import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Mail,
  Calendar,
  FileDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Clock,
  Users,
  CheckSquare,
  Activity,
  Sliders,
  ExternalLink,
  ShieldAlert,
  Send,
  Sparkles,
  GitCommit,
  MessageSquare,
  FileText,
  Trash2,
  Plus,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { StudentGroup, RiskLevel, ProjectTask, TeamMember } from '../types';
import { calculateHealthScore, getRiskClassification } from '../mockData';
import { AddMemberModal } from './Modals';
import { syncStudentGroupFromAsana } from '../services/asanaService';

interface GroupDetailsViewProps {
  group: StudentGroup;
  allGroups?: StudentGroup[];
  onSelectOtherGroup?: (group: StudentGroup) => void;
  onBack: () => void;
  onSendMessage: (group: StudentGroup) => void;
  onRequestMeeting: (group: StudentGroup) => void;
  onExportReport: (group: StudentGroup, format: 'csv' | 'pdf') => void;
  onUpdateGroupScores: (updatedGroup: StudentGroup) => void;
  onRemoveProject: (group: StudentGroup) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const GroupDetailsView: React.FC<GroupDetailsViewProps> = ({
  group,
  allGroups = [],
  onSelectOtherGroup,
  onBack,
  onSendMessage,
  onRequestMeeting,
  onExportReport,
  onUpdateGroupScores,
  onRemoveProject,
  onShowToast,
}) => {
  const [trendRange, setTrendRange] = useState<'7' | '14' | '30'>('7');
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'members' | 'simulator'>('overview');
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; score: number; event?: string } | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isSyncingAsana, setIsSyncingAsana] = useState(false);

  // Compute live health score using exact formula
  const currentHealthScore = useMemo(() => {
    return calculateHealthScore({
      taskCompletionScore: group.taskCompletionScore,
      overdueTaskScore: group.overdueTaskScore,
      memberActivityScore: group.memberActivityScore,
      workloadEquityScore: group.workloadEquityScore,
      communicationScore: group.communicationScore,
    });
  }, [group]);

  const currentRisk = useMemo(() => {
    return getRiskClassification(currentHealthScore);
  }, [currentHealthScore]);

  // Tasks statistics
  const totalTasks = group.tasks.length;
  const completedTasks = group.tasks.filter((t) => t.status === 'Completed').length;
  const inProgressTasks = group.tasks.filter((t) => t.status === 'In Progress').length;
  const overdueTasks = group.tasks.filter((t) => t.status === 'Overdue').length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Trend data selector
  const activeTrendData = useMemo(() => {
    if (trendRange === '7') return group.trends.sevenDays;
    if (trendRange === '14') return group.trends.fourteenDays;
    return group.trends.thirtyDays;
  }, [group, trendRange]);

  // Task input state for manual addition
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState(group.members[0]?.name || 'Team Member');
  const [newTaskDueDate, setNewTaskDueDate] = useState('2026-09-28');
  const [newTaskStatus, setNewTaskStatus] = useState<ProjectTask['status']>('Overdue');
  const [newTaskPriority, setNewTaskPriority] = useState<ProjectTask['priority']>('High');
  const [isSyncingTasks, setIsSyncingTasks] = useState(false);

  // Helper to recompute group metrics from a task list
  const applyTasksUpdate = (updatedTasks: ProjectTask[], additionalUpdates?: Partial<StudentGroup>) => {
    const total = updatedTasks.length || 1;
    const newCompleted = updatedTasks.filter((t) => t.status === 'Completed').length;
    const newOverdue = updatedTasks.filter((t) => t.status === 'Overdue').length;

    // Exact formula inputs
    const newTaskScore = Math.min(100, Math.round((newCompleted / total) * 100));
    const overdueRatio = newOverdue / total;
    const newOverdueScore = Math.max(0, Math.min(100, Math.round(100 - overdueRatio * 120)));

    // Dynamic risk factors
    const updatedRiskFactors = [...group.riskFactors];
    const overdueIdx = updatedRiskFactors.findIndex((rf) =>
      rf.title.toLowerCase().includes('overdue')
    );

    if (newOverdue > 0) {
      const overdueFactor = {
        id: `rf-overdue-${Date.now()}`,
        title: `Critical Overdue Deliverables (${newOverdue} Overdue Tasks)`,
        description: `${newOverdue} of ${total} tasks (${Math.round(
          overdueRatio * 100
        )}%) are past due date, severely depressing project health.`,
        severity: newOverdue >= 3 ? ('Critical' as const) : ('Moderate' as const),
        scoreImpact: Math.round(-overdueRatio * 25 * 10) / 10,
        suggestedAction: 'Reassign or descope overdue sprint tasks immediately.',
      };
      if (overdueIdx >= 0) {
        updatedRiskFactors[overdueIdx] = overdueFactor;
      } else {
        updatedRiskFactors.unshift(overdueFactor);
      }
    } else if (overdueIdx >= 0) {
      updatedRiskFactors.splice(overdueIdx, 1);
    }

    const updatedGroup: StudentGroup = {
      ...group,
      tasks: updatedTasks,
      taskCompletionScore: newTaskScore,
      overdueTaskScore: newOverdueScore,
      riskFactors: updatedRiskFactors,
      ...additionalUpdates,
    };

    onUpdateGroupScores(updatedGroup);
  };

  // Handle task status toggle
  const handleToggleTaskStatus = (taskId: string, newStatus: ProjectTask['status']) => {
    const updatedTasks = group.tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, status: newStatus };
      }
      return t;
    });
    applyTasksUpdate(updatedTasks);
  };

  // Handle delete task
  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = group.tasks.filter((t) => t.id !== taskId);
    applyTasksUpdate(updatedTasks);
  };

  // Handle add task
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: ProjectTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      assigneeId: group.members[0]?.id || 'm-1',
      assigneeName: newTaskAssignee,
      dueDate: newTaskDueDate,
      status: newTaskStatus,
      priority: newTaskPriority,
      weight: 10,
    };

    applyTasksUpdate([...group.tasks, newTask]);
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  // Handle Asana task sync
  const handleSyncAsanaTasks = () => {
    setIsSyncingTasks(true);
    setTimeout(() => {
      setIsSyncingTasks(false);
      const updatedTasks = group.tasks.map((t) => {
        if (t.status !== 'Completed') {
          return { ...t, status: 'Overdue' as const };
        }
        return t;
      });
      applyTasksUpdate(updatedTasks, {
        lastActivity: 'Just now (Synced from Asana)',
      });
    }, 1000);
  };

  const handleSyncThisGroupFromAsana = async () => {
    setIsSyncingAsana(true);
    try {
      const updated = await syncStudentGroupFromAsana(group);
      onUpdateGroupScores(updated);
      if (onShowToast) {
        onShowToast(
          `Synced with Asana: Updated to ${updated.members.length} members and ${updated.tasks.length} tasks!`,
          'success'
        );
      }
    } catch (e: any) {
      console.warn('Sync notice:', e);
      // Item 6: A failed live fetch must keep the group's last real data unchanged and show the error to the lecturer
      if (onShowToast) {
        onShowToast(e.message || 'Unable to sync from Asana. Preserved last good data.', 'warning');
      }
    } finally {
      setIsSyncingAsana(false);
    }
  };

  const handleMemberAdded = (updatedGroup: StudentGroup, newMember: TeamMember) => {
    onUpdateGroupScores(updatedGroup);
    if (onShowToast) {
      onShowToast(
        `Added student ${newMember.name} to team! Total members now: ${updatedGroup.members.length}.`,
        'success'
      );
    }
  };

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            High Risk (Health Score &lt; 40)
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Medium Risk (Health Score 40-69)
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Low Risk (Health Score &ge; 70)
          </span>
        );
    }
  };

  // SVG Chart Dimensions & Path Generation
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 25;

  const points = useMemo(() => {
    const count = activeTrendData.length;
    return activeTrendData.map((pt, idx) => {
      const x = paddingX + (idx / (count - 1)) * (svgWidth - paddingX * 2);
      // y-axis 0 to 100
      const y = svgHeight - paddingY - (pt.score / 100) * (svgHeight - paddingY * 2);
      return { x, y, data: pt };
    });
  }, [activeTrendData]);

  const linePathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');
  }, [points]);

  const areaPathD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = svgHeight - paddingY;
    return `${linePathD} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [linePathD, points]);

  // Reference lines for 70 (Low) and 40 (Medium/High)
  const y70 = svgHeight - paddingY - (70 / 100) * (svgHeight - paddingY * 2);
  const y40 = svgHeight - paddingY - (40 / 100) * (svgHeight - paddingY * 2);

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            aria-label="Back to groups dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Dashboard</span>
            {allGroups.length > 0 && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">
                {allGroups.length}
              </span>
            )}
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Courses</span>
              <span>/</span>
              <span className="font-mono text-slate-700">{group.courseCode}</span>
              <span>/</span>
              <span className="text-slate-900 font-semibold">{group.name}</span>
              {allGroups.length > 1 && onSelectOtherGroup && (
                <div className="ml-2 inline-flex items-center gap-1">
                  <span className="text-slate-400">| Switch:</span>
                  <select
                    value={group.id}
                    onChange={(e) => {
                      const target = allGroups.find((g) => g.id === e.target.value);
                      if (target) onSelectOtherGroup(target);
                    }}
                    className="text-[11px] py-0.5 px-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-800 font-medium cursor-pointer"
                  >
                    {allGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.courseCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              {group.name}: {group.projectTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {group.dataSource === 'live' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Synced from Asana {group.lastSyncedAt ? `(${new Date(group.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Simulated data, not read from Asana
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncThisGroupFromAsana}
            disabled={isSyncingAsana}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            title="Fetch latest members and tasks directly from Asana"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingAsana ? 'animate-spin' : ''}`} />
            <span>{isSyncingAsana ? 'Syncing...' : 'Sync from Asana'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSendMessage(group)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            Send Team Message
          </button>

          <button
            type="button"
            onClick={() => onRequestMeeting(group)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Set Up Meeting
          </button>

          <div className="relative group/export">
            <button
              type="button"
              onClick={() => onExportReport(group, 'csv')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500" />
              Download Report
            </button>
          </div>

          <button
            type="button"
            onClick={() => onRemoveProject(group)}
            title="Remove this project from active tracking"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            Remove Project
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 relative cursor-pointer ${
            activeTab === 'overview'
              ? 'text-indigo-600 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Overview &amp; Health Trend
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 relative cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'text-indigo-600 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Tasks &amp; To-Dos</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
            {group.tasks.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`pb-3 relative cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'members'
              ? 'text-indigo-600 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Team Members &amp; Work Share</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
            {group.members.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('simulator')}
          className={`pb-3 relative cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'simulator'
              ? 'text-indigo-600 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Health Score Details</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & RISK DIAGNOSTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Row: Risk Summary Panel + Top 2 to 3 Risk Factors */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Risk Summary Panel (FR 03) */}
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Health Summary
                  </h2>
                  {getRiskBadge(currentRisk)}
                </div>

                {/* Circular Score Gauge */}
                <div className="mt-6 flex flex-col items-center justify-center text-center">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="text-slate-100 stroke-current"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className={`${
                          currentRisk === 'High'
                            ? 'text-rose-600'
                            : currentRisk === 'Medium'
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        } stroke-current transition-all duration-1000 ease-out`}
                        strokeWidth="10"
                        strokeDasharray={264}
                        strokeDashoffset={264 - (264 * currentHealthScore) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums">
                        {currentHealthScore}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">OUT OF 100</span>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-600 max-w-xs">
                    Score calculation:
                    <div className="text-[11px] text-slate-500 mt-1 bg-slate-50 py-1 px-2 rounded border border-slate-100">
                      30% Completed Tasks + 25% On-Time + 20% Activity + 15% Work Share + 10% Chat
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Score Bars */}
              <div className="mt-6 pt-4 border-t border-slate-100 space-y-2.5">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Completed Tasks (30% weight)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {group.taskCompletionScore}/100 ({Math.round(group.taskCompletionScore * 0.3 * 10) / 10} pts)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${group.taskCompletionScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">On-Time Delivery (25% weight)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {group.overdueTaskScore}/100 ({Math.round(group.overdueTaskScore * 0.25 * 10) / 10} pts)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        group.overdueTaskScore < 50 ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${group.overdueTaskScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Student Activity (20% weight)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {group.memberActivityScore}/100 ({Math.round(group.memberActivityScore * 0.2 * 10) / 10} pts)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${group.memberActivityScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Fair Work Share (15% weight)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {group.workloadEquityScore}/100 ({Math.round(group.workloadEquityScore * 0.15 * 10) / 10} pts)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        group.workloadEquityScore < 40 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${group.workloadEquityScore}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500 mt-1.5">
                    {group.members.map((m) => (
                      <span key={m.id} className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        {m.name}: <strong className="font-mono text-slate-700">{m.workloadSharePercent}%</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Team Messages (10% weight)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {group.communicationScore}/100 ({Math.round(group.communicationScore * 0.1 * 10) / 10} pts)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${group.communicationScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Explanation Section */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-base font-bold text-slate-900">
                      Why This Team Needs Attention
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">Automatic Check</span>
                </div>

                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Based on recent Asana tasks and team activity, here are the main reasons for this score:
                </p>

                <div className="space-y-3.5">
                  {group.riskFactors.map((factor, idx) => (
                    <div
                      key={factor.id}
                      className={`p-4 rounded-xl border ${
                        factor.severity === 'Critical'
                          ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                          : factor.severity === 'Moderate'
                          ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                          : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                              factor.severity === 'Critical'
                                ? 'bg-rose-200 text-rose-800'
                                : factor.severity === 'Moderate'
                                ? 'bg-amber-200 text-amber-800'
                                : 'bg-emerald-200 text-emerald-800'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {factor.title}
                            </div>
                            <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                              {factor.description}
                            </p>
                          </div>
                        </div>
                        {factor.scoreImpact < 0 && (
                          <span className="shrink-0 text-xs font-mono font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
                            {factor.scoreImpact} pts
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-medium">
                          <strong>Recommended Action:</strong> {factor.suggestedAction}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick message shortcut */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  We recommend reaching out to this team soon if they have late tasks.
                </span>
                <button
                  type="button"
                  onClick={() => onSendMessage(group)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Send Message to Team →
                </button>
              </div>
            </div>
          </div>

          {/* Health Score Trend Graph */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Health Score Over Time
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shows how this team's score changed over time against Low (≥70) and High (&lt;40) risk levels.
                </p>
              </div>

              {/* 7, 14, 30 Day Toggle */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                <button
                  type="button"
                  onClick={() => setTrendRange('7')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    trendRange === '7'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setTrendRange('14')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    trendRange === '14'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  14 Days
                </button>
                <button
                  type="button"
                  onClick={() => setTrendRange('30')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    trendRange === '30'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  30 Days
                </button>
              </div>
            </div>

            {/* SVG Interactive Chart */}
            <div className="relative w-full overflow-x-auto">
              <div className="min-w-[600px] h-[240px]">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  <line
                    x1={paddingX}
                    y1={y70}
                    x2={svgWidth - paddingX}
                    y2={y70}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeOpacity="0.7"
                  />
                  <text
                    x={svgWidth - paddingX + 5}
                    y={y70 + 4}
                    fill="#059669"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    Low Risk (70)
                  </text>

                  <line
                    x1={paddingX}
                    y1={y40}
                    x2={svgWidth - paddingX}
                    y2={y40}
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeOpacity="0.7"
                  />
                  <text
                    x={svgWidth - paddingX + 5}
                    y={y40 + 4}
                    fill="#e11d48"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    High Risk (40)
                  </text>

                  {/* Base X Axis line */}
                  <line
                    x1={paddingX}
                    y1={svgHeight - paddingY}
                    x2={svgWidth - paddingX}
                    y2={svgHeight - paddingY}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />

                  {/* Shaded Area */}
                  <path d={areaPathD} fill="url(#trendGradient)" />

                  {/* Trend Line */}
                  <path
                    d={linePathD}
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Points and Dates */}
                  {points.map((pt, i) => (
                    <g key={i}>
                      {/* X label */}
                      <text
                        x={pt.x}
                        y={svgHeight - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#64748b"
                        fontFamily="sans-serif"
                      >
                        {pt.data.date}
                      </text>

                      {/* Point circle */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredPoint?.date === pt.data.date ? 6 : 4}
                        fill={
                          pt.data.score >= 70
                            ? '#10b981'
                            : pt.data.score >= 40
                            ? '#f59e0b'
                            : '#f43f5e'
                        }
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPoint(pt.data)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  ))}
                </svg>
              </div>

              {/* Hover tooltip card */}
              {hoveredPoint && (
                <div className="absolute top-2 right-4 bg-slate-900 text-white p-2.5 rounded-lg shadow-lg text-xs space-y-0.5 border border-slate-700 animate-in fade-in duration-100">
                  <div className="text-slate-400 font-mono">{hoveredPoint.date}</div>
                  <div className="font-bold text-sm">
                    Score: <span className="tabular-nums font-mono">{hoveredPoint.score}</span>/100
                  </div>
                  {hoveredPoint.event && (
                    <div className="text-indigo-300 text-[11px] pt-1 border-t border-slate-700">
                      • {hoveredPoint.event}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sent Messages to Team Log */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Advisory Messages Sent to Team ({group.messages?.length || 0})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSendMessage(group)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer inline-flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Message to Team</span>
              </button>
            </div>

            {group.messages && group.messages.length > 0 ? (
              <div className="space-y-2">
                {group.messages.map((msg) => (
                  <div key={msg.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{msg.subject}</span>
                        <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-medium">
                          To: {msg.recipient}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-600 whitespace-pre-line leading-relaxed">{msg.content}</p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Dispatched via: {msg.channels.join(', ')}
                      </span>
                      {msg.recipientEmail && (
                        <span className="text-slate-400">Email: {msg.recipientEmail}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>No check-in messages sent to this team yet. Use the button to send guidance or unblock students.</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSendMessage(group)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shrink-0 cursor-pointer shadow-xs inline-flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Send Message</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TASK COMPLETION DASHBOARD (FR 03) */}
      {activeTab === 'tasks' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Task Completion Dashboard & Milestone Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tasks tracked directly from Asana integration. You can toggle statuses or add new tasks to reflect your real project state.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSyncAsanaTasks}
                disabled={isSyncingTasks}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTasks ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{isSyncingTasks ? 'Syncing...' : 'Sync Tasks with Asana'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddingTask(!isAddingTask)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingTask ? 'Close Form' : 'Add Task from Asana'}</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs pl-2 border-l border-slate-200">
                <span className="text-slate-500">Progress:</span>
                <strong className="font-mono text-slate-900 text-sm">{completionPercentage}%</strong>
              </div>
            </div>
          </div>

          {/* Add Task Inline Form */}
          {isAddingTask && (
            <form onSubmit={handleAddTask} className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
              <div className="font-bold text-xs text-indigo-900 uppercase tracking-wide">
                Add New Deliverable / Milestone from Asana
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title (e.g. End-to-end integration test)"
                  className="sm:col-span-5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
                />
                <input
                  type="text"
                  required
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  placeholder="Assignee name"
                  className="sm:col-span-3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                />
                <input
                  type="date"
                  required
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="sm:col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-[11px]"
                />
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value as any)}
                  className="sm:col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold"
                >
                  <option value="Overdue">Overdue</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingTask(false)}
                  className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-xs cursor-pointer"
                >
                  + Add & Recalculate Health
                </button>
              </div>
            </form>
          )}

          {/* Progress Bar with Color Breakdown */}
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`${completedTasks} Completed`}
              />
              <div
                style={{ width: `${(inProgressTasks / totalTasks) * 100}%` }}
                className="bg-indigo-500 h-full transition-all"
                title={`${inProgressTasks} In Progress`}
              />
              <div
                style={{ width: `${(overdueTasks / totalTasks) * 100}%` }}
                className="bg-rose-500 h-full transition-all"
                title={`${overdueTasks} Overdue`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Completed ({completedTasks})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  In Progress ({inProgressTasks})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  Overdue ({overdueTasks})
                </span>
              </div>
              <span className="text-slate-400">Total: {totalTasks} sprint items</span>
            </div>
          </div>

          {/* Interactive Task Checklist */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {group.tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        task.priority === 'High'
                          ? 'bg-rose-100 text-rose-700'
                          : task.priority === 'Medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {task.priority} Priority
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Due: {task.dueDate}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Assignee:</span>
                    <strong className="text-slate-700">{task.assigneeName}</strong>
                  </div>
                </div>

                {/* Status selector to simulate real-time status update */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <select
                    value={task.status}
                    onChange={(e) =>
                      handleToggleTaskStatus(task.id, e.target.value as ProjectTask['status'])
                    }
                    className={`text-xs font-semibold py-1.5 px-3 rounded-lg border cursor-pointer focus:ring-2 focus:ring-indigo-500 ${
                      task.status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : task.status === 'In Progress'
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    title="Delete task from project"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MEMBER ACTIVITY & WORKLOAD */}
      {activeTab === 'members' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Team Members &amp; Work Share
                </h3>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-mono">
                  {group.members.length} Members
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Workload equity &amp; contribution breakdown synced with Asana project tasks.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncThisGroupFromAsana}
                disabled={isSyncingAsana}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-all"
                title="Fetch latest members and tasks directly from Asana"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncingAsana ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{isSyncingAsana ? 'Syncing...' : 'Sync from Asana'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddMemberOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Student Member</span>
              </button>
            </div>
          </div>

          {/* Workload Equity Bar Visualizer */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">How Work is Divided</span>
              <span className="text-slate-500">
                Fair share per student: ~{Math.round(100 / group.members.length)}%
              </span>
            </div>

            <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  style={{ width: `${member.workloadSharePercent}%` }}
                  className={`${member.avatarColor} h-full transition-all`}
                  title={`${member.name}: ${member.workloadSharePercent}% of total team work`}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
              {group.members.map((member) => (
                <div key={member.id} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${member.avatarColor}`} />
                  <span className="font-medium text-slate-800">{member.name}:</span>
                  <span className="font-mono">{member.workloadSharePercent}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Member Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.members.map((member) => (
              <div
                key={member.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-white space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${member.avatarColor} text-white flex items-center justify-center font-bold text-sm`}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{member.name}</h4>
                      <p className="text-xs text-slate-500">{member.role}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                        member.status === 'Left project'
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : member.status === 'Overloaded'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : member.status === 'At-Risk / Disengaged'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {member.status === 'Left project'
                        ? 'Left project'
                        : member.status === 'Overloaded'
                        ? 'Doing Too Much'
                        : member.status === 'At-Risk / Disengaged'
                        ? 'Not Active'
                        : 'Balanced'}
                    </span>
                    <span className="text-[11px] text-slate-600 font-medium">
                      Workload Share: <strong className="font-mono text-indigo-600">{member.workloadSharePercent}%</strong>
                    </span>
                  </div>
                </div>

                {/* Member Metrics */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Tasks Done</div>
                    <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                      {member.completedTasks}/{member.assignedTasks}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Code Updates</div>
                    <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                      {member.commits}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Messages</div>
                    <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                      {member.messagesSent}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Last active: {member.lastActive}</span>
                  <a
                    href={`mailto:${member.email}`}
                    className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <Mail className="w-3 h-3" />
                    {member.email}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: FORMULA AUDIT (READ-ONLY, FIXED ACCORDING TO ASANA DATA) */}
      {activeTab === 'simulator' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                  Formula
                </span>
                <span className="text-xs text-slate-500">· Calculated from Asana</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                How This Health Score is Calculated
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                These scores come directly from your Asana tasks, due dates, and student contributions.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Total Health Score</span>
                <div className="text-2xl font-bold font-mono text-indigo-600 tabular-nums">
                  {currentHealthScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncThisGroupFromAsana}
                disabled={isSyncingAsana}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAsana ? 'animate-spin' : ''}`} />
                <span>{isSyncingAsana ? 'Syncing...' : 'Sync with Asana'}</span>
              </button>
            </div>
          </div>

          {/* Detailed Audit Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            <div className="bg-slate-50 px-4 py-2.5 grid grid-cols-12 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <div className="col-span-4">Category &amp; Importance</div>
              <div className="col-span-4">What We Count from Asana</div>
              <div className="col-span-2 text-center">Score</div>
              <div className="col-span-2 text-right">Points Earned</div>
            </div>

            {/* 1. Task Completion */}
            <div className="px-4 py-3 grid grid-cols-12 items-center text-xs">
              <div className="col-span-4">
                <div className="font-bold text-slate-900">Completed Tasks</div>
                <div className="text-[11px] text-slate-500">Weight: 30% of total score</div>
              </div>
              <div className="col-span-4 text-slate-700">
                <span className="font-semibold">{completedTasks}</span> completed out of <span className="font-semibold">{totalTasks}</span> total tasks
              </div>
              <div className="col-span-2 text-center font-mono font-bold text-slate-900">
                {group.taskCompletionScore}/100
              </div>
              <div className="col-span-2 text-right font-mono font-bold text-indigo-600">
                +{(Math.round(group.taskCompletionScore * 0.30 * 10) / 10).toFixed(1)} pts
              </div>
            </div>

            {/* 2. Overdue Tasks */}
            <div className="px-4 py-3 grid grid-cols-12 items-center text-xs bg-slate-50/40">
              <div className="col-span-4">
                <div className="font-bold text-slate-900">On-Time Tasks</div>
                <div className="text-[11px] text-slate-500">Weight: 25% of total score</div>
              </div>
              <div className="col-span-4 text-slate-700">
                <span className={`font-semibold ${overdueTasks > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {overdueTasks} late
                </span>{' '}
                out of {totalTasks} tasks ({totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0}% late)
              </div>
              <div className={`col-span-2 text-center font-mono font-bold ${group.overdueTaskScore < 50 ? 'text-rose-600' : 'text-slate-900'}`}>
                {group.overdueTaskScore}/100
              </div>
              <div className="col-span-2 text-right font-mono font-bold text-indigo-600">
                +{(Math.round(group.overdueTaskScore * 0.25 * 10) / 10).toFixed(1)} pts
              </div>
            </div>

            {/* 3. Member Activity */}
            <div className="px-4 py-3 grid grid-cols-12 items-center text-xs">
              <div className="col-span-4">
                <div className="font-bold text-slate-900">Student Activity</div>
                <div className="text-[11px] text-slate-500">Weight: 20% of total score</div>
              </div>
              <div className="col-span-4 text-slate-700">
                {group.members.length} students actively completing tasks and commits in Asana
              </div>
              <div className="col-span-2 text-center font-mono font-bold text-slate-900">
                {group.memberActivityScore}/100
              </div>
              <div className="col-span-2 text-right font-mono font-bold text-indigo-600">
                +{(Math.round(group.memberActivityScore * 0.20 * 10) / 10).toFixed(1)} pts
              </div>
            </div>

            {/* 4. Workload Equity */}
            <div className="px-4 py-3 grid grid-cols-12 items-center text-xs bg-slate-50/40">
              <div className="col-span-4">
                <div className="font-bold text-slate-900">Fair Work Share</div>
                <div className="text-[11px] text-slate-500">Weight: 15% of total score</div>
              </div>
              <div className="col-span-4 text-slate-700">
                How evenly work is divided among {group.members.length} team members
              </div>
              <div className="col-span-2 text-center font-mono font-bold text-slate-900">
                {group.workloadEquityScore}/100
              </div>
              <div className="col-span-2 text-right font-mono font-bold text-indigo-600">
                +{(Math.round(group.workloadEquityScore * 0.15 * 10) / 10).toFixed(1)} pts
              </div>
            </div>

            {/* 5. Communication */}
            <div className="px-4 py-3 grid grid-cols-12 items-center text-xs">
              <div className="col-span-4">
                <div className="font-bold text-slate-900">Team Communication</div>
                <div className="text-[11px] text-slate-500">Weight: 10% of total score</div>
              </div>
              <div className="col-span-4 text-slate-700">
                Team discussion and updates in Asana
              </div>
              <div className="col-span-2 text-center font-mono font-bold text-slate-900">
                {group.communicationScore}/100
              </div>
              <div className="col-span-2 text-right font-mono font-bold text-indigo-600">
                +{(Math.round(group.communicationScore * 0.10 * 10) / 10).toFixed(1)} pts
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-900">How to update this project's Health Score:</div>
            <p>
              Scores are never changed by hand. When students finish tasks or update work in Asana, click <strong>"Sync with Asana"</strong> to get the latest status. The health score updates automatically.
            </p>
          </div>
        </div>
      )}

      {/* Add Student Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        group={group}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  );
};
