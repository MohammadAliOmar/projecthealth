export type RiskLevel = 'Low' | 'Medium' | 'High';

export type GroupStatus = 'Active' | 'Reviewed' | 'Completed';

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue';

export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface QuietHours {
  start: string; // '22:00'
  end: string;   // '07:00'
}

export interface Thresholds {
  low: number;    // default 70
  medium: number; // default 40
}

export interface Course {
  code: string;
  name: string;
}

export interface DashboardDefaults {
  sort: 'risk' | 'score' | 'name' | 'activity';
  filter: 'all' | 'Low' | 'Medium' | 'High';
}

export interface UserSettings {
  emailAlerts?: boolean;
  alertLevels?: RiskLevel[];
  quietHours?: QuietHours;
  webhookUrl?: string;
  thresholds?: Thresholds;
  dashboardDefaults?: DashboardDefaults;
  emailNotifications?: boolean;
  highRiskAlerts?: boolean;
  dailyDigest?: boolean;
  asanaWebhookSync?: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'lecturer';
  courses: Course[];
  settings: UserSettings;
}

export interface GroupMember {
  id: string;
  lecturerId: string;
  name: string;
  role: string;
  joinedAt: Date | string;
  tasksCompleted?: number;
  totalTasksAssigned?: number;
  daysSinceLastActivity?: number;
  contributionPercent?: number;
}

export interface GroupTask {
  id: string;
  lecturerId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | string;
  assigneeId: string;
  completedAt?: Date | string | null;
  completedById?: string | null;
}

export interface ActivityLog {
  id: string;
  lecturerId: string;
  userId: string;
  userName?: string;
  actionType: 'commit' | 'task_completed' | 'pr_merged' | 'document_edit';
  timestamp: Date | string;
}

export interface Message {
  id: string;
  lecturerId: string;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: Date | string;
}

export interface ContributingFactor {
  factor: string;
  description: string;
  pointsLost?: number;
}

export interface HealthSnapshot {
  id: string;
  lecturerId: string;
  score: number;
  riskLevel: RiskLevel;
  riskExplanation: string;
  topFactors: ContributingFactor[];
  recommendation: string;
  snapshotTimestamp: Date | string;
}

export interface HistoryItem {
  id: string;
  lecturerId: string;
  type: 'message_sent' | 'meeting_requested' | 'marked_reviewed';
  note: string;
  timestamp: Date | string;
}

export interface DeliveryChannelLog {
  channel: 'in_app' | 'email' | 'webhook';
  status: 'Sent' | 'Failed' | 'Skipped';
  attempts: number;
  timestamp: Date | string;
  error?: string;
}

export interface Alert {
  id: string;
  lecturerId: string;
  groupId: string;
  groupName: string;
  projectName: string;
  riskLevel: RiskLevel;
  healthScore: number;
  contributingFactors: ContributingFactor[] | string[];
  recommendation: string;
  triggerType: 'risk_worsened' | 'high_risk' | 'medium_streak' | 'critical_overdue' | 'critical_inactive';
  status: 'New' | 'Read' | 'Reviewed';
  deliveries: DeliveryChannelLog[];
  createdAt: Date | string;
}

export interface AuditLog {
  id: string;
  lecturerId: string;
  event: string;
  timestamp: Date | string;
}

export interface Group {
  id: string;
  lecturerId: string;
  groupName: string;
  projectTitle: string;
  courseCode: string;
  status: GroupStatus;
  memberCount: number;
  lastActivityAt: Date | string;
  latestScore: number;
  latestRisk: RiskLevel;
  previousScore: number;
  mediumStreak: number;
  // Computed client-side / cache
  members?: GroupMember[];
  tasks?: GroupTask[];
  recentSnapshots?: HealthSnapshot[];
  topFactors?: ContributingFactor[];
}

export interface ScoringMetrics {
  taskCompletionScore: number;
  overdueTaskScore: number;
  memberActivityScore: number;
  workloadEquityScore: number;
  communicationScore: number;
  completedTasksCount: number;
  totalTasksCount: number;
  overdueTasksCount: number;
  totalDaysOverdue: number;
  daysSinceLastActivity: number;
  avgMessagesPerDay7d: number;
  daysSinceLastMessage: number;
  maxShare: number;
  dominantMemberName?: string;
  inactiveMemberName?: string;
  inactiveDays?: number;
  mostOverdueTaskTitle?: string;
  mostOverdueTaskDays?: number;
}

export interface ScoringBreakdown {
  finalScore: number;
  riskLevel: RiskLevel;
  metrics: ScoringMetrics;
  topFactors: ContributingFactor[];
  riskExplanation: string;
  recommendation: string;
}
