// Shared Monthly/Quarterly/Yearly/Custom period resolution, used by
// PeriodFilter and every dashboard page. Every department's dashboard
// backend endpoint already accepts arbitrary startDate/endDate — this
// utility only computes which two ranges (current + the immediately
// preceding equivalent period) to ask for, nothing server-side changes.

export type PeriodType = 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string;
}

export interface PeriodSelection {
  type: PeriodType;
  /** 'YYYY-MM', required for monthly */
  month?: string;
  /** required for quarterly */
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  /** required for custom */
  from?: string;
  to?: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function getMonthRange(monthStr: string): DateRange {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // last day of month
  return { start: toISO(start), end: toISO(end), label: `${MONTH_NAMES[m - 1]} ${y}` };
}

// Indian financial year: April 1 through March 31. Q1=Apr-Jun, Q2=Jul-Sep,
// Q3=Oct-Dec (all within `fyStartYear`), Q4=Jan-Mar (within `fyStartYear + 1`)
// — matches how SEBI-regulated entities and Indian companies actually
// report, rather than the calendar-year Jan-Dec convention.
export function getQuarterRange(fyStartYear: number, quarter: 1 | 2 | 3 | 4): DateRange {
  const fyLabel = `FY${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
  if (quarter === 4) {
    const start = new Date(fyStartYear + 1, 0, 1);
    const end = new Date(fyStartYear + 1, 3, 0);
    return { start: toISO(start), end: toISO(end), label: `Q4 ${fyLabel}` };
  }
  const startMonth = 3 + (quarter - 1) * 3; // Q1->Apr(3), Q2->Jul(6), Q3->Oct(9)
  const start = new Date(fyStartYear, startMonth, 1);
  const end = new Date(fyStartYear, startMonth + 3, 0);
  return { start: toISO(start), end: toISO(end), label: `Q${quarter} ${fyLabel}` };
}

export function getYearRange(fyStartYear: number): DateRange {
  const start = new Date(fyStartYear, 3, 1); // Apr 1
  const end = new Date(fyStartYear + 1, 2, 31); // Mar 31 next year
  return { start: toISO(start), end: toISO(end), label: `FY${fyStartYear}-${String(fyStartYear + 1).slice(-2)}` };
}

/** Which financial year (by its start calendar year) a given date falls in. */
export function fyStartYearOf(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

export function getCustomRange(from: string, to: string): DateRange {
  return { start: from, end: to, label: `${from} to ${to}` };
}

/**
 * The immediately preceding equivalent period — previous calendar
 * month/quarter/year for those preset types, or for Custom, an
 * equal-length window immediately before the chosen range.
 */
export function getPreviousRange(selection: PeriodSelection, current: DateRange): DateRange {
  switch (selection.type) {
    case 'monthly': {
      const [y, m] = (selection.month as string).split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1); // one month back
      return getMonthRange(`${prevDate.getFullYear()}-${pad2(prevDate.getMonth() + 1)}`);
    }
    case 'quarterly': {
      const fyStartYear = selection.year as number;
      const quarter = selection.quarter as 1 | 2 | 3 | 4;
      if (quarter === 1) return getQuarterRange(fyStartYear - 1, 4);
      return getQuarterRange(fyStartYear, (quarter - 1) as 1 | 2 | 3 | 4);
    }
    case 'yearly': {
      return getYearRange((selection.year as number) - 1);
    }
    case 'custom':
    default: {
      const start = new Date(current.start);
      const end = new Date(current.end);
      const spanDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (spanDays - 1));
      return { start: toISO(prevStart), end: toISO(prevEnd), label: `${toISO(prevStart)} to ${toISO(prevEnd)}` };
    }
  }
}

export function resolvePeriod(selection: PeriodSelection): { current: DateRange; previous: DateRange } {
  let current: DateRange;
  switch (selection.type) {
    case 'monthly':
      current = getMonthRange(selection.month || toISO(new Date()).slice(0, 7));
      break;
    case 'quarterly':
      current = getQuarterRange(selection.year ?? fyStartYearOf(new Date()), selection.quarter || 1);
      break;
    case 'yearly':
      current = getYearRange(selection.year ?? fyStartYearOf(new Date()));
      break;
    case 'custom':
    default:
      current = getCustomRange(selection.from || toISO(new Date()), selection.to || toISO(new Date()));
      break;
  }
  return { current, previous: getPreviousRange(selection, current) };
}

/** 'YYYY-MM' for the calendar month immediately before today — used to
 *  seed the Comparison page's "Period A" side with a sensible default
 *  (last month) distinct from "Period B"'s default (this month). */
export function previousMonthStr(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`;
}

/** Which FY quarter (Q1=Apr-Jun ... Q4=Jan-Mar) a given date falls in. */
export function currentQuarterOf(date: Date): 1 | 2 | 3 | 4 {
  const m = date.getMonth(); // 0-11
  if (m >= 3 && m <= 5) return 1;
  if (m >= 6 && m <= 8) return 2;
  if (m >= 9 && m <= 11) return 3;
  return 4;
}

/**
 * The same "Monthly, current month" default PeriodFilter starts on unless
 * the user changes it. Dashboard pages that gate their entire render
 * behind a `loading` flag (rather than always showing the header) must
 * seed their `period` state with this — not `null` — so the initial
 * fetch can fire immediately instead of waiting on PeriodFilter's mount
 * effect to report a value back, which never happens if the header
 * itself is hidden while `loading` is true.
 */
export function getDefaultPeriod(): { current: DateRange; previous: DateRange } {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return resolvePeriod({ type: 'monthly', month });
}
