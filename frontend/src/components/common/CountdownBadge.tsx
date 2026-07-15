import React from 'react';
import { differenceInCalendarDays } from 'date-fns';

interface CountdownBadgeProps {
  dueDate: string | null | undefined;
  /** Shown when dueDate is empty — defaults to a neutral dash. */
  emptyLabel?: string;
}

/**
 * Renders a "days to go" pill for any renewal/filing due date — audits,
 * AMC contracts, software licenses. Color follows the same rule everywhere
 * in the app: green (>30 days), amber (0-30 days), red (overdue).
 */
const CountdownBadge: React.FC<CountdownBadgeProps> = ({ dueDate, emptyLabel = 'No date set' }) => {
  if (!dueDate) {
    return <span className="mis-badge mis-badge-neutral">{emptyLabel}</span>;
  }

  const daysToGo = differenceInCalendarDays(new Date(dueDate), new Date());

  if (daysToGo < 0) {
    return <span className="mis-badge mis-badge-danger">Overdue by {Math.abs(daysToGo)}d</span>;
  }
  if (daysToGo <= 30) {
    return <span className="mis-badge mis-badge-warning">{daysToGo}d left</span>;
  }
  return <span className="mis-badge mis-badge-success">{daysToGo}d left</span>;
};

export default CountdownBadge;
