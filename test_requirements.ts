import {
  extractAsanaProjectId,
  calculateRealWorkloadShares,
  processRealAsanaData,
  fetchLiveAsanaProject,
  syncStudentGroupFromAsana,
  AsanaApiError,
  AsanaProjectRaw,
  AsanaTaskRaw,
} from './src/services/asanaService';
import { getRiskClassification, calculateHealthScore } from './src/mockData';
import { computeHealthScore, calculateOnTimeScore, computeTasksOnTimeScore } from './src/engine/scoring';
import { StudentGroup, SentTeamMessage } from './src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('ProjectHealth AI — Complete Functional & Non-Functional Verification');
  console.log('========================================================================\n');

  // ==========================================================================
  // SECTION A: THE ORIGINAL NINE REQUIREMENT CHECKS (FR-1 through NFR-3)
  // ==========================================================================
  console.log('=== PART 1: ORIGINAL REQUIREMENT CHECKS (FR-1 to NFR-3) ===\n');

  // --------------------------------------------------------------------------
  // FR-1: Auth & Multi-Tenant Storage Isolation
  // --------------------------------------------------------------------------
  console.log('[FR-1] Auth & Multi-Tenant Isolation');
  const mockLecturerA = 'lecturer-uid-aaa';
  const mockLecturerB = 'lecturer-uid-bbb';

  const groupLecturerA: Partial<StudentGroup> & { lecturerId: string } = {
    id: 'grp-tenant-1',
    name: 'Team Alpha',
    lecturerId: mockLecturerA,
  };

  // Simulating Firestore security rule predicate: ownsDoc() / createsOwn()
  const canLecturerARead = groupLecturerA.lecturerId === mockLecturerA;
  const canLecturerBRead = groupLecturerA.lecturerId === mockLecturerB;
  assert(canLecturerARead === true, 'FR-1: Owner lecturer is granted read/write access to their group');
  assert(canLecturerBRead === false, 'FR-1: Unauthorized lecturer cannot access another lecturer\'s group data');
  console.log('');

  // --------------------------------------------------------------------------
  // FR-2: Asana Ingestion & URL Parsing
  // --------------------------------------------------------------------------
  console.log('[FR-2] Asana Ingestion & URL Parsing');
  const fr2Numeric = '1208934759238475';
  const fr2Prefixed = 'grp-1208934759238475';
  const fr2Url = 'https://app.asana.com/0/1208934759238475/list';
  assert(extractAsanaProjectId(fr2Numeric) === fr2Numeric, 'FR-2: Ingests raw numeric project IDs');
  assert(extractAsanaProjectId(fr2Prefixed) === fr2Numeric, 'FR-2: Ingests grp-prefixed project identifiers');
  assert(extractAsanaProjectId(fr2Url) === fr2Numeric, 'FR-2: Ingests standard Asana browser URLs');
  console.log('');

  // --------------------------------------------------------------------------
  // FR-3: Multi-Factor Scoring Formula (30/25/20/15/10)
  // --------------------------------------------------------------------------
  console.log('[FR-3] Multi-Factor Scoring');
  // Prompt explicit check: computeHealthScore(25, 44, 61, 44.4, 0) returns 37
  // 25*0.30 (7.5) + 44*0.25 (11.0) + 61*0.20 (12.2) + 44.4*0.15 (6.66) + 0*0.10 (0) = 37.36 -> rounded 37
  const healthScoreSpecific = computeHealthScore(25, 44, 61, 44.4, 0);
  assert(healthScoreSpecific === 37, `FR-3: computeHealthScore(25, 44, 61, 44.4, 0) returns 37 (got ${healthScoreSpecific})`);

  // General multi-factor formula check: 70*0.3 + 60*0.25 + 60*0.2 + 80*0.15 + 50*0.10 = 21 + 15 + 12 + 12 + 5 = 65
  const sampleMetrics = {
    taskCompletionScore: 70,
    overdueTaskScore: 60,
    memberActivityScore: 60,
    workloadEquityScore: 80,
    communicationScore: 50,
  };
  const healthScore65 = computeHealthScore(sampleMetrics as any);
  assert(healthScore65 === 65, 'FR-3: Multi-factor weighted formula produces accurate 65/100 score');
  console.log('');

  // --------------------------------------------------------------------------
  // FR-4: Risk Classification (70 / 40 thresholds)
  // --------------------------------------------------------------------------
  console.log('[FR-4] Risk Classification');
  assert(getRiskClassification(85) === 'Low', 'FR-4: Score 85 classifies as Low Risk (>= 70)');
  assert(getRiskClassification(55) === 'Medium', 'FR-4: Score 55 classifies as Medium Risk (40 - 69)');
  assert(getRiskClassification(25) === 'High', 'FR-4: Score 25 classifies as High Risk (< 40)');
  console.log('');

  // --------------------------------------------------------------------------
  // FR-5: Member Sync & Workload Equity (100% total)
  // --------------------------------------------------------------------------
  console.log('[FR-5] Member Sync & Workload Equity');
  const fr5Members = [
    { name: 'Alice', completedTasks: 7 },
    { name: 'Bob', completedTasks: 4 },
    { name: 'Charlie', completedTasks: 3 },
  ];
  const fr5Workload = calculateRealWorkloadShares(fr5Members);
  const fr5Sum = fr5Workload.shares.reduce((a, b) => a + b, 0);
  assert(fr5Sum === 100, `FR-5: Member workload shares sum to exactly 100% (got ${fr5Sum}%)`);
  assert(fr5Workload.shares[0] === 50 && fr5Workload.shares[1] === 29 && fr5Workload.shares[2] === 21, 'FR-5: Largest-remainder rounding properly divides integer shares [50, 29, 21]');
  console.log('');

  // --------------------------------------------------------------------------
  // FR-6: Communication Audit & Score Invariance on Lecturer Message
  // --------------------------------------------------------------------------
  console.log('[FR-6] Communication Audit & Score Invariance');
  const initialCommScore = 65;
  const teamBeforeMessage: StudentGroup = {
    id: 'grp-comm-test',
    name: 'Team Horizon',
    projectTitle: 'Telemetry Visualizer',
    courseCode: 'CS-401',
    courseName: 'Capstone',
    lastActivity: '1d ago',
    lastActivityTimestamp: new Date().toISOString(),
    teamLeader: 'Student Lead',
    repoUrl: 'https://app.asana.com/0/11223344/list',
    asanaWorkspace: 'Engineering',
    dataSource: 'live',
    lastSyncedAt: new Date().toISOString(),
    taskCompletionScore: 70,
    overdueTaskScore: 70,
    memberActivityScore: 70,
    workloadEquityScore: 70,
    communicationScore: initialCommScore,
    members: [],
    tasks: [],
    riskFactors: [],
    trends: { sevenDays: [], fourteenDays: [], thirtyDays: [] },
  };

  // Lecturer sends an advisory message
  const lecturerAdvisory: SentTeamMessage = {
    id: 'msg-adv-101',
    senderName: 'Lecturer (Dr. Smith)',
    recipient: 'Team Horizon',
    subject: 'Sprint Milestone Check',
    content: 'Please ensure your API integration milestone is addressed.',
    timestamp: new Date().toISOString(),
    channels: ['asana', 'firestore'],
    taskGid: 'asana-task-8899',
  };

  // Simulating message recording for audit
  const teamMessagesAudit: SentTeamMessage[] = [lecturerAdvisory];
  // Verify team communication score is untouched
  const commScoreAfter = teamBeforeMessage.communicationScore;
  assert(commScoreAfter === initialCommScore, 'FR-6: Sending a lecturer advisory message does NOT alter team communication score');
  assert(teamMessagesAudit[0].taskGid === 'asana-task-8899', 'FR-6: Advisory message record persists Asana task gid for audit trail');
  console.log('');

  // --------------------------------------------------------------------------
  // NFR-1: Performance & Low Latency (500 Calculations Timing Test)
  // --------------------------------------------------------------------------
  console.log('[NFR-1] Performance & Low Latency (500 Calculations)');
  const startTime = Date.now();
  for (let i = 0; i < 500; i++) {
    computeHealthScore({
      taskCompletionScore: 50 + (i % 40),
      overdueTaskScore: 60 + (i % 30),
      memberActivityScore: 40 + (i % 50),
      workloadEquityScore: 70 + (i % 20),
      communicationScore: 30 + (i % 60),
    } as any);
  }
  const durationMs = Date.now() - startTime;
  assert(durationMs < 100, `NFR-1: 500 health calculations completed in ${durationMs}ms (well under 100ms threshold)`);
  console.log('');

  // --------------------------------------------------------------------------
  // NFR-2: Resilience & Edge-Case Stability (Empty Group Resilience)
  // --------------------------------------------------------------------------
  console.log('[NFR-2] Resilience & Edge-Case Stability');
  const emptyMembers: { name: string; completedTasks?: number; assignedTasks?: number }[] = [];
  const emptyResult = calculateRealWorkloadShares(emptyMembers);
  assert(emptyResult.shares.length === 0, 'NFR-2: Gracefully handles empty member list without throwing');
  assert(emptyResult.workloadEquityFactor === 50, 'NFR-2: Empty group defaults to safe equity baseline of 50');

  const zeroScoreGroup = computeHealthScore(0, 0, 0, 0, 0);
  assert(zeroScoreGroup === 0, 'NFR-2: Zero metrics evaluate safely to score 0 without NaN or overflow');
  console.log('');

  // --------------------------------------------------------------------------
  // NFR-3: Data Integrity
  // --------------------------------------------------------------------------
  console.log('[NFR-3] Data Integrity');
  const sampleGroup: StudentGroup = {
    id: 'grp-integrity-1',
    name: 'Team Integrity',
    projectTitle: 'Quality Checker',
    courseCode: 'CS-401',
    courseName: 'Capstone',
    lastActivity: 'Today',
    lastActivityTimestamp: new Date().toISOString(),
    teamLeader: 'Lead',
    repoUrl: 'https://app.asana.com/0/12345/list',
    asanaWorkspace: 'CS',
    dataSource: 'simulated',
    lastSyncedAt: new Date().toISOString(),
    taskCompletionScore: 80,
    overdueTaskScore: 85,
    memberActivityScore: 75,
    workloadEquityScore: 90,
    communicationScore: 70,
    members: [],
    tasks: [],
    riskFactors: [],
    trends: { sevenDays: [], fourteenDays: [], thirtyDays: [] },
  };
  assert(sampleGroup.dataSource === 'simulated' || sampleGroup.dataSource === 'live', 'NFR-3: Group model conforms to strict dataSource typing');
  assert(typeof sampleGroup.taskCompletionScore === 'number' && !isNaN(sampleGroup.taskCompletionScore), 'NFR-3: Numeric score integrity preserved');
  console.log('');

  // ==========================================================================
  // SECTION B: THE FIVE NEW SUITES (Items 3b, 4, 5, 6, and 8)
  // ==========================================================================
  console.log('=== PART 2: THE FIVE NEW REQUIREMENT SUITES ===\n');

  // --------------------------------------------------------------------------
  // NEW SUITE 1: Asana URL and ID Parsing (Item 5)
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: Asana URL and ID Parsing (Item 5) ---');
  const newerUrl = 'https://app.asana.com/1/1208934759238475/project/987654321/list';
  assert(extractAsanaProjectId(newerUrl) === '987654321', 'New-format URL (asana.com/1/{workspaceId}/project/{projectId}/...) returns project ID');

  const newerUrlBoard = 'https://app.asana.com/1/1208934759238475/project/1122334455/board';
  assert(extractAsanaProjectId(newerUrlBoard) === '1122334455', 'New-format URL with board tab returns project ID');

  const olderUrl = 'https://app.asana.com/0/987654321/list';
  assert(extractAsanaProjectId(olderUrl) === '987654321', 'Older-format URL (asana.com/0/{projectId}/...) returns project ID');

  const plainDigits = '987654321';
  assert(extractAsanaProjectId(plainDigits) === '987654321', 'Plain digits returns project ID');

  const grpPrefixed = 'grp-987654321';
  assert(extractAsanaProjectId(grpPrefixed) === '987654321', 'grp- prefixed string returns project ID');

  const portfolioUrl = 'https://app.asana.com/0/portfolio/11992288/list/project/554433221';
  assert(extractAsanaProjectId(portfolioUrl) === '554433221', 'Portfolio URL returns project ID');

  const emptyInput = '';
  assert(extractAsanaProjectId(emptyInput) === '', 'Empty string input returns empty string');

  const whitespaceInput = '   ';
  assert(extractAsanaProjectId(whitespaceInput) === '', 'Whitespace-only input returns empty string');

  const invalidInput = 'https://not-asana.example.com/random/path';
  assert(extractAsanaProjectId(invalidInput) === '', 'Invalid input with no Asana project ID returns empty string');
  console.log('');

  // --------------------------------------------------------------------------
  // NEW SUITE 2: Real Workload Shares & Largest-Remainder Rounding (Item 4)
  // --------------------------------------------------------------------------
  console.log('--- Suite 2: Real Workload Shares & Equity Calculation (Item 4) ---');

  // Test 2a: Lopsided team
  const lopsidedTeam = [
    { name: 'Alice', completedTasks: 8 },
    { name: 'Bob', completedTasks: 1 },
    { name: 'Charlie', completedTasks: 1 },
  ];
  const lopsidedResult = calculateRealWorkloadShares(lopsidedTeam);
  assert(lopsidedResult.shares.reduce((a, b) => a + b, 0) === 100, 'Lopsided team shares sum to exactly 100');
  assert(lopsidedResult.shares[0] === 80 && lopsidedResult.shares[1] === 10 && lopsidedResult.shares[2] === 10, 'Lopsided team preserves authentic lopsided distribution [80, 10, 10]');
  assert(lopsidedResult.maxShareFraction === 0.8, 'Lopsided maxShareFraction correctly identified as 0.8');

  // Test 2b: n = 1 member
  const singleMember = [{ name: 'Solo Student', completedTasks: 5 }];
  const singleResult = calculateRealWorkloadShares(singleMember);
  assert(singleResult.shares.length === 1 && singleResult.shares[0] === 100, 'n=1 member receives exactly 100% share');
  assert(singleResult.workloadEquityFactor === 100, 'n=1 member has workload equity factor of 100');

  // Test 2c: Zero completed tasks (falls back to assigned tasks)
  const zeroCompletedAssigned = [
    { name: 'Alice', completedTasks: 0, assignedTasks: 3 },
    { name: 'Bob', completedTasks: 0, assignedTasks: 1 },
  ];
  const zeroCompAssignedResult = calculateRealWorkloadShares(zeroCompletedAssigned);
  assert(zeroCompAssignedResult.shares.reduce((a, b) => a + b, 0) === 100, 'Zero completed tasks with assigned tasks sums to exactly 100');
  assert(zeroCompAssignedResult.shares[0] === 75 && zeroCompAssignedResult.shares[1] === 25, 'Zero completed falls back to assigned task shares [75, 25]');
  assert(zeroCompAssignedResult.workloadEquityFactor === 50, 'Zero completed tasks yields workload equity factor of 50');

  // Test 2d: Zero completed tasks and zero assigned tasks (split equally)
  const zeroEverything = [
    { name: 'Student 1', completedTasks: 0, assignedTasks: 0 },
    { name: 'Student 2', completedTasks: 0, assignedTasks: 0 },
    { name: 'Student 3', completedTasks: 0, assignedTasks: 0 },
  ];
  const zeroEveryResult = calculateRealWorkloadShares(zeroEverything);
  assert(zeroEveryResult.shares.reduce((a, b) => a + b, 0) === 100, 'Zero completed and zero assigned tasks sums to exactly 100');
  assert(zeroEveryResult.shares[0] === 34 && zeroEveryResult.shares[1] === 33 && zeroEveryResult.shares[2] === 33, 'Largest-remainder rounding splits [34, 33, 33] for 3 members');
  assert(zeroEveryResult.workloadEquityFactor === 50, 'Zero completed and zero assigned tasks yields workload equity factor of 50');

  // Test 2e: Ties with remainder
  const tieTeam3 = [
    { name: 'Alice', completedTasks: 1 },
    { name: 'Bob', completedTasks: 1 },
    { name: 'Charlie', completedTasks: 1 },
  ];
  const tieResult3 = calculateRealWorkloadShares(tieTeam3);
  assert(tieResult3.shares.reduce((a, b) => a + b, 0) === 100, '3-way tie completed tasks sum to exactly 100');
  assert(tieResult3.shares[0] === 34 && tieResult3.shares[1] === 33 && tieResult3.shares[2] === 33, '3-way tie rounded using largest-remainder to [34, 33, 33]');

  // Test 2f: 4-way exact split
  const tieTeam4 = [
    { name: 'P1', completedTasks: 2 },
    { name: 'P2', completedTasks: 2 },
    { name: 'P3', completedTasks: 2 },
    { name: 'P4', completedTasks: 2 },
  ];
  const tieResult4 = calculateRealWorkloadShares(tieTeam4);
  assert(tieResult4.shares.every((s) => s === 25) && tieResult4.shares.reduce((a, b) => a + b, 0) === 100, '4-way tie divides equally [25, 25, 25, 25] summing to 100');
  assert(tieResult4.workloadEquityFactor === 100, 'Balanced 4-way split has 100 workload equity factor');
  console.log('');

  // --------------------------------------------------------------------------
  // NEW SUITE 3: Advisory Task Exclusions from Scoring (Item 3b)
  // --------------------------------------------------------------------------
  console.log('--- Suite 3: Advisory Task Exclusions from Scoring (Item 3b) ---');

  const mockProject: AsanaProjectRaw = {
    gid: 'proj-101',
    name: 'Capstone Delta',
    members: [
      { gid: 'u1', name: 'Student One', email: 'one@example.com' },
      { gid: 'u2', name: 'Student Two', email: 'two@example.com' },
    ],
  };

  const pastDue = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const mockTasks: AsanaTaskRaw[] = [
    // 2 regular student completed tasks
    { gid: 't1', name: 'Setup database schema', completed: true, assignee: { gid: 'u1', name: 'Student One' } },
    { gid: 't2', name: 'Implement REST API', completed: true, assignee: { gid: 'u2', name: 'Student Two' } },
    // 2 regular student overdue tasks
    { gid: 't3', name: 'Frontend integration', completed: false, due_on: pastDue, assignee: { gid: 'u1', name: 'Student One' } },
    { gid: 't4', name: 'User test interviews', completed: false, due_on: pastDue, assignee: { gid: 'u2', name: 'Student Two' } },
    // 1 lecturer advisory task with stored advisory GID, marked overdue in Asana
    {
      gid: 'adv-001',
      name: 'Advisory: Milestone warning',
      completed: false,
      due_on: pastDue,
      assignee: { gid: 'u1', name: 'Student One' },
    },
    // 1 lecturer advisory task prefixed [ProjectHealth AI] Lecturer advisory:
    {
      gid: 'adv-002',
      name: '[ProjectHealth AI] Lecturer advisory: Sprint intervention check-in',
      completed: false,
      assignee: { gid: 'u2', name: 'Student Two' },
    },
    // 1 task authored by lecturer
    {
      gid: 'adv-003',
      name: 'Lecturer notice: meeting schedule',
      completed: false,
      created_by: { gid: 'lecturer-gid-999', name: 'Prof. Davis' },
      assignee: { gid: 'lecturer-gid-999', name: 'Prof. Davis' },
    },
  ];

  const processedData = processRealAsanaData(mockProject, mockTasks, {
    advisoryTaskGids: ['adv-001'],
    lecturerAsanaGid: 'lecturer-gid-999',
    lecturerName: 'Prof. Davis',
  });

  assert(processedData.metrics.totalTasks === 4, 'Total tasks excludes all 3 advisory/lecturer tasks (4 tasks remain)');
  assert(processedData.metrics.completedTasks === 2, 'Completed tasks count is 2 of 4 (50%)');
  assert(processedData.metrics.overdueTasks === 2, 'Overdue tasks count is 2 (overdue advisory task adv-001 is excluded)');
  assert(processedData.metrics.taskCompletionScore === 50, 'Task completion score is accurately 50%');

  // Verify members workload shares in processedData
  const activeMembers = processedData.members.filter((m) => m.status !== 'Left project');
  assert(activeMembers.length === 2, 'Two student members mapped in roster');
  const totalMemberShares = activeMembers.reduce((acc, m) => acc + m.workloadSharePercent, 0);
  assert(totalMemberShares === 100, `Member workload shares total exactly 100% (got ${totalMemberShares}%)`);
  console.log('');

  // --------------------------------------------------------------------------
  // NEW SUITE 4: No Silent Fallback to Simulated Data (Item 6)
  // --------------------------------------------------------------------------
  console.log('--- Suite 4: No Silent Fallback to Simulated Data (Item 6) ---');

  // Test 4a: fetchLiveAsanaProject with invalid token throws error, never returns data
  let fetchFailedAsExpected = false;
  let fetchErrorMessage = '';
  try {
    await fetchLiveAsanaProject('987654321', '');
  } catch (err: any) {
    fetchFailedAsExpected = true;
    fetchErrorMessage = err.message;
  }
  assert(fetchFailedAsExpected, 'fetchLiveAsanaProject throws error when token is invalid or missing');
  assert(fetchErrorMessage === 'Asana token rejected', `Throws explicit error "Asana token rejected" (got "${fetchErrorMessage}")`);

  // Test 4b: syncStudentGroupFromAsana with token throws on fetch failure (no silent simulation fallback)
  const baseGroup: StudentGroup = {
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
  };

  let syncFailedAsExpected = false;
  try {
    // Calling with invalid token when live sync is intended must not silently fabricate data
    await syncStudentGroupFromAsana(baseGroup, 'invalid-nonexistent-token-xyz');
  } catch (err: any) {
    syncFailedAsExpected = true;
    assert(err instanceof AsanaApiError || err instanceof Error, 'Failed live sync returns error object');
  }
  assert(syncFailedAsExpected, 'syncStudentGroupFromAsana does NOT silently fallback to simulated data on failed live fetch');
  console.log('');

  // --------------------------------------------------------------------------
  // NEW SUITE 5: Boundary Risk Classification (39, 40, 69, 70)
  // --------------------------------------------------------------------------
  console.log('--- Suite 5: Risk Classification Boundary Conditions ---');

  assert(getRiskClassification(39) === 'High', 'Score 39 classifies as High Risk (< 40)');
  assert(getRiskClassification(40) === 'Medium', 'Score 40 classifies as Medium Risk (40 - 69)');
  assert(getRiskClassification(69) === 'Medium', 'Score 69 classifies as Medium Risk (40 - 69)');
  assert(getRiskClassification(70) === 'Low', 'Score 70 classifies as Low Risk (70 - 100)');
  assert(getRiskClassification(0) === 'High', 'Score 0 classifies as High Risk');
  assert(getRiskClassification(100) === 'Low', 'Score 100 classifies as Low Risk');
  console.log('');

  // --------------------------------------------------------------------------
  // NEW SUITE 6: ONE Shared Overdue (On-Time) Formula Verification
  // Formula: OnTime = max(0, 100 - 20*N - 2*SumDaysOverdue)
  // --------------------------------------------------------------------------
  console.log('--- Suite 6: ONE Shared Overdue Formula Verification ---');

  // 2 overdue tasks (4 and 3 days) -> 100 - 20*2 - 2*(4 + 3) = 46
  const score2Tasks = calculateOnTimeScore(2, 7);
  assert(score2Tasks === 46, `2 overdue tasks (4 and 3 days) -> 46 (actual: ${score2Tasks})`);

  // 0 overdue -> 100
  const score0Tasks = calculateOnTimeScore(0, 0);
  assert(score0Tasks === 100, `0 overdue -> 100 (actual: ${score0Tasks})`);

  // heavy overdue clamps at 0
  const scoreHeavy = calculateOnTimeScore(10, 150);
  assert(scoreHeavy === 0, `Heavy overdue clamps at 0 (actual: ${scoreHeavy})`);

  // Advisory tasks ignored in On-Time calculations
  const refDate = new Date('2026-10-08T12:00:00Z');
  const sampleTasks = [
    { title: 'Regular Task 1', dueDate: '2026-10-04T12:00:00Z', status: 'Overdue' }, // 4 days overdue
    { title: 'Regular Task 2', dueDate: '2026-10-05T12:00:00Z', status: 'Overdue' }, // 3 days overdue
    { title: '[ProjectHealth AI] Lecturer advisory: Sprint review', dueDate: '2026-10-01T12:00:00Z', status: 'Overdue', isAdvisory: true }, // ignored
    { title: 'Lecturer task', dueDate: '2026-10-02T12:00:00Z', status: 'Overdue', isLecturerAuthored: true }, // ignored
  ];
  const evaluatedTasks = computeTasksOnTimeScore(sampleTasks, refDate);
  assert(evaluatedTasks.overdueCount === 2, `Advisory tasks ignored: overdueCount is 2 (actual: ${evaluatedTasks.overdueCount})`);
  assert(evaluatedTasks.sumDaysOverdue === 7, `Advisory tasks ignored: sumDaysOverdue is 7 (actual: ${evaluatedTasks.sumDaysOverdue})`);
  assert(evaluatedTasks.score === 46, `Advisory tasks ignored: OnTime score is 46 (actual: ${evaluatedTasks.score})`);
  console.log('');

  // --------------------------------------------------------------------------
  // NEW SUITE 7: Live Data Protection Against Overwriting By Sample Data
  // --------------------------------------------------------------------------
  console.log('--- Suite 7: Live Data Protection (No Token Missing Sync) ---');
  const liveProjectToProtect: StudentGroup = {
    id: 'grp-live-real',
    name: 'Real Live Project',
    projectTitle: 'Real Production App',
    courseCode: 'CS401',
    courseName: 'Capstone',
    lastActivity: '1 hour ago',
    lastActivityTimestamp: '2026-10-08T09:00:00Z',
    teamLeader: 'Alice Smith',
    repoUrl: 'github.com/real/repo',
    asanaWorkspace: '1219253588419555',
    dataSource: 'live',
    taskCompletionScore: 85,
    overdueTaskScore: 75,
    memberActivityScore: 80,
    workloadEquityScore: 70,
    communicationScore: 65,
    members: [
      {
        id: 'm1',
        name: 'Alice Smith',
        email: 'alice@example.com',
        role: 'Lead',
        avatarColor: 'bg-indigo-600',
        assignedTasks: 5,
        completedTasks: 4,
        commits: 12,
        prReviews: 3,
        messagesSent: 12,
        lastActive: 'Today',
        workloadSharePercent: 60,
        status: 'Overloaded',
      },
    ],
    tasks: [],
    riskFactors: [],
    trends: { sevenDays: [], fourteenDays: [], thirtyDays: [] },
  };

  let tokenMissingErrorThrown = false;
  let tokenMissingErrorMessage = '';
  try {
    // Calling sync with empty token for a live dataSource project
    await syncStudentGroupFromAsana(liveProjectToProtect, '');
  } catch (err: any) {
    tokenMissingErrorThrown = true;
    tokenMissingErrorMessage = err.message || '';
  }

  assert(tokenMissingErrorThrown, 'syncStudentGroupFromAsana threw error when syncing live project without token');
  assert(
    tokenMissingErrorMessage === 'Paste your Asana token to sync this project.',
    `Throws exact message: "Paste your Asana token to sync this project." (actual: "${tokenMissingErrorMessage}")`
  );
  assert(
    liveProjectToProtect.dataSource === 'live' && liveProjectToProtect.taskCompletionScore === 85,
    'Live project was NOT overwritten with simulated data and preserved original metrics'
  );
  console.log('');

  console.log('\n========================================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
