import { supabaseAdmin } from '../config/supabase.js';

const SHEET_TABLE_MAPPING: { [key: string]: string } = {
  'new-accounts': 'dp_new_account',
  'ucc-updation': 'dp_ucc_updation',
  'modifications': 'dp_modification',
  'demat-executions': 'dp_demat_execution',
  'transfers-transmissions': 'dp_transfers_transmissions',
  'demat-rejections': 'dp_demat_rejection',
  'closures': 'dp_closure_execution',
  'dis-slips': 'dp_dis_slip_upload',
  'back-office-updates': 'dp_back_office_update',
  'eod-backups': 'dp_eod_backup',
  'amc-charges': 'dp_amc_charges',
  'monthly-statements': 'dp_monthly_statements',
  'audit-compliance': 'dp_audit_compliance',
  'client-queries': 'dp_client_queries'
};

const TABLES_WITH_CLIENTS = [
  'dp_new_account',
  'dp_ucc_updation',
  'dp_modification',
  'dp_demat_execution',
  'dp_transfers_transmissions',
  'dp_demat_rejection',
  'dp_closure_execution',
  'dp_dis_slip_upload',
  'dp_amc_charges',
  'dp_monthly_statements',
  'dp_client_queries'
];

// Mirrors each table's DB CHECK constraint on `status` in database_dp.sql.
// dis-slips (scan_upload_status) and monthly-statements (dispatch_status)
// deliberately have no entry here — they don't have a `status` column at
// all, so a sheet not listed here cleanly rejects a batch status update
// instead of failing with a raw "column does not exist" DB error.
const SHEET_STATUS_OPTIONS: { [key: string]: string[] } = {
  'new-accounts': ['Pending', 'Uploaded', 'Completed', 'Rejected'],
  'ucc-updation': ['Pending', 'Uploaded', 'Confirmed', 'Rejected'],
  'modifications': ['Pending', 'Processed', 'Rejected'],
  'demat-executions': ['Sent to RTA', 'Confirmed', 'Rejected', 'Resubmitted', 'Closed'],
  'transfers-transmissions': ['Pending', 'Executed', 'Rejected'],
  'demat-rejections': ['Pending', 'Resolved'],
  'closures': ['Requested', 'Approved', 'Closed', 'Rejected'],
  'back-office-updates': ['Success', 'Failed'],
  'eod-backups': ['Success', 'Failed', 'Verified'],
  'amc-charges': ['Pending', 'Debited', 'Waived', 'Failed'],
  'audit-compliance': ['Open', 'Action Pending', 'Closed'],
  'client-queries': ['Open', 'In Progress', 'Resolved', 'Escalated'],
};

export class DPService {
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
    const isDPDept = departmentName.toUpperCase() === 'DP';

    // Employees now get their own dashboard too (previously HOD-only) — what
    // they actually see on it is restricted per-widget client-side via
    // DashboardPermissionService, defaulting to nothing visible until admin
    // opts specific widgets in.
    let isAuthorized = false;
    if (requiresDashboard) {
      isAuthorized = isAdminOrMgmt || (isDPDept && (role === 'hod' || role === 'employee'));
    } else {
      isAuthorized = isAdminOrMgmt || isDPDept;
    }

    return {
      authorized: isAuthorized,
      role,
      branchId,
      departmentId
    };
  }

  private async validatePayload(client: NonNullable<typeof supabaseAdmin>, sheet: string, payload: any) {
    if (!payload) throw new Error('Data payload is required.');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const boIdRegex = /^\d{16}$/;
    const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

    const TABLES_WITH_CLIENTS = [
      'new-accounts', 'ucc-updation', 'modifications', 'demat-executions',
      'transfers-transmissions', 'demat-rejections', 'closures', 'dis-slips',
      'amc-charges', 'monthly-statements', 'client-queries'
    ];
    if (TABLES_WITH_CLIENTS.includes(sheet)) {
      if (!payload.kyc_client_id || !uuidRegex.test(payload.kyc_client_id)) {
        throw new Error('Invalid or missing KYC Client ID reference.');
      }

      // The client-picker in the UI only ever lists Verified clients, but
      // the API itself didn't check this — a request built by hand could
      // reference any kyc_new_account row, including one still Pending or
      // Rejected, and DP would process it as if KYC was already cleared.
      const { data: kycClient, error: kycErr } = await client
        .from('kyc_new_account')
        .select('status')
        .eq('id', payload.kyc_client_id)
        .single();
      if (kycErr || !kycClient) {
        throw new Error('Linked KYC client record was not found.');
      }
      if (kycClient.status !== 'Verified') {
        throw new Error('Linked client\'s KYC is not yet Verified. Only Verified clients can be processed here.');
      }
    }

    const boIdFields = ['bo_id', 'from_bo_id', 'to_bo_id', 'bo_id_generated'];
    for (const field of boIdFields) {
      if (payload[field] !== undefined && payload[field] !== null && String(payload[field]).trim() !== '') {
        if (!boIdRegex.test(String(payload[field]).trim())) {
          throw new Error(`Field ${field} must be a valid 16-digit Demat BO ID.`);
        }
      }
    }

    if (payload.isin !== undefined && payload.isin !== null && String(payload.isin).trim() !== '') {
      if (!isinRegex.test(String(payload.isin).trim().toUpperCase())) {
        throw new Error('Invalid ISIN format. Must be a standard 12-character code starting with IN.');
      }
    }

    const numberFields = ['quantity', 'amc_amount', 'gst_amount', 'total_amount', 'file_size_kb'];
    for (const field of numberFields) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        const val = Number(payload[field]);
        if (isNaN(val) || val < 0) {
          throw new Error(`Field ${field} must be a positive number.`);
        }
      }
    }

    const dateFields = [
      'verification_date', 'uploaded_to_cdsl_date', 'upload_date', 'confirmation_date',
      'request_date', 'processed_date', 'sent_to_rta_date', 'execution_date',
      'rejection_date', 'resubmission_date', 'closure_date', 'backup_date',
      'debit_date', 'generated_date', 'resolution_date'
    ];
    for (const field of dateFields) {
      if (payload[field] !== undefined && payload[field] !== null && String(payload[field]).trim() !== '') {
        const val = String(payload[field]).substring(0, 10);
        if (!dateRegex.test(val)) {
          throw new Error(`Field ${field} must be a valid date in YYYY-MM-DD format.`);
        }
      }
    }

    if (payload.status !== undefined && payload.status !== null) {
      const allowed = ['Pending', 'Uploaded', 'Completed', 'Rejected', 'Confirmed', 'Processed', 'Sent to RTA', 'Closed', 'Resubmitted', 'Executed', 'Resolved', 'Requested', 'Approved', 'Failed', 'Success', 'Verified', 'Debited', 'Waived', 'Sent', 'Bounced', 'Open', 'Action Pending', 'In Progress', 'Escalated'];
      if (!allowed.includes(String(payload.status).trim())) {
        throw new Error('Invalid status value.');
      }
    }

    if (payload.exchange !== undefined && payload.exchange !== null && String(payload.exchange).trim() !== '') {
      if (!['NSE', 'BSE'].includes(String(payload.exchange).trim())) {
        throw new Error('Exchange must be NSE or BSE.');
      }
    }

    if (payload.segment !== undefined && payload.segment !== null && String(payload.segment).trim() !== '') {
      if (!['Cash', 'F&O', 'Currency', 'Commodity'].includes(String(payload.segment).trim())) {
        throw new Error('Segment must be Cash, F&O, Currency, or Commodity.');
      }
    }
  }

  async getVerifiedClients(): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');
    
    const { data, error } = await client
      .from('kyc_new_account')
      .select('id, applicant_name, pan, aadhaar_number, mobile_number, email, date_of_birth, address')
      .eq('status', 'Verified')
      .order('applicant_name', { ascending: true });

    if (error) throw new Error(`Failed to load verified clients: ${error.message}`);
    return data || [];
  }

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

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet identifier.');

    let targetBranchId: string | undefined = branchIdFilter;
    if (access.role === 'employee') {
      // Deny rather than silently list every branch's raw records if this
      // employee has no branch assigned (e.g. their branch was deleted,
      // which nulls branch_id via ON DELETE SET NULL).
      if (!access.branchId) throw new Error('Unauthorized: No branch assigned.');
      targetBranchId = access.branchId;
    }

    const hasClient = TABLES_WITH_CLIENTS.includes(table);
    let selectString = '*';
    if (hasClient) {
      selectString = '*, kyc_new_account(applicant_name, pan, aadhaar_number, mobile_number, email, date_of_birth, address)';
    }

    let query = client.from(table).select(selectString);

    if (targetBranchId) {
      query = query.eq('branch_id', targetBranchId);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    if (search && hasClient) {
      // PostgREST's or() filter is a raw string — unescaped commas/parens in
      // user input could inject extra filter clauses, so strip them first.
      const safeSearch = search.replace(/[,()]/g, '').slice(0, 100).trim();
      const { data: matchingClients } = await client
        .from('kyc_new_account')
        .select('id')
        .or(`applicant_name.ilike.%${safeSearch}%,pan.ilike.%${safeSearch}%`);

      const ids = (matchingClients || []).map(c => c.id);
      if (ids.length > 0) {
        query = query.in('kyc_client_id', ids);
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
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

    delete (payload as any).kyc_new_account;
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    await this.validatePayload(client, sheet, payload);

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

    let query = client.from(table).select('id, branch_id').eq('id', id).single();
    const { data: record, error: fetchError } = await query;
    if (fetchError || !record) throw new Error('Record not found.');

    // Branch is locked at creation time (the edit form never shows a branch
    // selector), so an HOD editing a record outside their own branch should
    // be blocked the same way bulkUpdate() already blocks it.
    if ((access.role === 'employee' || access.role === 'hod') && access.branchId && record.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const payload = { ...updates };
    delete (payload as any).kyc_new_account;
    delete (payload as any).branch_id;
    delete (payload as any).created_by;
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    await this.validatePayload(client, sheet, payload);

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

    updates = updates || {};

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    if (!Array.isArray(ids) || ids.length === 0) throw new Error('At least one record id is required.');

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

    const safeUpdates: any = {};
    if (updates.status !== undefined) {
      const cleanStatus = String(updates.status).trim();
      const allowedStatuses = SHEET_STATUS_OPTIONS[sheet];
      if (!allowedStatuses || !allowedStatuses.includes(cleanStatus)) {
        throw new Error('Invalid status value for this sheet.');
      }
      safeUpdates.status = cleanStatus;
    }
    if (sheet === 'new-accounts') {
      if (updates.pan_copy !== undefined) safeUpdates.pan_copy = !!updates.pan_copy;
      if (updates.aadhaar_copy !== undefined) safeUpdates.aadhaar_copy = !!updates.aadhaar_copy;
      if (updates.bank_proof !== undefined) safeUpdates.bank_proof = !!updates.bank_proof;
      if (updates.photograph !== undefined) safeUpdates.photograph = !!updates.photograph;
      if (updates.signature !== undefined) safeUpdates.signature = !!updates.signature;
    }

    if (Object.keys(safeUpdates).length === 0) {
      throw new Error('No valid update properties provided.');
    }

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

    const validatedRecords: any[] = [];
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        const branchId = access.role === 'employee' ? defaultBranchId : (row.branch_id || defaultBranchId);
        if ((access.role === 'employee' || access.role === 'hod') && defaultBranchId && branchId !== defaultBranchId) {
          throw new Error('Unauthorized: Row contains foreign branch ID.');
        }

        const item: any = {
          ...row,
          branch_id: branchId,
          created_by: requesterId
        };

        delete item.kyc_new_account;
        delete item.id;
        delete item.created_at;
        delete item.updated_at;

        await this.validatePayload(client, sheet, item);
        validatedRecords.push(item);
      } catch (err: any) {
        throw new Error(`Row ${i + 1}: ${err.message}`);
      }
    }

    const { data, error } = await client.from(table).insert(validatedRecords).select();
    if (error) throw new Error(`Bulk insert failed: ${error.message}`);
    return data;
  }

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

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) throw new Error('Invalid start date format.');
    if (endDate && !dateRegex.test(endDate)) throw new Error('Invalid end date format.');

    const applyFilters = <T extends any>(query: T): T => {
      let q: any = query;
      if (targetBranchId) q = q.eq('branch_id', targetBranchId);
      if (startDate) q = q.gte('created_at', startDate);
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59.999Z`);
      return q;
    };

    // Query 1: New Accounts
    const { data: newAccounts } = await applyFilters(
      client.from('dp_new_account').select('status, created_at')
    );

    // Query 2: Modifications
    const { data: modifications } = await applyFilters(
      client.from('dp_modification').select('status')
    );

    // Query 3: Demat Executions
    const { data: dematExecs } = await applyFilters(
      client.from('dp_demat_execution').select('status')
    );

    // Query 4: DIS Slips
    const { data: disSlips } = await applyFilters(
      client.from('dp_dis_slip_upload').select('scan_upload_status')
    );

    // Query 5: Client Queries
    const { data: queries } = await applyFilters(
      client.from('dp_client_queries').select('status, query_type')
    );

    // Query 6: Audits
    const { data: audits } = await applyFilters(
      client.from('dp_audit_compliance').select('status')
    );

    // Aggregates
    const accountsCount = (newAccounts || []).length;
    const pendingModifications = (modifications || []).filter(m => m.status === 'Pending').length;
    const completedDemats = (dematExecs || []).filter(d => d.status === 'Confirmed').length;
    const activeQueries = (queries || []).filter(q => q.status === 'Open' || q.status === 'In Progress').length;
    const openAudits = (audits || []).filter(a => a.status === 'Open' || a.status === 'Action Pending').length;

    // Line trends: Account openings over the months
    const monthlyCounts = Array(12).fill(0);
    (newAccounts || []).forEach(acc => {
      if (acc.created_at) {
        const monthIndex = new Date(acc.created_at).getMonth();
        if (monthIndex >= 0 && monthIndex < 12) monthlyCounts[monthIndex]++;
      }
    });

    // Donut chart: DIS scans upload status
    const disStatus = { Uploaded: 0, Pending: 0, Failed: 0 };
    (disSlips || []).forEach(dis => {
      const status = dis.scan_upload_status as keyof typeof disStatus;
      if (status in disStatus) disStatus[status]++;
    });

    // Bar chart: Query distribution by type
    const queryTypes: { [key: string]: number } = {
      'Delayed Transfer': 0,
      'AMC Issue': 0,
      'Account Details': 0,
      'Document Status': 0,
      'Other': 0
    };
    (queries || []).forEach(q => {
      const type = q.query_type;
      if (type && type in queryTypes) {
        const key = type as keyof typeof queryTypes;
        queryTypes[key] = (queryTypes[key] || 0) + 1;
      }
    });

    return {
      kpis: {
        totalAccounts: accountsCount,
        pendingModifications,
        completedDemats,
        activeQueries,
        openAudits
      },
      charts: {
        accountOpenings: monthlyCounts,
        disUploadStatus: [disStatus.Uploaded, disStatus.Pending, disStatus.Failed],
        queryTypes: Object.values(queryTypes),
        queryLabels: Object.keys(queryTypes)
      }
    };
  }
}
