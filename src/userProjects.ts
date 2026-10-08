import { StudentGroup, SystemAlert, UserAccount } from './types';

/**
 * Creates a unique storage key for each user account based on their email.
 * This ensures User A's Asana projects never mix with User B's projects.
 * Example: 'projecthealth_dr_chen_university_edu_groups'
 */
export function getUserStorageKey(email: string, suffix: string): string {
  const sanitized = email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  return `projecthealth_${sanitized}_${suffix}`;
}

/**
 * Starter projects generator: Returns empty array so new accounts start completely fresh.
 */
export function generateStarterProjectsForUser(_email: string, _userName?: string): StudentGroup[] {
  return [];
}

/**
 * Initial projects for user: Returns empty array (no random pre-seeded projects).
 */
export function getInitialProjectsForUser(_user: UserAccount): StudentGroup[] {
  return [];
}

/**
 * Generates alerts based strictly on projects the user has added to their workspace.
 */
export function getInitialAlertsForUser(_user: UserAccount, groups: StudentGroup[]): SystemAlert[] {
  if (!groups || groups.length === 0) {
    return [];
  }

  const alerts: SystemAlert[] = [];
  const highOrMed = groups.filter((g) => g.taskCompletionScore < 50 || g.overdueTaskScore < 50);

  highOrMed.forEach((g, idx) => {
    alerts.push({
      id: `alt-${g.id}-${idx}`,
      groupId: g.id,
      groupName: g.name,
      courseCode: g.courseCode,
      riskLevel: g.overdueTaskScore < 30 ? 'High' : 'Medium',
      healthScore: Math.round(
        g.taskCompletionScore * 0.3 +
          g.overdueTaskScore * 0.25 +
          g.memberActivityScore * 0.2 +
          g.workloadEquityScore * 0.15 +
          g.communicationScore * 0.1
      ),
      contributingFactors: `Asana Alert (${g.asanaWorkspace}): ${g.riskFactors[0]?.title || 'Multiple overdue tasks detected'}.`,
      timestamp: 'Just now',
      read: false,
    });
  });

  return alerts;
}

/**
 * Loads the projects for a specific user from localStorage.
 * Returns an empty array if the user has not added any projects yet.
 */
export function loadUserGroups(user: UserAccount): StudentGroup[] {
  if (!user || !user.email) return [];
  const key = getUserStorageKey(user.email, 'groups');
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // If parsing fails, fall back to empty list
  }
  return [];
}

/**
 * Saves project changes (such as adding, removing, or syncing tasks)
 * strictly under the current user's email key.
 */
export function saveUserGroups(user: UserAccount, groups: StudentGroup[]): void {
  if (!user || !user.email) return;
  const key = getUserStorageKey(user.email, 'groups');
  try {
    localStorage.setItem(key, JSON.stringify(groups));
  } catch {
    // ignore storage error
  }
}

/**
 * Loads risk alerts for the current logged-in user.
 */
export function loadUserAlerts(user: UserAccount, groups: StudentGroup[]): SystemAlert[] {
  if (!user || !user.email) return [];
  const key = getUserStorageKey(user.email, 'alerts');
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  const initial = getInitialAlertsForUser(user, groups);
  try {
    localStorage.setItem(key, JSON.stringify(initial));
  } catch {
    // ignore
  }
  return initial;
}

/**
 * Saves risk alerts for the current logged-in user.
 */
export function saveUserAlerts(user: UserAccount, alerts: SystemAlert[]): void {
  if (!user || !user.email) return;
  const key = getUserStorageKey(user.email, 'alerts');
  try {
    localStorage.setItem(key, JSON.stringify(alerts));
  } catch {
    // ignore
  }
}
