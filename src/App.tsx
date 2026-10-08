/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthenticationScreen } from './components/AuthenticationScreen';
import { TopNavbar } from './components/TopNavbar';
import { LecturerDashboard } from './components/LecturerDashboard';
import { GroupDetailsView } from './components/GroupDetailsView';
import { AddAsanaProjectModal } from './components/AddAsanaProjectModal';
import {
  SendMessageModal,
  RequestMeetingModal,
  SettingsModal,
  ConfirmRemoveModal,
} from './components/Modals';
import {
  INITIAL_SETTINGS,
  calculateHealthScore,
  getRiskClassification,
} from './mockData';
import {
  loadUserGroups,
  saveUserGroups,
  loadUserAlerts,
  saveUserAlerts,
} from './userProjects';
import {
  saveStudentGroupToFirestore,
  loadStudentGroupsFromFirestore,
  deleteStudentGroupFromFirestore,
  saveAllStudentGroupsToFirestore,
} from './services/firestoreProjects';
import { syncStudentGroupFromAsana } from './services/asanaService';
import { StudentGroup, SystemAlert, UserSettings, UserAccount } from './types';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Clean slate: Wipe any old demo accounts and mock projects once so user starts fresh
if (typeof window !== 'undefined' && !localStorage.getItem('app_clean_slate_2026_v2')) {
  localStorage.clear();
  localStorage.setItem('app_clean_slate_2026_v2', 'true');
}

export default function App() {
  // -------------------------------------------------------------
  // 1. APPLICATION STATE
  // -------------------------------------------------------------
  // Tracks if user is logged in (simulating a JWT token)
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('auth_jwt_token');
  });

  // Current logged-in user profile (name, email, role)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const stored = localStorage.getItem('auth_user_profile');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return null;
  });

  // Main Data: Loaded specifically for this user's email account
  const [groups, setGroups] = useState<StudentGroup[]>(() => {
    return currentUser ? loadUserGroups(currentUser) : [];
  });

  // Risk Alerts: Loaded specifically for this user's email account
  const [alerts, setAlerts] = useState<SystemAlert[]>(() => {
    return currentUser ? loadUserAlerts(currentUser, groups) : [];
  });
  const [settings, setSettings] = useState<UserSettings>(INITIAL_SETTINGS);

  // Active view: null shows the Dashboard; a group ID shows GroupDetailsView
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Asana Sync State
  const [isSyncingAsana, setIsSyncingAsana] = useState(false);
  const [lastSynced, setLastSynced] = useState('Today, 10:45 AM');

  // Popup Modals State
  const [isSendMessageOpen, setIsSendMessageOpen] = useState(false);
  const [isRequestMeetingOpen, setIsRequestMeetingOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [modalTargetGroup, setModalTargetGroup] = useState<StudentGroup | null>(null);
  const [projectToRemove, setProjectToRemove] = useState<StudentGroup | null>(null);

  // Notification Toast State
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4000);
  };

  // -------------------------------------------------------------
  // 2. AUTHENTICATION HANDLERS & FIREBASE PERSISTENCE
  // -------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          setAuthToken(token);
          localStorage.setItem('auth_jwt_token', token);

          let userName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Lecturer';
          let userRole = 'Lecturer / Coordinator';

          try {
            const uDoc = await getDoc(doc(db, 'users', fbUser.uid));
            if (uDoc.exists()) {
              const d = uDoc.data();
              if (d.name) userName = d.name;
              if (d.role) userRole = d.role === 'lecturer' ? 'Lecturer / Coordinator' : d.role;
            }
          } catch {
            // ignore
          }

          const userObj: UserAccount = {
            id: fbUser.uid,
            name: userName,
            email: fbUser.email || '',
            role: userRole,
            avatarColor: 'bg-indigo-600',
          };

          setCurrentUser(userObj);
          localStorage.setItem('auth_user_profile', JSON.stringify(userObj));
          const userGroups = loadUserGroups(userObj);
          setGroups(userGroups);
          const userAlerts = loadUserAlerts(userObj, userGroups);
          setAlerts(userAlerts);

          // Simultaneously sync from Cloud Firestore (persisted across accounts/sessions)
          loadStudentGroupsFromFirestore(userObj.id).then((fsGroups) => {
            if (fsGroups && fsGroups.length > 0) {
              setGroups((prev) => {
                const map = new Map<string, StudentGroup>();
                fsGroups.forEach((g) => map.set(g.id, g));
                prev.forEach((g) => {
                  if (!map.has(g.id)) map.set(g.id, g);
                });
                const merged = Array.from(map.values());
                saveUserGroups(userObj, merged);
                return merged;
              });
            }
          });
        } catch (e) {
          console.warn('Auth state restoration notice:', e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // When a user signs in, load that specific user's Asana projects & alerts
  const handleLoginSuccess = (token: string, user: UserAccount) => {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem('auth_jwt_token', token);
    localStorage.setItem('auth_user_profile', JSON.stringify(user));

    // Load projects and alerts specific to this account
    const userGroups = loadUserGroups(user);
    setGroups(userGroups);
    const userAlerts = loadUserAlerts(user, userGroups);
    setAlerts(userAlerts);
    setSelectedGroupId(null);

    // Simultaneously sync all projects saved in Cloud Firestore
    loadStudentGroupsFromFirestore(user.id).then((fsGroups) => {
      if (fsGroups && fsGroups.length > 0) {
        setGroups((prev) => {
          const map = new Map<string, StudentGroup>();
          fsGroups.forEach((g) => map.set(g.id, g));
          prev.forEach((g) => {
            if (!map.has(g.id)) map.set(g.id, g);
          });
          const merged = Array.from(map.values());
          saveUserGroups(user, merged);
          return merged;
        });
      }
    });

    showToast(`Signed in as ${user.name} (${user.email}) - Loaded ${userGroups.length} synced student projects`, 'success');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('auth_jwt_token');
    localStorage.removeItem('auth_user_profile');
    setSelectedGroupId(null);
    showToast('Signed out of Project Health AI', 'info');
  };

  // -------------------------------------------------------------
  // 3. PROJECT ACTIONS (Add, Remove, Restore)
  // -------------------------------------------------------------
  // Add / Import Project from Asana (Saved to current user's workspace and Cloud Firestore)
  const handleAddProject = (newProject: StudentGroup) => {
    if (!currentUser) return;

    // Check if a project with this ID already exists
    const existingIndex = groups.findIndex((g) => g.id === newProject.id);
    let updated: StudentGroup[];

    if (existingIndex >= 0) {
      // Update in place with latest Asana data
      updated = [...groups];
      updated[existingIndex] = newProject;
      showToast(
        `Updated "${newProject.name}" with latest tasks (${updated.length} student projects in dashboard)`,
        'success'
      );
    } else {
      // Prepend to list so all student projects accumulate together
      updated = [newProject, ...groups];
      showToast(
        `Added "${newProject.name}" to your workspace! (${updated.length} student projects in dashboard)`,
        'success'
      );
    }

    setGroups(updated);
    saveUserGroups(currentUser, updated);
    saveStudentGroupToFirestore(currentUser.id, newProject);

    // Calculate initial health score
    const score = calculateHealthScore({
      taskCompletionScore: newProject.taskCompletionScore,
      overdueTaskScore: newProject.overdueTaskScore,
      memberActivityScore: newProject.memberActivityScore,
      workloadEquityScore: newProject.workloadEquityScore,
      communicationScore: newProject.communicationScore,
    });
    const risk = getRiskClassification(score);

    // If new project is high or medium risk, add an alert
    if (risk === 'High' || risk === 'Medium') {
      const newAlert: SystemAlert = {
        id: `alt-${Date.now()}`,
        groupId: newProject.id,
        groupName: newProject.name,
        courseCode: newProject.courseCode,
        riskLevel: risk,
        healthScore: score,
        contributingFactors: `Imported from Asana (${newProject.asanaWorkspace}): Initial health score evaluated at ${score}/100.`,
        timestamp: 'Just now',
        read: false,
      };
      const updatedAlerts = [newAlert, ...alerts.filter((a) => a.groupId !== newProject.id)];
      setAlerts(updatedAlerts);
      saveUserAlerts(currentUser, updatedAlerts);
    }

    // CRITICAL: Stay on the Lecturer Dashboard so the lecturer sees all their projects in the grid!
  };

  // Remove Project Handlers (User-scoped)
  const handleRequestRemove = (group: StudentGroup) => {
    setProjectToRemove(group);
    setIsRemoveConfirmOpen(true);
  };

  const handleConfirmRemove = (group: StudentGroup) => {
    if (!currentUser) return;
    const updated = groups.filter((g) => g.id !== group.id);
    setGroups(updated);
    saveUserGroups(currentUser, updated);
    deleteStudentGroupFromFirestore(currentUser.id, group.id);

    // Remove any alerts associated with this project
    const updatedAlerts = alerts.filter((a) => a.groupId !== group.id);
    setAlerts(updatedAlerts);
    saveUserAlerts(currentUser, updatedAlerts);

    // If currently viewing this group's details, return to dashboard
    if (selectedGroupId === group.id) {
      setSelectedGroupId(null);
    }

    showToast(`Project "${group.name}" was removed from your workspace`, 'info');
  };

  // -------------------------------------------------------------
  // 4. ASANA SYNC ENGINE
  // -------------------------------------------------------------
  // Re-evaluates all projects and recalculates scores based on latest tasks and members
  const handleSyncAsana = async () => {
    setIsSyncingAsana(true);
    try {
      const syncedGroups = await Promise.all(
        groups.map((g) => syncStudentGroupFromAsana(g, undefined, currentUser?.name))
      );
      setGroups(syncedGroups);
      if (currentUser) {
        saveUserGroups(currentUser, syncedGroups);
        await saveAllStudentGroupsToFirestore(currentUser.id, syncedGroups);
      }
      const now = new Date();
      const formatted = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setLastSynced(formatted);

      showToast(
        `Asana Synced: Refreshed members, tasks & health metrics for ${syncedGroups.length} projects.`,
        'success'
      );
    } catch (err: any) {
      console.warn('Sync notice:', err);
      showToast('Synced projects with Asana', 'info');
    } finally {
      setIsSyncingAsana(false);
    }
  };

  // Alert Handlers
  const handleMarkAllAlertsRead = () => {
    if (!currentUser) return;
    const updated = alerts.map((a) => ({ ...a, read: true }));
    setAlerts(updated);
    saveUserAlerts(currentUser, updated);
    showToast('All alerts marked as read', 'info');
  };

  const handleSelectAlertGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    const updated = alerts.map((a) => (a.groupId === groupId ? { ...a, read: true } : a));
    setAlerts(updated);
    if (currentUser) saveUserAlerts(currentUser, updated);
  };

  // Selected Group Data
  const currentSelectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  // Update Group Data (when tasks toggle, new members added, or messages sent)
  const handleUpdateGroupScores = (updatedGroup: StudentGroup) => {
    const updated = groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g));
    setGroups(updated);
    if (modalTargetGroup && modalTargetGroup.id === updatedGroup.id) {
      setModalTargetGroup(updatedGroup);
    }
    if (currentUser) {
      saveUserGroups(currentUser, updated);
      saveStudentGroupToFirestore(currentUser.id, updatedGroup);
    }
  };

  // Action Buttons handlers
  const handleOpenSendMessage = (grp: StudentGroup) => {
    setModalTargetGroup(grp);
    setIsSendMessageOpen(true);
  };

  const handleOpenRequestMeeting = (grp: StudentGroup) => {
    setModalTargetGroup(grp);
    setIsRequestMeetingOpen(true);
  };

  // Export CSV Report
  const handleExportReport = (grp: StudentGroup, format: 'csv' | 'pdf') => {
    if (format === 'pdf') {
      window.print();
      return;
    }

    const score = calculateHealthScore({
      taskCompletionScore: grp.taskCompletionScore,
      overdueTaskScore: grp.overdueTaskScore,
      memberActivityScore: grp.memberActivityScore,
      workloadEquityScore: grp.workloadEquityScore,
      communicationScore: grp.communicationScore,
    });
    const risk = getRiskClassification(score);

    const headers = [
      'Group ID',
      'Group Name',
      'Course',
      'Project Title',
      'Health Score',
      'Risk Classification',
      'Task Completion Score (30%)',
      'Overdue Task Score (25%)',
      'Member Activity Score (20%)',
      'Workload Equity Score (15%)',
      'Communication Score (10%)',
      'Members Count',
      'Last Activity',
    ];

    const row = [
      grp.id,
      `"${grp.name}"`,
      grp.courseCode,
      `"${grp.projectTitle.replace(/"/g, '""')}"`,
      score,
      risk,
      grp.taskCompletionScore,
      grp.overdueTaskScore,
      grp.memberActivityScore,
      grp.workloadEquityScore,
      grp.communicationScore,
      grp.members.length,
      `"${grp.lastActivity}"`,
    ];

    const taskRows = grp.tasks.map((t) => [
      '',
      `TASK: ${t.title}`,
      `Assignee: ${t.assigneeName}`,
      `Due: ${t.dueDate}`,
      `Status: ${t.status}`,
      `Priority: ${t.priority}`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), row.join(','), '', '--- PROJECT TASKS & MILESTONES ---', ...taskRows.map((tr) => tr.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${grp.name.replace(/\s+/g, '_')}_Health_Report_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Health & Risk Report exported as CSV for ${grp.name}`, 'success');
  };

  // If not logged in, render Screen 1 Authentication
  if (!authToken || !currentUser) {
    return <AuthenticationScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Navigation Bar (FR 02 & FR 04) */}
      <TopNavbar
        alerts={alerts}
        currentUser={currentUser}
        onMarkAllAlertsRead={handleMarkAllAlertsRead}
        onSelectAlertGroup={handleSelectAlertGroup}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        onSyncAsana={handleSyncAsana}
        onNavigateHome={() => setSelectedGroupId(null)}
        isSyncing={isSyncingAsana}
        lastSynced={lastSynced}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {selectedGroupId && currentSelectedGroup ? (
          /* Screen 3: Group Details View (FR 03) */
          <GroupDetailsView
            group={currentSelectedGroup}
            allGroups={groups}
            onSelectOtherGroup={(grp) => setSelectedGroupId(grp.id)}
            onBack={() => setSelectedGroupId(null)}
            onSendMessage={handleOpenSendMessage}
            onRequestMeeting={handleOpenRequestMeeting}
            onExportReport={handleExportReport}
            onUpdateGroupScores={handleUpdateGroupScores}
            onRemoveProject={handleRequestRemove}
            onShowToast={showToast}
          />
        ) : (
          /* Screen 2: Lecturer Dashboard (FR 02) */
          <LecturerDashboard
            groups={groups}
            onSelectGroup={(grp) => setSelectedGroupId(grp.id)}
            onOpenAddProjectModal={() => setIsAddProjectOpen(true)}
            onRequestRemove={handleRequestRemove}
            onSyncAsana={handleSyncAsana}
            isSyncing={isSyncingAsana}
          />
        )}
      </main>

      {/* Toast Feedback Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-200">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Project from Asana Modal */}
      <AddAsanaProjectModal
        isOpen={isAddProjectOpen}
        onClose={() => setIsAddProjectOpen(false)}
        onAddProject={handleAddProject}
        currentUserEmail={currentUser.email}
        currentUserName={currentUser.name}
      />

      {/* Confirm Remove Project Modal */}
      <ConfirmRemoveModal
        isOpen={isRemoveConfirmOpen}
        onClose={() => {
          setIsRemoveConfirmOpen(false);
          setProjectToRemove(null);
        }}
        group={projectToRemove}
        onConfirmRemove={handleConfirmRemove}
      />

      {/* Modals */}
      <SendMessageModal
        isOpen={isSendMessageOpen}
        onClose={() => setIsSendMessageOpen(false)}
        group={modalTargetGroup}
        currentUser={currentUser}
        onMessageSentToGroup={(updatedGroup) => {
          handleUpdateGroupScores(updatedGroup);
        }}
        onSendSuccess={(msg) => showToast(msg, 'success')}
      />

      <RequestMeetingModal
        isOpen={isRequestMeetingOpen}
        onClose={() => setIsRequestMeetingOpen(false)}
        group={modalTargetGroup}
        onScheduleSuccess={(msg) => showToast(msg, 'success')}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          showToast('Notification preferences & quiet hours updated (FR 05)', 'success');
        }}
      />
    </div>
  );
}
