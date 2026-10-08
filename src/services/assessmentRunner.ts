/**
 * Assessment Runner and Alert Engine
 * 
 * Free of UI components so it can easily move into a Cloud Function in the future.
 * Runs on dashboard load (if last run > 15m), periodic intervals, and on demand from Demo Panel.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  Group,
  GroupMember,
  GroupTask,
  Message,
  ActivityLog,
  Alert,
  DeliveryChannelLog,
  RiskLevel,
  UserSettings
} from '../types';
import {
  assessGroupHealth,
  DEFAULT_THRESHOLDS
} from '../engine/scoring';
import {
  getThresholds,
  getProfile,
  addAuditLog,
  toJsDate
} from './api';

let isRunningAssessment = false;
let lastAssessmentTimestamp: number = 0;

/**
 * Checks if quiet hours are currently active based on lecturer settings
 */
export function isCurrentlyQuietHours(startStr: string, endStr: string, now: Date = new Date()): boolean {
  if (!startStr || !endStr) return false;
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight quiet hours, e.g. 22:00 to 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Simulates alert deliveries with retry & exponential backoff
 */
export async function simulateDeliveryDispatch(
  riskLevel: RiskLevel,
  settings: UserSettings,
  now: Date = new Date()
): Promise<DeliveryChannelLog[]> {
  const deliveries: DeliveryChannelLog[] = [];

  // 1. In-App delivery: always sent
  deliveries.push({
    channel: 'in_app',
    status: 'Sent',
    attempts: 1,
    timestamp: now.toISOString()
  });

  // 2. Email delivery: check settings, selected risk levels, and quiet hours
  const alertLevels = settings.alertLevels || ['High', 'Medium'];
  const quietHours = settings.quietHours || { start: '22:00', end: '07:00' };

  if (!settings.emailAlerts) {
    deliveries.push({
      channel: 'email',
      status: 'Skipped',
      attempts: 0,
      timestamp: now.toISOString(),
      error: 'Email alerts disabled in lecturer settings'
    });
  } else if (!alertLevels.includes(riskLevel)) {
    deliveries.push({
      channel: 'email',
      status: 'Skipped',
      attempts: 0,
      timestamp: now.toISOString(),
      error: `Risk level ${riskLevel} not subscribed in notification settings`
    });
  } else if (isCurrentlyQuietHours(quietHours.start, quietHours.end, now)) {
    deliveries.push({
      channel: 'email',
      status: 'Skipped',
      attempts: 0,
      timestamp: now.toISOString(),
      error: `Suppressed by Quiet Hours (${quietHours.start} - ${quietHours.end})`
    });
  } else {
    deliveries.push({
      channel: 'email',
      status: 'Sent',
      attempts: 1,
      timestamp: now.toISOString()
    });
  }

  // 3. Webhook delivery: check if URL configured, simulate backoff retry demonstration
  if (!settings.webhookUrl || settings.webhookUrl.trim() === '') {
    deliveries.push({
      channel: 'webhook',
      status: 'Skipped',
      attempts: 0,
      timestamp: now.toISOString(),
      error: 'No webhook URL configured'
    });
  } else {
    // Demonstrate retry simulation with exponential backoff if simulating a transient failure
    const simulateTransientError = settings.webhookUrl.includes('test-fail');
    if (simulateTransientError) {
      // 3 attempts with simulated backoff (1s, 2s, 4s)
      deliveries.push({
        channel: 'webhook',
        status: 'Failed',
        attempts: 3,
        timestamp: now.toISOString(),
        error: 'HTTP 504 Gateway Timeout after 3 retries (1s, 2s, 4s backoff)'
      });
    } else {
      deliveries.push({
        channel: 'webhook',
        status: 'Sent',
        attempts: 1,
        timestamp: now.toISOString()
      });
    }
  }

  return deliveries;
}

/**
 * Main assessment loop for all groups belonging to the signed-in lecturer
 */
export async function runAssessmentForAllGroups(force: boolean = false): Promise<{ assessedCount: number; alertsCreated: number }> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { assessedCount: 0, alertsCreated: 0 };

  const now = new Date();
  const fifteenMinutesMs = 15 * 60 * 1000;

  // Enforce throttle: do not run if assessed within 15 minutes unless forced
  if (!force && (now.getTime() - lastAssessmentTimestamp < fifteenMinutesMs)) {
    return { assessedCount: 0, alertsCreated: 0 };
  }

  if (isRunningAssessment) {
    return { assessedCount: 0, alertsCreated: 0 };
  }

  isRunningAssessment = true;
  lastAssessmentTimestamp = now.getTime();

  let assessedCount = 0;
  let alertsCreated = 0;

  try {
    const profile = await getProfile(uid);
    const thresholds = profile.settings.thresholds || DEFAULT_THRESHOLDS;

    // 1. Fetch all groups owned by this lecturer
    const gSnap = await getDocs(query(collection(db, 'groups'), where('lecturerId', '==', uid)));
    const groups: Group[] = gSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    for (const group of groups) {
      // 2. Fetch subcollection documents
      const mSnap = await getDocs(query(collection(db, 'groups', group.id, 'members'), where('lecturerId', '==', uid)));
      const members: GroupMember[] = mSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      const tSnap = await getDocs(query(collection(db, 'groups', group.id, 'tasks'), where('lecturerId', '==', uid)));
      const tasks: GroupTask[] = tSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      const msgSnap = await getDocs(query(collection(db, 'groups', group.id, 'messages'), where('lecturerId', '==', uid)));
      const messages: Message[] = msgSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      const lSnap = await getDocs(query(collection(db, 'groups', group.id, 'activityLogs'), where('lecturerId', '==', uid)));
      const logs: ActivityLog[] = lSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // 3. Compute score and risk breakdown
      const assessment = assessGroupHealth(members, tasks, messages, logs, thresholds, now);

      // Track streaks
      let newStreak = group.mediumStreak || 0;
      if (assessment.riskLevel === 'Medium') {
        newStreak += 1;
      } else {
        newStreak = 0;
      }

      // 4. Record health snapshot in Firestore
      const snapRef = doc(collection(db, 'groups', group.id, 'health'));
      await setDoc(snapRef, {
        lecturerId: uid,
        score: assessment.finalScore,
        riskLevel: assessment.riskLevel,
        riskExplanation: assessment.riskExplanation,
        topFactors: assessment.topFactors,
        recommendation: assessment.recommendation,
        snapshotTimestamp: now.toISOString()
      });

      // 5. Update group doc
      const previousScore = group.latestScore ?? assessment.finalScore;
      const previousRisk = group.latestRisk ?? assessment.riskLevel;

      await updateDoc(doc(db, 'groups', group.id), {
        latestScore: assessment.finalScore,
        latestRisk: assessment.riskLevel,
        previousScore,
        mediumStreak: newStreak,
        lastActivityAt: now.toISOString()
      });

      assessedCount++;

      // 6. Check alert conditions:
      // Condition A: Risk worsened (Low->Medium or Medium->High)
      const isWorsened =
        (previousRisk === 'Low' && (assessment.riskLevel === 'Medium' || assessment.riskLevel === 'High')) ||
        (previousRisk === 'Medium' && assessment.riskLevel === 'High');

      // Condition B: Group is High risk
      const isHigh = assessment.riskLevel === 'High';

      // Condition C: Medium for > 3 consecutive assessments
      const isMediumStreak = newStreak >= 3;

      // Condition D: Critical event (task overdue or member inactive 5+ days)
      const hasCriticalOverdue = assessment.metrics.overdueTasksCount > 0;
      const hasCriticalInactive = (assessment.metrics.inactiveDays || 0) >= 5;

      let triggerType: Alert['triggerType'] | null = null;
      if (isWorsened) triggerType = 'risk_worsened';
      else if (isHigh) triggerType = 'high_risk';
      else if (isMediumStreak) triggerType = 'medium_streak';
      else if (hasCriticalOverdue) triggerType = 'critical_overdue';
      else if (hasCriticalInactive) triggerType = 'critical_inactive';

      if (triggerType) {
        // Deduplication rule: check if similar alert (same group + same triggerType) within 24h
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600 * 1000);
        const existingAlertsQ = query(
          collection(db, 'alerts'),
          where('lecturerId', '==', uid)
        );
        const existingAlertsSnap = await getDocs(existingAlertsQ);

        const recentDuplicate = existingAlertsSnap.docs.find(d => {
          const data = d.data();
          return data.groupId === group.id &&
            data.triggerType === triggerType &&
            new Date(data.createdAt).getTime() >= twentyFourHoursAgo.getTime() &&
            data.status !== 'Reviewed';
        });

        const deliveries = await simulateDeliveryDispatch(assessment.riskLevel, profile.settings, now);

        if (recentDuplicate) {
          // Update the existing active alert with fresh data
          await updateDoc(recentDuplicate.ref, {
            healthScore: assessment.finalScore,
            riskLevel: assessment.riskLevel,
            contributingFactors: assessment.topFactors,
            recommendation: assessment.recommendation,
            deliveries,
            createdAt: now.toISOString()
          });
        } else {
          // Create new alert
          const alertRef = doc(collection(db, 'alerts'));
          await setDoc(alertRef, {
            lecturerId: uid,
            groupId: group.id,
            groupName: group.groupName,
            projectName: group.projectTitle,
            riskLevel: assessment.riskLevel,
            healthScore: assessment.finalScore,
            contributingFactors: assessment.topFactors,
            recommendation: assessment.recommendation,
            triggerType,
            status: 'New',
            deliveries,
            createdAt: now.toISOString()
          });
          alertsCreated++;
        }
      }
    }

    if (assessedCount > 0) {
      await addAuditLog(`Assessment runner executed across ${assessedCount} groups. Triggered ${alertsCreated} new alerts.`);
    }
  } catch (err) {
    console.error('Assessment runner execution error:', err);
  } finally {
    isRunningAssessment = false;
  }

  return { assessedCount, alertsCreated };
}
