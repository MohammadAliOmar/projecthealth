/**
 * Scoring Engine (Pure Functions, Zero External Dependencies)
 * 
 * Computes multi-factor Health Scores (0-100), risk classifications,
 * plain-English explanations, and actionable pedagogical recommendations.
 */

import {
  GroupMember,
  GroupTask,
  Message,
  ActivityLog,
  Thresholds,
  RiskLevel,
  ContributingFactor,
  ScoringMetrics,
  ScoringBreakdown
} from '../types';

export const DEFAULT_THRESHOLDS: Thresholds = {
  low: 70,
  medium: 40
};

export const WEIGHTS = {
  taskCompletion: 0.30,
  overdueTasks: 0.25,
  memberActivity: 0.20,
  workloadEquity: 0.15,
  communication: 0.10
};

/**
 * Calculates days between two date objects or ISO strings
 */
export function getDaysDifference(pastDate: Date | string, referenceDate: Date = new Date()): number {
  const past = typeof pastDate === 'string' ? new Date(pastDate) : pastDate;
  const diffMs = referenceDate.getTime() - past.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Calculates raw metrics and factor sub-scores from group domain data
 */
export function calculateScoringMetrics(
  members: GroupMember[],
  tasks: GroupTask[],
  messages: Message[],
  activityLogs: ActivityLog[],
  now: Date = new Date()
): ScoringMetrics {
  // 3b: Exclude from ALL scoring inputs any advisory tasks or tasks starting with [ProjectHealth AI]
  const validTasks = tasks.filter(t => {
    if (!t) return false;
    if (t.title && t.title.startsWith('[ProjectHealth AI]')) return false;
    if ((t as any).name && (t as any).name.startsWith('[ProjectHealth AI]')) return false;
    if ((t as any).isAdvisory) return false;
    if ((t as any).isLecturerAuthored) return false;
    return true;
  });

  // Exclude members who left the project
  const activeMembers = members.filter(m => (m as any).status !== 'Left project');
  const memberCount = Math.max(1, activeMembers.length);

  // 1. Task Completion Score
  const totalTasksCount = validTasks.length;
  const completedTasks = validTasks.filter(t => t.status === 'Completed');
  const completedTasksCount = completedTasks.length;
  const taskCompletionScore = totalTasksCount === 0 
    ? 100 
    : Math.min(100, Math.max(0, Math.round((completedTasksCount / totalTasksCount) * 100)));

  // 2. Overdue Task Score
  let overdueTasksCount = 0;
  let totalDaysOverdue = 0;
  let mostOverdueTaskTitle: string | undefined;
  let mostOverdueTaskDays = 0;

  for (const task of validTasks) {
    if (task.status === 'Completed') continue;
    const due = typeof task.dueDate === 'string' ? new Date(task.dueDate) : task.dueDate;
    if (due.getTime() < now.getTime()) {
      overdueTasksCount++;
      const daysOverdue = getDaysDifference(due, now);
      totalDaysOverdue += daysOverdue;
      if (daysOverdue > mostOverdueTaskDays) {
        mostOverdueTaskDays = daysOverdue;
        mostOverdueTaskTitle = task.title;
      }
    }
  }

  const overdueTaskScore = Math.max(0, Math.round(100 - (20 * overdueTasksCount) - (2 * totalDaysOverdue)));

  // 3. Member Activity Score
  let totalMemberScore = 0;
  let maxInactiveDays = 0;
  let inactiveMemberName: string | undefined;

  for (const member of activeMembers) {
    // Find latest activity from activityLogs or member tasks
    let memberLatest = member.joinedAt;
    const memberLogs = activityLogs.filter(l => l.userId === member.id);
    if (memberLogs.length > 0) {
      memberLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      memberLatest = memberLogs[0].timestamp;
    }

    const daysInactive = getDaysDifference(memberLatest, now);
    if (daysInactive > maxInactiveDays) {
      maxInactiveDays = daysInactive;
      inactiveMemberName = member.name;
    }

    const scoreForMember = Math.max(0, 100 - (12 * daysInactive));
    totalMemberScore += scoreForMember;
  }

  const memberActivityScore = Math.round(totalMemberScore / memberCount);

  // 4. Workload Equity Score
  let workloadEquityScore = 50;
  let maxShare = 0;
  let dominantMemberName: string | undefined;

  if (completedTasksCount > 0 && memberCount > 1) {
    const completionsByMember: Record<string, number> = {};
    for (const t of completedTasks) {
      const assigneeId = t.completedById || t.assigneeId;
      if (assigneeId) {
        completionsByMember[assigneeId] = (completionsByMember[assigneeId] || 0) + 1;
      }
    }

    let topCompletedCount = 0;
    let topMemberId = '';
    for (const [mId, count] of Object.entries(completionsByMember)) {
      if (count > topCompletedCount) {
        topCompletedCount = count;
        topMemberId = mId;
      }
    }

    maxShare = topCompletedCount / completedTasksCount;
    const dominant = activeMembers.find(m => m.id === topMemberId);
    dominantMemberName = dominant ? dominant.name : 'A single member';

    const idealShare = 1 / memberCount;
    if (maxShare <= idealShare) {
      workloadEquityScore = 100;
    } else {
      const equityIndex = 1 - ((maxShare - idealShare) / (1 - idealShare));
      workloadEquityScore = Math.max(0, Math.min(100, Math.round(100 * equityIndex)));
    }
  } else if (completedTasksCount > 0 && memberCount === 1) {
    workloadEquityScore = 100;
    maxShare = 1;
  }

  // 5. Communication Score
  // Average messages per day over the last 7 days
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentMessages = messages.filter(m => new Date(m.timestamp).getTime() >= sevenDaysAgo.getTime());
  const avgMessagesPerDay7d = Math.round((recentMessages.length / 7) * 10) / 10;

  let daysSinceLastMessage = 7;
  if (messages.length > 0) {
    const sortedMessages = [...messages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    daysSinceLastMessage = getDaysDifference(sortedMessages[0].timestamp, now);
  }

  const baseComm = Math.min(100, avgMessagesPerDay7d * 20);
  const commPenalty = 10 * Math.max(0, daysSinceLastMessage - 2);
  const communicationScore = Math.max(0, Math.round(baseComm - commPenalty));

  // Determine group-level last activity days
  let lastActivityDays = maxInactiveDays;
  if (activityLogs.length > 0) {
    const latestLog = [...activityLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    lastActivityDays = getDaysDifference(latestLog.timestamp, now);
  }

  return {
    taskCompletionScore,
    overdueTaskScore,
    memberActivityScore,
    workloadEquityScore,
    communicationScore,
    completedTasksCount,
    totalTasksCount,
    overdueTasksCount,
    totalDaysOverdue,
    daysSinceLastActivity: lastActivityDays,
    avgMessagesPerDay7d,
    daysSinceLastMessage,
    maxShare,
    dominantMemberName,
    inactiveMemberName: maxInactiveDays >= 5 ? inactiveMemberName : undefined,
    inactiveDays: maxInactiveDays,
    mostOverdueTaskTitle,
    mostOverdueTaskDays
  };
}

/**
 * Computes the overall Health Score (0-100) using the weighted formula
 */
export function computeHealthScore(metrics: ScoringMetrics): number {
  const score =
    metrics.taskCompletionScore * WEIGHTS.taskCompletion +
    metrics.overdueTaskScore * WEIGHTS.overdueTasks +
    metrics.memberActivityScore * WEIGHTS.memberActivity +
    metrics.workloadEquityScore * WEIGHTS.workloadEquity +
    metrics.communicationScore * WEIGHTS.communication;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Classifies risk level based on configured thresholds
 */
export function getRiskLevel(score: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): RiskLevel {
  if (score >= thresholds.low) return 'Low';
  if (score >= thresholds.medium) return 'Medium';
  return 'High';
}

/**
 * Evaluates points lost per factor to extract top 2-3 contributing factors
 */
export function generateContributingFactors(metrics: ScoringMetrics): ContributingFactor[] {
  const factorPoints: { factor: string; description: string; pointsLost: number }[] = [];

  // Overdue Tasks (Weight: 0.25)
  const overdueLost = WEIGHTS.overdueTasks * (100 - metrics.overdueTaskScore);
  if (overdueLost >= 3 || metrics.overdueTasksCount > 0) {
    let desc = `${metrics.overdueTasksCount} task${metrics.overdueTasksCount === 1 ? ' is' : 's are'} overdue.`;
    if (metrics.mostOverdueTaskTitle && (metrics.mostOverdueTaskDays ?? 0) > 0) {
      desc = `${metrics.overdueTasksCount} task${metrics.overdueTasksCount === 1 ? ' is' : 's are'} overdue, including "${metrics.mostOverdueTaskTitle}", which is ${metrics.mostOverdueTaskDays} day${metrics.mostOverdueTaskDays === 1 ? '' : 's'} overdue.`;
    }
    factorPoints.push({
      factor: 'Overdue Tasks',
      description: desc,
      pointsLost: Math.round(overdueLost * 10) / 10
    });
  }

  // Member Activity (Weight: 0.20)
  const activityLost = WEIGHTS.memberActivity * (100 - metrics.memberActivityScore);
  if (activityLost >= 3 || (metrics.inactiveDays && metrics.inactiveDays >= 5)) {
    const memberName = metrics.inactiveMemberName || 'A team member';
    const desc = metrics.inactiveDays && metrics.inactiveDays >= 5
      ? `Member "${memberName}" has not contributed for ${metrics.inactiveDays} days.`
      : `Team member activity has fallen below expected velocity thresholds.`;
    factorPoints.push({
      factor: 'Member Inactivity',
      description: desc,
      pointsLost: Math.round(activityLost * 10) / 10
    });
  }

  // Task Completion (Weight: 0.30)
  const completionLost = WEIGHTS.taskCompletion * (100 - metrics.taskCompletionScore);
  if (completionLost >= 3) {
    const desc = `Only ${metrics.taskCompletionScore}% of tasks are complete (${metrics.completedTasksCount} of ${metrics.totalTasksCount}).`;
    factorPoints.push({
      factor: 'Low Task Completion',
      description: desc,
      pointsLost: Math.round(completionLost * 10) / 10
    });
  }

  // Workload Equity (Weight: 0.15)
  const equityLost = WEIGHTS.workloadEquity * (100 - metrics.workloadEquityScore);
  if (equityLost >= 3 && metrics.maxShare >= 0.5) {
    const percent = Math.round(metrics.maxShare * 100);
    const dominant = metrics.dominantMemberName || 'One member';
    const desc = `Member "${dominant}" has completed ${percent}% of all completed tasks.`;
    factorPoints.push({
      factor: 'Workload Imbalance',
      description: desc,
      pointsLost: Math.round(equityLost * 10) / 10
    });
  }

  // Communication (Weight: 0.10)
  const commLost = WEIGHTS.communication * (100 - metrics.communicationScore);
  if (commLost >= 2 || metrics.daysSinceLastMessage >= 3) {
    const desc = `The group averages ${metrics.avgMessagesPerDay7d} message${metrics.avgMessagesPerDay7d === 1 ? '' : 's'} per day and the last message was ${metrics.daysSinceLastMessage} days ago.`;
    factorPoints.push({
      factor: 'Low Communication',
      description: desc,
      pointsLost: Math.round(commLost * 10) / 10
    });
  }

  // Sort by points lost descending and pick top 2 to 3
  factorPoints.sort((a, b) => b.pointsLost - a.pointsLost);
  return factorPoints.slice(0, 3);
}

/**
 * Builds plain English risk explanation sentence from contributing factors
 */
export function buildRiskExplanation(factors: ContributingFactor[]): string {
  if (factors.length === 0) {
    return 'The project is progressing smoothly across all measured milestones with balanced contributions.';
  }
  return factors.map(f => f.description).join(' ');
}

/**
 * Generates an actionable recommendation based on the top risk drivers
 */
export function buildRecommendation(factors: ContributingFactor[]): string {
  if (factors.length === 0) {
    return 'Continue monitoring project progress.';
  }

  const factorTitles = factors.map(f => f.factor.toLowerCase());

  if (factorTitles.some(f => f.includes('inactivity'))) {
    return 'Contact the inactive student to check on personal circumstances and unblock contributions.';
  }
  if (factorTitles.some(f => f.includes('overdue'))) {
    return 'Review task allocation and deadlines with the team to reset sprint commitments.';
  }
  if (factorTitles.some(f => f.includes('imbalance'))) {
    return 'Review task allocation to redistribute deliverables more fairly among teammates.';
  }
  if (factorTitles.some(f => f.includes('communication'))) {
    return 'Schedule a meeting with the group to re-establish regular standups and collaboration.';
  }

  return 'Schedule an advisory milestone check-in to review sprint deliverables.';
}

/**
 * Complete assessment pipeline
 */
export function assessGroupHealth(
  members: GroupMember[],
  tasks: GroupTask[],
  messages: Message[],
  activityLogs: ActivityLog[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
  now: Date = new Date()
): ScoringBreakdown {
  const metrics = calculateScoringMetrics(members, tasks, messages, activityLogs, now);
  const finalScore = computeHealthScore(metrics);
  const riskLevel = getRiskLevel(finalScore, thresholds);
  const topFactors = generateContributingFactors(metrics);
  const riskExplanation = buildRiskExplanation(topFactors);
  const recommendation = buildRecommendation(topFactors);

  return {
    finalScore,
    riskLevel,
    metrics,
    topFactors,
    riskExplanation,
    recommendation
  };
}
