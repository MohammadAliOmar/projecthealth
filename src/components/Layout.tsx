import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  HelpCircle,
  LogOut,
  User,
  Sliders,
  ChevronDown,
  CheckCheck,
  Search,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAlerts } from '../hooks/useAlerts';
import { logout } from '../services/api';
import { useToast } from '../hooks/useToast';
import { DemoPanel } from './DemoPanel';
import { Group } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  groups?: Group[];
  onDataMutated?: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  groups = [],
  onDataMutated,
  searchQuery = '',
  onSearchChange
}) => {
  const { profile } = useAuth();
  const { alerts, unreadCount, markAllAsRead, markAsRead } = useAlerts();
  const { info, error } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const alertsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setIsAlertsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      info('Signed Out', 'You have been logged out of your session.');
      navigate('/login');
    } catch (err: any) {
      error('Sign Out Failed', err.message);
    }
  };

  const handleAlertClick = async (alertId: string, groupId: string) => {
    await markAsRead(alertId);
    setIsAlertsOpen(false);
    navigate(`/groups/${groupId}`);
  };

  const recentAlerts = alerts.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Bar Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo and Nav links */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                      ProjectHealth <span className="text-indigo-600">AI</span>
                    </span>
                    <span className="hidden lg:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                      Capstone Early Warning
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 hidden sm:block">
                    University Capstone Early Risk Prediction
                  </p>
                </div>
              </Link>

              {/* Navigation Tabs */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600">
                <Link
                  to="/"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    location.pathname === '/' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/alerts"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors relative ${
                    location.pathname === '/alerts' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Alerts</span>
                  {unreadCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-bold">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/settings"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    location.pathname === '/settings' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Settings</span>
                </Link>
                <Link
                  to="/guide"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    location.pathname === '/guide' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Methodology</span>
                </Link>
              </nav>
            </div>

            {/* Right Tools: Search, Notification Bell, User Menu, Help */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Optional Search Input */}
              {onSearchChange && (
                <div className="relative hidden lg:block w-52 xl:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search groups or projects..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-transparent focus:border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400"
                  />
                </div>
              )}

              {/* Notification Bell Dropdown */}
              <div className="relative" ref={alertsRef}>
                <button
                  type="button"
                  onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                  aria-label={`System alerts: ${unreadCount} unread`}
                  className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown Menu */}
                {isAlertsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Project Alerts</span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {unreadCount} New
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllAsRead()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {recentAlerts.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                          No risk alerts at this time. All capstone teams on track.
                        </div>
                      ) : (
                        recentAlerts.map(a => (
                          <div
                            key={a.id}
                            onClick={() => handleAlertClick(a.id, a.groupId)}
                            className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${
                              a.status === 'New' ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            <div className="shrink-0 mt-0.5">
                              {a.riskLevel === 'High' ? (
                                <ShieldAlert className="w-4 h-4 text-rose-600" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {a.groupName}
                                </span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                                  a.riskLevel === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {a.riskLevel} Risk
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                                {Array.isArray(a.contributingFactors) && a.contributingFactors.length > 0
                                  ? typeof a.contributingFactors[0] === 'string'
                                    ? a.contributingFactors[0]
                                    : (a.contributingFactors[0] as any).description
                                  : a.recommendation}
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                <span>Score: <strong className="font-mono text-slate-700">{a.healthScore}/100</strong></span>
                                <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 text-center">
                      <Link
                        to="/alerts"
                        onClick={() => setIsAlertsOpen(false)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                      >
                        <span>View all alerts</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Help & Methodology Link */}
              <Link
                to="/guide"
                title="User Guide and Scoring Methodology"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <HelpCircle className="w-4 h-4" />
              </Link>

              {/* User Menu Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {profile?.name ? profile.name.charAt(0) : 'L'}
                  </div>
                  <span className="hidden sm:inline font-semibold text-slate-800">
                    {profile?.name || 'Dr. Evelyn Reed'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <div className="text-xs font-bold text-slate-900">{profile?.name || 'Lecturer'}</div>
                      <div className="text-[11px] text-slate-500 truncate">{profile?.email}</div>
                      <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">Faculty IT Capstone Coordinator</div>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Profile &amp; Settings</span>
                      </Link>
                      <Link
                        to="/guide"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>Methodology Guide</span>
                      </Link>
                    </div>
                    <div className="border-t border-slate-100 pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Live Demo Control Drawer */}
      <DemoPanel groups={groups} onDataMutated={onDataMutated} />
    </div>
  );
};
