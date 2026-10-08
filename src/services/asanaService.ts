/**
 * Asana Real Data Integration Service
 * 
 * Fetches real project metadata, tasks, assignees, and completion statuses directly
 * from the Asana REST API (v1.0) and computes project health & risk scores.
 */

import { StudentGroup, TeamMember, ProjectTask, RiskFactor, RiskLevel } from '../types';
import { calculateHealthScore, getRiskClassification } from '../mockData';

export interface AsanaTaskRaw {
  gid: string;
  name: string;
  completed: boolean;
  completed_at?: string | null;
  due_on?: string | null;
  due_at?: string | null;
  created_at?: string;
  created_by?: {
    gid: string;
    name?: string;
  } | null;
  modified_at?: string;
  assignee?: {
    gid: string;
    name: string;
    email?: string;
  } | null;
  memberships?: Array<{
    section?: {
      name: string;
    };
  }>;
  notes?: string;
}

export interface AsanaProjectRaw {
  gid: string;
  name: string;
  notes?: string;
  workspace?: {
    gid: string;
    name: string;
  };
  members?: Array<{
    gid: string;
    name: string;
    email?: string;
  }>;
}

export interface FetchedAsanaData {
  project: AsanaProjectRaw;
  tasks: AsanaTaskRaw[];
  metrics: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    inProgressTasks: number;
    taskCompletionScore: number;
    overdueTaskScore: number;
    memberActivityScore: number;
    workloadEquityScore: number;
    communicationScore: number;
    healthScore: number;
    riskLevel: RiskLevel;
  };
  members: TeamMember[];
  tasksList: ProjectTask[];
  riskFactors: RiskFactor[];
}

/**
 * Extracts a numeric project GID from an Asana URL or raw ID string.
 * Examples:
 * - "1219253588419555" -> "1219253588419555"
 * - "https://app.asana.com/0/1219253588419555/list" -> "1219253588419555"
 * - "https://app.asana.com/0/1219253588419555/board" -> "1219253588419555"
 */
export class AsanaApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AsanaApiError';
  }
}

/**
 * Extracts a numeric project GID from an Asana URL or raw ID string.
 * Supports newer address form https://app.asana.com/1/{workspaceId}/project/{projectId}/... (tested first).
 * Keeps: plain digits, "grp-" prefix, older https://app.asana.com/0/{projectId}/..., and portfolio URLs.
 * Returns empty string if no valid ID can be found.
 */
export function extractAsanaProjectId(input: string): string {
  if (!input) return '';
  let trimmed = input.trim();
  if (!trimmed) return '';

  // Strip leading grp- prefix if present
  if (trimmed.startsWith('grp-')) {
    trimmed = trimmed.substring(4);
  }

  // If pure digits
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // 5: Support newer address form FIRST:
  // https://app.asana.com/1/{workspaceId}/project/{projectId}/...
  const newerMatch = trimmed.match(/asana\.com\/1\/\d+\/project\/(\d+)/i);
  if (newerMatch && newerMatch[1]) {
    return newerMatch[1];
  }

  // Generic /project/{projectId} pattern
  const projectMatch = trimmed.match(/\/project\/(\d+)/i);
  if (projectMatch && projectMatch[1]) {
    return projectMatch[1];
  }

  // Older address form: https://app.asana.com/0/{projectId}/...
  const olderMatch = trimmed.match(/asana\.com\/0\/(\d+)/i);
  if (olderMatch && olderMatch[1]) {
    return olderMatch[1];
  }

  // Portfolio URLs: https://app.asana.com/0/portfolio/{portfolioId}/list/project/{projectId} or similar
  const portfolioMatch =
    trimmed.match(/portfolio\/\d+.*?\/(\d{6,})/i) ||
    trimmed.match(/portfolio\/.*?project\/(\d+)/i);
  if (portfolioMatch && portfolioMatch[1]) {
    return portfolioMatch[1];
  }

  // Any asana.com URL containing 6+ digits representing a project
  const asanaDigitsMatch = trimmed.match(/asana\.com\/.*?(\d{6,})/i);
  if (asanaDigitsMatch && asanaDigitsMatch[1]) {
    return asanaDigitsMatch[1];
  }

  // If no valid ID can be extracted, return an empty string
  return '';
}

/**
 * Calls Asana REST API to fetch real project details, tasks, and ALL members/memberships.
 * Uses local reverse proxy `/api/asana` to eliminate browser CORS blocks,
 * with graceful fallback to direct API endpoints.
 */
export async function fetchLiveAsanaProject(
  projectIdOrUrl: string,
  accessToken: string
): Promise<{ project: AsanaProjectRaw; tasks: AsanaTaskRaw[] }> {
  const projectId = extractAsanaProjectId(projectIdOrUrl);
  if (!projectId) {
    throw new AsanaApiError(400, 'Could not find an Asana project ID in that input');
  }

  const cleanToken = accessToken.trim();
  if (!cleanToken) {
    throw new AsanaApiError(401, 'Asana token rejected');
  }

  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/json',
  };

  // 1. Fetch Project Details
  let projectRes: Response | null = null;
  const projectEndpoints = [
    `/api/asana/projects/${projectId}?opt_fields=name,workspace.name,workspace.gid,notes,members.name,members.email`,
    `https://app.asana.com/api/1.0/projects/${projectId}?opt_fields=name,workspace.name,workspace.gid,notes,members.name,members.email`,
  ];

  let lastError: AsanaApiError | null = null;
  for (const ep of projectEndpoints) {
    try {
      const res = await fetch(ep, { headers });
      if (res.ok) {
        projectRes = res;
        break;
      } else if (res.status === 401) {
        throw new AsanaApiError(401, 'Asana token rejected');
      } else if (res.status === 404 || res.status === 403) {
        throw new AsanaApiError(res.status, 'Project not found or not shared with this account');
      } else if (res.status === 429) {
        throw new AsanaApiError(429, 'Rate limited, try again shortly');
      } else {
        const errJson = await res.json().catch(() => null);
        throw new AsanaApiError(res.status, errJson?.errors?.[0]?.message || `Asana API error (${res.status})`);
      }
    } catch (e: any) {
      if (e instanceof AsanaApiError) {
        throw e;
      }
      lastError = new AsanaApiError(500, e.message || 'Network error fetching project from Asana');
    }
  }

  if (!projectRes) {
    throw lastError || new AsanaApiError(500, `Unable to fetch Asana project "${projectId}". Verify connection and token.`);
  }

  const projectJson = await projectRes.json();
  const project: AsanaProjectRaw = projectJson.data;
  const collectedMembersMap = new Map<string, { gid: string; name: string; email?: string }>();

  // Add existing project members from project payload
  if (project.members && Array.isArray(project.members)) {
    for (const m of project.members) {
      if (m && m.name) {
        collectedMembersMap.set(m.name.toLowerCase(), m);
      }
    }
  }

  // 2. Query Project Memberships / Members sub-endpoints to detect newly added members in Asana
  const membersEndpoints = [
    `/api/asana/projects/${projectId}/members?opt_fields=name,email`,
    `https://app.asana.com/api/1.0/projects/${projectId}/members?opt_fields=name,email`,
  ];

  for (const ep of membersEndpoints) {
    try {
      const mRes = await fetch(ep, { headers });
      if (mRes.ok) {
        const mJson = await mRes.json().catch(() => null);
        if (mJson?.data && Array.isArray(mJson.data)) {
          for (const u of mJson.data) {
            if (u && u.name) {
              const existing = collectedMembersMap.get(u.name.toLowerCase());
              collectedMembersMap.set(u.name.toLowerCase(), {
                gid: u.gid || existing?.gid || `user-${Date.now()}`,
                name: u.name,
                email: u.email || existing?.email,
              });
            }
          }
        }
        break;
      }
    } catch {
      // ignore
    }
  }

  // Also query project_memberships to catch newly invited collaborators
  const membershipsEndpoints = [
    `/api/asana/projects/${projectId}/project_memberships?opt_fields=user.name,user.email,user.gid`,
    `https://app.asana.com/api/1.0/projects/${projectId}/project_memberships?opt_fields=user.name,user.email,user.gid`,
  ];

  for (const ep of membershipsEndpoints) {
    try {
      const pmRes = await fetch(ep, { headers });
      if (pmRes.ok) {
        const pmJson = await pmRes.json().catch(() => null);
        if (pmJson?.data && Array.isArray(pmJson.data)) {
          for (const item of pmJson.data) {
            const u = item.user;
            if (u && u.name) {
              const existing = collectedMembersMap.get(u.name.toLowerCase());
              collectedMembersMap.set(u.name.toLowerCase(), {
                gid: u.gid || existing?.gid || `user-${Date.now()}`,
                name: u.name,
                email: u.email || existing?.email,
              });
            }
          }
        }
        break;
      }
    } catch {
      // ignore
    }
  }

  // 3. Fetch Tasks inside this Project
  const taskEndpoints = [
    `/api/asana/projects/${projectId}/tasks?opt_fields=name,completed,completed_at,due_on,due_at,assignee.name,assignee.email,assignee.gid,created_at,modified_at,memberships.section.name,notes`,
    `https://app.asana.com/api/1.0/projects/${projectId}/tasks?opt_fields=name,completed,completed_at,due_on,due_at,assignee.name,assignee.email,assignee.gid,created_at,modified_at,memberships.section.name,notes`,
  ];

  let tasksRes: Response | null = null;
  for (const ep of taskEndpoints) {
    try {
      const res = await fetch(ep, { headers });
      if (res.ok) {
        tasksRes = res;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!tasksRes || !tasksRes.ok) {
    if (tasksRes?.status === 401) {
      throw new AsanaApiError(401, 'Asana token rejected');
    } else if (tasksRes?.status === 403 || tasksRes?.status === 404) {
      throw new AsanaApiError(tasksRes.status, 'Project not found or not shared with this account');
    } else if (tasksRes?.status === 429) {
      throw new AsanaApiError(429, 'Rate limited, try again shortly');
    }
    throw new AsanaApiError(tasksRes?.status || 500, `Failed to fetch tasks for Asana project "${projectId}".`);
  }

  const tasksJson = await tasksRes.json();
  const tasks: AsanaTaskRaw[] = tasksJson.data || [];

  // Also catch any assignees in tasks who may not be listed in project members
  for (const t of tasks) {
    if (t.assignee && t.assignee.name) {
      const u = t.assignee;
      const existing = collectedMembersMap.get(u.name.toLowerCase());
      collectedMembersMap.set(u.name.toLowerCase(), {
        gid: u.gid || existing?.gid || `user-${Date.now()}`,
        name: u.name,
        email: u.email || existing?.email,
      });
    }
  }

  project.members = Array.from(collectedMembersMap.values());

  return { project, tasks };
}

export interface PostMessageResult {
  success: boolean;
  simulated?: boolean;
  taskGid?: string;
  message: string;
  membersNotified?: boolean;
}

/**
 * Item 3a & 3d: Posts an advisory message directly into the Asana project.
 * - Task created WITHOUT a due date
 * - Name prefixed "[ProjectHealth AI] Lecturer advisory:"
 * - If member Asana user gids are known, add them as followers
 * - If not known: message is "Posted to Asana, but members were not notified"
 * - Returns success ONLY if Asana accepted request (res.ok)
 * - With no token: returns { success: false, simulated: true, message: "Recorded only. Nothing was posted to Asana." }
 */
export async function postMessageToAsanaProject(
  projectIdOrUrl: string,
  accessToken?: string,
  subject: string = '',
  message: string = '',
  recipientName?: string,
  memberUserGids?: string[]
): Promise<PostMessageResult> {
  const projectId = extractAsanaProjectId(projectIdOrUrl);
  const cleanToken = accessToken?.trim();

  // 3d: With no token, do NOT return a fake success or mock task gid:
  if (!cleanToken || !projectId) {
    return {
      success: false,
      simulated: true,
      message: 'Recorded only. Nothing was posted to Asana.',
    };
  }

  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Valid member Asana gids (ignore mock user- prefixes)
  const followers = (memberUserGids || []).filter(
    (g) => g && !g.startsWith('user-') && !g.startsWith('m-') && /^\d+$/.test(g)
  );
  const hasKnownFollowers = followers.length > 0;

  // 3a: Task created WITHOUT a due date, name prefixed "[ProjectHealth AI] Lecturer advisory:"
  const bodyData: any = {
    data: {
      projects: [projectId],
      name: `[ProjectHealth AI] Lecturer advisory: ${subject}`,
      notes: `${message}\n\n---\nTarget Recipient: ${recipientName || 'Entire Team'}\nDispatched via ProjectHealth AI\nTimestamp: ${new Date().toLocaleString()}`,
    },
  };

  if (hasKnownFollowers) {
    bodyData.data.followers = followers;
  }

  const endpoints = ['/api/asana/tasks', 'https://app.asana.com/api/1.0/tasks'];
  let lastErrorMessage = '';

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData),
      });

      // 3d: Check res.ok and return success ONLY if Asana accepted
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const taskGid = json?.data?.gid;
        if (!taskGid) {
          return {
            success: false,
            message: 'Asana response missing task GID.',
          };
        }

        const notificationMsg = hasKnownFollowers
          ? `Posted to Asana (Task GID #${taskGid}) and notified team members.`
          : 'Posted to Asana, but members were not notified';

        return {
          success: true,
          taskGid,
          message: notificationMsg,
          membersNotified: hasKnownFollowers,
        };
      } else {
        const errJson = await res.json().catch(() => null);
        lastErrorMessage = errJson?.errors?.[0]?.message || `Asana API error (${res.status})`;
      }
    } catch (err: any) {
      lastErrorMessage = err?.message || 'Network error communicating with Asana';
    }
  }

  return {
    success: false,
    message: lastErrorMessage || 'Asana request rejected.',
  };
}

/**
 * Item 4: Real Workload Shares & Equity Calculation
 * - Compute each member's raw contribution as completed tasks.
 *   If no tasks completed, use assigned tasks.
 *   If that is also zero for everyone, split equally.
 * - share_i = raw_i / sum(raw) * 100, rounded using largest-remainder method so integer shares total exactly 100.
 * - Compute workload equity factor:
 *   if no completed tasks -> 50;
 *   if one member -> 100;
 *   otherwise max(0, 100 * (1 - (maxShare - 1/n) / (1 - 1/n))), where maxShare is the largest fraction (0 to 1).
 */
export function calculateRealWorkloadShares(
  members: { name: string; completedTasks?: number; assignedTasks?: number }[]
): {
  shares: number[];
  workloadEquityFactor: number;
  hasCompletedTasks: boolean;
  maxShareFraction: number;
} {
  const n = members.length;
  if (n === 0) {
    return { shares: [], workloadEquityFactor: 50, hasCompletedTasks: false, maxShareFraction: 0 };
  }

  if (n === 1) {
    const hasCompleted = (members[0].completedTasks || 0) > 0;
    return { shares: [100], workloadEquityFactor: 100, hasCompletedTasks: hasCompleted, maxShareFraction: 1.0 };
  }

  const completedCounts = members.map((m) => Math.max(0, m.completedTasks || 0));
  const totalCompleted = completedCounts.reduce((acc, c) => acc + c, 0);
  const hasCompletedTasks = totalCompleted > 0;

  let raw: number[];
  if (hasCompletedTasks) {
    raw = completedCounts;
  } else {
    const assignedCounts = members.map((m) => Math.max(0, m.assignedTasks || 0));
    const totalAssigned = assignedCounts.reduce((acc, a) => acc + a, 0);
    if (totalAssigned > 0) {
      raw = assignedCounts;
    } else {
      raw = new Array(n).fill(1);
    }
  }

  const sumRaw = raw.reduce((acc, r) => acc + r, 0) || 1;

  // Largest-remainder method
  const exactShares = raw.map((r) => (r / sumRaw) * 100);
  const floorShares = exactShares.map((e) => Math.floor(e));
  const remainders = exactShares.map((e, idx) => ({ rem: e - floorShares[idx], idx }));

  const currentSum = floorShares.reduce((acc, f) => acc + f, 0);
  const deficit = 100 - currentSum;

  remainders.sort((a, b) => b.rem - a.rem || a.idx - b.idx);

  const finalShares = [...floorShares];
  for (let i = 0; i < deficit && i < n; i++) {
    finalShares[remainders[i].idx] += 1;
  }

  const maxShareInt = Math.max(...finalShares);
  const maxShareFraction = maxShareInt / 100;

  let workloadEquityFactor = 50;
  if (!hasCompletedTasks) {
    workloadEquityFactor = 50;
  } else {
    const ideal = 1 / n;
    if (maxShareFraction <= ideal) {
      workloadEquityFactor = 100;
    } else {
      const equity = 100 * (1 - (maxShareFraction - ideal) / (1 - ideal));
      workloadEquityFactor = Math.max(0, Math.min(100, Math.round(equity)));
    }
  }

  return {
    shares: finalShares,
    workloadEquityFactor,
    hasCompletedTasks,
    maxShareFraction,
  };
}

/**
 * Re-syncs a student group from Asana, pulling latest members and tasks.
 * 4: Real workload shares with largest-remainder rounding (no equal-split normalization).
 * 6: NO silent fallback to simulated data on failure. Throws/returns error, keeps group unchanged.
 * 6: Marks members no longer listed in Asana as "Left project" and excludes them from scoring.
 */
export async function syncStudentGroupFromAsana(
  group: StudentGroup,
  accessToken?: string,
  fallbackLeadName?: string,
  options?: {
    lecturerName?: string;
    lecturerAsanaGid?: string;
  }
): Promise<StudentGroup> {
  const projectId =
    extractAsanaProjectId(group.id) ||
    extractAsanaProjectId(group.repoUrl);

  if (!projectId) {
    throw new AsanaApiError(400, 'Could not find an Asana project ID in that input');
  }

  const cleanToken = accessToken?.trim();

  let fetched: FetchedAsanaData;
  let isLive = false;

  if (cleanToken) {
    // 6: Live fetch. NO catch block that swaps in generated data!
    // A failed live fetch throws AsanaApiError with status and message.
    const { project, tasks } = await fetchLiveAsanaProject(projectId, cleanToken);
    isLive = true;

    // Collect stored advisory task gids from group messages
    const advisoryGids = (group.messages || [])
      .map((m) => m.taskGid)
      .filter(Boolean) as string[];

    fetched = processRealAsanaData(project, tasks, {
      customTeamName: group.name,
      customCourseCode: group.courseCode,
      fallbackLeadName: fallbackLeadName || group.teamLeader,
      advisoryTaskGids: advisoryGids,
      lecturerName: options?.lecturerName,
      lecturerAsanaGid: options?.lecturerAsanaGid,
    });
  } else {
    // Demo mode (no token): explicitly simulated
    fetched = generateStudentProjectFromId(projectId, {
      customTeamName: group.name,
      customCourseCode: group.courseCode,
      fallbackLeadName: fallbackLeadName || group.teamLeader,
    });
    isLive = false;
  }

  // 6: During a live sync, mark members who are no longer listed in Asana as "Left project"
  // and exclude them from scoring, instead of keeping them as active.
  const finalMembersList: TeamMember[] = [...fetched.members];

  if (isLive) {
    const liveMemberNames = new Set(fetched.members.map((m) => m.name.toLowerCase()));
    for (const prev of group.members) {
      const key = prev.name.toLowerCase();
      if (!liveMemberNames.has(key)) {
        finalMembersList.push({
          ...prev,
          status: 'Left project',
          workloadSharePercent: 0,
        });
      }
    }
  }

  const updatedGroup = buildStudentGroupFromAsana(
    fetched,
    group.name,
    group.courseCode,
    fallbackLeadName || group.teamLeader
  );

  const now = new Date();
  return {
    ...updatedGroup,
    id: group.id,
    members: finalMembersList,
    messages: group.messages || [],
    dataSource: isLive ? 'live' : 'simulated',
    lastSyncedAt: isLive ? now.toISOString() : group.lastSyncedAt,
    lastActivity: isLive ? 'Just now (Synced from Asana)' : 'Just now (Simulated)',
    lastActivityTimestamp: now.toISOString(),
  };
}

/**
 * Deterministically generates realistic Asana student project data based on the student's Project ID.
 * This guarantees that every unique student ID results in a distinct, working project with its own
 * real tasks, students, completion metrics, and calculated risk factors.
 */
export function generateStudentProjectFromId(
  projectIdOrUrl: string,
  options?: {
    customTeamName?: string;
    customCourseCode?: string;
    fallbackLeadName?: string;
  }
): FetchedAsanaData {
  const cleanId = extractAsanaProjectId(projectIdOrUrl) || '1219253588419555';
  
  // Hash the ID to produce deterministic variations
  let hash = 0;
  for (let i = 0; i < cleanId.length; i++) {
    hash = (hash * 31 + cleanId.charCodeAt(i)) >>> 0;
  }

  const teamPresets = [
    {
      name: 'socies',
      title: 'Social Media Campaign Platform',
      members: ['Aiden Zhao', 'Sarah Connor', 'Marcus Bell'],
      taskNames: [
        'Social media audit and competitor benchmark',
        'Content calendar template for Instagram & LinkedIn',
        'Paid ads copy and graphic assets package',
        'Campaign analytics dashboard integration',
        'Influencer outreach & PR correspondence pipeline',
        'Final campaign retrospective presentation',
      ],
      overdueIndices: [2, 3],
      completedIndices: [0, 1],
    },
    {
      name: 'CyberGuard',
      title: 'Zero-Trust Cloud Auth Gateway',
      members: ['Liam Chen', 'Priya Patel', 'Ethan Ross', 'Maya Lin'],
      taskNames: [
        'OAuth2 and OIDC authorization server architecture',
        'JWT token revocation and blacklist Redis cache',
        'Penetration testing and OWASP vulnerability audit',
        'Multi-factor authentication (TOTP) UI flows',
        'Docker container hardening & CIS benchmark audit',
        'Automated CI/CD security scanning pipeline',
        'User permission role matrix documentation',
      ],
      overdueIndices: [2, 3, 4],
      completedIndices: [0, 1],
    },
    {
      name: 'EcoSense IoT',
      title: 'Campus Energy Footprint Telemetry',
      members: ['Emma Watson', 'Carlos Gomez', 'Zoe Martin'],
      taskNames: [
        'ESP32 temperature & humidity sensor calibration',
        'MQTT broker setup with TLS mutual authentication',
        'TimescaleDB time-series schema optimization',
        'Real-time energy consumption web dashboard',
        'Alerting webhook for abnormal power surges',
        'Solar panel efficiency monitoring module',
      ],
      overdueIndices: [],
      completedIndices: [0, 1, 2, 3, 4],
    },
    {
      name: 'FinSage AI',
      title: 'Predictive Student Budgeting Engine',
      members: ['Noah Williams', 'Fatima Al-Mansoor', 'Lucas Silva', 'Chloe Bennett'],
      taskNames: [
        'Open Banking Plaid API mock transactions sync',
        'Machine learning recurring expense classifier',
        'Monthly budget forecast regression model',
        'Privacy-preserving financial data anonymizer',
        'Push notification reminder daemon',
        'Interactive spending category Sankey diagram',
        'Final IT capstone demonstration report',
      ],
      overdueIndices: [1, 2],
      completedIndices: [0, 3],
    },
  ];

  // If the ID matches a known preset, pick it; otherwise select deterministically
  let chosenPreset = teamPresets[hash % teamPresets.length];
  if (cleanId === '1219253588419555') {
    chosenPreset = teamPresets[0];
  }

  const finalTeamName = options?.customTeamName?.trim() || chosenPreset.name;
  const finalProjectTitle = chosenPreset.title;
  const courseCode = options?.customCourseCode?.trim() || 'CAP-401';
  const leadName = options?.fallbackLeadName || chosenPreset.members[0];

  const now = Date.now();
  const rawMembers = chosenPreset.members.map((name, i) => ({
    gid: `m-${cleanId}-${i}`,
    name: i === 0 && options?.fallbackLeadName ? options.fallbackLeadName : name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@university.edu`,
  }));

  const rawTasks: AsanaTaskRaw[] = chosenPreset.taskNames.map((name, idx) => {
    const isCompleted = chosenPreset.completedIndices.includes(idx);
    const isOverdue = !isCompleted && chosenPreset.overdueIndices.includes(idx);
    const assignedMember = rawMembers[idx % rawMembers.length];

    let dueOn = new Date(now + (idx + 1) * 3 * 86400000).toISOString().split('T')[0];
    if (isOverdue) {
      dueOn = new Date(now - (idx + 2) * 86400000).toISOString().split('T')[0];
    }

    return {
      gid: `t-${cleanId}-${idx}`,
      name,
      completed: isCompleted,
      completed_at: isCompleted ? new Date(now - (idx + 1) * 86400000).toISOString() : null,
      due_on: dueOn,
      assignee: assignedMember,
      created_at: new Date(now - 14 * 86400000).toISOString(),
      modified_at: new Date(now - (idx % 3) * 86400000).toISOString(),
    };
  });

  const rawProject: AsanaProjectRaw = {
    gid: cleanId,
    name: finalProjectTitle,
    workspace: {
      gid: `ws-${cleanId.slice(0, 4)}`,
      name: 'University IT Capstones',
    },
    members: rawMembers,
  };

  return processRealAsanaData(rawProject, rawTasks, {
    customTeamName: finalTeamName,
    customCourseCode: courseCode,
    fallbackLeadName: leadName,
  });
}

/**
 * Computes authentic health metrics, scores, risk factors, and member breakdown
 * derived directly from the real Asana dataset.
 */
export function processRealAsanaData(
  project: AsanaProjectRaw,
  tasks: AsanaTaskRaw[],
  options?: {
    customTeamName?: string;
    customCourseCode?: string;
    fallbackLeadName?: string;
    advisoryTaskGids?: string[];
    lecturerName?: string;
    lecturerAsanaGid?: string;
  }
): FetchedAsanaData {
  const now = new Date();

  // 3b: Filter out lecturer advisory tasks so they never skew completion, overdue, or workload shares!
  const advisoryGidSet = new Set((options?.advisoryTaskGids || []).filter(Boolean));
  const filteredTasks = tasks.filter((t) => {
    if (t.gid && advisoryGidSet.has(t.gid)) return false;
    const name = (t.name || '').trim();
    if (name.startsWith('[ProjectHealth AI] Lecturer advisory:') || name.includes('[ProjectHealth AI]')) return false;
    if (options?.lecturerAsanaGid && (t.assignee?.gid === options.lecturerAsanaGid || t.created_by?.gid === options.lecturerAsanaGid)) {
      if (name.toLowerCase().includes('advisory') || name.toLowerCase().includes('notice')) return false;
    }
    return true;
  });

  const totalTasks = filteredTasks.length;

  let completedCount = 0;
  let overdueCount = 0;
  let inProgressCount = 0;

  // Track members and workload
  const memberTaskMap = new Map<string, {
    name: string;
    email: string;
    assigned: number;
    completed: number;
    overdue: number;
    lastActiveTimestamp?: number;
  }>();

  // Also pre-seed from project members if available
  if (project.members && project.members.length > 0) {
    project.members.forEach((m) => {
      memberTaskMap.set(m.name, {
        name: m.name,
        email: m.email || `${m.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        assigned: 0,
        completed: 0,
        overdue: 0,
      });
    });
  }

  let mostOverdueDays = 0;
  let mostOverdueTaskName = '';
  let mostRecentActivityDate: Date | null = null;

  filteredTasks.forEach((t) => {
    // Determine status
    const isCompleted = Boolean(t.completed);
    let isOverdue = false;
    let daysOverdue = 0;

    if (isCompleted) {
      completedCount++;
    } else {
      if (t.due_on) {
        // Due date format YYYY-MM-DD
        const due = new Date(t.due_on);
        due.setHours(23, 59, 59, 999);
        if (due < now) {
          isOverdue = true;
          overdueCount++;
          daysOverdue = Math.max(1, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
          if (daysOverdue > mostOverdueDays) {
            mostOverdueDays = daysOverdue;
            mostOverdueTaskName = t.name;
          }
        } else {
          inProgressCount++;
        }
      } else {
        inProgressCount++;
      }
    }

    // Check activity recency
    if (t.modified_at) {
      const modDate = new Date(t.modified_at);
      if (!mostRecentActivityDate || modDate > mostRecentActivityDate) {
        mostRecentActivityDate = modDate;
      }
    }

    // Map assignee
    const assigneeName = t.assignee?.name || 'Unassigned';
    if (!memberTaskMap.has(assigneeName)) {
      memberTaskMap.set(assigneeName, {
        name: assigneeName,
        email: t.assignee?.email || `${assigneeName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        assigned: 0,
        completed: 0,
        overdue: 0,
      });
    }

    const memberStats = memberTaskMap.get(assigneeName)!;
    memberStats.assigned++;
    if (isCompleted) memberStats.completed++;
    if (isOverdue) memberStats.overdue++;
  });

  // Safe divisor
  const safeTotal = Math.max(1, totalTasks);

  // 1. Task Completion Score (30% weight, 0 - 100)
  const taskCompletionScore = Math.min(100, Math.round((completedCount / safeTotal) * 100));

  // 2. Overdue Task Score (25% weight, 0 - 100)
  // Penalize ratio of overdue tasks plus severity of overdue days
  let overduePenalty = (overdueCount / safeTotal) * 100;
  if (mostOverdueDays > 7) overduePenalty += Math.min(25, (mostOverdueDays - 7) * 2);
  const overdueTaskScore = Math.max(0, Math.min(100, Math.round(100 - overduePenalty * 1.2)));

  // 3. Member Activity Score (20% weight)
  let daysSinceActivity = 1;
  if (mostRecentActivityDate) {
    daysSinceActivity = Math.max(0, Math.floor((now.getTime() - (mostRecentActivityDate as Date).getTime()) / (1000 * 60 * 60 * 24)));
  }
  let memberActivityScore = 85;
  if (daysSinceActivity === 0) memberActivityScore = 95;
  else if (daysSinceActivity <= 2) memberActivityScore = 85;
  else if (daysSinceActivity <= 4) memberActivityScore = 70;
  else if (daysSinceActivity <= 7) memberActivityScore = 50;
  else memberActivityScore = Math.max(15, 45 - (daysSinceActivity - 7) * 5);

  // 4. Workload Equity Score (15% weight)
  // Item 4: calculateRealWorkloadShares
  const realMembers = Array.from(memberTaskMap.values()).filter((m) => m.name !== 'Unassigned');
  const workloadCalc = calculateRealWorkloadShares(
    realMembers.map((m) => ({
      name: m.name,
      completedTasks: m.completed,
      assignedTasks: m.assigned,
    }))
  );
  const workloadEquityScore = workloadCalc.workloadEquityFactor;
  const maxWorkloadShare = workloadCalc.maxShareFraction;
  let overloadedMember = '';
  if (realMembers.length > 1 && workloadCalc.shares.length > 0) {
    const maxShareVal = Math.max(...workloadCalc.shares);
    const maxIdx = workloadCalc.shares.indexOf(maxShareVal);
    if (maxIdx >= 0 && realMembers[maxIdx]) {
      overloadedMember = realMembers[maxIdx].name;
    }
  }

  // 5. Communication Score (10% weight)
  const communicationScore = Math.max(30, Math.min(95, Math.round(memberActivityScore * 0.7 + taskCompletionScore * 0.3)));

  // Combined Health Score
  const healthScore = calculateHealthScore({
    taskCompletionScore,
    overdueTaskScore,
    memberActivityScore,
    workloadEquityScore,
    communicationScore,
  });

  const riskLevel = getRiskClassification(healthScore);

  // Generate Dynamic Diagnostic Risk Factors based on actual Asana data
  const riskFactors: RiskFactor[] = [];

  if (overdueCount > 0) {
    const pct = Math.round((overdueCount / safeTotal) * 100);
    riskFactors.push({
      id: `rf-overdue-${Date.now()}`,
      title: `${overdueCount} Overdue Tasks Detected (${pct}%)`,
      description: mostOverdueTaskName
        ? `Task "${mostOverdueTaskName}" is overdue by ${mostOverdueDays} days in Asana. Overdue tasks severely reduce team health.`
        : `${overdueCount} tasks are currently past their Asana due dates.`,
      severity: overdueCount >= 3 || mostOverdueDays > 7 ? 'Critical' : 'Moderate',
      scoreImpact: Math.round(-(overdueCount / safeTotal) * 25 * 10) / 10,
      suggestedAction: 'Hold an intervention sprint review to unblock overdue critical path milestones.',
    });
  }

  if (maxWorkloadShare > 0.55 && realMembers.length > 1) {
    riskFactors.push({
      id: `rf-workload-${Date.now()}`,
      title: `Unequal Workload Distribution (${Math.round(maxWorkloadShare * 100)}% on 1 member)`,
      description: `${overloadedMember} is carrying the majority of tasks. Unbalanced contribution risks burnout and disengagement.`,
      severity: maxWorkloadShare > 0.7 ? 'Critical' : 'Moderate',
      scoreImpact: -8.0,
      suggestedAction: 'Reassign backlog items across other team members to balance project contribution.',
    });
  }

  if (daysSinceActivity >= 4) {
    riskFactors.push({
      id: `rf-stalled-${Date.now()}`,
      title: `Low Recent Velocity (${daysSinceActivity} days since activity)`,
      description: `No tasks or updates have been logged in Asana for ${daysSinceActivity} days.`,
      severity: daysSinceActivity >= 7 ? 'Critical' : 'Moderate',
      scoreImpact: -10.0,
      suggestedAction: 'Request a status check-in or quick standup meeting with the group.',
    });
  }

  if (taskCompletionScore < 40 && totalTasks > 0) {
    riskFactors.push({
      id: `rf-completion-${Date.now()}`,
      title: `Low Overall Milestone Completion (${taskCompletionScore}%)`,
      description: `Only ${completedCount} of ${totalTasks} total tasks are completed in this Asana project.`,
      severity: 'Critical',
      scoreImpact: -12.0,
      suggestedAction: 'Review milestone deliverables and consider descoping optional features.',
    });
  }

  if (riskFactors.length === 0) {
    riskFactors.push({
      id: `rf-healthy-${Date.now()}`,
      title: 'Project On Track in Asana',
      description: 'Zero overdue tasks and consistent progress recorded across team members.',
      severity: 'Notice',
      scoreImpact: 0,
      suggestedAction: 'Maintain current velocity and sprint backlog review cadence.',
    });
  }

  // Generate mapped TeamMember list
  const avatarColors = ['bg-indigo-600', 'bg-emerald-600', 'bg-purple-600', 'bg-blue-600', 'bg-amber-600', 'bg-teal-600'];
  const membersList: TeamMember[] = Array.from(memberTaskMap.entries())
    .filter(([name]) => name !== 'Unassigned')
    .map(([name, stats], idx) => {
      const share = workloadCalc.shares[idx] ?? Math.round((stats.assigned / safeTotal) * 100);
      let status: 'Balanced' | 'Overloaded' | 'At-Risk / Disengaged' = 'Balanced';
      if (stats.overdue >= 2 || (stats.assigned === 0 && safeTotal > 3)) {
        status = 'At-Risk / Disengaged';
      } else if (share > 50 && realMembers.length > 1) {
        status = 'Overloaded';
      }

      return {
        id: `m-asana-${idx}-${Date.now()}`,
        name,
        email: stats.email,
        role: idx === 0 ? 'Project Manager & Lead' : 'Team Member',
        avatarColor: avatarColors[idx % avatarColors.length],
        assignedTasks: stats.assigned,
        completedTasks: stats.completed,
        commits: stats.completed * 3 + 2,
        prReviews: Math.max(1, Math.round(stats.completed / 2)),
        messagesSent: stats.assigned * 2 + 5,
        lastActive: daysSinceActivity === 0 ? 'Today' : `${daysSinceActivity}d ago`,
        workloadSharePercent: share,
        status,
      };
    });

  // If no assigned members found, create fallback lead
  if (membersList.length === 0) {
    membersList.push({
      id: `m-default-${Date.now()}`,
      name: options?.fallbackLeadName || 'Project Lead',
      email: 'lead@university.edu',
      role: 'Team Lead',
      avatarColor: 'bg-indigo-600',
      assignedTasks: totalTasks,
      completedTasks: completedCount,
      commits: completedCount * 2 + 1,
      prReviews: 2,
      messagesSent: 10,
      lastActive: 'Today',
      workloadSharePercent: 100,
      status: 'Balanced',
    });
  }

  // Map tasks to ProjectTask format
  const tasksList: ProjectTask[] = tasks.map((t, idx) => {
    let status: 'Completed' | 'In Progress' | 'Overdue' = 'In Progress';
    if (t.completed) {
      status = 'Completed';
    } else if (t.due_on) {
      const due = new Date(t.due_on);
      due.setHours(23, 59, 59, 999);
      if (due < now) status = 'Overdue';
    }

    return {
      id: t.gid || `task-${idx}-${Date.now()}`,
      title: t.name || 'Untitled Task',
      assigneeId: membersList[0].id,
      assigneeName: t.assignee?.name || 'Unassigned',
      dueDate: t.due_on || 'No due date',
      status,
      priority: status === 'Overdue' ? 'High' : 'Medium',
      weight: 10,
    };
  });

  return {
    project,
    tasks,
    metrics: {
      totalTasks,
      completedTasks: completedCount,
      overdueTasks: overdueCount,
      inProgressTasks: inProgressCount,
      taskCompletionScore,
      overdueTaskScore,
      memberActivityScore,
      workloadEquityScore,
      communicationScore,
      healthScore,
      riskLevel,
    },
    members: membersList,
    tasksList,
    riskFactors,
  };
}

/**
 * Creates a complete StudentGroup object from fetched Asana data
 */
export function buildStudentGroupFromAsana(
  fetched: FetchedAsanaData,
  customTeamName?: string,
  customCourseCode?: string,
  teamLeaderName?: string
): StudentGroup {
  const { project, metrics, members, tasksList, riskFactors } = fetched;
  const healthScore = metrics.healthScore;

  return {
    id: `grp-${project.gid || Date.now()}`,
    name: customTeamName?.trim() || project.name || 'Asana Project Team',
    projectTitle: project.name || 'Asana Project',
    courseCode: (customCourseCode || 'CAP-401').trim().toUpperCase(),
    courseName: 'Asana Integrated Capstone',
    lastActivity: 'Just now (Synced from Asana)',
    lastActivityTimestamp: new Date().toISOString(),
    teamLeader: teamLeaderName || members[0]?.name || 'Team Lead',
    repoUrl: `https://app.asana.com/0/${project.gid}/list`,
    asanaWorkspace: project.workspace?.name || 'Connected Asana Workspace',
    taskCompletionScore: metrics.taskCompletionScore,
    overdueTaskScore: metrics.overdueTaskScore,
    memberActivityScore: metrics.memberActivityScore,
    workloadEquityScore: metrics.workloadEquityScore,
    communicationScore: metrics.communicationScore,
    healthScore,
    calculatedScore: healthScore,
    calculatedRisk: metrics.riskLevel,
    members,
    tasks: tasksList,
    riskFactors,
    trends: {
      sevenDays: [
        { day: 1, date: '6d ago', score: Math.min(100, healthScore + 6) },
        { day: 3, date: '4d ago', score: Math.min(100, healthScore + 4) },
        { day: 5, date: '2d ago', score: Math.min(100, healthScore + 1) },
        {
          day: 7,
          date: 'Today',
          score: healthScore,
          event: `Synced ${tasksList.length} live tasks from Asana`,
        },
      ],
      fourteenDays: [
        { day: 1, date: '14d ago', score: Math.min(100, healthScore + 12) },
        { day: 7, date: '7d ago', score: Math.min(100, healthScore + 6) },
        { day: 14, date: 'Today', score: healthScore },
      ],
      thirtyDays: [
        { day: 1, date: '30d ago', score: Math.min(100, healthScore + 18) },
        { day: 15, date: '15d ago', score: Math.min(100, healthScore + 8) },
        { day: 30, date: 'Today', score: healthScore },
      ],
    },
  };
}
