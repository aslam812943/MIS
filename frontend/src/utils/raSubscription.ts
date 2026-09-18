export function calculateRaEndDate(start: string, duration: number): string {
  if (!start || !Number.isInteger(Number(duration)) || Number(duration) <= 0) return '';
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(start);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(start);
  if (!iso && !local) return '';
  const year = Number(iso ? iso[1] : local![3]);
  const month = Number(iso ? iso[2] : local![2]);
  const day = Number(iso ? iso[3] : local![1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  date.setUTCDate(date.getUTCDate() + Number(duration));
  return date.toISOString().slice(0, 10);
}

export function fillRaCsvEndDates(rows: Record<string, string>[], plans: Array<{ name: string; duration_days: number }>): Record<string, string>[] {
  return rows.map(row => {
    if (!row.subscription_start_date || row.subscription_end_date) return row;
    const plan = plans.find(plan => plan.name.trim().toLowerCase() === (row.package || '').trim().toLowerCase());
    const end = plan ? calculateRaEndDate(row.subscription_start_date, plan.duration_days) : '';
    return end ? { ...row, subscription_end_date: end } : row;
  });
}
