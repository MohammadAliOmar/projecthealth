// Export all domain model types
export * from './types/index';

// Custom / Dashboard specific types
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  assignedTasks: number;
  completedTasks: number;
  commits: number;
  prReviews: number;
  messagesSent: number;
  lastActive: string;
  workloadSharePercent: number;
  status: 'Balanced' | 'Overloaded' | 'At-Risk / Disengaged';
}

export interface ProjectTask {
  id: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  status: 'Completed' | 'In Progress' | 'Overdue';
  priority: 'High' | 'Medium' | 'Low';
  weight: number;
}

export interface MetricFactor {
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  statusText: string;
  riskImpact: 'Critical' | 'Warning' | 'Healthy';
}

export interface HealthTrendPoint {
  day: number;
  date: string;
  score: number;
  event?: string;
}

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  severity: 'Critical' | 'Moderate' | 'Notice';
  scoreImpact: number;
  suggestedAction: string;
}

export interface SentTeamMessage {
  id: string;
  senderName: string;
  senderEmail?: string;
  recipient: string;
  recipientEmail?: string;
  subject: string;
  content: string;
  timestamp: string;
  channels: string[];
}

export interface StudentGroup {
  id: string;
  name: string;
  projectTitle: string;
  courseCode: string;
  courseName: string;
  lastActivity: string;
  lastActivityTimestamp: string;
  teamLeader: string;
  repoUrl: string;
  asanaWorkspace: string;
  
  // Factor scores (0 - 100)
  taskCompletionScore: number; // weight 0.30
  overdueTaskScore: number;    // weight 0.25
  memberActivityScore: number; // weight 0.20
  workloadEquityScore: number; // weight 0.15
  communicationScore: number;  // weight 0.10
  healthScore?: number;
  calculatedScore?: number;
  calculatedRisk?: 'Low' | 'Medium' | 'High';
  
  members: TeamMember[];
  tasks: ProjectTask[];
  riskFactors: RiskFactor[];
  trends: {
    sevenDays: HealthTrendPoint[];
    fourteenDays: HealthTrendPoint[];
    thirtyDays: HealthTrendPoint[];
  };
  messages?: SentTeamMessage[];
}

export interface SystemAlert {
  id: string;
  groupId: string;
  groupName: string;
  courseCode: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  healthScore: number;
  contributingFactors: string;
  timestamp: string;
  read: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
}
