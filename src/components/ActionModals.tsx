import React, { useState } from 'react';
import {
  X,
  Mail,
  Calendar,
  CheckCircle,
  Loader2,
  Clock,
  MapPin,
  Send
} from 'lucide-react';
import { Group } from '../types';
import { addGroupIntervention } from '../services/api';
import { useToast } from '../hooks/useToast';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onActionComplete?: () => void;
}

export const SendMessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  group,
  onActionComplete
}) => {
  const [subject, setSubject] = useState(`[Academic Advisory] Capstone Sprint Health Check-in - ${group.groupName}`);
  const [message, setMessage] = useState(
    `Hello ${group.groupName} team,\n\nI am reviewing our capstone project analytics for ${group.courseCode}. Your current Project Health Score is ${group.latestScore}/100.\n\nPlease provide a brief update on your recent progress and let me know if your team needs faculty assistance.`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      await addGroupIntervention(group.id, 'message_sent', `Sent advisory message: "${subject}"`);
      success('Message Sent to Group', `Logged academic advisory notification for ${group.groupName}.`);
      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err: any) {
      error('Send Failed', err.message || 'Could not log message intervention.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Mail className="w-4 h-4 text-indigo-600" />
            <span>Send Advisory Message to {group.groupName}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Message Body</label>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Logged in group intervention history</span>
            <span className="font-semibold text-indigo-600">{group.courseCode}</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Dispatch Message</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RequestMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onActionComplete?: () => void;
}

export const RequestMeetingModal: React.FC<RequestMeetingModalProps> = ({
  isOpen,
  onClose,
  group,
  onActionComplete
}) => {
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [meetingTime, setMeetingTime] = useState('14:00');
  const [location, setLocation] = useState('Faculty Office Building 4, Room 412 (or Zoom)');
  const [note, setNote] = useState('Mandatory sprint intervention meeting to discuss task backlog and workload re-balancing.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const summary = `Meeting requested on ${meetingDate} at ${meetingTime}. Location: ${location}. Agenda: ${note}`;
      await addGroupIntervention(group.id, 'meeting_requested', summary);
      success('Meeting Requested', `Consultation logged for ${group.groupName} on ${meetingDate}.`);
      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err: any) {
      error('Meeting Request Failed', err.message || 'Error recording meeting intervention.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Request Consultation Meeting - {group.groupName}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Date
              </label>
              <input
                type="date"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Time
              </label>
              <input
                type="time"
                required
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" /> Location / Room / Link
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Agenda &amp; Instructions</label>
            <textarea
              required
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              <span>Schedule Consultation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface MarkReviewedModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onActionComplete?: () => void;
}

export const MarkReviewedModal: React.FC<MarkReviewedModalProps> = ({
  isOpen,
  onClose,
  group,
  onActionComplete
}) => {
  const [note, setNote] = useState('Reviewed current sprint progress. Actions agreed with team lead.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await addGroupIntervention(group.id, 'marked_reviewed', note);
      success('Marked as Reviewed', `Status for ${group.groupName} set to Reviewed.`);
      if (onActionComplete) onActionComplete();
      onClose();
    } catch (err: any) {
      error('Review Update Failed', err.message || 'Error updating review state.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Mark {group.groupName} as Reviewed?</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            This flags that you have examined the team's risk factors and intervened. The project status will update to <strong className="text-slate-800">Reviewed</strong>.
          </p>

          <div className="text-left pt-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Note</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              <span>Confirm Reviewed</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
