import React, { useState } from 'react';
import {
  Wrench,
  Play,
  Zap,
  UserX,
  Database,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  seedDemoData,
  resetDemoData,
  simulateNewActivity,
  simulateMemberInactive
} from '../services/api';
import { runAssessmentForAllGroups } from '../services/assessmentRunner';
import { useToast } from '../hooks/useToast';
import { Group } from '../types';

interface DemoPanelProps {
  groups: Group[];
  onDataMutated?: () => void;
}

export const DemoPanel: React.FC<DemoPanelProps> = ({ groups, onDataMutated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const { success, error, info, warning } = useToast();

  const handleRunAssessment = async () => {
    setLoadingAction('assess');
    try {
      const res = await runAssessmentForAllGroups(true);
      success(
        'Assessment Completed',
        `Re-evaluated ${res.assessedCount} groups. Triggered ${res.alertsCreated} new risk alerts.`
      );
      if (onDataMutated) onDataMutated();
    } catch (err: any) {
      error('Assessment Failed', err.message || 'Error executing assessment runner.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSimulateActivity = async () => {
    setLoadingAction('activity');
    try {
      const resultMessage = await simulateNewActivity(selectedGroupId || undefined);
      success('Simulated Overdue Activity', resultMessage);
      if (onDataMutated) onDataMutated();
    } catch (err: any) {
      error('Simulation Failed', err.message || 'Failed to simulate task activity.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSimulateInactive = async () => {
    setLoadingAction('inactive');
    try {
      const target = selectedGroupId || (groups.length > 0 ? groups[0].id : undefined);
      const resultMessage = await simulateMemberInactive(target);
      warning('Simulated Inactivity Triggered', resultMessage);
      if (onDataMutated) onDataMutated();
    } catch (err: any) {
      error('Simulation Failed', err.message || 'Failed to simulate inactive student.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSeed = async () => {
    setLoadingAction('seed');
    try {
      await seedDemoData();
      success('Demo Dataset Seeded', 'Successfully written 12 capstone groups across 3 courses to Firestore.');
      if (onDataMutated) onDataMutated();
    } catch (err: any) {
      error('Seeding Error', err.message || 'Failed to seed mock dataset.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset will remove current Firestore groups and re-seed clean baseline demo data. Continue?')) {
      return;
    }
    setLoadingAction('reset');
    try {
      await resetDemoData();
      info('Demo Reset Complete', 'All capstone groups, alerts, and snapshots reset to pristine state.');
      if (onDataMutated) onDataMutated();
    } catch (err: any) {
      error('Reset Error', err.message || 'Failed to reset demo dataset.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-md w-[calc(100vw-2rem)]">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden transition-all">
        {/* Toggle Bar */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-wide uppercase text-slate-200 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              Capstone Demo Control Panel
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span>{isOpen ? 'Collapse' : 'Expand Controls'}</span>
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>

        {/* Collapsible Content */}
        {isOpen && (
          <div className="p-4 border-t border-slate-800 space-y-3.5 text-xs bg-slate-900/95">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Use these live prototype controls to trigger assessment runs, simulate student disengagement, and demonstrate the alert delivery pipeline during university presentations.
            </p>

            {/* Target Group Selector */}
            {groups.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Target Group for Simulations:
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Random or Default Group</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.groupName} ({g.courseCode}) - Current Score: {g.latestScore}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* 1. Run Assessment Now */}
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={handleRunAssessment}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loadingAction === 'assess' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Run Assessment</span>
              </button>

              {/* 2. Simulate New Activity */}
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={handleSimulateActivity}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600/90 hover:bg-amber-500 font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loadingAction === 'activity' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>Worsen Milestone</span>
              </button>

              {/* 3. Simulate Member Inactive */}
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={handleSimulateInactive}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600/90 hover:bg-rose-500 font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loadingAction === 'inactive' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                <span>Simulate Inactivity</span>
              </button>

              {/* 4. Seed Demo Data */}
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={handleSeed}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-medium text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {loadingAction === 'seed' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-indigo-400" />}
                <span>Seed 12 Groups</span>
              </button>
            </div>

            {/* Reset Button */}
            <div className="pt-1">
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 font-medium text-slate-400 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loadingAction === 'reset' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Reset Demo Data (Clean Baseline)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
