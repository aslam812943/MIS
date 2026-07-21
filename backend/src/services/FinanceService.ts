import { supabaseAdmin } from '../config/supabase.js';

const SHEET_TABLE_MAPPING: { [key: string]: string } = {
  'pnl-summary': 'finance_pnl_summary',
  'compliance-renewals': 'finance_compliance_renewals',
  'exchange-reporting': 'finance_exchange_reporting',
  'fund-movement': 'finance_fund_movement',
  'client-requests': 'finance_client_requests',
  'referral-commission': 'finance_referral_commission',
  'cash-bank-position': 'finance_cash_bank_position',
  'recurring-payables': 'finance_recurring_payables'
};

// Single source of truth for each sheet's status-like column and its allowed
// values. Reused by both validatePayload() (create/update/import) and
// bulkUpdate() so the batch-action endpoint can't write a status value that
// wouldn't be accepted anywhere else (it previously wrote straight to the DB
// with no whitelist check at all).
const SHEET_STATUS_CONFIG: { [key: string]: { field: string; options: string[] } } = {
  'compliance-renewals': { field: 'status', options: ['Pending', 'Paid', 'Renewed', 'Overdue', 'Filed'] },
  'exchange-reporting': { field: 'status', options: ['Pending', 'Submitted On-Time', 'Submitted Late', 'Not Submitted'] },
  'client-requests': { field: 'status', options: ['Pending', 'In Process', 'Approved', 'Rejected', 'Completed'] },
  'referral-commission': { field: 'payment_status', options: ['Pending', 'Paid', 'On Hold'] },
  'cash-bank-position': { field: 'bank_reconciliation_status', options: ['Reconciled', 'Pending', 'Discrepancy Found'] },
  'recurring-payables': { field: 'status', options: ['Pending', 'Paid', 'Overdue'] }
};

// Matches the NUMERIC(15, 2) column capacity used across every Finance table.
const MAX_MONETARY_VALUE = 9999999999999.99;

export class FinanceService {
  /**
   * Verifies if the requester has permission to access Finance department data.
   */
  async verifyAccess(userId: string, requiresDashboard = false): Promise<{ authorized: boolean; role?: string; branchId?: string; departmentId?: string }> {
    const client = supabaseAdmin;
    if (!client) return { authorized: false };

    const { data: profile, error } = await client
      .from('profiles')
      .select('role, branch_id, department_id, departments(name)')
      .eq('id', userId)
      .single();

    if (error || !profile) return { authorized: false };

    const role = profile.role;
    const branchId = profile.branch_id;
    const departmentId = profile.department_id;
    const departmentName = (profile.departments as any)?.name || '';

    const isAdminOrMgmt = role === 'admin' || ['ceo', 'managing_director', 'director', 'executive'].includes(role);
    const isFinanceDept = departmentName.toUpperCase() === 'FINANCE';

    // Employees now get their own dashboard too (previously HOD-only) — what
    // they actually see on it is restricted per-widget client-side via
    // DashboardPermissionService, defaulting to nothing visible until admin
    // opts specific widgets in.
    let isAuthorized = false;
    if (requiresDashboard) {
      isAuthorized = isAdminOrMgmt || (isFinanceDept && (role === 'hod' || role === 'employee'));
    } else {
      isAuthorized = isAdminOrMgmt || isFinanceDept;
    }

    return {
      authorized: isAuthorized,
      role,
      branchId,
      departmentId
    };
  }

  /**
   * Strips NUL/control characters, which Postgres rejects outright in
   * text columns. Deliberately does NOT HTML-entity-encode the value:
   * the React frontend never uses dangerouslySetInnerHTML for this data,
   * so it already renders stored text safely as plain text. Encoding it
   * here as well used to corrupt ordinary Finance text like "R&D",
   * "Client's request", or "TDS Return Filing Q1/Q2" into literal
   * "R&amp;D" / "Client&#x27;s request" strings that were then displayed
   * verbatim (React doesn't decode HTML entities in text nodes).
   */
  private sanitizeString(str: any): any {
    if (typeof str !== 'string') return str;
    const controlCharPattern = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');
    return str.replace(controlCharPattern, '');
  }

  private sanitizePayload(payload: any) {
    if (!payload) return;
    for (const key of Object.keys(payload)) {
      if (typeof payload[key] === 'string') {
        payload[key] = this.sanitizeString(payload[key].trim());
      }
    }
  }

  /**
   * Performs backend sanity and format validation.
   */
  private validatePayload(sheet: string, payload: any) {
    if (!payload) throw new Error('Data payload is required.');

    // 1. Trim and strip control characters from all string fields
    this.sanitizePayload(payload);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    const dateFields = [
      'period_month', 'due_date', 'last_paid_date', 'period_date', 'submitted_date',
      'entry_date', 'request_date', 'resolved_date', 'statement_date', 'payment_date',
      'position_date', 'pis_reporting_date', 'paid_date'
    ];
    for (const field of dateFields) {
      if (payload[field] !== undefined && payload[field] !== null && String(payload[field]).trim() !== '') {
        const val = String(payload[field]).substring(0, 10);
        if (!dateRegex.test(val)) {
          throw new Error(`Field ${field} must be a valid date in YYYY-MM-DD format.`);
        }
      }
    }

    // 2. Logic date assertions (Prevent date order manipulation)
    if (payload.due_date && payload.last_paid_date && new Date(payload.last_paid_date) > new Date(payload.due_date) && payload.status === 'Pending') {
      // Not a hard error - paid ahead of due date is fine. No assertion needed here.
    }
    if (payload.request_date && payload.resolved_date && new Date(payload.resolved_date) < new Date(payload.request_date)) {
      throw new Error('Resolved date cannot be before request date.');
    }
    if (payload.period_date && payload.submitted_date && new Date(payload.submitted_date) < new Date(payload.period_date)) {
      throw new Error('Submitted date cannot be before the period date.');
    }

    // 3. String length checks (DoS prevention)
    const longTextFields = ['description', 'remarks'];
    for (const key of Object.keys(payload)) {
      if (typeof payload[key] === 'string') {
        const len = payload[key].length;
        if (longTextFields.includes(key)) {
          if (len > 4000) {
            throw new Error(`Field ${key.replace(/_/g, ' ')} exceeds maximum length limit of 4000 characters.`);
          }
        } else {
          if (len > 255) {
            throw new Error(`Field ${key.replace(/_/g, ' ')} exceeds maximum length limit of 255 characters.`);
          }
        }
      }
    }

    // 4. Non-negative numbers check
    const numberFields = [
      'cash_brokerage_revenue', 'fno_brokerage_revenue', 'commodity_brokerage_revenue', 'dp_other_income',
      'operating_expense', 'cash_flow_bank', 'amount', 'notification_lead_time_days', 'payin_amount',
      'payin_count', 'payout_amount', 'payout_count', 'commission_amount', 'cash_in_hand', 'cash_at_bank'
    ];
    for (const field of numberFields) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        const val = Number(payload[field]);
        if (isNaN(val) || !isFinite(val) || val < 0) {
          throw new Error(`Field ${field.replace(/_/g, ' ')} must be a positive number.`);
        }
        if (val > MAX_MONETARY_VALUE) {
          throw new Error(`Field ${field.replace(/_/g, ' ')} exceeds the maximum allowed value.`);
        }
      }
    }

    // 5. Enum/dropdown constraint validation
    if (payload.renewal_type !== undefined && payload.renewal_type !== null && String(payload.renewal_type).trim() !== '') {
      const allowed = ['Land Tax', 'Insurance', 'TDS Payment', 'TDS Return Filing', 'GST Payment', 'GST Return Filing', 'Fixed Deposit Renewal', 'Exchange Security Deposit Renewal', 'AMC Renewal', 'License/Membership Fee', 'LPC Running', 'Other'];
      if (!allowed.includes(String(payload.renewal_type).trim())) {
        throw new Error('Invalid renewal type.');
      }
    }

    if (payload.frequency !== undefined && payload.frequency !== null && String(payload.frequency).trim() !== '') {
      if (!['One-time', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annually'].includes(String(payload.frequency).trim())) {
        throw new Error('Invalid frequency value.');
      }
    }

    if (payload.submission_type !== undefined && payload.submission_type !== null && String(payload.submission_type).trim() !== '') {
      if (!['Daily Segregation Report', 'Holdings Statement', 'Monthly Settlement Report', 'Quarterly Settlement Report', 'Other'].includes(String(payload.submission_type).trim())) {
        throw new Error('Invalid submission type.');
      }
    }

    if (payload.exchange !== undefined && payload.exchange !== null && String(payload.exchange).trim() !== '') {
      if (!['NSE', 'BSE', 'MCX', 'All'].includes(String(payload.exchange).trim())) {
        throw new Error('Invalid exchange value.');
      }
    }

    if (payload.request_type !== undefined && payload.request_type !== null && String(payload.request_type).trim() !== '') {
      if (!['General Client Request', 'Brokerage Revision Request'].includes(String(payload.request_type).trim())) {
        throw new Error('Invalid request type.');
      }
    }

    if (payload.payable_type !== undefined && payload.payable_type !== null && String(payload.payable_type).trim() !== '') {
      if (!['EMI', 'Mobile Bill', 'Internet Bill', 'Rent Payable', 'Rent Receivable', 'Other Utility'].includes(String(payload.payable_type).trim())) {
        throw new Error('Invalid payable type.');
      }
    }

    // Status-like column validation is sheet-specific (e.g. recurring-payables
    // only allows Pending/Paid/Overdue, not exchange-reporting's "Submitted
    // Late"). Validating against a single merged list across all sheets would
    // let a wrong-sheet value pass the API check and only fail later against
    // the database CHECK constraint with a raw, unfriendly error.
    const statusConfig = SHEET_STATUS_CONFIG[sheet];
    if (statusConfig) {
      const val = payload[statusConfig.field];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        if (!statusConfig.options.includes(String(val).trim())) {
          throw new Error(`Invalid ${statusConfig.field.replace(/_/g, ' ')} value.`);
        }
      }
    }
  }

  /**
   * Retrieves entries for a specific Finance table.
   */
  async getEntries(
    requesterId: string,
    sheet: string,
    branchIdFilter?: string,
    search?: string,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(requesterId, false);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    let targetBranchId: string | undefined = branchIdFilter;
    if (access.role === 'employee') {
      // Deny rather than silently list every branch's raw records if this
      // employee has no branch assigned (e.g. their branch was deleted,
      // which nulls branch_id via ON DELETE SET NULL).
      if (!access.branchId) throw new Error('Unauthorized: No branch assigned.');
      targetBranchId = access.branchId;
    }

    let query = client.from(table).select('*');

    if (targetBranchId) {
      query = query.eq('branch_id', targetBranchId);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    if (search) {
      // PostgREST's or()/ilike() filters are built from a raw string, so
      // comma/parenthesis characters in user input can inject extra filter
      // clauses (e.g. "),status.eq.X,(" ) into the query. Strip the syntax
      // metacharacters and cap the length before it's ever interpolated.
      const safeSearch = search.replace(/[,()]/g, '').slice(0, 100).trim();

      if (safeSearch) {
        if (sheet === 'compliance-renewals') {
          query = query.or(`item_name.ilike.%${safeSearch}%,reference_no.ilike.%${safeSearch}%`);
        } else if (sheet === 'client-requests') {
          query = query.or(`client_name.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
        } else if (sheet === 'referral-commission') {
          query = query.ilike('referrer_name', `%${safeSearch}%`);
        } else if (sheet === 'recurring-payables') {
          query = query.ilike('description', `%${safeSearch}%`);
        } else if (sheet === 'cash-bank-position') {
          query = query.ilike('bank_name', `%${safeSearch}%`);
        }
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(`Query failed: ${error.message}`);

    return data || [];
  }

  async createEntry(requesterId: string, sheet: string, data: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    const branchId = access.role === 'employee' ? access.branchId : (data.branch_id || access.branchId);

    const payload = {
      ...data,
      branch_id: branchId,
      created_by: requesterId
    };

    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    this.validatePayload(sheet, payload);

    const { data: result, error } = await client.from(table).insert(payload).select().single();
    if (error) throw new Error(`Insert failed: ${error.message}`);
    return result;
  }

  async updateEntry(requesterId: string, sheet: string, id: string, updates: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    const { data: record, error: fetchError } = await client.from(table).select('id, branch_id').eq('id', id).single();
    if (fetchError || !record) throw new Error('Record not found.');

    // Branch is locked at creation time (the edit form never shows a branch
    // selector), so editing a record outside your own branch should be
    // blocked the same way bulkUpdate() already blocks it for HODs.
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && record.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const payload = { ...updates };
    delete (payload as any).branch_id;
    delete (payload as any).created_by;
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    this.validatePayload(sheet, payload);

    const { data: result, error } = await client.from(table).update(payload).eq('id', id).select().single();
    if (error) throw new Error(`Update failed: ${error.message}`);
    return result;
  }

  async deleteEntry(requesterId: string, sheet: string, id: string): Promise<void> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    const { data: record, error: fetchError } = await client.from(table).select('branch_id').eq('id', id).single();
    if (fetchError || !record) throw new Error('Record not found.');

    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && record.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const { error } = await client.from(table).delete().eq('id', id);
    if (error) throw new Error(`Delete failed: ${error.message}`);
  }

  async bulkUpdate(requesterId: string, sheet: string, ids: string[], updates: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    if (!Array.isArray(ids) || ids.length === 0) throw new Error('At least one record id is required.');
    if (ids.length > 500) throw new Error('Batch update limit exceeded (500 records max).');

    // This endpoint only ever writes a sheet's status-like column, so
    // whatever value comes in must match that sheet's own whitelist — the
    // same one create/update/import already enforce. Previously this wrote
    // updates.status straight to the DB with only a .trim(), so any string
    // value would have gone through as long as the DB CHECK constraint
    // happened to allow it (and failed with a raw Postgres error otherwise).
    const statusConfig = SHEET_STATUS_CONFIG[sheet];
    if (!statusConfig) throw new Error('This sheet does not support batch status updates.');

    const incomingValue = updates ? updates[statusConfig.field] : undefined;
    if (incomingValue === undefined || incomingValue === null || String(incomingValue).trim() === '') {
      throw new Error(`A valid ${statusConfig.field.replace(/_/g, ' ')} value is required.`);
    }
    const cleanValue = String(incomingValue).trim();
    if (!statusConfig.options.includes(cleanValue)) {
      throw new Error(`Invalid ${statusConfig.field.replace(/_/g, ' ')} value.`);
    }

    if ((access.role === 'employee' || access.role === 'hod') && access.branchId) {
      const { data: mismatchRows } = await client
        .from(table)
        .select('id')
        .in('id', ids)
        .neq('branch_id', access.branchId);
      if (mismatchRows && mismatchRows.length > 0) {
        throw new Error('Unauthorized: Selected records contain rows outside your branch.');
      }
    }

    const safeUpdates = { [statusConfig.field]: cleanValue };

    const { data, error } = await client.from(table).update(safeUpdates).in('id', ids).select();
    if (error) throw new Error(`Bulk update failed: ${error.message}`);
    return data;
  }

  async bulkImport(requesterId: string, sheet: string, records: any[]): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    if (!Array.isArray(records)) throw new Error('Records must be an array.');
    if (records.length > 500) throw new Error('Bulk import limit exceeded (500 records max).');

    const defaultBranchId = access.branchId;

    const validatedRecords = records.map((row: any) => {
      const branchId = access.role === 'employee' ? defaultBranchId : (row.branch_id || defaultBranchId);
      if ((access.role === 'employee' || access.role === 'hod') && defaultBranchId && branchId !== defaultBranchId) {
        throw new Error('Unauthorized: Row contains foreign branch ID.');
      }

      const item: any = {
        ...row,
        branch_id: branchId,
        created_by: requesterId
      };

      delete item.id;
      delete item.created_at;
      delete item.updated_at;

      this.validatePayload(sheet, item);
      return item;
    });

    const { data, error } = await client.from(table).insert(validatedRecords).select();
    if (error) throw new Error(`Bulk insert failed: ${error.message}`);
    return data;
  }

  /**
   * Aggregates stats for the Finance dashboard charts and metrics.
   */
  async getDashboardStats(
    requesterId: string,
    branchIdFilter?: string,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(requesterId, true);
    if (!access.authorized) throw new Error('Unauthorized dashboard access.');

    let targetBranchId: string | undefined = branchIdFilter;
    if (access.role === 'employee') {
      // Deny rather than silently show unfiltered company-wide data if this
      // employee has no branch assigned (e.g. their branch was deleted,
      // which nulls branch_id via ON DELETE SET NULL) — falling through to
      // "no filter" here would leak every branch's aggregate KPIs to them.
      if (!access.branchId) throw new Error('Unauthorized: No branch assigned — dashboard unavailable.');
      targetBranchId = access.branchId;
    }

    const applyFilters = <T extends any>(query: T): T => {
      let q: any = query;
      if (targetBranchId) q = q.eq('branch_id', targetBranchId);
      if (startDate) q = q.gte('created_at', startDate);
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59.999Z`);
      return q;
    };

    // P&L Summary rows (for revenue, profit, ratio KPIs + revenue charts)
    const { data: pnlRows } = await applyFilters(
      client.from('finance_pnl_summary').select('entry_date, cash_brokerage_revenue, fno_brokerage_revenue, commodity_brokerage_revenue, dp_other_income, operating_expense')
    );

    let totalCash = 0, totalFno = 0, totalCommodity = 0, totalDpOther = 0, totalOpex = 0;
    (pnlRows || []).forEach((r: any) => {
      totalCash += Number(r.cash_brokerage_revenue || 0);
      totalFno += Number(r.fno_brokerage_revenue || 0);
      totalCommodity += Number(r.commodity_brokerage_revenue || 0);
      totalDpOther += Number(r.dp_other_income || 0);
      totalOpex += Number(r.operating_expense || 0);
    });

    const totalBrokerageRevenue = totalCash + totalFno + totalCommodity;
    const totalRevenueAll = totalBrokerageRevenue + totalDpOther;
    const netProfit = totalRevenueAll - totalOpex;
    const ebitdaMargin = totalRevenueAll > 0 ? Number(((netProfit / totalRevenueAll) * 100).toFixed(1)) : 0;
    const costToIncome = totalRevenueAll > 0 ? Number(((totalOpex / totalRevenueAll) * 100).toFixed(1)) : 0;

    // Latest Cash & Bank position (for Total Liquidity KPI)
    let liquidityQuery = client.from('finance_cash_bank_position').select('cash_in_hand, cash_at_bank, position_date');
    if (targetBranchId) liquidityQuery = liquidityQuery.eq('branch_id', targetBranchId);
    const { data: cashRows } = await liquidityQuery.order('position_date', { ascending: false }).limit(1);
    const totalLiquidity = cashRows && cashRows.length > 0
      ? Number(cashRows[0]?.cash_in_hand || 0) + Number(cashRows[0]?.cash_at_bank || 0)
      : 0;

    // Compliance renewals (for Renewals Due Soon KPI + upcoming dues chart)
    const { data: renewals } = await applyFilters(
      client.from('finance_compliance_renewals').select('due_date, status, notification_lead_time_days')
    );
    const today = new Date();
    const openStatuses = ['Pending', 'Overdue'];
    const renewalsDueSoon = (renewals || []).filter((r: any) => {
      if (!openStatuses.includes(r.status)) return false;
      if (!r.due_date) return false;
      const dueDate = new Date(r.due_date);
      const leadDays = Number(r.notification_lead_time_days || 15);
      const alertFrom = new Date(dueDate.getTime() - leadDays * 24 * 60 * 60 * 1000);
      return today >= alertFrom;
    }).length;

    // Client Requests (for Open Client Requests KPI)
    const { data: requests } = await applyFilters(
      client.from('finance_client_requests').select('status')
    );
    const openClientRequests = (requests || []).filter((r: any) => ['Pending', 'In Process'].includes(r.status)).length;

    // CHART 1: Monthly revenue trend (last 12 months, stacked Cash/F&O/Commodity)
    const monthsLabels: string[] = [];
    const monthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      monthsLabels.push(d.toLocaleString('default', { month: 'short', year: 'numeric' }));
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const cashSeries = new Array(12).fill(0);
    const fnoSeries = new Array(12).fill(0);
    const commoditySeries = new Array(12).fill(0);
    (pnlRows || []).forEach((r: any) => {
      if (!r.entry_date) return;
      const d = new Date(r.entry_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const idx = monthKeys.indexOf(key);
      if (idx !== -1) {
        cashSeries[idx] += Number(r.cash_brokerage_revenue || 0);
        fnoSeries[idx] += Number(r.fno_brokerage_revenue || 0);
        commoditySeries[idx] += Number(r.commodity_brokerage_revenue || 0);
      }
    });

    // CHART 2: Revenue composition donut (Cash / F&O / Commodity / DP & Other Income)
    const revenueComposition = {
      labels: ['Cash', 'F&O', 'Commodity', 'DP & Other Income'],
      values: [totalCash, totalFno, totalCommodity, totalDpOther]
    };

    // CHART 3: Upcoming statutory/compliance dues over next 12 months
    const dueMonthLabels: string[] = [];
    const upcomingDues: number[] = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      const futureMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
      dueMonthLabels.push(futureMonth.toLocaleString('default', { month: 'short', year: 'numeric' }));
    }
    (renewals || []).forEach((r: any) => {
      if (!r.due_date) return;
      const dueDate = new Date(r.due_date);
      const diffMonths = (dueDate.getFullYear() - today.getFullYear()) * 12 + (dueDate.getMonth() - today.getMonth());
      if (diffMonths >= 0 && diffMonths < 12) {
        upcomingDues[diffMonths] = (upcomingDues[diffMonths] || 0) + 1;
      }
    });

    return {
      kpis: {
        totalBrokerageRevenue: Number(totalBrokerageRevenue.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        ebitdaMargin,
        costToIncome,
        totalLiquidity: Number(totalLiquidity.toFixed(2)),
        renewalsDueSoon,
        openClientRequests
      },
      charts: {
        revenueTrendLabels: monthsLabels,
        cashSeries,
        fnoSeries,
        commoditySeries,
        revenueCompositionLabels: revenueComposition.labels,
        revenueComposition: revenueComposition.values,
        upcomingDuesLabels: dueMonthLabels,
        upcomingDues
      }
    };
  }
}
