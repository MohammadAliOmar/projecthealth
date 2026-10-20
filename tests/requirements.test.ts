/**
 * ProjectHealth AI: automated test suite (Vitest)
 *
 * Run with:  npm test
 *
 * 69 checks in 16 groups. FR-1 to NFR-3 are the original requirement checks;
 * "Review 1" to "Review 7" cover the defects found in the later code review.
 * Every check calls the application's own code. Network calls are replaced
 * with a mock, so the suite needs no internet connection, no Firebase project
 * and no Asana token.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AsanaApiError,
  calculateRealWorkloadShares,
  extractAsanaProjectId,
  fetchLiveAsanaProject,
  postMessageToAsanaProject,
  processRealAsanaData,
  syncStudentGroupFromAsana,
} from '../src/services/asanaService';
import type { AsanaProjectRaw, AsanaTaskRaw } from '../src/services/asanaService';
import { getRiskClassification } from '../src/mockData';
import { calculateOnTimeScore, computeHealthScore, computeTasksOnTimeScore } from '../src/engine/scoring';
import type { ScoringMetrics, StudentGroup } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a complete StudentGroup so each test only states what it changes. */
function makeGroup(overrides: Partial<StudentGroup> = {}): StudentGroup {
  return {
    id: 'grp-test-101',
    name: 'Real Asana Capstone',
    projectTitle: 'E-Commerce Microservices',
    courseCode: 'CS-490',
    courseName: 'Capstone Project',
    lastActivity: '3d ago',
    lastActivityTimestamp: new Date().toISOString(),
    teamLeader: 'Alice',
    repoUrl: 'https://app.asana.com/0/987654321/list',
    asanaWorkspace: 'Engineering',
    dataSource: 'live',
    lastSyncedAt: new Date().toISOString(),
    taskCompletionScore: 80,
    overdueTaskScore: 90,
    memberActivityScore: 85,
    workloadEquityScore: 80,
    communicationScore: 75,
    members: [
      {
        id: 'm1',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'Lead',
        avatarColor: 'bg-indigo-600',
        assignedTasks: 4,
        completedTasks: 3,
        commits: 10,
        prReviews: 4,
        messagesSent: 15,
        lastActive: 'Today',
        workloadSharePercent: 60,
        status: 'Balanced',
      },
      {
        id: 'm2',
        name: 'Bob',
        email: 'bob@example.com',
        role: 'Member',
        avatarColor: 'bg-emerald-600',
        assignedTasks: 3,
        completedTasks: 2,
        commits: 5,
        prReviews: 2,
        messagesSent: 8,
        lastActive: 'Yesterday',
        workloadSharePercent: 40,
        status: 'Balanced',
      },
    ],
    tasks: [],
    riskFactors: [],
    trends: { sevenDays: [], fourteenDays: [], thirtyDays: [] },
    ...overrides,
  };
}

/** A fetch replacement that answers every request with the given status and body. */
function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ===========================================================================
// PART 1: ORIGINAL REQUIREMENT CHECKS (FR-1 to NFR-3), 20 checks
// ===========================================================================

describe('FR-1 Authentication and tenant isolation (rules file)', () => {
  const rules = readFileSync(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8');

  it('FR-1: The owning lecturer is granted read, write and delete on their own group', () => {
    expect(rules).toMatch(
      /function ownsDoc\(\)\s*\{\s*return signedIn\(\) && resource\.data\.lecturerId == request\.auth\.uid;/,
    );
    expect(rules).toMatch(
      /function createsOwn\(\)\s*\{\s*return signedIn\(\) && request\.resource\.data\.lecturerId == request\.auth\.uid;/,
    );
    const groups = rules.slice(rules.indexOf('match /groups/{groupId}'), rules.indexOf('match /alerts/{alertId}'));
    expect(groups).toMatch(/allow read, delete: if ownsDoc\(\);/);
    expect(groups).toMatch(/allow create: if createsOwn\(\);/);
    expect(groups).toMatch(/allow update: if ownsDoc\(\) && lecturerUnchanged\(\);/);
  });

  it("FR-1: Another lecturer cannot read or change this group, its messages or its history", () => {
    expect(rules).toMatch(/match \/messages\/\{id\} \{ allow read, write: if ownsParent\(groupId\); \}/);
    expect(rules).toMatch(/match \/history\/\{id\} \{ allow read, write: if ownsParent\(groupId\); \}/);
    expect(rules).toMatch(
      /function ownsParent\(groupId\)\s*\{\s*return signedIn\(\) &&[\s\S]*?\.data\.lecturerId == request\.auth\.uid;/,
    );
    // No rule may be satisfied by being signed in alone.
    expect(rules).not.toMatch(/allow [^;]*if signedIn\(\);/);
  });
});

describe('FR-2 Asana ingestion and URL parsing', () => {
  const id = '1208934759238475';

  it('FR-2: Ingests raw numeric project IDs', () => {
    expect(extractAsanaProjectId(id)).toBe(id);
  });

  it('FR-2: Ingests grp-prefixed project identifiers', () => {
    expect(extractAsanaProjectId(`grp-${id}`)).toBe(id);
  });

  it('FR-2: Ingests standard Asana browser URLs', () => {
    expect(extractAsanaProjectId(`https://app.asana.com/0/${id}/list`)).toBe(id);
  });
});

describe('FR-3 Multi-factor scoring (weights 30/25/20/15/10)', () => {
  it('FR-3: computeHealthScore(25, 44, 61, 44.4, 0) returns 37', () => {
    // 7.5 + 11.0 + 12.2 + 6.66 + 0 = 37.36, rounded to 37
    expect(computeHealthScore(25, 44, 61, 44.4, 0)).toBe(37);
  });

  it('FR-3: Multi-factor weighted formula produces an accurate 65/100 score', () => {
    // 70*0.30 + 60*0.25 + 60*0.20 + 80*0.15 + 50*0.10 = 21 + 15 + 12 + 12 + 5 = 65
    const metrics = {
      taskCompletionScore: 70,
      overdueTaskScore: 60,
      memberActivityScore: 60,
      workloadEquityScore: 80,
      communicationScore: 50,
    } as ScoringMetrics;
    expect(computeHealthScore(metrics)).toBe(65);
  });
});

describe('FR-4 Risk classification (70 and 40 thresholds)', () => {
  it('FR-4: Score 85 classifies as Low Risk (>= 70)', () => {
    expect(getRiskClassification(85)).toBe('Low');
  });

  it('FR-4: Score 55 classifies as Medium Risk (40 - 69)', () => {
    expect(getRiskClassification(55)).toBe('Medium');
  });

  it('FR-4: Score 25 classifies as High Risk (< 40)', () => {
    expect(getRiskClassification(25)).toBe('High');
  });
});

describe('FR-5 Member sync and workload equity (shares total 100)', () => {
  const result = calculateRealWorkloadShares([
    { name: 'Alice', completedTasks: 7 },
    { name: 'Bob', completedTasks: 4 },
    { name: 'Charlie', completedTasks: 3 },
  ]);

  it('FR-5: Member workload shares sum to exactly 100%', () => {
    expect(result.shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('FR-5: Largest-remainder rounding divides integer shares [50, 29, 21]', () => {
    expect(result.shares).toEqual([50, 29, 21]);
  });
});

describe('FR-6 Communication audit and invariance (mocked Asana)', () => {
  const project: AsanaProjectRaw = {
    gid: 'proj-comm',
    name: 'Team Horizon',
    members: [
      { gid: 'u1', name: 'Student One', email: 'one@example.com' },
      { gid: 'u2', name: 'Student Two', email: 'two@example.com' },
    ],
  };
  const studentTasks: AsanaTaskRaw[] = [
    { gid: 't1', name: 'Design the schema', completed: true, assignee: { gid: 'u1', name: 'Student One' } },
    { gid: 't2', name: 'Build the API', completed: false, assignee: { gid: 'u2', name: 'Student Two' } },
  ];
  const advisoryTasks: AsanaTaskRaw[] = [
    {
      gid: 'asana-task-8899',
      name: '[ProjectHealth AI] Lecturer advisory: Sprint Milestone Check',
      completed: false,
      assignee: { gid: 'u1', name: 'Student One' },
    },
    {
      gid: 'adv-2',
      name: '[ProjectHealth AI] Lecturer advisory: Second reminder',
      completed: false,
      assignee: { gid: 'u2', name: 'Student Two' },
    },
  ];

  it('FR-6: Sending a lecturer advisory message does NOT alter the team communication score', () => {
    const before = processRealAsanaData(project, studentTasks);
    const after = processRealAsanaData(project, [...studentTasks, ...advisoryTasks], {
      advisoryTaskGids: ['asana-task-8899'],
    });
    expect(after.metrics.communicationScore).toBe(before.metrics.communicationScore);
    expect(after.metrics.healthScore).toBe(before.metrics.healthScore);
    expect(after.metrics.totalTasks).toBe(before.metrics.totalTasks);
  });

  it('FR-6: Advisory message record keeps the Asana task gid for the audit trail', async () => {
    const fetchMock = mockFetch(201, { data: { gid: 'asana-task-8899' } });
    const result = await postMessageToAsanaProject(
      'https://app.asana.com/0/11223344/list',
      'test-token',
      'Sprint Milestone Check',
      'Please ensure your API integration milestone is addressed.',
      'Team Horizon',
    );
    expect(result.success).toBe(true);
    expect(result.taskGid).toBe('asana-task-8899');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const posted = JSON.parse(String(init.body)).data;
    expect(posted.name.startsWith('[ProjectHealth AI] Lecturer advisory:')).toBe(true);
    expect(posted.due_on).toBeUndefined();
  });
});

describe('NFR-1 Performance and low latency', () => {
  it('NFR-1: 500 health calculations complete in under 100 ms', () => {
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      computeHealthScore(50 + (i % 40), 60 + (i % 30), 40 + (i % 50), 70 + (i % 20), 30 + (i % 60));
    }
    expect(performance.now() - start).toBeLessThan(100);
  });
});

describe('NFR-2 Resilience and edge-case stability', () => {
  it('NFR-2: Gracefully handles an empty member list without throwing', () => {
    expect(() => calculateRealWorkloadShares([])).not.toThrow();
    expect(calculateRealWorkloadShares([]).shares).toHaveLength(0);
  });

  it('NFR-2: An empty group defaults to a safe equity baseline of 50', () => {
    expect(calculateRealWorkloadShares([]).workloadEquityFactor).toBe(50);
  });

  it('NFR-2: Zero metrics evaluate to a score of 0 with no NaN or overflow', () => {
    expect(computeHealthScore(0, 0, 0, 0, 0)).toBe(0);
  });
});

describe('NFR-3 Data integrity (simulated sync, no network)', () => {
  const group = makeGroup({ dataSource: 'simulated', id: 'grp-integrity-1' });
  const synced = () => syncStudentGroupFromAsana(group);

  it('NFR-3: A synced group keeps strict dataSource typing', async () => {
    const result = await synced();
    expect(result.dataSource).toBe('simulated');
    expect(['live', 'simulated']).toContain(result.dataSource);
  });

  it('NFR-3: All five factor scores and the health score stay finite numbers from 0 to 100', async () => {
    const result = await synced();
    const scores = [
      result.taskCompletionScore,
      result.overdueTaskScore,
      result.memberActivityScore,
      result.workloadEquityScore,
      result.communicationScore,
      result.healthScore as number,
    ];
    for (const s of scores) {
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ===========================================================================
// PART 2: REVIEW SUITES, 49 checks
// ===========================================================================

describe('Review 1 Asana URL and ID parsing', () => {
  it('New-format URL (asana.com/1/{workspaceId}/project/{projectId}/...) returns the project ID', () => {
    expect(extractAsanaProjectId('https://app.asana.com/1/1208934759238475/project/987654321/list')).toBe('987654321');
  });

  it('New-format URL with the board tab returns the project ID', () => {
    expect(extractAsanaProjectId('https://app.asana.com/1/1208934759238475/project/1122334455/board')).toBe('1122334455');
  });

  it('Older-format URL (asana.com/0/{projectId}/...) returns the project ID', () => {
    expect(extractAsanaProjectId('https://app.asana.com/0/987654321/list')).toBe('987654321');
  });

  it('Plain digits return the project ID', () => {
    expect(extractAsanaProjectId('987654321')).toBe('987654321');
  });

  it('A grp- prefixed string returns the project ID', () => {
    expect(extractAsanaProjectId('grp-987654321')).toBe('987654321');
  });

  it('A portfolio URL returns the project ID', () => {
    expect(extractAsanaProjectId('https://app.asana.com/0/portfolio/11992288/list/project/554433221')).toBe('554433221');
  });

  it('An empty string returns an empty string', () => {
    expect(extractAsanaProjectId('')).toBe('');
  });

  it('Whitespace-only input returns an empty string', () => {
    expect(extractAsanaProjectId('   ')).toBe('');
  });

  it('Invalid input with no Asana project ID returns an empty string', () => {
    expect(extractAsanaProjectId('https://not-asana.example.com/random/path')).toBe('');
  });
});

describe('Review 2 Real workload shares and equity calculation', () => {
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

  describe('lopsided team (8, 1, 1 completed tasks)', () => {
    const r = calculateRealWorkloadShares([
      { name: 'Alice', completedTasks: 8 },
      { name: 'Bob', completedTasks: 1 },
      { name: 'Charlie', completedTasks: 1 },
    ]);
    it('Lopsided team shares sum to exactly 100', () => {
      expect(sum(r.shares)).toBe(100);
    });
    it('Lopsided team keeps its real distribution [80, 10, 10]', () => {
      expect(r.shares).toEqual([80, 10, 10]);
    });
    it('Lopsided maxShareFraction is 0.8', () => {
      expect(r.maxShareFraction).toBe(0.8);
    });
  });

  describe('one-member team', () => {
    const r = calculateRealWorkloadShares([{ name: 'Solo Student', completedTasks: 5 }]);
    it('A one-member team receives exactly 100% share', () => {
      expect(r.shares).toEqual([100]);
    });
    it('A one-member team has a workload equity factor of 100', () => {
      expect(r.workloadEquityFactor).toBe(100);
    });
  });

  describe('no completed tasks, assigned tasks 3 and 1', () => {
    const r = calculateRealWorkloadShares([
      { name: 'Alice', completedTasks: 0, assignedTasks: 3 },
      { name: 'Bob', completedTasks: 0, assignedTasks: 1 },
    ]);
    it('Zero completed tasks with assigned tasks sums to exactly 100', () => {
      expect(sum(r.shares)).toBe(100);
    });
    it('Zero completed tasks falls back to assigned-task shares [75, 25]', () => {
      expect(r.shares).toEqual([75, 25]);
    });
    it('Zero completed tasks gives a workload equity factor of 50', () => {
      expect(r.workloadEquityFactor).toBe(50);
    });
  });

  describe('no completed and no assigned tasks (three students)', () => {
    const r = calculateRealWorkloadShares([
      { name: 'Student 1', completedTasks: 0, assignedTasks: 0 },
      { name: 'Student 2', completedTasks: 0, assignedTasks: 0 },
      { name: 'Student 3', completedTasks: 0, assignedTasks: 0 },
    ]);
    it('Zero completed and zero assigned tasks sums to exactly 100', () => {
      expect(sum(r.shares)).toBe(100);
    });
    it('Largest-remainder rounding splits [34, 33, 33] for 3 members', () => {
      expect(r.shares).toEqual([34, 33, 33]);
    });
    it('Zero completed and zero assigned tasks gives a workload equity factor of 50', () => {
      expect(r.workloadEquityFactor).toBe(50);
    });
  });

  describe('ties', () => {
    const three = calculateRealWorkloadShares([
      { name: 'Alice', completedTasks: 1 },
      { name: 'Bob', completedTasks: 1 },
      { name: 'Charlie', completedTasks: 1 },
    ]);
    const four = calculateRealWorkloadShares([
      { name: 'P1', completedTasks: 2 },
      { name: 'P2', completedTasks: 2 },
      { name: 'P3', completedTasks: 2 },
      { name: 'P4', completedTasks: 2 },
    ]);
    it('A 3-way tie sums to exactly 100', () => {
      expect(sum(three.shares)).toBe(100);
    });
    it('A 3-way tie rounds by largest remainder to [34, 33, 33]', () => {
      expect(three.shares).toEqual([34, 33, 33]);
    });
    it('A 4-way tie divides equally [25, 25, 25, 25] and sums to 100', () => {
      expect(four.shares).toEqual([25, 25, 25, 25]);
      expect(sum(four.shares)).toBe(100);
    });
    it('A balanced 4-way split has a workload equity factor of 100', () => {
      expect(four.workloadEquityFactor).toBe(100);
    });
  });
});

describe('Review 3 Advisory task exclusion from scoring', () => {
  const project: AsanaProjectRaw = {
    gid: 'proj-101',
    name: 'Capstone Delta',
    members: [
      { gid: 'u1', name: 'Student One', email: 'one@example.com' },
      { gid: 'u2', name: 'Student Two', email: 'two@example.com' },
    ],
  };
  const pastDue = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const tasks: AsanaTaskRaw[] = [
    { gid: 't1', name: 'Setup database schema', completed: true, assignee: { gid: 'u1', name: 'Student One' } },
    { gid: 't2', name: 'Implement REST API', completed: true, assignee: { gid: 'u2', name: 'Student Two' } },
    { gid: 't3', name: 'Frontend integration', completed: false, due_on: pastDue, assignee: { gid: 'u1', name: 'Student One' } },
    { gid: 't4', name: 'User test interviews', completed: false, due_on: pastDue, assignee: { gid: 'u2', name: 'Student Two' } },
    // advisory task found by its stored gid, overdue in Asana
    { gid: 'adv-001', name: 'Advisory: Milestone warning', completed: false, due_on: pastDue, assignee: { gid: 'u1', name: 'Student One' } },
    // advisory task found by its name prefix
    {
      gid: 'adv-002',
      name: '[ProjectHealth AI] Lecturer advisory: Sprint intervention check-in',
      completed: false,
      assignee: { gid: 'u2', name: 'Student Two' },
    },
    // task written by the lecturer
    {
      gid: 'adv-003',
      name: 'Lecturer notice: meeting schedule',
      completed: false,
      created_by: { gid: 'lecturer-gid-999', name: 'Prof. Davis' },
      assignee: { gid: 'lecturer-gid-999', name: 'Prof. Davis' },
    },
  ];
  const data = processRealAsanaData(project, tasks, {
    advisoryTaskGids: ['adv-001'],
    lecturerAsanaGid: 'lecturer-gid-999',
    lecturerName: 'Prof. Davis',
  });
  const active = data.members.filter((m) => m.status !== 'Left project');

  it('Total tasks excludes all 3 advisory and lecturer tasks (4 tasks remain)', () => {
    expect(data.metrics.totalTasks).toBe(4);
  });
  it('Completed tasks count is 2 of 4', () => {
    expect(data.metrics.completedTasks).toBe(2);
  });
  it('Overdue tasks count is 2 (the overdue advisory task is excluded)', () => {
    expect(data.metrics.overdueTasks).toBe(2);
  });
  it('Task completion score is exactly 50', () => {
    expect(data.metrics.taskCompletionScore).toBe(50);
  });
  it('Two student members are mapped in the roster', () => {
    expect(active).toHaveLength(2);
  });
  it('Member workload shares total exactly 100%', () => {
    expect(active.reduce((acc, m) => acc + m.workloadSharePercent, 0)).toBe(100);
  });
});

describe('Review 4 No silent fallback to simulated data', () => {
  it('fetchLiveAsanaProject throws when the token is missing', async () => {
    await expect(fetchLiveAsanaProject('987654321', '')).rejects.toBeInstanceOf(AsanaApiError);
  });

  it('The error message is exactly "Asana token rejected"', async () => {
    await expect(fetchLiveAsanaProject('987654321', '')).rejects.toThrow('Asana token rejected');
  });

  it('A failed live sync (Asana answers 401) raises an AsanaApiError', async () => {
    mockFetch(401, { errors: [{ message: 'Not Authorized' }] });
    await expect(syncStudentGroupFromAsana(makeGroup(), 'invalid-token-xyz')).rejects.toBeInstanceOf(AsanaApiError);
  });

  it('syncStudentGroupFromAsana does NOT fall back to simulated data on a failed live fetch', async () => {
    mockFetch(401, { errors: [{ message: 'Not Authorized' }] });
    let result: StudentGroup | undefined;
    try {
      result = await syncStudentGroupFromAsana(makeGroup(), 'invalid-token-xyz');
    } catch {
      // expected: the sync stops with an error
    }
    expect(result).toBeUndefined();
  });
});

describe('Review 5 Risk-band boundaries', () => {
  it('Score 39 classifies as High Risk (< 40)', () => {
    expect(getRiskClassification(39)).toBe('High');
  });
  it('Score 40 classifies as Medium Risk (40 - 69)', () => {
    expect(getRiskClassification(40)).toBe('Medium');
  });
  it('Score 69 classifies as Medium Risk (40 - 69)', () => {
    expect(getRiskClassification(69)).toBe('Medium');
  });
  it('Score 70 classifies as Low Risk (70 - 100)', () => {
    expect(getRiskClassification(70)).toBe('Low');
  });
  it('Score 0 classifies as High Risk', () => {
    expect(getRiskClassification(0)).toBe('High');
  });
  it('Score 100 classifies as Low Risk', () => {
    expect(getRiskClassification(100)).toBe('Low');
  });
});

describe('Review 6 One shared overdue formula: max(0, 100 - 20N - 2D)', () => {
  it('2 overdue tasks (4 and 3 days late) score 46', () => {
    expect(calculateOnTimeScore(2, 7)).toBe(46);
  });
  it('0 overdue tasks score 100', () => {
    expect(calculateOnTimeScore(0, 0)).toBe(100);
  });
  it('Heavy lateness clamps at 0', () => {
    expect(calculateOnTimeScore(10, 150)).toBe(0);
  });

  describe('advisory and lecturer tasks are ignored', () => {
    const refDate = new Date('2026-10-08T12:00:00Z');
    const evaluated = computeTasksOnTimeScore(
      [
        { title: 'Regular Task 1', dueDate: '2026-10-04T12:00:00Z', status: 'Overdue' }, // 4 days late
        { title: 'Regular Task 2', dueDate: '2026-10-05T12:00:00Z', status: 'Overdue' }, // 3 days late
        { title: '[ProjectHealth AI] Lecturer advisory: Sprint review', dueDate: '2026-10-01T12:00:00Z', status: 'Overdue', isAdvisory: true },
        { title: 'Lecturer task', dueDate: '2026-10-02T12:00:00Z', status: 'Overdue', isLecturerAuthored: true },
      ],
      refDate,
    );
    it('overdueCount is 2', () => {
      expect(evaluated.overdueCount).toBe(2);
    });
    it('sumDaysOverdue is 7', () => {
      expect(evaluated.sumDaysOverdue).toBe(7);
    });
    it('The on-time score is 46', () => {
      expect(evaluated.score).toBe(46);
    });
  });
});

describe('Review 7 Live-data protection', () => {
  const live = makeGroup({
    id: 'grp-live-real',
    name: 'Real Live Project',
    asanaWorkspace: '1219253588419555',
    taskCompletionScore: 85,
    members: [makeGroup().members[0]],
  });

  it('Syncing a live project with no token throws an error', async () => {
    await expect(syncStudentGroupFromAsana(live, '')).rejects.toBeInstanceOf(AsanaApiError);
  });

  it('The error says "Paste your Asana token to sync this project."', async () => {
    await expect(syncStudentGroupFromAsana(live, '')).rejects.toThrow('Paste your Asana token to sync this project.');
  });

  it('The live project keeps its original data and is not replaced by simulated data', async () => {
    await syncStudentGroupFromAsana(live, '').catch(() => undefined);
    expect(live.dataSource).toBe('live');
    expect(live.taskCompletionScore).toBe(85);
    expect(live.members).toHaveLength(1);
  });
});
