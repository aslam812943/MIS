import React from 'react';

interface TrendDeltaProps {
  current: number | null | undefined;
  previous: number | null | undefined;
  /**
   * Set for metrics that are already a percentage/ratio (e.g. SLA %,
   * uptime %) — shows the point difference ("+3pp") instead of a relative
   * % change, since "% change of a %" reads as confusing for those.
   */
  isPercentagePoint?: boolean;
}

/**
 * Previous-vs-current comparison badge, shown under a KPI's big number on
 * every dashboard. Green/up if improved, red/down if it fell, neutral
 * "New" if there's nothing to compare against yet.
 */
const TrendDelta: React.FC<TrendDeltaProps> = ({ current, previous, isPercentagePoint }) => {
  const cur = Number(current ?? 0);

  if (!previous || previous === 0) {
    if (cur > 0) {
      return <span className="text-[9px] font-semibold" style={{ color: 'var(--text-secondary)' }}>New this period</span>;
    }
    return null;
  }

  if (cur === previous) {
    return <span className="text-[9px] font-semibold" style={{ color: 'var(--text-secondary)' }}>— No change</span>;
  }

  const up = cur > previous;
  const color = up ? '#10b981' : '#ef4444';
  const arrow = up ? '▲' : '▼';

  const text = isPercentagePoint
    ? `${up ? '+' : ''}${(cur - previous).toFixed(1)}pp vs last period`
    : `${Math.abs(((cur - previous) / previous) * 100).toFixed(1)}% vs last period`;

  return (
    <span className="text-[9px] font-semibold" style={{ color }}>
      {arrow} {text}
    </span>
  );
};

export default TrendDelta;
