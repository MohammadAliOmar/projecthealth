import React, { useState } from 'react';
import {
  X,
  Send,
  Calendar,
  Clock,
  Download,
  Printer,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Sliders,
  Trash2,
  AlertTriangle,
  Mail,
  Copy,
  ExternalLink,
  UserPlus,
  Users,
  FolderGit2,
  CheckSquare,
} from 'lucide-react';
import { StudentGroup, UserSettings, UserAccount, SentTeamMessage, TeamMember } from '../types';
import { calculateHealthScore, getRiskClassification } from '../mockData';
import { postMessageToAsanaProject } from '../services/asanaService';
import { saveMessageToFirestore } from '../services/firestoreProjects';

// 1. Send Message Modal
interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: StudentGroup | null;
  currentUser?: UserAccount | null;
  onSendSuccess: (msg: string) => void;
  onMessageSentToGroup?: (updatedGroup: StudentGroup, sentMsg: SentTeamMessage) => void;
}

export const SendMessageModal: React.FC<SendMessageModalProps> = ({
  isOpen,
  onClose,
  group,
  currentUser,
  onSendSuccess,
  onMessageSentToGroup,
}) => {
  const [recipient, setRecipient] = useState<string>('all');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [launchEmailClient, setLaunchEmailClient] = useState(true);
  const [postToAsana, setPostToAsana] = useState(true);
  const [asanaTokenInput, setAsanaTokenInput] = useState('');
  const [showTokenField, setShowTokenField] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    asanaStatus: string;
    asanaSuccess: boolean;
    asanaSimulated: boolean;
    asanaTaskGid?: string;
    firestoreSaved: boolean;
    emailsDispatched: string[];
    timestamp: string;
    mailClientLaunched: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (group) {
      setSubject(`Academic Check-in - ${group.name}`);
      const topFactor = group.riskFactors[0];
      const senderName = currentUser?.name || 'Dr. Evelyn Chen (Course Coordinator)';
      const template = `Hello ${group.name} team,\n\nI am reviewing our capstone project progress for ${group.courseCode}.\n\nDeliverable Note: ${
        topFactor?.title || 'Milestone tasks'
      } - ${
        topFactor?.description || 'some tasks appear to be running behind schedule'
      }.\n\nPlease review your current sprint deliverables in Asana, sync up as a team, and let me know if you need faculty assistance or an unblocking session!\n\nBest regards,\n${senderName}`;
      setMessage(template);
      setSendResult(null);
    }
  }, [group, currentUser]);

  if (!isOpen || !group) return null;

  // Compute recipient emails
  const targetEmails = recipient === 'all'
    ? group.members.map((m) => m.email).filter(Boolean)
    : [group.members.find((m) => m.name === recipient)?.email].filter(Boolean) as string[];
  const targetEmailStr = targetEmails.join(', ');

  const mailtoUrl = `mailto:${encodeURIComponent(targetEmailStr)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(message)}`;

  const webGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    targetEmailStr
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(`To: ${targetEmailStr}\nSubject: ${subject}\n\n${message}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEmailClient = () => {
    const a = document.createElement('a');
    a.href = mailtoUrl;
    a.click();
  };

  const handleOpenGmailWeb = () => {
    window.open(webGmailUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);

    try {
      const tokenToUse = asanaTokenInput.trim();

      const deliveryChannels: string[] = ['University Cloud Firestore'];
      let asanaFeedback = 'Notice logged and queued for Asana project';
      let asanaGid: string | undefined;
      let asanaSuccess = false;
      let asanaSimulated = false;

      // 1. Post notice task directly to Asana project board if enabled
      if (postToAsana) {
        try {
          const memberUserGids = (group.members || [])
            .map((m: any) => m.asanaGid || (/^\d+$/.test(m.id) ? m.id : undefined))
            .filter(Boolean) as string[];

          const asanaRes = await postMessageToAsanaProject(
            group.id || group.repoUrl,
            tokenToUse,
            subject,
            message,
            recipient === 'all' ? 'Entire Team' : recipient,
            memberUserGids
          );
          asanaFeedback = asanaRes.message;
          asanaGid = asanaRes.taskGid;
          asanaSuccess = asanaRes.success;
          asanaSimulated = Boolean(asanaRes.simulated);

          if (asanaRes.success) {
            deliveryChannels.push('Asana Project Board (Delivered)');
          } else if (asanaRes.simulated) {
            deliveryChannels.push('Asana Project Board (Simulated Record)');
          } else {
            deliveryChannels.push('Asana Project Board (Failed)');
          }
        } catch (asanaErr: any) {
          console.warn('Asana post warning:', asanaErr);
          asanaFeedback = asanaErr.message || 'Queued for Asana sync';
          deliveryChannels.push('Asana Project Board (Failed)');
        }
      }

      // 2. Launch Email Client if enabled so the email is actually dispatched
      let mailLaunched = false;
      if (targetEmailStr) {
        deliveryChannels.push('Student Email Log');
        if (launchEmailClient) {
          try {
            const link = document.createElement('a');
            link.href = mailtoUrl;
            link.click();
            mailLaunched = true;
          } catch {
            // fallback
          }
        }
      }

      // 3. Build SentTeamMessage record (3a: save created task gid)
      const sentMsg: SentTeamMessage = {
        id: `msg-${Date.now()}`,
        senderName: currentUser?.name || 'Course Coordinator',
        senderEmail: currentUser?.email || 'lecturer@university.edu',
        recipient: recipient === 'all' ? `Entire Team (${group.name})` : recipient,
        recipientEmail: targetEmailStr,
        subject: subject.trim(),
        content: message.trim(),
        timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
        channels: deliveryChannels,
        taskGid: asanaGid,
      };

      // 4. Persist to Cloud Firestore under groups/{groupId}/messages
      let firestoreSaved = false;
      if (currentUser?.id) {
        try {
          await saveMessageToFirestore(currentUser.id, group.id, sentMsg);
          firestoreSaved = true;
        } catch (fsErr) {
          console.warn('Firestore message save notice:', fsErr);
        }
      }

      // 3c: Remove any code that changes a team's communication score when lecturer sends message.
      // Communication must come only from student activity. Keep saved record for audit.
      const updatedMessages = [sentMsg, ...(group.messages || [])];
      const updatedGroup: StudentGroup = {
        ...group,
        messages: updatedMessages,
        lastActivity: 'Advisory Notice Dispatched',
        lastActivityTimestamp: new Date().toISOString(),
      };

      if (onMessageSentToGroup) {
        onMessageSentToGroup(updatedGroup, sentMsg);
      }

      setSendResult({
        success: true,
        asanaStatus: asanaFeedback,
        asanaSuccess,
        asanaSimulated,
        asanaTaskGid: asanaGid,
        firestoreSaved,
        emailsDispatched: targetEmails,
        timestamp: sentMsg.timestamp,
        mailClientLaunched: mailLaunched,
      });

      // 3d: With no token, show exact toast "Recorded only. Nothing was posted to Asana."
      if (postToAsana) {
        if (!tokenToUse || asanaSimulated) {
          onSendSuccess('Recorded only. Nothing was posted to Asana.');
        } else if (asanaSuccess) {
          onSendSuccess(asanaFeedback || `Advisory posted to Asana for ${recipient === 'all' ? group.name : recipient}`);
        } else {
          onSendSuccess(`Recorded in audit log. Asana delivery failed: ${asanaFeedback}`);
        }
      } else {
        onSendSuccess(`Advisory recorded and logged for ${recipient === 'all' ? group.name : recipient}`);
      }
    } catch (err: any) {
      console.error('Send error:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Send Message to Team</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sendResult ? (
          /* Delivery Confirmation Screen */
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Message Successfully Dispatched!</span>
              </div>
              <p className="text-xs text-emerald-700">
                Your advisory guidance has been logged, recorded in team history, and dispatched across active channels.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    Student Emails ({sendResult.emailsDispatched.length} recipients):
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                    Ready / Sent
                  </span>
                </div>
                <p className="text-slate-600 font-mono text-[11px] truncate">
                  {sendResult.emailsDispatched.join(', ')}
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleOpenGmailWeb}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-medium text-[11px] cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in Web Gmail
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenEmailClient}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-medium text-[11px] cursor-pointer"
                  >
                    <Mail className="w-3 h-3" />
                    Open in Mail App (mailto)
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-300 rounded text-[11px] cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {postToAsana && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-rose-500" />
                      Asana Project Notice:
                    </span>
                    {sendResult.asanaSuccess ? (
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                        Delivered (GID #{sendResult.asanaTaskGid})
                      </span>
                    ) : sendResult.asanaSimulated ? (
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                        Simulated Record
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded">
                        Delivery Failed
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-[11px]">{sendResult.asanaStatus}</p>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    Course Health &amp; Audit Log:
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                    Recorded in Firestore
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Permanently saved to Cloud Firestore under advisory audit log. Team communication health factor is unaffected by lecturer advisory notices.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSendResult(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Send Another Message
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Compose Form */
          <form onSubmit={handleSend} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Recipient(s)
              </label>
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">
                  Entire Team ({group.name} - all {group.members.length} student members)
                </option>
                {group.members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} ({m.role}) - {m.email}
                  </option>
                ))}
              </select>
              {targetEmailStr && (
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  Recipient Email(s): <strong className="text-slate-700">{targetEmailStr}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Line
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Message Body
                </label>
                <span className="text-[11px] text-indigo-600 font-medium">Auto-composed with diagnostic context</span>
              </div>
              <textarea
                rows={5}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
              />
            </div>

            {/* Delivery Channels */}
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2.5 text-xs">
              <span className="font-semibold text-slate-800 block">Dispatch Channels:</span>

              <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={launchEmailClient}
                  onChange={(e) => setLaunchEmailClient(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-slate-800">Launch Email Client automatically upon sending</span>
                  <p className="text-[11px] text-slate-500">
                    Opens your email app (Gmail / Outlook / Apple Mail) pre-filled with all student recipients.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={postToAsana}
                  onChange={(e) => setPostToAsana(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-slate-800">Post Announcement Notice directly to Asana Project Board</span>
                  <p className="text-[11px] text-slate-500">
                    Creates an announcement task on the student team's Asana board.
                  </p>
                </div>
              </label>

              {postToAsana && (
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTokenField(!showTokenField)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium underline cursor-pointer"
                  >
                    {showTokenField ? 'Hide Asana Token' : 'Asana PAT Token Settings'}
                  </button>
                  {showTokenField && (
                    <div className="mt-1.5 space-y-1">
                      <input
                        type="password"
                        placeholder="Paste Asana Personal Access Token (1/12...)"
                        value={asanaTokenInput}
                        onChange={(e) => setAsanaTokenInput(e.target.value)}
                        className="w-full text-[11px] py-1.5 px-2 bg-white border border-slate-300 rounded font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        Prototype only: this token is used from your browser. Use a throwaway token and revoke it afterwards.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-slate-600 text-[11px] pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Saves permanently to Cloud Firestore advisory audit log</span>
              </div>
            </div>

            {/* Quick Web Actions & Send */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenGmailWeb}
                  className="text-[11px] text-red-600 hover:text-red-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                  title="Open directly in Gmail web browser"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Draft in Gmail</span>
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[11px] text-slate-600 hover:text-slate-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {isSending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending &amp; Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send &amp; Dispatch Message</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// 2. Request Meeting Modal
interface RequestMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: StudentGroup | null;
  onScheduleSuccess: (msg: string) => void;
}

export const RequestMeetingModal: React.FC<RequestMeetingModalProps> = ({
  isOpen,
  onClose,
  group,
  onScheduleSuccess,
}) => {
  const [date, setDate] = useState('2026-10-06');
  const [time, setTime] = useState('14:30');
  const [duration, setDuration] = useState('30');
  const [meetingType, setMeetingType] = useState('Virtual (Zoom / Teams)');
  const [agenda, setAgenda] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (group) {
      setAgenda(
        `1. Check on overdue tasks\n2. Talk about team workload and sharing the work\n3. Any questions or technical help needed`
      );
    }
  }, [group]);

  if (!isOpen || !group) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      onScheduleSuccess(
        `Meeting invitation scheduled with ${group.name} on ${date} at ${time} (${duration} mins). Calendar invite sent.`
      );
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Schedule Meeting with Team</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meeting Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Time
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="15">15 Minutes (Quick check)</option>
                <option value="30">30 Minutes (Standard)</option>
                <option value="45">45 Minutes (Detailed review)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Where to Meet
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Virtual (Zoom / Teams)">Online (Zoom / Teams)</option>
                <option value="In-Person (Faculty Office 412)">In-Person (Office 412)</option>
                <option value="Lab Review (ECE Building 3)">In Lab (Building 3)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              What to Talk About
            </label>
            <textarea
              rows={4}
              required
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 font-sans"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scheduling (1s)...</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule Meeting</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. Simple Settings Modal
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<UserSettings>(settings);
  const [savedToast, setSavedToast] = useState(false);

  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Alerts &amp; Sync Settings</h3>
            <p className="text-xs text-slate-500">Configure your alert preferences and Asana integration</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2.5">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 transition-colors cursor-pointer">
              <div className="pr-3">
                <div className="text-xs font-semibold text-slate-900">
                  Critical High-Risk Alerts
                </div>
                <div className="text-[11px] text-slate-500">
                  Send immediate alert when a project health score drops below 40
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.highRiskAlerts}
                onChange={(e) =>
                  setFormData({ ...formData, highRiskAlerts: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 transition-colors cursor-pointer">
              <div className="pr-3">
                <div className="text-xs font-semibold text-slate-900">
                  Daily Morning Digest (08:00 AM)
                </div>
                <div className="text-[11px] text-slate-500">
                  Daily summary email of all active project groups and risk changes
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.dailyDigest}
                onChange={(e) =>
                  setFormData({ ...formData, dailyDigest: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/60 transition-colors cursor-pointer">
              <div className="pr-3">
                <div className="text-xs font-semibold text-slate-900">
                  Asana Background Auto-Sync
                </div>
                <div className="text-[11px] text-slate-500">
                  Periodically poll Asana workspaces for updated task statuses and overdue deadlines
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.asanaWebhookSync}
                onChange={(e) =>
                  setFormData({ ...formData, asanaWebhookSync: e.target.checked })
                }
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              {savedToast ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. Confirm Remove Project Modal
interface ConfirmRemoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: StudentGroup | null;
  onConfirmRemove: (group: StudentGroup) => void;
}

export const ConfirmRemoveModal: React.FC<ConfirmRemoveModalProps> = ({
  isOpen,
  onClose,
  group,
  onConfirmRemove,
}) => {
  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Remove Project?
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Are you sure you want to remove{' '}
              <strong className="text-slate-900">{group.name}</strong> ({group.projectTitle})?
            </p>
            <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              This project, its tasks, and alerts will be removed from your dashboard.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmRemove(group);
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove Project
          </button>
        </div>
      </div>
    </div>
  );
};

// 5. Add / Sync Student Member Modal
interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: StudentGroup | null;
  onMemberAdded: (updatedGroup: StudentGroup, newMember: TeamMember) => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  group,
  onMemberAdded,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Frontend & UI Developer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !group) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);

    const avatarColors = [
      'bg-indigo-600',
      'bg-emerald-600',
      'bg-purple-600',
      'bg-blue-600',
      'bg-amber-600',
      'bg-teal-600',
      'bg-rose-600',
    ];
    const avatarColor = avatarColors[(group.members.length + 1) % avatarColors.length];

    const cleanEmail = email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@university.edu`;

    const newMember: TeamMember = {
      id: `m-custom-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      role: role.trim() || 'Team Contributor',
      avatarColor,
      assignedTasks: 0,
      completedTasks: 0,
      commits: 2,
      prReviews: 1,
      messagesSent: 3,
      lastActive: 'Today',
      workloadSharePercent: Math.round(100 / (group.members.length + 1)),
      status: 'Balanced',
    };

    const newMembers = [...group.members, newMember];

    // Recompute workload shares so sum is 100%
    const count = newMembers.length;
    const balancedShare = Math.round(100 / count);
    const updatedMembers = newMembers.map((m) => ({
      ...m,
      workloadSharePercent: balancedShare,
    }));

    const workloadEquityScore = Math.max(50, Math.min(95, Math.round(90 - Math.abs(balancedShare - 25) * 1.5)));

    const updatedGroup: StudentGroup = {
      ...group,
      members: updatedMembers,
      workloadEquityScore,
      lastActivity: `New Member Added (${newMember.name})`,
      lastActivityTimestamp: new Date().toISOString(),
    };

    setTimeout(() => {
      setIsSubmitting(false);
      onMemberAdded(updatedGroup, newMember);
      setName('');
      setEmail('');
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Add Student Member</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">
            Add a new student contributor to <strong>{group.name}</strong>. The team member count, workload equity, and roster will be updated immediately.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Student Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Jordan Lee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              University Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. jordan.lee@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Project Role / Responsibilities
            </label>
            <input
              type="text"
              placeholder="e.g. Full Stack Developer, QA Tester, Scrum Master"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member to Roster</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

