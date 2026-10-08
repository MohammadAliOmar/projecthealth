import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 90,
  height = 24,
  strokeColor
}) => {
  if (!data || data.length < 2) {
    return <div className="text-[10px] text-slate-300 italic">No history</div>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  const latestVal = data[data.length - 1];
  const firstVal = data[0];
  const color = strokeColor || (latestVal >= firstVal ? '#10b981' : '#f43f5e');

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* Latest point circle */}
      {data.length > 0 && (
        <circle
          cx={width - 2}
          cy={height - ((latestVal - min) / range) * (height - 8) - 4}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
};
