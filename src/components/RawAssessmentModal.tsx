import React, { useState } from 'react';
import { Code2, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { HealthSnapshot, RiskLevel, ContributingFactor } from '../types';

interface RawAssessmentModalProps {
  score: number;
  riskLevel: RiskLevel;
  factors: ContributingFactor[];
  recommendation: string;
  snapshots?: HealthSnapshot[];
}

export const RawAssessmentModal: React.FC<RawAssessmentModalProps> = ({
  score,
  riskLevel,
  factors,
  recommendation,
  snapshots = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const payload = {
    risk_level: riskLevel,
    health_score: score,
    contributing_factors: factors.map(f => ({
      factor: f.factor,
      description: f.description,
      points_lost: f.pointsLost ?? null
    })),
    recommendation,
    historical_snapshots_count: snapshots.length,
    evaluated_at: new Date().toISOString()
  };

  const jsonString = JSON.stringify(payload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Code2 className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800">
            View Raw Assessment JSON Payload
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
            API Format
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>{isOpen ? 'Hide Payload' : 'Inspect JSON'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 border-t border-slate-100 bg-slate-950 text-slate-200">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="text-[11px] font-mono text-slate-400">
              Scoring Engine Output Schema (v2.1)
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-emerald-400 overflow-x-auto p-2 bg-slate-900 rounded-lg max-h-72 leading-relaxed">
            <code>{jsonString}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
