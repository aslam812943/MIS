const dateFields = ['payment_date', 'research_date', 'kyc_fetch_date', 'kra_modify_date', 'subscription_start_date', 'subscription_end_date'];

export function normalizeRaImportRow(input: Record<string, unknown>): Record<string, any> {
  const row: Record<string, any> = { ...input };
  for (const [alias, field] of Object.entries({coverage_start_date: 'subscription_start_date', coverage_end_date: 'subscription_end_date', fee_paid: 'amount', amount_paid: 'amount', paid_amount: 'amount'})) {
    if (row[alias] !== undefined && row[alias] !== '') {
      if (row[field] !== undefined && row[field] !== '' && String(row[field]) !== String(row[alias])) throw new Error(`Conflicting values for ${field} and ${alias}.`);
      row[field] = row[alias];
      delete row[alias];
    }
  }
  const amount = String(row.amount ?? '').trim().replace(/[₹,\s]/g, '').replace(/^INR/i, '');
  if (amount && (!/^\d+(\.\d+)?$/.test(amount) || !Number.isFinite(Number(amount)))) throw new Error('Amount must be a valid non-negative number.');
  row.amount = amount ? Number(amount) : 0;
  for (const field of dateFields) {
    const value = String(row[field] ?? '').trim();
    if (!value) { row[field] = null; continue; }
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
    const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
    if (!iso && !local) throw new Error(`${field}: use YYYY-MM-DD or DD/MM/YYYY.`);
    const year = Number(iso ? iso[1] : local![3]);
    const month = Number(iso ? iso[2] : local![2]);
    const day = Number(iso ? iso[3] : local![1]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${field}: invalid calendar date.`);
    row[field] = date.toISOString().slice(0, 10);
  }
  if (row.subscription_start_date && row.subscription_end_date && row.subscription_end_date < row.subscription_start_date) throw new Error('Subscription end date must be on or after the start date.');
  const status = String(row.kra_updation_status ?? '').trim();
  const canonical = ['Pending', 'In Progress', 'Completed', 'Updated'].find(item => item.toLowerCase() === status.toLowerCase());
  if (status && !canonical) throw new Error('KRA status must be Pending, In Progress, Completed, or Updated.');
  row.kra_updation_status = canonical || 'Pending';
  return row;
}

// A shared phone or email alone does not identify a client.
export function raClientDuplicateKeys(row: Record<string, any>): string[] {
  const text = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const keys: string[] = [];
  const pan = text(row.pan);
  const sw = text(row.sw_code);
  const name = text(row.client_name);
  const phone = String(row.mobile_number ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const email = text(row.email_id);
  if (/^[a-z]{5}[0-9]{4}[a-z]$/.test(pan)) keys.push(`pan:${pan}`);
  if (sw && !['-', 'na', 'n/a', 'none'].includes(sw)) keys.push(`sw:${sw}`);
  if (name && phone) keys.push(JSON.stringify(['name-phone', name, phone]));
  if (name && email) keys.push(JSON.stringify(['name-email', name, email]));
  if (!keys.length && name) keys.push(JSON.stringify(['record', name, text(row.package), row.subscription_start_date || '', row.subscription_end_date || '']));
  return keys;
}

export function fillRaSubscriptionEndDate<T extends Record<string, any>>(row: T, plans: Array<{ name: string; duration_days: number }>): T {
  if (!row.subscription_start_date || row.subscription_end_date) return row;
  const plan = plans.find(plan => plan.name.trim().toLowerCase() === String(row.package || '').trim().toLowerCase());
  if (!plan || !Number.isInteger(Number(plan.duration_days)) || Number(plan.duration_days) <= 0) throw new Error('Cannot calculate end date: select a plan with a valid duration in days.');
  const start = new Date(`${row.subscription_start_date}T00:00:00Z`);
  if (!Number.isFinite(start.getTime())) throw new Error('Cannot calculate end date: invalid subscription start date.');
  start.setUTCDate(start.getUTCDate() + Number(plan.duration_days));
  return { ...row, subscription_end_date: start.toISOString().slice(0, 10) };
}
