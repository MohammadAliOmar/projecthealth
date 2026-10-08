/**
 * Firestore and Firebase Authentication Access Layer
 * 
 * Strict isolation rules:
 * - Every write includes `lecturerId: uid`.
 * - Every query includes `where('lecturerId', '==', uid)`.
 * - Avoids cross-field where + orderBy to run index-free.
 * - Uses writeBatch in chunks of <= 400 operations.
 */

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  UserProfile,
  UserSettings,
  Thresholds,
  Group,
  GroupMember,
  GroupTask,
  ActivityLog,
  Message,
  HealthSnapshot,
  HistoryItem,
  Alert,
  AuditLog
} from '../types';
import { getDefaultUserProfile, generateSeedDataset } from '../data/seedData';
import { DEFAULT_THRESHOLDS, assessGroupHealth } from '../engine/scoring';

// Ensure browserSessionPersistence as specified in requirements
setPersistence(auth, browserSessionPersistence).catch(err => {
  console.warn('Session persistence setup notice:', err);
});

// ============================================================================
// HELPER: Convert Firestore Timestamps to JS Dates
// ============================================================================
export function toJsDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    return new Date(val);
  }
  return new Date();
}

export function getCurrentLecturerId(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required: No active lecturer session.');
  return user.uid;
}

// ============================================================================
// AUTHENTICATION SERVICES
// ============================================================================
export async function login(email: string, pass: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const uid = cred.user.uid;
  const profile = await getProfile(uid);
  return profile;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function changePassword(currentPass: string, newPass: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No signed-in user found.');

  const credential = EmailAuthProvider.credential(user.email, currentPass);
  await reauthenticateWithCredential(user, credential);
  await fbUpdatePassword(user, newPass);

  await addAuditLog(`Lecturer changed account password`);
}

// ============================================================================
// PROFILE & SETTINGS
// ============================================================================
export async function getProfile(targetUid?: string): Promise<UserProfile> {
  const uid = targetUid || getCurrentLecturerId();
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // First login initialization
    const email = auth.currentUser?.email || 'lecturer@university.edu.au';
    const initialProfile = getDefaultUserProfile(uid, email);
    await setDoc(userRef, initialProfile);
    await addAuditLog(`Created default lecturer profile for ${email}`);
    return initialProfile;
  }

  const data = snap.data();
  return {
    uid,
    name: data.name || 'Lecturer',
    email: data.email || '',
    role: 'lecturer',
    courses: data.courses || [],
    settings: {
      emailAlerts: data.settings?.emailAlerts ?? true,
      alertLevels: data.settings?.alertLevels || ['High', 'Medium'],
      quietHours: data.settings?.quietHours || { start: '22:00', end: '07:00' },
      webhookUrl: data.settings?.webhookUrl || '',
      thresholds: data.settings?.thresholds || DEFAULT_THRESHOLDS,
      dashboardDefaults: data.settings?.dashboardDefaults || { sort: 'risk', filter: 'all' }
    }
  };
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<void> {
  const uid = getCurrentLecturerId();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updates);
  await addAuditLog(`Updated lecturer profile settings`);
}

export async function getThresholds(): Promise<Thresholds> {
  const profile = await getProfile();
  return profile.settings.thresholds || { low: 70, medium: 40 };
}

export async function updateThresholds(thresholds: Thresholds): Promise<void> {
  if (thresholds.medium >= thresholds.low) {
    throw new Error('Threshold error: Medium risk threshold must be strictly less than Low risk threshold.');
  }

  const uid = getCurrentLecturerId();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    'settings.thresholds': thresholds
  });

  // Re-classify all active groups owned by this lecturer
  const groups = await getDashboard();
  const batch = writeBatch(db);

  for (const g of groups) {
    const newRisk = g.latestScore >= thresholds.low ? 'Low' : g.latestScore >= thresholds.medium ? 'Medium' : 'High';
    if (newRisk !== g.latestRisk) {
      batch.update(doc(db, 'groups', g.id), { latestRisk: newRisk });
    }
  }

  await batch.commit();
  await addAuditLog(`Updated system risk thresholds to Low >= ${thresholds.low}, Medium >= ${thresholds.medium}`);
}

// ============================================================================
// DASHBOARD & GROUPS
// ============================================================================
export async function getDashboard(): Promise<Group[]> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'groups'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  const groups: Group[] = [];
  for (const docSnap of snap.docs) {
    const d = docSnap.data();
    groups.push({
      id: docSnap.id,
      lecturerId: d.lecturerId,
      groupName: d.groupName,
      projectTitle: d.projectTitle,
      courseCode: d.courseCode,
      status: d.status || 'Active',
      memberCount: d.memberCount || 0,
      lastActivityAt: toJsDate(d.lastActivityAt),
      latestScore: d.latestScore ?? 50,
      latestRisk: d.latestRisk || 'Medium',
      previousScore: d.previousScore ?? 50,
      mediumStreak: d.mediumStreak ?? 0
    });
  }

  return groups;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  const uid = getCurrentLecturerId();
  const ref = doc(db, 'groups', groupId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  const d = snap.data();
  if (d.lecturerId !== uid) throw new Error('Unauthorized group access.');

  return {
    id: snap.id,
    lecturerId: d.lecturerId,
    groupName: d.groupName,
    projectTitle: d.projectTitle,
    courseCode: d.courseCode,
    status: d.status,
    memberCount: d.memberCount,
    lastActivityAt: toJsDate(d.lastActivityAt),
    latestScore: d.latestScore,
    latestRisk: d.latestRisk,
    previousScore: d.previousScore,
    mediumStreak: d.mediumStreak
  };
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'groups', groupId, 'members'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      lecturerId: data.lecturerId,
      name: data.name,
      role: data.role,
      joinedAt: toJsDate(data.joinedAt),
      tasksCompleted: data.tasksCompleted || 0,
      contributionPercent: data.contributionPercent || 0,
      daysSinceLastActivity: data.daysSinceLastActivity || 0
    };
  });
}

export async function getGroupTasks(groupId: string): Promise<GroupTask[]> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'groups', groupId, 'tasks'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      lecturerId: data.lecturerId,
      title: data.title,
      status: data.status,
      priority: data.priority,
      dueDate: toJsDate(data.dueDate),
      assigneeId: data.assigneeId,
      completedAt: data.completedAt ? toJsDate(data.completedAt) : null,
      completedById: data.completedById || null
    };
  });
}

export async function getGroupActivity(groupId: string): Promise<ActivityLog[]> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'groups', groupId, 'activityLogs'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      lecturerId: data.lecturerId,
      userId: data.userId,
      userName: data.userName,
      actionType: data.actionType,
      timestamp: toJsDate(data.timestamp)
    };
  });
}

export async function getGroupMessages(groupId: string): Promise<Message[]> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'groups', groupId, 'messages'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      lecturerId: data.lecturerId,
      senderId: data.senderId,
      senderName: data.senderName,
      content: data.content,
      timestamp: toJsDate(data.timestamp)
    };
  });
}

export async function getGroupHealth(groupId: string): Promise<HealthSnapshot[]> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'groups', groupId, 'health'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  const list = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      lecturerId: data.lecturerId,
      score: data.score,
      riskLevel: data.riskLevel,
      riskExplanation: data.riskExplanation || '',
      topFactors: data.topFactors || [],
      recommendation: data.recommendation || '',
      snapshotTimestamp: toJsDate(data.snapshotTimestamp)
    };
  });

  // Client-side sort chronologically
  list.sort((a, b) => new Date(a.snapshotTimestamp).getTime() - new Date(b.snapshotTimestamp).getTime());
  return list;
}

export async function getGroupHistory(groupId: string): Promise<HistoryItem[]> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'groups', groupId, 'history'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  const list = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      lecturerId: data.lecturerId,
      type: data.type,
      note: data.note,
      timestamp: toJsDate(data.timestamp)
    };
  });

  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return list;
}

export async function addGroupIntervention(groupId: string, type: 'message_sent' | 'meeting_requested' | 'marked_reviewed', note: string): Promise<void> {
  const uid = getCurrentLecturerId();
  const histRef = doc(collection(db, 'groups', groupId, 'history'));

  await setDoc(histRef, {
    lecturerId: uid,
    type,
    note,
    timestamp: new Date().toISOString()
  });

  if (type === 'marked_reviewed') {
    await updateDoc(doc(db, 'groups', groupId), { status: 'Reviewed' });
  }

  await addAuditLog(`Logged intervention on group ${groupId}: ${type}`);
}

export async function updateGroupStatus(groupId: string, status: 'Active' | 'Reviewed' | 'Completed'): Promise<void> {
  const uid = getCurrentLecturerId();
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, { status });
  await addAuditLog(`Updated status for group ${groupId} to ${status}`);
}

// ============================================================================
// ALERTS
// ============================================================================
export async function getAlerts(): Promise<Alert[]> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'alerts'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  const alerts: Alert[] = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      lecturerId: data.lecturerId,
      groupId: data.groupId,
      groupName: data.groupName,
      projectName: data.projectName,
      riskLevel: data.riskLevel,
      healthScore: data.healthScore,
      contributingFactors: data.contributingFactors || [],
      recommendation: data.recommendation || '',
      triggerType: data.triggerType,
      status: data.status || 'New',
      deliveries: data.deliveries || [],
      createdAt: toJsDate(data.createdAt)
    };
  });

  // Client-side sort descending
  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return alerts;
}

export function subscribeToAlerts(callback: (alerts: Alert[]) => void): Unsubscribe {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'alerts'), where('lecturerId', '==', uid));

  return onSnapshot(q, (snap) => {
    const alerts: Alert[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        lecturerId: data.lecturerId,
        groupId: data.groupId,
        groupName: data.groupName,
        projectName: data.projectName,
        riskLevel: data.riskLevel,
        healthScore: data.healthScore,
        contributingFactors: data.contributingFactors || [],
        recommendation: data.recommendation || '',
        triggerType: data.triggerType,
        status: data.status || 'New',
        deliveries: data.deliveries || [],
        createdAt: toJsDate(data.createdAt)
      };
    });

    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(alerts);
  }, (err) => {
    console.error('Alerts subscription error:', err);
  });
}

export async function markAlertRead(alertId: string): Promise<void> {
  const uid = getCurrentLecturerId();
  const ref = doc(db, 'alerts', alertId);
  await updateDoc(ref, { status: 'Read' });
}

export async function markAllAlertsRead(): Promise<void> {
  const uid = getCurrentLecturerId();
  const q = query(collection(db, 'alerts'), where('lecturerId', '==', uid));
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    if (d.data().status === 'New') {
      batch.update(d.ref, { status: 'Read' });
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    await addAuditLog(`Marked ${count} unread alerts as read`);
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================
export async function addAuditLog(event: string): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(collection(db, 'auditLogs'));
    await setDoc(ref, {
      lecturerId: uid,
      event,
      timestamp: new Date().toISOString()
    });
  } catch {
    // Audit logging is non-blocking
  }
}

// ============================================================================
// SEEDING & RESET (Chunked at <= 400 operations)
// ============================================================================
async function commitInChunks(operations: { ref: any; data?: any; type: 'set' | 'delete' }[]): Promise<void> {
  const CHUNK_SIZE = 380;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

export async function seedDemoData(): Promise<void> {
  const uid = getCurrentLecturerId();
  const {
    groups,
    allMembers,
    allTasks,
    allLogs,
    allMessages,
    allSnapshots,
    allAlerts,
    allAudits
  } = generateSeedDataset(uid, new Date());

  const operations: { ref: any; data?: any; type: 'set' | 'delete' }[] = [];

  // Groups
  for (const g of groups) {
    const gRef = doc(db, 'groups', g.id);
    operations.push({
      ref: gRef,
      data: {
        lecturerId: uid,
        groupName: g.groupName,
        projectTitle: g.projectTitle,
        courseCode: g.courseCode,
        status: g.status,
        memberCount: g.memberCount,
        lastActivityAt: g.lastActivityAt,
        latestScore: g.latestScore,
        latestRisk: g.latestRisk,
        previousScore: g.previousScore,
        mediumStreak: g.mediumStreak
      },
      type: 'set'
    });
  }

  // Members
  for (const m of allMembers) {
    const gId = m.id.split('_')[1];
    const mRef = doc(db, 'groups', `grp_${gId}`, 'members', m.id);
    operations.push({
      ref: mRef,
      data: m,
      type: 'set'
    });
  }

  // Tasks
  for (const t of allTasks) {
    const gId = t.id.split('_')[1];
    const tRef = doc(db, 'groups', `grp_${gId}`, 'tasks', t.id);
    operations.push({
      ref: tRef,
      data: t,
      type: 'set'
    });
  }

  // Logs
  for (const l of allLogs) {
    const gId = l.id.split('_')[1];
    const lRef = doc(db, 'groups', `grp_${gId}`, 'activityLogs', l.id);
    operations.push({
      ref: lRef,
      data: l,
      type: 'set'
    });
  }

  // Messages
  for (const msg of allMessages) {
    const gId = msg.id.split('_')[1];
    const msgRef = doc(db, 'groups', `grp_${gId}`, 'messages', msg.id);
    operations.push({
      ref: msgRef,
      data: msg,
      type: 'set'
    });
  }

  // Health Snapshots
  for (const s of allSnapshots) {
    const gId = s.id.split('_')[1];
    const sRef = doc(db, 'groups', `grp_${gId}`, 'health', s.id);
    operations.push({
      ref: sRef,
      data: s,
      type: 'set'
    });
  }

  // Alerts
  for (const a of allAlerts) {
    const aRef = doc(db, 'alerts', a.id);
    operations.push({
      ref: aRef,
      data: a,
      type: 'set'
    });
  }

  // Audits
  for (const aud of allAudits) {
    const audRef = doc(db, 'auditLogs', aud.id);
    operations.push({
      ref: audRef,
      data: aud,
      type: 'set'
    });
  }

  await commitInChunks(operations);
  await addAuditLog(`Seeded complete capstone demo dataset for lecturer`);
}

export async function resetDemoData(): Promise<void> {
  const uid = getCurrentLecturerId();
  const operations: { ref: any; type: 'set' | 'delete' }[] = [];

  // 1. Collect groups & subcollections
  const gSnap = await getDocs(query(collection(db, 'groups'), where('lecturerId', '==', uid)));
  for (const gDoc of gSnap.docs) {
    const gId = gDoc.id;

    const subColls = ['members', 'tasks', 'activityLogs', 'messages', 'health', 'history'];
    for (const sub of subColls) {
      const subSnap = await getDocs(query(collection(db, 'groups', gId, sub), where('lecturerId', '==', uid)));
      for (const d of subSnap.docs) {
        operations.push({ ref: d.ref, type: 'delete' });
      }
    }

    operations.push({ ref: gDoc.ref, type: 'delete' });
  }

  // 2. Alerts
  const aSnap = await getDocs(query(collection(db, 'alerts'), where('lecturerId', '==', uid)));
  for (const aDoc of aSnap.docs) {
    operations.push({ ref: aDoc.ref, type: 'delete' });
  }

  // 3. Audits
  const audSnap = await getDocs(query(collection(db, 'auditLogs'), where('lecturerId', '==', uid)));
  for (const audDoc of audSnap.docs) {
    operations.push({ ref: audDoc.ref, type: 'delete' });
  }

  if (operations.length > 0) {
    await commitInChunks(operations);
  }

  // Reseed fresh deterministic dataset
  await seedDemoData();
  await addAuditLog(`Reset and freshly re-seeded capstone demo dataset`);
}

// ============================================================================
// SIMULATION HELPERS FOR DEMO PANEL
// ============================================================================
export async function simulateNewActivity(groupId?: string): Promise<string> {
  const uid = getCurrentLecturerId();
  const groups = await getDashboard();
  if (groups.length === 0) throw new Error('No groups found. Please seed demo data first.');

  const targetGroup = groupId ? groups.find(g => g.id === groupId) || groups[0] : groups[Math.floor(Math.random() * groups.length)];
  const now = new Date();

  // Create an overdue high-priority task to worsen risk and trigger alert
  const taskRef = doc(collection(db, 'groups', targetGroup.id, 'tasks'));
  await setDoc(taskRef, {
    lecturerId: uid,
    title: 'Urgent Milestone Deliverable - System Integration Test',
    status: 'Overdue',
    priority: 'High',
    dueDate: new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString(),
    assigneeId: `mem_${targetGroup.id.replace('grp_', '')}_1`,
    completedAt: null,
    completedById: null
  });

  // Re-assess and create alert
  const members = await getGroupMembers(targetGroup.id);
  const tasks = await getGroupTasks(targetGroup.id);
  const messages = await getGroupMessages(targetGroup.id);
  const logs = await getGroupActivity(targetGroup.id);
  const thresholds = await getThresholds();

  const assessment = assessGroupHealth(members, tasks, messages, logs, thresholds, now);

  // Write snapshot
  const snapRef = doc(collection(db, 'groups', targetGroup.id, 'health'));
  await setDoc(snapRef, {
    lecturerId: uid,
    score: assessment.finalScore,
    riskLevel: assessment.riskLevel,
    riskExplanation: assessment.riskExplanation,
    topFactors: assessment.topFactors,
    recommendation: assessment.recommendation,
    snapshotTimestamp: now.toISOString()
  });

  // Update group record
  await updateDoc(doc(db, 'groups', targetGroup.id), {
    latestScore: assessment.finalScore,
    latestRisk: assessment.riskLevel,
    previousScore: targetGroup.latestScore,
    lastActivityAt: now.toISOString()
  });

  // Trigger simulated alert
  const alertRef = doc(collection(db, 'alerts'));
  await setDoc(alertRef, {
    lecturerId: uid,
    groupId: targetGroup.id,
    groupName: targetGroup.groupName,
    projectName: targetGroup.projectTitle,
    riskLevel: assessment.riskLevel,
    healthScore: assessment.finalScore,
    contributingFactors: assessment.topFactors,
    recommendation: assessment.recommendation,
    triggerType: 'critical_overdue',
    status: 'New',
    deliveries: [
      { channel: 'in_app', status: 'Sent', attempts: 1, timestamp: now.toISOString() },
      { channel: 'email', status: 'Sent', attempts: 1, timestamp: now.toISOString() }
    ],
    createdAt: now.toISOString()
  });

  await addAuditLog(`Simulated high overdue activity on ${targetGroup.groupName}`);
  return `Simulated overdue milestone on ${targetGroup.groupName}. Health score updated to ${assessment.finalScore} (${assessment.riskLevel} Risk).`;
}

export async function simulateMemberInactive(groupId?: string): Promise<string> {
  const uid = getCurrentLecturerId();
  const groups = await getDashboard();
  if (groups.length === 0) throw new Error('No groups found. Please seed demo data first.');

  const targetGroup = groupId ? groups.find(g => g.id === groupId) || groups[0] : groups[0];
  const members = await getGroupMembers(targetGroup.id);
  if (members.length === 0) throw new Error('No members found in target group.');

  const chosen = members[0];
  const now = new Date();

  // Update member daysSinceLastActivity in Firestore to 8 days
  const memberRef = doc(db, 'groups', targetGroup.id, 'members', chosen.id);
  await updateDoc(memberRef, {
    daysSinceLastActivity: 8
  });

  // Create alert for critical inactivity
  const alertRef = doc(collection(db, 'alerts'));
  await setDoc(alertRef, {
    lecturerId: uid,
    groupId: targetGroup.id,
    groupName: targetGroup.groupName,
    projectName: targetGroup.projectTitle,
    riskLevel: 'High',
    healthScore: Math.max(25, targetGroup.latestScore - 18),
    contributingFactors: [
      { factor: 'Member Inactivity', description: `Member "${chosen.name}" has not contributed for 8 days.` }
    ],
    recommendation: 'Contact the inactive student immediately.',
    triggerType: 'critical_inactive',
    status: 'New',
    deliveries: [
      { channel: 'in_app', status: 'Sent', attempts: 1, timestamp: now.toISOString() },
      { channel: 'email', status: 'Sent', attempts: 1, timestamp: now.toISOString() }
    ],
    createdAt: now.toISOString()
  });

  await addAuditLog(`Simulated student inactivity for ${chosen.name} in ${targetGroup.groupName}`);
  return `Simulated 8-day student inactivity for ${chosen.name} in ${targetGroup.groupName}. Triggered High Risk alert.`;
}

// ============================================================================
// CSV IMPORT (Working parser for members and tasks)
// ============================================================================
export async function uploadCsvData(groupId: string, csvContent: string): Promise<{ membersAdded: number; tasksAdded: number }> {
  const uid = getCurrentLecturerId();
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must contain a header and at least one data row.');

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const isTaskCsv = header.includes('title') || header.includes('task');

  const batch = writeBatch(db);
  let membersAdded = 0;
  let tasksAdded = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (row.length < 2 || !row[0]) continue;

    if (isTaskCsv) {
      const taskRef = doc(collection(db, 'groups', groupId, 'tasks'));
      const title = row[0];
      const priority = (['High', 'Medium', 'Low'].includes(row[1]) ? row[1] : 'Medium') as any;
      const status = (['Completed', 'In Progress', 'Pending', 'Overdue'].includes(row[2]) ? row[2] : 'Pending') as any;
      const dueDate = row[3] || new Date(Date.now() + 7 * 86400000).toISOString();

      batch.set(taskRef, {
        lecturerId: uid,
        title,
        priority,
        status,
        dueDate,
        assigneeId: `mem_${groupId}_1`,
        completedAt: status === 'Completed' ? new Date().toISOString() : null,
        completedById: null
      });
      tasksAdded++;
    } else {
      // Member CSV: Name, Role
      const memRef = doc(collection(db, 'groups', groupId, 'members'));
      batch.set(memRef, {
        lecturerId: uid,
        name: row[0],
        role: row[1] || 'Contributor',
        joinedAt: new Date().toISOString(),
        tasksCompleted: 0,
        daysSinceLastActivity: 0
      });
      membersAdded++;
    }
  }

  await batch.commit();
  await addAuditLog(`Imported CSV data into group ${groupId} (${membersAdded} members, ${tasksAdded} tasks)`);
  return { membersAdded, tasksAdded };
}
