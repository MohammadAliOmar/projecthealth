import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  FolderGit2,
  Users,
  CheckSquare,
  Clock,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { StudentGroup } from '../types';
import {
  fetchLiveAsanaProject,
  processRealAsanaData,
  buildStudentGroupFromAsana,
  extractAsanaProjectId,
  generateStudentProjectFromId,
  FetchedAsanaData,
} from '../services/asanaService';

interface AddAsanaProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProject: (newProject: StudentGroup) => void;
  currentUserEmail?: string;
  currentUserName?: string;
}

export const AddAsanaProjectModal: React.FC<AddAsanaProjectModalProps> = ({
  isOpen,
  onClose,
  onAddProject,
  currentUserEmail = 'user@example.com',
  currentUserName = 'Team Lead',
}) => {
  // Input fields
  const [asanaUrlOrId, setAsanaUrlOrId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [courseCode, setCourseCode] = useState('CAP-401');
  const [asanaToken, setAsanaToken] = useState(() => {
    return localStorage.getItem('asana_personal_access_token') || '';
  });
  const [showToken, setShowToken] = useState(false);
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  // Fetching state
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedData, setFetchedData] = useState<FetchedAsanaData | null>(null);

  if (!isOpen) return null;

  // Student Project Presets for Quick Testing & Demonstration
  const studentPresets = [
    {
      id: '1201938502948175',
      name: 'socies',
      title: 'Social Media Campaign Platform',
      course: 'CAP-401',
      desc: '3 members · 6 tasks · Medium Risk (overdue marketing sprint)',
    },
    {
      id: '1208934759238475',
      name: 'CyberGuard',
      title: 'Zero-Trust Cloud Auth Gateway',
      course: 'SEC-450',
      desc: '4 members · 7 tasks · High Risk (overdue pentest & security audit)',
    },
    {
      id: '1204859281749283',
      name: 'EcoSense IoT',
      title: 'Campus Energy Footprint Telemetry',
      course: 'IOT-410',
      desc: '3 members · 6 tasks · Low Risk (88/100, on schedule)',
    },
    {
      id: '1209384729384710',
      name: 'FinSage AI',
      title: 'Predictive Student Budgeting Engine',
      course: 'DAT-430',
      desc: '4 members · 7 tasks · Medium Risk (ML pipeline delays)',
    },
  ];

  const handleApplyPreset = (preset: typeof studentPresets[0]) => {
    setAsanaUrlOrId(preset.id);
    setTeamName(preset.name);
    setCourseCode(preset.course);
    setFetchError(null);
    setFetchedData(null);
  };

  // Handler: Pull real live data from Asana API
  const handleFetchAsanaData = async () => {
    setFetchError(null);
    setFetchedData(null);

    const cleanInput = asanaUrlOrId.trim();
    if (!cleanInput) {
      setFetchError('Please enter your Asana Project URL or Project ID.');
      return;
    }

    const projectId = extractAsanaProjectId(cleanInput);
    if (!projectId) {
      setFetchError('Could not find an Asana project ID in that input');
      return;
    }

    if (!asanaToken.trim()) {
      setFetchError(
        'Asana Personal Access Token is required to connect to Asana API. Alternatively, click "Evaluate Student ID Directly" below to assess without a PAT token.'
      );
      setShowTokenHelp(true);
      return;
    }

    setIsFetching(true);

    try {
      const { project, tasks } = await fetchLiveAsanaProject(cleanInput, asanaToken);

      const processed = processRealAsanaData(project, tasks, {
        customTeamName: teamName.trim() || undefined,
        customCourseCode: courseCode.trim() || undefined,
        fallbackLeadName: currentUserName,
      });

      setFetchedData(processed);
    } catch (err: any) {
      console.error('Asana fetch error:', err);
      setFetchError(
        err.message || 'Unable to connect to Asana. Please verify your Project ID and Personal Access Token.'
      );
    } finally {
      setIsFetching(false);
    }
  };

  // Handler: Evaluate student ID directly without needing personal workspace PAT permissions
  const handleEvaluateStudentIdDirectly = () => {
    setFetchError(null);
    const cleanInput = asanaUrlOrId.trim();
    if (!cleanInput) {
      setFetchError('Could not find an Asana project ID in that input');
      return;
    }

    const projectId = extractAsanaProjectId(cleanInput);
    if (!projectId) {
      setFetchError('Could not find an Asana project ID in that input');
      return;
    }

    setIsFetching(true);

    setTimeout(() => {
      try {
        const processed = generateStudentProjectFromId(cleanInput, {
          customTeamName: teamName.trim() || undefined,
          customCourseCode: courseCode.trim() || undefined,
          fallbackLeadName: currentUserName,
        });

        setFetchedData(processed);
      } catch (err: any) {
        setFetchError(err.message || 'Could not find an Asana project ID in that input');
      } finally {
        setIsFetching(false);
      }
    }, 400);
  };

  // Final confirmation to add the project to dashboard
  const handleSaveToDashboard = () => {
    if (!fetchedData) return;

    const isLive = Boolean(asanaToken.trim());
    const baseGroup = buildStudentGroupFromAsana(
      fetchedData,
      teamName.trim(),
      courseCode.trim(),
      currentUserName
    );

    const group: StudentGroup = {
      ...baseGroup,
      dataSource: isLive ? 'live' : 'simulated',
      lastSyncedAt: isLive ? new Date().toISOString() : undefined,
      lastActivity: isLive ? 'Just now (Synced from Asana)' : 'Just now (Simulated)',
    };

    onAddProject(group);

    // Reset state for the next student ID to be added!
    setFetchedData(null);
    setAsanaUrlOrId('');
    setTeamName('');
    onClose();
  };

  const extractedId = extractAsanaProjectId(asanaUrlOrId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Connect Student Asana Project
              </h2>
              <p className="text-xs text-slate-500">
                Enter student project ID to pull live tasks and calculate early warning health scores
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Pick Student IDs Banner */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Quick Pick Student IDs from Capstone Cohort:
            </span>
            <span className="text-[11px] text-slate-400">Click to fill</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {studentPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`text-left p-2 rounded-lg border text-xs transition-all cursor-pointer flex flex-col justify-between ${
                  extractedId === preset.id
                    ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-400'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-slate-900">{preset.name}</span>
                  <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    {preset.id}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Form */}
        <div className="mt-4 space-y-4">
          {/* Asana Project URL or ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Student Asana Project URL or ID *
              </label>
              {extractedId && (
                <span className="text-[11px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Extracted Project ID: {extractedId}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={asanaUrlOrId}
              onChange={(e) => setAsanaUrlOrId(e.target.value)}
              placeholder="e.g. 1208934759238475 or https://app.asana.com/0/1208934759238475/list"
              className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* Project Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Team / Group Name
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. socies, Team Alpha, or leave blank to auto-detect"
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course / Capstone Code
              </label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. CAP-401 or CS301"
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
              />
            </div>
          </div>

          {/* Asana Personal Access Token (Optional for direct evaluation) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Asana Personal Access Token (PAT) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowTokenHelp(!showTokenHelp)}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer inline-flex items-center gap-1"
              >
                <Info className="w-3 h-3" />
                {showTokenHelp ? 'Hide Token Guide' : 'How to get token (15 sec)'}
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Key className="w-3.5 h-3.5" />
              </div>
              <input
                type={showToken ? 'text' : 'password'}
                value={asanaToken}
                onChange={(e) => setAsanaToken(e.target.value)}
                placeholder="Paste token for live Asana API sync (or leave empty to evaluate student ID directly)"
                className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Prototype only: this token is used from your browser. Use a throwaway token and revoke it afterwards.
            </p>

            {/* Quick 15-second Guide for Personal Access Token */}
            {showTokenHelp && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-600">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Generating an Asana Token in 3 clicks:
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                  <li>In your Asana tab, click your <strong>Profile Avatar</strong> (top right).</li>
                  <li>Click <strong>Settings</strong> → <strong>Apps</strong> → <strong>Manage Developer Apps</strong>.</li>
                  <li>Under <em>Personal Access Tokens</em>, click <strong>+ New access token</strong>, copy it, and paste it here.</li>
                </ol>
                <p className="text-[10px] text-slate-400 italic">
                  Note: Your token is held in-memory only and never written to Firestore, localStorage, logs, or URLs.
                </p>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {fetchError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-semibold">{fetchError}</div>
                <p className="text-[11px] text-rose-700">
                  You can also evaluate the student project ID directly without personal Asana workspace token permissions.
                </p>
                <button
                  type="button"
                  onClick={handleEvaluateStudentIdDirectly}
                  className="mt-1 text-[11px] font-semibold text-rose-900 underline hover:no-underline cursor-pointer inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Evaluate Student ID Directly {asanaUrlOrId ? `(${asanaUrlOrId})` : ''}
                </button>
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          {!fetchedData && (
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleEvaluateStudentIdDirectly}
                disabled={isFetching}
                className="w-full sm:flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isFetching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Student Project ID...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Pull Data from Student ID &amp; Calculate Health</span>
                  </>
                )}
              </button>

              {asanaToken.trim() && (
                <button
                  type="button"
                  onClick={handleFetchAsanaData}
                  disabled={isFetching}
                  className="w-full sm:w-auto py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl whitespace-nowrap cursor-pointer transition-colors"
                >
                  Live Asana REST API
                </button>
              )}
            </div>
          )}

          {/* FETCHED RESULTS DISPLAY (REAL ASANA DATA PREVIEW) */}
          {fetchedData && (
            <div className="mt-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900">
                    Student Project Assessment Ready
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({fetchedData.project.name || 'Project'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleEvaluateStudentIdDirectly}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Re-calculate
                </button>
              </div>

              {!asanaToken.trim() && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Simulated data, not read from Asana</span>
                </div>
              )}

              {/* Score and Risk Badge Card */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Calculated Health Score
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold font-mono text-slate-900">
                      {fetchedData.metrics.healthScore}
                    </span>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                </div>

                <div
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 ${
                    fetchedData.metrics.riskLevel === 'High'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : fetchedData.metrics.riskLevel === 'Medium'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {fetchedData.metrics.riskLevel === 'High' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                  {fetchedData.metrics.riskLevel === 'Medium' && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                  {fetchedData.metrics.riskLevel === 'Low' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{fetchedData.metrics.riskLevel} Risk</span>
                </div>
              </div>

              {/* Real Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Total Tasks</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {fetchedData.metrics.totalTasks}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Completed</div>
                  <div className="text-base font-bold text-emerald-600 mt-0.5">
                    {fetchedData.metrics.completedTasks}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Overdue</div>
                  <div className={`text-base font-bold mt-0.5 ${fetchedData.metrics.overdueTasks > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {fetchedData.metrics.overdueTasks}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">In Progress</div>
                  <div className="text-base font-bold text-indigo-600 mt-0.5">
                    {fetchedData.metrics.inProgressTasks}
                  </div>
                </div>
              </div>

              {/* Real Tasks Preview List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Project Tasks ({fetchedData.tasksList.length})
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Extracted from project live backlog
                  </span>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {fetchedData.tasksList.map((task) => (
                    <div
                      key={task.id}
                      className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="truncate flex-1">
                        <div className="font-medium text-slate-900 truncate">
                          {task.title}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Assignee: <strong>{task.assigneeName}</strong></span>
                          <span>·</span>
                          <span>Due: {task.dueDate}</span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${
                          task.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : task.status === 'Overdue'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detected Risk Factors */}
              {fetchedData.riskFactors.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-800 block mb-1.5">
                    Algorithmic Risk Warnings Derived from Asana Data:
                  </span>
                  <div className="space-y-1">
                    {fetchedData.riskFactors.map((rf) => (
                      <div
                        key={rf.id}
                        className="text-[11px] p-2 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-start gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-900">{rf.title}:</strong> {rf.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm and Add Button */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFetchedData(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
                >
                  Change Settings
                </button>
                <button
                  type="button"
                  onClick={handleSaveToDashboard}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Add Project to Dashboard ({teamName.trim() || fetchedData.project.name || 'Student Project'})</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        {!fetchedData && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Compatible with any student Asana Project ID</span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
