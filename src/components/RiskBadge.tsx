import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { RiskLevel, ContributingFactor } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
  factors?: ContributingFactor[] | string[];
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  factors = [],
  size = 'md',
  showTooltip = true
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Configuration for WCAG AA accessible styles, icons, and text labels
  const config = {
    Low: {
      label: 'Low Risk',
      icon: CheckCircle2,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-500/20',
      iconClass: 'text-emerald-600'
    },
    Medium: {
      label: 'Medium Risk',
      icon: AlertTriangle,
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 ring-amber-500/20',
      iconClass: 'text-amber-600'
    },
    High: {
      label: 'High Risk',
      icon: ShieldAlert,
      badgeClass: 'bg-rose-50 text-rose-900 border-rose-300 ring-rose-500/20',
      iconClass: 'text-rose-600'
    }
  }[level] || {
    label: 'Assessing',
    icon: Info,
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-300 ring-slate-500/20',
    iconClass: 'text-slate-500'
  };

  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold'
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  }[size];

  const formattedFactors = factors.map(f => typeof f === 'string' ? f : `${f.factor}: ${f.description}`);

  return (
    <div className="relative inline-block">
      <div
        tabIndex={0}
        role="status"
        aria-label={`${config.label}. ${formattedFactors.length > 0 ? formattedFactors.join('. ') : ''}`}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={`inline-flex items-center font-medium rounded-full border shadow-2xs transition-all cursor-help focus:outline-none focus:ring-2 ${config.badgeClass} ${sizeClasses}`}
      >
        <Icon className={`${iconSizes} ${config.iconClass} shrink-0`} aria-hidden="true" />
        <span>{config.label}</span>
      </div>

      {/* Accessible Tooltip */}
      {showTooltip && isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs border border-slate-700 pointer-events-none animate-in fade-in-50 zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-1.5 font-semibold text-slate-200 border-b border-slate-800 pb-1.5 mb-2">
            <Icon className={`w-3.5 h-3.5 ${config.iconClass}`} />
            <span>{config.label} Summary</span>
          </div>

          {formattedFactors.length > 0 ? (
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              {formattedFactors.map((fact, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                  <span className="text-slate-500 font-bold">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[11px] text-slate-400">
              Group milestone progress is currently within expected tolerances.
            </div>
          )}

          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
