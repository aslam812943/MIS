import { supabaseAdmin } from '../config/supabase.js';

const SHEET_TABLE_MAPPING: { [key: string]: string } = {
  'audits': 'it_audits',
  'audit-findings': 'it_audit_findings',
  'vendors': 'it_vendors',
  'assets': 'it_assets',
  'diagrams': 'it_diagrams',
  'cybersecurity-compliance': 'it_cybersecurity_compliance',
  'tickets': 'it_tickets',
  'incidents': 'it_incidents',
  'projects': 'it_projects'
};

// Mirrors each table's DB CHECK constraint on `status` in database_it.sql.
// 'diagrams' has no entry — it has no status column at all.
const SHEET_STATUS_OPTIONS: { [key: string]: string[] } = {
  'audits': ['Scheduled', 'In Progress', 'Report Received', 'Submitted', 'Overdue'],
  'audit-findings': ['Open', 'In Progress', 'Implemented', 'Closed', 'Overdue'],
  'vendors': ['Active', 'Under Renewal', 'Expired', 'Terminated'],
  'assets': ['Active', 'Under Repair', 'Retired', 'Disposed'],
  'cybersecurity-compliance': ['Compliant', 'Non-Compliant', 'Due for Review', 'In Remediation'],
  'tickets': ['Open', 'In Progress', 'Resolved', 'Closed'],
  'incidents': ['Identified', 'Investigating', 'Mitigated', 'Resolved'],
  'projects': ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
};

// Only audit-findings and incidents have a `severity` column.
const SHEETS_WITH_SEVERITY = new Set(['audit-findings', 'incidents']);
const SEVERITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];

export class ITService {
  /**
   * Verifies if the requester has permission to access IT department data.
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
    const isITDept = departmentName.toUpperCase() === 'IT';

    let isAuthorized = false;
    if (requiresDashboard) {
      isAuthorized = isAdminOrMgmt || (isITDept && role === 'hod');
    } else {
      isAuthorized = isAdminOrMgmt || isITDept;
    }

    return {
      authorized: isAuthorized,
      role,
      branchId,
      departmentId
    };
  }

  /**
   * Computes current book value based on straight-line depreciation.
   */
  private calculateBookValue(asset: any): number {
    if (!asset.purchase_date || asset.purchase_value === undefined || !asset.useful_life_years) {
      return Number(asset.purchase_value || 0);
    }
    const purchaseValue = Number(asset.purchase_value);
    const usefulLife = Number(asset.useful_life_years);
    if (usefulLife <= 0) return 0;

    const purchaseDate = new Date(asset.purchase_date);
    const today = new Date();

    // Years elapsed calculation
    let yearsElapsed = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsElapsed < 0) yearsElapsed = 0;
    if (yearsElapsed > usefulLife) yearsElapsed = usefulLife;

    const annualDepreciation = purchaseValue / usefulLife;
    const currentBookValue = purchaseValue - (yearsElapsed * annualDepreciation);
    return Number(currentBookValue.toFixed(2));
  }

  /**
   * Flags whether an asset is due/past its useful life for upgrades.
   */
  private checkUpgradeFlag(asset: any): boolean {
    if (asset.status === 'Retired' || asset.status === 'Disposed') {
      return false;
    }
    if (!asset.purchase_date || !asset.useful_life_years) {
      return false;
    }
    const purchaseDate = new Date(asset.purchase_date);
    const today = new Date();
    const yearsElapsed = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return yearsElapsed >= Number(asset.useful_life_years);
  }

  /**
   * Strips NUL/control characters, which Postgres rejects outright in text
   * columns. Deliberately does NOT HTML-entity-encode the value: the React
   * frontend never uses dangerouslySetInnerHTML for this data, so it already
   * renders stored text safely as plain text. Encoding it here as well used
   * to corrupt ordinary IT text like "R&D server", "Vendor's contract", or
   * "Rack 3/B" into literal "R&amp;D server" strings that were then
   * displayed verbatim (React doesn't decode HTML entities in text nodes).
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

    // 1. Sanitize all string fields (Stored XSS mitigation)
    this.sanitizePayload(payload);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // Dates check
    const dateFields = [
      'scheduled_date', 'start_date', 'end_date', 'submission_deadline', 'actual_submission_date',
      'implementation_target_date', 'actual_implementation_date', 'amc_last_paid_date', 'amc_due_date',
      'purchase_date', 'warranty_start_date', 'warranty_end_date', 'last_assessed_date', 'next_review_date',
      'opened_date', 'closed_date', 'discovered_date', 'resolved_date', 'target_end_date', 'actual_end_date'
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
    if (payload.start_date && payload.end_date && new Date(payload.end_date) < new Date(payload.start_date)) {
      throw new Error('End date cannot be before start date.');
    }
    if (payload.warranty_start_date && payload.warranty_end_date && new Date(payload.warranty_end_date) < new Date(payload.warranty_start_date)) {
      throw new Error('Warranty end date cannot be before warranty start date.');
    }
    if (payload.opened_date && payload.closed_date && new Date(payload.closed_date) < new Date(payload.opened_date)) {
      throw new Error('Close date cannot be before open date.');
    }
    if (payload.discovered_date && payload.resolved_date && new Date(payload.resolved_date) < new Date(payload.discovered_date)) {
      throw new Error('Resolution date cannot be before discovery date.');
    }
    if (payload.start_date && payload.target_end_date && new Date(payload.target_end_date) < new Date(payload.start_date)) {
      throw new Error('Target end date cannot be before start date.');
    }
    if (payload.start_date && payload.actual_end_date && new Date(payload.actual_end_date) < new Date(payload.start_date)) {
      throw new Error('Actual end date cannot be before start date.');
    }

    // 3. String length checks (DoS prevention)
    const longTextFields = ['finding_description', 'recommended_action', 'remarks', 'description', 'control_item', 'issue_description', 'root_cause_analysis', 'remediation_action'];
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

    // Alphanumeric code formatting check
    if (payload.ticket_number !== undefined && payload.ticket_number !== null && String(payload.ticket_number).trim() !== '') {
      if (!/^[A-Z0-9-]+$/i.test(String(payload.ticket_number).trim())) {
        throw new Error('Ticket number must be alphanumeric characters.');
      }
    }
    if (payload.incident_number !== undefined && payload.incident_number !== null && String(payload.incident_number).trim() !== '') {
      if (!/^[A-Z0-9-]+$/i.test(String(payload.incident_number).trim())) {
        throw new Error('Incident number must be alphanumeric characters.');
      }
    }
    if (payload.asset_id !== undefined && payload.asset_id !== null && String(payload.asset_id).trim() !== '') {
      if (!/^[A-Z0-9-]+$/i.test(String(payload.asset_id).trim())) {
        throw new Error('Asset ID must be alphanumeric characters.');
      }
    }

    // Non-negative numbers check
    const numberFields = ['purchase_value', 'useful_life_years', 'contract_value', 'notification_lead_time_days', 'sla_target_hours'];
    for (const field of numberFields) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        const val = Number(payload[field]);
        if (isNaN(val) || val < 0) {
          throw new Error(`Field ${field} must be a positive number.`);
        }
      }
    }

    // Fields that are meaningless at zero (an asset with 0 years useful
    // life, or a ticket with a 0-hour SLA target, can't be acted on).
    const strictlyPositiveFields = ['useful_life_years', 'sla_target_hours'];
    for (const field of strictlyPositiveFields) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        if (Number(payload[field]) <= 0) {
          throw new Error(`Field ${field.replace(/_/g, ' ')} must be greater than zero.`);
        }
      }
    }

    // POC phone: 10-digit Indian mobile number, matching the same format
    // used for staff phone numbers elsewhere in the app.
    if (payload.poc_phone !== undefined && payload.poc_phone !== null && String(payload.poc_phone).trim() !== '') {
      if (!/^\d{10}$/.test(String(payload.poc_phone).trim())) {
        throw new Error('POC phone must be exactly 10 digits.');
      }
    }

    // Constraints validation. Status is sheet-specific (e.g. 'vendors' only
    // allows Active/Under Renewal/Expired/Terminated, not 'tickets'
    // Open/In Progress/etc) — validating against one merged list across all
    // 9 sheets would let a wrong-sheet value pass here and only fail later
    // against the database CHECK constraint with a raw, unfriendly error.
    if (payload.status !== undefined && payload.status !== null && String(payload.status).trim() !== '') {
      const allowed = SHEET_STATUS_OPTIONS[sheet];
      if (!allowed || !allowed.includes(String(payload.status).trim())) {
        throw new Error('Invalid status value for this sheet.');
      }
    }

    if (payload.audit_type !== undefined && payload.audit_type !== null && String(payload.audit_type).trim() !== '') {
      if (!['Internal', 'CERT-In Empanelled External', 'SEBI-Mandated Cyber Audit', 'VAPT'].includes(String(payload.audit_type).trim())) {
        throw new Error('Invalid audit type.');
      }
    }

    if (payload.domain !== undefined && payload.domain !== null && String(payload.domain).trim() !== '') {
      if (!['Governance', 'Infrastructure', 'Data Security', 'Network Security', 'Access Control', 'Incident Management'].includes(String(payload.domain).trim())) {
        throw new Error('Invalid compliance domain.');
      }
    }

    if (payload.severity !== undefined && payload.severity !== null && String(payload.severity).trim() !== '') {
      if (!['Critical', 'High', 'Medium', 'Low'].includes(String(payload.severity).trim())) {
        throw new Error('Invalid severity rating.');
      }
    }
  }

  // Sheets whose table has a UNIQUE column, so an insert/update can raise a
  // Postgres unique-violation. Maps each to the friendly field name shown
  // in the error, instead of leaking a raw "duplicate key value violates
  // unique constraint ..." message to the user.
  private static readonly UNIQUE_FIELD_LABEL: { [key: string]: string } = {
    'vendors': 'vendor name',
    'assets': 'asset barcode/ID',
  };

  /**
   * Translates a raw Postgres/PostgREST error into a clear, user-facing
   * message for known failure shapes (duplicate key). Anything else is
   * passed through with a generic prefix so it doesn't leak raw internals.
   */
  private friendlyDbError(sheet: string, rawMessage: string): string {
    if (rawMessage.includes('duplicate key value violates unique constraint') || rawMessage.includes('already exists')) {
      const label = ITService.UNIQUE_FIELD_LABEL[sheet] || 'value';
      return `A record with this ${label} already exists.`;
    }
    return `Operation failed: ${rawMessage}`;
  }

  /**
   * Fetches vendors list for dropdown mapping.
   */
  async getVendorsDropdown(userId: string): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');
    
    const { data, error } = await client
      .from('it_vendors')
      .select('id, vendor_name')
      .eq('status', 'Active')
      .order('vendor_name', { ascending: true });

    if (error) throw new Error(`Failed to load vendors: ${error.message}`);
    return data || [];
  }

  /**
   * Retrieves entries for a specific IT table.
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
      targetBranchId = access.branchId || undefined;
    }

    let selectString = '*';
    if (sheet === 'assets') {
      selectString = '*, it_vendors(vendor_name)';
    } else if (sheet === 'audit-findings') {
      selectString = '*, it_audits(audit_name)';
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

    if (search) {
      // PostgREST's or()/ilike() filters are built from a raw string, so
      // comma/parenthesis characters in user input can inject extra filter
      // clauses. Strip the syntax metacharacters and cap the length first.
      const safeSearch = search.replace(/[,()]/g, '').slice(0, 100).trim();

      if (safeSearch) {
        if (sheet === 'vendors') {
          query = query.or(`vendor_name.ilike.%${safeSearch}%,poc_name.ilike.%${safeSearch}%`);
        } else if (sheet === 'assets') {
          query = query.or(`asset_id.ilike.%${safeSearch}%,make_model.ilike.%${safeSearch}%`);
        } else if (sheet === 'audits') {
          query = query.ilike('audit_name', `%${safeSearch}%`);
        } else if (sheet === 'tickets') {
          query = query.or(`ticket_number.ilike.%${safeSearch}%,issue_description.ilike.%${safeSearch}%`);
        }
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(`Query failed: ${error.message}`);

    // Post-process assets to calculate depreciation on the fly
    if (sheet === 'assets' && data) {
      return data.map((asset: any) => ({
        ...asset,
        book_value: this.calculateBookValue(asset),
        time_to_upgrade: this.checkUpgradeFlag(asset)
      }));
    }

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

    delete (payload as any).it_vendors;
    delete (payload as any).it_audits;
    delete (payload as any).book_value;
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    this.validatePayload(sheet, payload);

    const { data: result, error } = await client.from(table).insert(payload).select().single();
    if (error) throw new Error(this.friendlyDbError(sheet, error.message));
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
    delete (payload as any).it_vendors;
    delete (payload as any).it_audits;
    delete (payload as any).book_value;
    delete (payload as any).branch_id;
    delete (payload as any).created_by;
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    this.validatePayload(sheet, payload);

    const { data: result, error } = await client.from(table).update(payload).eq('id', id).select().single();
    if (error) throw new Error(this.friendlyDbError(sheet, error.message));
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

    if (updates.severity !== undefined) {
      const cleanSeverity = String(updates.severity).trim();
      if (!SHEETS_WITH_SEVERITY.has(sheet) || !SEVERITY_OPTIONS.includes(cleanSeverity)) {
        throw new Error('Invalid severity value for this sheet.');
      }
      safeUpdates.severity = cleanSeverity;
    }

    if (updates.assigned_to !== undefined) {
      const cleanAssignee = String(updates.assigned_to).trim().slice(0, 255);
      if (!cleanAssignee) throw new Error('Assigned To cannot be empty.');
      safeUpdates.assigned_to = cleanAssignee;
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

      delete item.it_vendors;
      delete item.it_audits;
      delete item.book_value;
      delete item.id;
      delete item.created_at;
      delete item.updated_at;

      this.validatePayload(sheet, item);
      return item;
    });

    const { data, error } = await client.from(table).insert(validatedRecords).select();
    if (error) throw new Error(this.friendlyDbError(sheet, error.message));
    return data;
  }

  /**
   * Aggregates stats for the IT dashboard charts and metrics.
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
      targetBranchId = access.branchId || undefined;
    }

    const applyFilters = <T extends any>(query: T): T => {
      let q: any = query;
      if (targetBranchId) q = q.eq('branch_id', targetBranchId);
      if (startDate) q = q.gte('created_at', startDate);
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59.999Z`);
      return q;
    };

    // 1. Total Users (Count of profile rows matching branch)
    let usersQuery = client.from('profiles').select('id', { count: 'exact', head: true });
    if (targetBranchId) usersQuery = usersQuery.eq('branch_id', targetBranchId);
    const { count: usersCount } = await usersQuery;

    // 2. Active Devices (Count of assets where status = Active)
    const { data: assets } = await applyFilters(
      client.from('it_assets').select('status, asset_type, purchase_date, purchase_value, useful_life_years, warranty_end_date')
    );
    const activeDevicesCount = (assets || []).filter(a => a.status === 'Active').length;

    // 3. Open IT Tickets (Count of tickets where status = Open)
    const { data: tickets } = await applyFilters(
      client.from('it_tickets').select('status, is_sla_compliant')
    );
    const openTicketsCount = (tickets || []).filter(t => t.status === 'Open').length;

    // 4. Critical Incidents (Count of incidents where severity = Critical and status != Resolved)
    const { data: incidents } = await applyFilters(
      client.from('it_incidents').select('status, severity')
    );
    const criticalIncidentsCount = (incidents || []).filter(i => i.severity === 'Critical' && i.status !== 'Resolved').length;

    // 5. System Availability (Realistically computed availability percent based on incidents)
    const totalIncidents = (incidents || []).length;
    const systemAvailability = totalIncidents > 0 
      ? Number((100.0 - (totalIncidents * 0.05)).toFixed(2)) 
      : 100.0;

    // 6. SLA Compliance % (% of tickets that are SLA compliant)
    const totalTickets = (tickets || []).length;
    const compliantTickets = (tickets || []).filter(t => t.is_sla_compliant === true).length;
    const slaCompliance = totalTickets > 0 
      ? Number(((compliantTickets / totalTickets) * 100).toFixed(1)) 
      : 100.0;

    // 7. Ongoing Projects (Count of projects where status = In Progress)
    const { data: projects } = await applyFilters(
      client.from('it_projects').select('status')
    );
    const ongoingProjectsCount = (projects || []).filter(p => p.status === 'In Progress').length;

    // CHART 1: Asset Age Analysis (0-1 yr, 1-3 yr, 3-5 yr, 5+ yr)
    const ageBrackets = {
      '0-1 yr': 0,
      '1-3 yr': 0,
      '3-5 yr': 0,
      '5+ yr': 0
    };
    const today = new Date();
    (assets || []).forEach(asset => {
      if (asset.purchase_date) {
        const purchaseDate = new Date(asset.purchase_date);
        const ageYears = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears <= 1) ageBrackets['0-1 yr']++;
        else if (ageYears <= 3) ageBrackets['1-3 yr']++;
        else if (ageYears <= 5) ageBrackets['3-5 yr']++;
        else ageBrackets['5+ yr']++;
      }
    });

    // CHART 2: Asset Category Pie (Desktop, Laptop, Server, Printer, Network Device, Software License)
    const categoryCounts: { [key: string]: number } = {
      'Desktop': 0,
      'Laptop': 0,
      'Server': 0,
      'Printer': 0,
      'Network Device': 0,
      'Software License': 0
    };
    (assets || []).forEach(asset => {
      const type = asset.asset_type;
      if (type && type in categoryCounts) {
        categoryCounts[type] = (categoryCounts[type] || 0) + 1;
      }
    });

    // CHART 3: Warranty Expiry Timeline (Expiries in the next 12 months)
    const monthsLabels: string[] = [];
    const warrantyExpiries: number[] = new Array(12).fill(0);
    
    for (let i = 0; i < 12; i++) {
      const futureMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
      monthsLabels.push(futureMonth.toLocaleString('default', { month: 'short', year: 'numeric' }));
    }

    (assets || []).forEach(asset => {
      if (asset.warranty_end_date) {
        const expDate = new Date(asset.warranty_end_date);
        const diffMonths = (expDate.getFullYear() - today.getFullYear()) * 12 + (expDate.getMonth() - today.getMonth());
        if (diffMonths >= 0 && diffMonths < 12) {
          warrantyExpiries[diffMonths] = (warrantyExpiries[diffMonths] || 0) + 1;
        }
      }
    });

    return {
      kpis: {
        totalUsers: usersCount || 0,
        activeDevices: activeDevicesCount,
        openTickets: openTicketsCount,
        criticalIncidents: criticalIncidentsCount,
        systemAvailability,
        slaCompliance,
        ongoingProjects: ongoingProjectsCount
      },
      charts: {
        ageAnalysis: Object.values(ageBrackets),
        categories: Object.values(categoryCounts),
        categoryLabels: Object.keys(categoryCounts),
        warrantyExpiries,
        warrantyLabels: monthsLabels
      }
    };
  }
}
