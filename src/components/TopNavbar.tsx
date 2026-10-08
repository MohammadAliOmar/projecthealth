import React, { useState, useRef, useEffect } from 'react';
import { Bell, RefreshCw, Settings, LogOut, CheckCheck, AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { SystemAlert, RiskLevel, UserAccount } from '../types';

interface TopNavbarProps {
  alerts: SystemAlert[];
  currentUser: UserAccount;
  onMarkAllAlertsRead: () => void;
  onSelectAlertGroup: (groupId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onSyncAsana: () => void;
  onNavigateHome?: () => void;
  isSyncing: boolean;
  lastSynced: string;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  alerts,
  currentUser,
  onMarkAllAlertsRead,
  onSelectAlertGroup,
  onOpenSettings,
  onLogout,
  onSyncAsana,
  onNavigateHome,
  isSyncing,
  lastSynced,
}) => {
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAlertsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRiskBadge = (level: RiskLevel) => {
    switch (level) {
      case 'High':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            High Risk
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Medium Risk
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Low Risk
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Brand title & Context (Clickable to return to Dashboard) */}
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-3 text-left cursor-pointer group focus:outline-none"
            title="Go to Lecturer Dashboard"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 group-hover:bg-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-sm transition-colors">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight text-base sm:text-lg">
                  Project Health AI
                </span>
                <span className="hidden md:inline-block text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {currentUser.role}
                </span>
                <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Firebase: projecthealth-ai
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Track project health and spot problems early
              </p>
            </div>
          </button>

          {/* Zone 2 & 3: Primary Actions, Asana Sync, Alerts, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sync with Asana button */}
            <div className="flex flex-col items-end">
              <button
                type="button"
                onClick={onSyncAsana}
                disabled={isSyncing}
                title="Sync project tasks and updates from Asana"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
                <span className="whitespace-nowrap">{isSyncing ? 'Syncing...' : 'Sync with Asana'}</span>
              </button>
              <span className="text-[10px] text-slate-400 mt-0.5 hidden md:block">
                Last synced: {lastSynced}
              </span>
            </div>

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                aria-label={`Notifications, ${unreadCount} unread`}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {isAlertsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-800">
                        Project Warnings &amp; Alerts
                      </span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 text-[10px] font-medium bg-rose-100 text-rose-700 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllAlertsRead}
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark All as Read
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {alerts.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No alerts right now. All student groups are doing well.
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div
                          key={alert.id}
                          onClick={() => {
                            onSelectAlertGroup(alert.groupId);
                            setIsAlertsOpen(false);
                          }}
                          className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer text-left ${
                            !alert.read ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              {!alert.read && (
                                <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                              )}
                              <span className="font-semibold text-xs text-slate-900">
                                {alert.groupName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({alert.courseCode})
                              </span>
                            </div>
                            {getRiskBadge(alert.riskLevel)}
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-1.5">
                            {alert.contributingFactors}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>{alert.timestamp}</span>
                            <span className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 text-[11px] font-medium">
                              View team <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAlertsOpen(false);
                        onOpenSettings();
                      }}
                      className="text-[11px] text-slate-600 hover:text-indigo-600 font-medium"
                    >
                      Change notification settings →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Settings button */}
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Settings"
              title="Settings & Notifications"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Profile Avatar & Logout */}
            <div className="flex items-center pl-2 sm:pl-3 border-l border-slate-200 gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full ${currentUser.avatarColor || 'bg-slate-800'} text-white flex items-center justify-center text-xs font-semibold`}
                >
                  {currentUser.name
                    ? currentUser.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                    : 'U'}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-indigo-600 max-w-[150px] truncate font-medium">
                    {currentUser.email}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
