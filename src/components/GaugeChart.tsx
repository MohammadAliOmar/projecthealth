import React from 'react';

interface GaugeChartProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  score,
  size = 64,
  strokeWidth = 6,
  showLabel = true
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const offset = circumference - (clampedScore / 100) * circumference;

  const color = clampedScore >= 70
    ? '#10b981' // emerald-500
    : clampedScore >= 40
    ? '#f59e0b' // amber-500
    : '#f43f5e'; // rose-500

  const trackColor = '#e2e8f0'; // slate-200

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Score Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-bold text-slate-900 leading-none tabular-nums" style={{ fontSize: size * 0.32 }}>
            {clampedScore}
          </span>
          <span className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">
            /100
          </span>
        </div>
      )}
    </div>
  );
};
