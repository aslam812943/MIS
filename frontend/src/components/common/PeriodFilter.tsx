import React, { useEffect, useMemo, useState } from 'react';
import type { PeriodType, DateRange } from '../../utils/periodRange';
import { resolvePeriod, currentQuarterOf, fyStartYearOf } from '../../utils/periodRange';

interface PeriodFilterProps {
  onChange: (period: { current: DateRange; previous: DateRange; type: PeriodType }) => void;
  /** Seeds the starting selection — e.g. so two side-by-side instances
   *  (Comparison page) can default to different months instead of both
   *  opening on the current one. Defaults to Monthly/this-month. */
  initialMonth?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonthStr = () => new Date().toISOString().slice(0, 7);
const formatDisplayDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Shared Monthly/Quarterly/Yearly/Custom period picker, used on every
 * dashboard. Replaces the old hand-rolled From/To date pair — selecting a
 * preset reveals the matching picker (a month, a quarter+year, or a year),
 * and always resolves both the chosen period AND its immediately preceding
 * equivalent period, so callers can fetch current-vs-previous stats.
 *
 * Quarterly/Yearly use the Indian financial year (Apr-Mar), not the
 * calendar year — the Year field is the FY's *start* year, e.g. entering
 * 2026 + Q4 means Jan-Mar 2027. The resolved date range is always shown
 * below the controls so this is never ambiguous.
 */
const PeriodFilter: React.FC<PeriodFilterProps> = ({ onChange, initialMonth }) => {
  const now = new Date();
  const [type, setType] = useState<PeriodType>('monthly');
  const [month, setMonth] = useState(initialMonth || currentMonthStr());
  const [year, setYear] = useState(fyStartYearOf(now));
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(currentQuarterOf(now));
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const resolved = useMemo(
    () => resolvePeriod({ type, month, year, quarter, from, to }),
    [type, month, year, quarter, from, to]
  );

  useEffect(() => {
    onChange({ current: resolved.current, previous: resolved.previous, type });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="mis-tabs">
        {(['monthly', 'quarterly', 'yearly', 'custom'] as PeriodType[]).map(t => (
          <button
            key={t}
            type="button"
            className={`mis-tab ${type === t ? 'active' : ''}`}
            onClick={() => setType(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {type === 'monthly' && (
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="mis-input py-1 px-2 text-xs"
          style={{ width: '150px' }}
        />
      )}

      {type === 'quarterly' && (
        <>
          <select
            value={quarter}
            onChange={e => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="mis-select text-xs"
            style={{ width: '90px' }}
          >
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
          <input
            type="number"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="mis-input py-1 px-2 text-xs"
            style={{ width: '90px' }}
            title="Financial year start (e.g. 2026 = FY2026-27, Apr 2026 - Mar 2027)"
          />
        </>
      )}

      {type === 'yearly' && (
        <input
          type="number"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="mis-input py-1 px-2 text-xs"
          style={{ width: '90px' }}
          title="Financial year start (e.g. 2026 = FY2026-27, Apr 2026 - Mar 2027)"
        />
      )}

      {type === 'custom' && (
        <>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <span>From:</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mis-input py-1 px-2 text-xs" style={{ width: '130px' }} />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <span>To:</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="mis-input py-1 px-2 text-xs" style={{ width: '130px' }} />
          </div>
        </>
      )}

      {/* Resolved range is always spelled out — quarters/years are financial
          year (Apr-Mar), which isn't obvious from the controls alone. */}
      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {resolved.current.label} · {formatDisplayDate(resolved.current.start)} – {formatDisplayDate(resolved.current.end)}
      </span>
    </div>
  );
};

export default PeriodFilter;
