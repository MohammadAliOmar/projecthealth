import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Users,
  Clock,
  ArrowUpDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  BarChart3,
  Calendar,
  Plus,
  Trash2,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { StudentGroup, RiskLevel } from '../types';
import { calculateHealthScore, getRiskClassification } from '../mockData';

interface LecturerDashboardProps {
  groups: StudentGroup[];
  onSelectGroup: (group: StudentGroup) => void;
  onOpenAddProjectModal: () => void;
  onRequestRemove: (group: StudentGroup) => void;
  onSyncAsana?: () => void;
  isSyncing?: boolean;
}

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({
  groups,
  onSelectGroup,
  onOpenAddProjectModal,
  onRequestRemove,
  onSyncAsana,
  isSyncing = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'All' | RiskLevel>('All');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'health-asc' | 'health-desc' | 'activity' | 'name'>('health-asc');

  // Compute calculated scores and risk levels for every group
  // -------------------------------------------------------------------------
  // STEP 1: Calculate live health score and risk level for each student group
  // -------------------------------------------------------------------------
  const processedGroups = useMemo(() => {
    return groups.map((g) => {
      const score = calculateHealthScore({
        taskCompletionScore: g.taskCompletionScore,
        overdueTaskScore: g.overdueTaskScore,
        memberActivityScore: g.memberActivityScore,
        workloadEquityScore: g.workloadEquityScore,
        communicationScore: g.communicationScore,
      });
      const risk = getRiskClassification(score);
      return {
        ...g,
        calculatedScore: score,
        calculatedRisk: risk,
      };
    });
  }, [groups]);

  // Extract unique course codes for the course filter dropdown
  const uniqueCourses = useMemo(() => {
    const list = Array.from(new Set(groups.map((g) => g.courseCode)));
    return ['All', ...list];
  }, [groups]);

  // -------------------------------------------------------------------------
  // STEP 2: Aggregate summary numbers for the top dashboard cards
  // -------------------------------------------------------------------------
  const summary = useMemo(() => {
    const total = processedGroups.length;
    const highRisk = processedGroups.filter((g) => g.calculatedRisk === 'High').length;
    const mediumRisk = processedGroups.filter((g) => g.calculatedRisk === 'Medium').length;
    const lowRisk = processedGroups.filter((g) => g.calculatedRisk === 'Low').length;
    const avgScore =
      total > 0
        ? Math.round(
            (processedGroups.reduce((acc, g) => acc + g.calculatedScore, 0) / total) * 10
          ) / 10
        : 0;

    return { total, highRisk, mediumRisk, lowRisk, avgScore };
  }, [processedGroups]);

  // -------------------------------------------------------------------------
  // STEP 3: Filter by search keyword, selected course, and risk level
  // -------------------------------------------------------------------------
  const filteredGroups = useMemo(() => {
    return processedGroups
      .filter((group) => {
        // Matches search query across group name, project title, course, or student name
        const matchesSearch =
          group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.projectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.members.some((m) => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

        // Matches risk level filter button (All, High, Medium, Low)
        const matchesRisk =
          selectedRiskFilter === 'All' || group.calculatedRisk === selectedRiskFilter;

        // Matches course dropdown filter (All or specific course code)
        const matchesCourse =
          selectedCourseFilter === 'All' || group.courseCode === selectedCourseFilter;

        return matchesSearch && matchesRisk && matchesCourse;
      })
      .sort((a, b) => {
        // Sort lowest health first, highest health first, or alphabetical
        if (sortBy === 'health-asc') return a.calculatedScore - b.calculatedScore;
        if (sortBy === 'health-desc') return b.calculatedScore - a.calculatedScore;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [processedGroups, searchTerm, selectedRiskFilter, selectedCourseFilter, sortBy]);

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            High Risk (&lt;40)
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            Medium Risk (40-69)
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Low Risk (&ge;70)
          </span>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-700 border-emerald-200 bg-emerald-50';
    if (score >= 40) return 'text-amber-800 border-amber-200 bg-amber-50';
    return 'text-rose-700 border-rose-200 bg-rose-50';
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Student Project Health
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track team progress and see which student groups need help early.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {onSyncAsana && (
            <button
              type="button"
              onClick={onSyncAsana}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Sync latest tasks and members across all Asana projects"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync with Asana'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddProjectModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Project from Asana
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Groups</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {summary.total}
            </span>
            <span className="text-[11px] text-slate-500">All teams</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs bg-rose-50/20">
          <div className="text-xs font-medium text-rose-700 flex items-center justify-between">
            <span>High Risk Teams</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-700 tabular-nums">
              {summary.highRisk}
            </span>
            <span className="text-[11px] font-medium text-rose-600">Need Help Now</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="text-xs font-medium text-amber-800 flex items-center justify-between">
            <span>Medium Risk Teams</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-800 tabular-nums">
              {summary.mediumRisk}
            </span>
            <span className="text-[11px] font-medium text-amber-700">Keep an Eye On</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20">
          <div className="text-xs font-medium text-emerald-800 flex items-center justify-between">
            <span>Healthy Teams</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-800 tabular-nums">
              {summary.lowRisk}
            </span>
            <span className="text-[11px] font-medium text-emerald-700">Doing Well</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-slate-500">Class Average Score</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {summary.avgScore}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </span>
            <span className="text-[11px] text-slate-500">Average score</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by group name, project title, course code, or student..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Course filter & Sort options */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Course:</span>
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="py-1.5 pl-2 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                {uniqueCourses.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? 'All Courses' : c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="py-1.5 pl-2 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="health-asc">Lowest Score (Need Help First)</option>
                <option value="health-desc">Highest Score (Doing Best First)</option>
                <option value="name">Team Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Risk Level Segmented Controls */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500 mr-1">Filter by Risk:</span>
          {(['All', 'High', 'Medium', 'Low'] as const).map((lvl) => {
            const count =
              lvl === 'All'
                ? processedGroups.length
                : processedGroups.filter((g) => g.calculatedRisk === lvl).length;
            const isSelected = selectedRiskFilter === lvl;

            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedRiskFilter(lvl)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {lvl === 'All' ? 'All Risk Levels' : `${lvl} Risk`} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Group Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredGroups.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-xl border border-slate-200 text-center">
            <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-800">
              {groups.length === 0 ? 'No Projects Added Yet' : 'No matching projects found'}
            </div>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {groups.length === 0
                ? 'Your workspace is fresh and clean. Click below to add or import your project from Asana!'
                : 'Try typing a different name or clearing your search filters.'}
            </p>
            {groups.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onOpenAddProjectModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add Project from Asana
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredGroups.map((group) => {
            const overdueTasks = group.tasks.filter((t) => t.status === 'Overdue').length;
            const completedTasks = group.tasks.filter((t) => t.status === 'Completed').length;
            const totalTasks = group.tasks.length;

            return (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className="group bg-white rounded-xl border border-slate-200 hover:border-indigo-400 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top card bar: Course & Risk badge & Delete action */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {group.courseCode}
                      </span>
                      {group.dataSource === 'live' ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          Synced from Asana {group.lastSyncedAt ? `(${new Date(group.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Simulated
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getRiskBadge(group.calculatedRisk)}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestRemove(group);
                        }}
                        title="Remove this project"
                        className="opacity-70 hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Group Name & Project Title */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {group.name}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed min-h-[32px]">
                    {group.projectTitle}
                  </p>

                  {/* Health Score Display */}
                  <div className="mt-4 p-3 rounded-lg border border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">
                        Health Score
                      </div>
                      <div className="text-xs text-slate-400">
                        Based on completed work &amp; team effort
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-lg border font-mono font-bold text-lg tabular-nums ${getScoreColor(
                        group.calculatedScore
                      )}`}
                    >
                      {group.calculatedScore}
                      <span className="text-xs font-normal opacity-70">/100</span>
                    </div>
                  </div>

                  {/* Factor Breakdown Summary Snippets */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>
                        Tasks: <strong className="font-semibold text-slate-800">{completedTasks}/{totalTasks}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          overdueTasks > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span>
                        Late Tasks: <strong className={`font-semibold ${overdueTasks > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{overdueTasks}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Last Activity & Members */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5" title={`Last updated: ${group.lastActivityTimestamp}`}>
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[130px]">{group.lastActivity}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1" title={`${group.members.length} student contributors`}>
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{group.members.length} members</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
