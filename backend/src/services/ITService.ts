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
  'projects': 'it_projects',
  'audit-schedule': 'it_audit_schedule',
  'amc-contracts': 'it_amc_contracts',
  'servers': 'it_servers',
  'team-duties': 'it_team_duties',
  'software': 'it_software',
  'purchase-orders': 'it_purchase_orders'
};

// Mirrors each table's DB CHECK constraint on `status` in database_it.sql /
// database_it_v2_expansion.sql. 'diagrams', 'servers' and 'team-duties' have
// no entry — they have no status column at all.
const SHEET_STATUS_OPTIONS: { [key: string]: string[] } = {
  'audits': ['Scheduled', 'In Progress', 'Report Received', 'Submitted', 'Overdue'],
  'audit-findings': ['Open', 'In Progress', 'Implemented', 'Closed', 'Overdue'],
  'vendors': ['Active', 'Under Renewal', 'Expired', 'Terminated'],
  'assets': ['Active', 'Under Repair', 'Retired', 'Disposed'],
  'cybersecurity-compliance': ['Compliant', 'Non-Compliant', 'Due for Review', 'In Remediation'],
  'tickets': ['Open', 'In Progress', 'Resolved', 'Closed'],
  'incidents': ['Identified', 'Investigating', 'Mitigated', 'Resolved'],
  'projects': ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
  'audit-schedule': ['Upcoming', 'Filed', 'Overdue'],
  'amc-contracts': ['Active', 'Renewal Due', 'Renewed', 'Lapsed'],
  'software': ['Active', 'Expiring Soon', 'Expired'],
  'purchase-orders': ['Raised', 'Approved', 'Fulfilled', 'Cancelled'],
};

// Only audit-findings and incidents have a `severity` column.
const SHEETS_WITH_SEVERITY = new Set(['audit-findings', 'incidents']);
const SEVERITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];

// Sheets that are HO-only (org-wide) by design and whose tables therefore
// have no branch_id column at all — audits are confirmed HO-only, and the
// IT team roster is a single org-wide list, not per-branch.
const NO_BRANCH_SHEETS = new Set(['audit-schedule', 'team-duties']);

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
   * Computes current book value using Written Down Value (WDV / reducing
   * balance) depreciation — the standard method under the Companies Act for
   * computers and office equipment, and what "15% per year" means in Indian
   * accounting: each year, the rate is deducted from last year's REMAINING
   * value, not from the original purchase price.
   *   Current Value = Purchase Value * (1 - rate)^yearsElapsed
   * Years elapsed is whole completed years only (no mid-year proration) —
   * confirmed as the simpler, agreed approach over 180-day proration.
   */
  private calculateBookValue(asset: any): number {
    if (!asset.purchase_date || asset.purchase_value === undefined) {
      return Number(asset.purchase_value || 0);
    }
    const purchaseValue = Number(asset.purchase_value);
    const rate = Number(asset.depreciation_rate ?? 15) / 100;

    const purchaseDate = new Date(asset.purchase_date);
    const today = new Date();

    const daysElapsed = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
    const yearsElapsed = Math.max(0, Math.floor(daysElapsed / 365.25));

    const currentBookValue = purchaseValue * Math.pow(1 - rate, yearsElapsed);
    return Number(currentBookValue.toFixed(2));
  }

  /**
   * Recomputes the audit schedule's next_due_date server-side as
   * last_filing_date + recurrence_months, so it's always consistent with
   * the two inputs that drive it — the client never sets it directly.
   */
  private computeNextAuditDueDate(payload: any) {
    delete payload.next_due_date;
    if (!payload.last_filing_date || !payload.recurrence_months) return;

    const base = new Date(payload.last_filing_date);
    base.setMonth(base.getMonth() + Number(payload.recurrence_months));
    payload.next_due_date = base.toISOString().slice(0, 10);
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
      'opened_date', 'closed_date', 'discovered_date', 'resolved_date', 'target_end_date', 'actual_end_date',
      'amc_start_date', 'amc_renewal_date', 'last_paid_date', 'last_filing_date', 'next_due_date',
      'last_config_update_date', 'po_date'
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
    if (payload.amc_start_date && payload.amc_renewal_date && new Date(payload.amc_renewal_date) < new Date(payload.amc_start_date)) {
      throw new Error('AMC renewal date cannot be before AMC start date.');
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
    const numberFields = [
      'purchase_value', 'useful_life_years', 'contract_value', 'notification_lead_time_days', 'sla_target_hours',
      'depreciation_rate', 'amc_amount', 'recurrence_months', 'number_of_licenses', 'escalation_priority', 'amount'
    ];
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
    const strictlyPositiveFields = ['useful_life_years', 'sla_target_hours', 'recurrence_months', 'number_of_licenses', 'escalation_priority'];
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

    // audit_type means something different depending on the sheet: the old
    // per-cycle 'audits' log (Internal/CERT-In/SEBI-Mandated/VAPT) vs. the
    // new recurring 'audit-schedule' (System Audit/Cybersecurity Audit/VAPT).
    if (payload.audit_type !== undefined && payload.audit_type !== null && String(payload.audit_type).trim() !== '') {
      const allowedAuditTypes = sheet === 'audit-schedule'
        ? ['System Audit', 'Cybersecurity Audit', 'VAPT']
        : ['Internal', 'CERT-In Empanelled External', 'SEBI-Mandated Cyber Audit', 'VAPT'];
      if (!allowedAuditTypes.includes(String(payload.audit_type).trim())) {
        throw new Error('Invalid audit type.');
      }
    }

    if (payload.physical_or_virtual !== undefined && payload.physical_or_virtual !== null && String(payload.physical_or_virtual).trim() !== '') {
      if (!['Physical', 'Virtual'].includes(String(payload.physical_or_virtual).trim())) {
        throw new Error('Invalid value for Physical or Virtual.');
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
    'servers': 'server name',
    'team-duties': 'employee (already has a duties record)',
    'tickets': 'ticket number',
    'incidents': 'incident number',
    'purchase-orders': 'PO number',
  };

  // Reference-number fields that are server-generated, never accepted from
  // the client — manual typing here caused typos and (for po_number
  // especially, which had no DB uniqueness at all) outright duplicates.
  // Each is sequential-per-year: PO-2026-0001, TKT-2026-0001, etc. Fields
  // NOT in this list (asset_id, finding_id, Settlements' application_no)
  // stay manual on purpose — they have to match a real external reference
  // (a physical barcode, an auditor's own code, a bank/ASBA application
  // number) that this system doesn't control.
  private static readonly AUTO_CODE_FIELDS: { [key: string]: { column: string; prefix: () => string; pad: number } } = {
    'purchase-orders': { column: 'po_number', prefix: () => `PO-${new Date().getFullYear()}-`, pad: 4 },
    'tickets': { column: 'ticket_number', prefix: () => `TKT-${new Date().getFullYear()}-`, pad: 4 },
    'incidents': { column: 'incident_number', prefix: () => `INC-${new Date().getFullYear()}-`, pad: 4 },
  };

  /**
   * Computes the next sequential code for a given year-prefixed column
   * (e.g. "PO-2026-0001") by reading the current highest matching value.
   * Inherently racy under true concurrency — insertWithAutoCode() below
   * retries with a bumped value on an actual DB collision, the same
   * pattern already used for employee_id generation in UserService.
   */
  private async generateNextCode(client: any, table: string, column: string, prefix: string, pad: number): Promise<string> {
    const { data, error } = await client
      .from(table)
      .select(column)
      .like(column, `${prefix}%`)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to calculate next ${column}: ${error.message}`);
    if (!data) return `${prefix}${'1'.padStart(pad, '0')}`;
    const numStr = String((data as any)[column]).substring(prefix.length);
    const nextNum = (parseInt(numStr, 10) || 0) + 1;
    return `${prefix}${String(nextNum).padStart(pad, '0')}`;
  }

  private bumpCode(code: string, prefix: string, pad: number): string {
    const numStr = code.substring(prefix.length);
    const nextNum = (parseInt(numStr, 10) || 0) + 1;
    return `${prefix}${String(nextNum).padStart(pad, '0')}`;
  }

  /**
   * Inserts a row whose unique code column is server-generated, retrying
   * with the next code on an actual unique-violation (two concurrent
   * creates computing the same "next" value) instead of failing outright.
   */
  private async insertWithAutoCode(
    client: any,
    table: string,
    sheet: string,
    payload: any,
    config: { column: string; prefix: () => string; pad: number },
    startingCode: string
  ): Promise<{ data: any; nextCode: string }> {
    const prefix = config.prefix();
    let code = startingCode;
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; ; attempt++) {
      const { data, error } = await client.from(table).insert({ ...payload, [config.column]: code }).select().single();
      if (!error) return { data, nextCode: this.bumpCode(code, prefix, config.pad) };
      const isCollision = error.message.includes('duplicate key') && error.message.includes(config.column);
      if (!isCollision || attempt >= MAX_ATTEMPTS) {
        if (isCollision) throw new Error('Could not generate a unique reference number right now — please try again.');
        throw new Error(this.friendlyDbError(sheet, error.message));
      }
      code = this.bumpCode(code, prefix, config.pad);
    }
  }

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
   * Fetches IT department staff for dropdown mapping (Team Duties employee
   * picker, audit-schedule auditor picker).
   */
  async getITStaffDropdown(userId: string): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, departments(name)')
      .order('full_name', { ascending: true });

    if (error) throw new Error(`Failed to load staff: ${error.message}`);
    return (data || []).filter((p: any) => (p.departments as any)?.name?.toUpperCase() === 'IT');
  }

  /**
   * Uploads an IT document (audit report, PO PDF, diagram file, evidence
   * file) to the dedicated it-documents bucket. Mirrors
   * KYCService.uploadDocument's storage-upload pattern.
   */
  async uploadDocument(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const fileExt = fileName.split('.').pop() || 'bin';
    const filePath = `documents/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error } = await client.storage.from('it-documents').upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = client.storage.from('it-documents').getPublicUrl(filePath);
    return urlData.publicUrl;
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
    if (access.role === 'employee' && !NO_BRANCH_SHEETS.has(sheet)) {
      targetBranchId = access.branchId || undefined;
    }

    let selectString = '*';
    if (sheet === 'assets') {
      selectString = '*, it_vendors(vendor_name)';
    } else if (sheet === 'audit-findings') {
      selectString = '*, it_audits(audit_name)';
    } else if (sheet === 'amc-contracts' || sheet === 'software') {
      selectString = '*, it_vendors(vendor_name)';
    } else if (sheet === 'servers') {
      selectString = '*, it_assets(asset_id), it_diagrams(diagram_name)';
    } else if (sheet === 'team-duties') {
      selectString = '*, profiles!it_team_duties_profile_id_fkey(full_name), reporting_to_profile:profiles!it_team_duties_reporting_to_fkey(full_name)';
    }

    let query = client.from(table).select(selectString);

    if (targetBranchId && !NO_BRANCH_SHEETS.has(sheet)) {
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
        } else if (sheet === 'amc-contracts') {
          query = query.ilike('item_covered', `%${safeSearch}%`);
        } else if (sheet === 'audit-schedule') {
          query = query.ilike('audit_type', `%${safeSearch}%`);
        } else if (sheet === 'servers') {
          query = query.or(`server_name.ilike.%${safeSearch}%,role_purpose.ilike.%${safeSearch}%`);
        } else if (sheet === 'software') {
          query = query.ilike('software_name', `%${safeSearch}%`);
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

    // Post-process audit-schedule / AMC / software rows to expose a
    // consistent days_to_go number the frontend's CountdownBadge reads
    // directly, instead of re-deriving date math per-sheet on the client.
    if ((sheet === 'audit-schedule' || sheet === 'amc-contracts' || sheet === 'software') && data) {
      const dueCol = sheet === 'audit-schedule' ? 'next_due_date' : 'amc_renewal_date';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return data.map((row: any) => {
        let daysToGo: number | null = null;
        if (row[dueCol]) {
          const due = new Date(row[dueCol]);
          due.setHours(0, 0, 0, 0);
          daysToGo = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
        return { ...row, days_to_go: daysToGo };
      });
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

    const payload: any = {
      ...data,
      created_by: requesterId
    };

    if (NO_BRANCH_SHEETS.has(sheet)) {
      delete payload.branch_id;
    } else {
      payload.branch_id = access.role === 'employee' ? access.branchId : (data.branch_id || access.branchId);
    }

    delete (payload as any).it_vendors;
    delete (payload as any).it_audits;
    delete (payload as any).it_assets;
    delete (payload as any).it_diagrams;
    delete (payload as any).profiles;
    delete (payload as any).reporting_to_profile;
    delete (payload as any).book_value;
    delete (payload as any).days_to_go;
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    if (sheet === 'audit-schedule') this.computeNextAuditDueDate(payload);

    const autoCode = ITService.AUTO_CODE_FIELDS[sheet];
    if (autoCode) delete payload[autoCode.column];

    this.validatePayload(sheet, payload);

    if (autoCode) {
      const startingCode = await this.generateNextCode(client, table, autoCode.column, autoCode.prefix(), autoCode.pad);
      const { data } = await this.insertWithAutoCode(client, table, sheet, payload, autoCode, startingCode);
      return data;
    }

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

    let query = client.from(table).select('*').eq('id', id).single();
    const { data: record, error: fetchError } = await query;
    if (fetchError || !record) throw new Error('Record not found.');

    // Branch is locked at creation time (the edit form never shows a branch
    // selector), so an HOD editing a record outside their own branch should
    // be blocked the same way bulkUpdate() already blocks it. Skipped
    // entirely for HO-only sheets, whose tables have no branch_id column.
    if (!NO_BRANCH_SHEETS.has(sheet) && (access.role === 'employee' || access.role === 'hod') && access.branchId && record.branch_id !== access.branchId) {
      throw new Error('Unauthorized branch access.');
    }

    const payload = { ...updates };
    delete (payload as any).it_vendors;
    delete (payload as any).it_audits;
    delete (payload as any).it_assets;
    delete (payload as any).it_diagrams;
    delete (payload as any).profiles;
    delete (payload as any).reporting_to_profile;
    delete (payload as any).book_value;
    delete (payload as any).days_to_go;
    // Server-generated reference numbers are immutable once assigned —
    // same as IEPF's claim_number never being editable after creation.
    const autoCodeOnUpdate = ITService.AUTO_CODE_FIELDS[sheet];
    if (autoCodeOnUpdate) delete (payload as any)[autoCodeOnUpdate.column];
    delete (payload as any).branch_id;
    delete (payload as any).created_by;
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    if (sheet === 'audit-schedule') {
      // A partial update (e.g. only changing auditor_name) shouldn't lose
      // the due-date inputs it didn't touch — recompute from the merged
      // view of the existing row + incoming changes.
      const merged = { ...record, ...payload };
      this.computeNextAuditDueDate(merged);
      payload.next_due_date = merged.next_due_date;
    }

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

    const selectCols = NO_BRANCH_SHEETS.has(sheet) ? 'id' : 'branch_id';
    const { data: record, error: fetchError } = await client.from(table).select(selectCols).eq('id', id).single();
    if (fetchError || !record) throw new Error('Record not found.');

    if (!NO_BRANCH_SHEETS.has(sheet) && (access.role === 'employee' || access.role === 'hod') && access.branchId && (record as any).branch_id !== access.branchId) {
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

    if (!NO_BRANCH_SHEETS.has(sheet) && (access.role === 'employee' || access.role === 'hod') && access.branchId) {
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

  /**
   * Imports rows one at a time rather than as a single batch INSERT, so one
   * bad row (a validation failure, or a DB-level rejection like a duplicate
   * asset_id) doesn't abort the entire file — every other valid row still
   * gets inserted, and the caller gets back exactly which rows failed and
   * why, instead of a single opaque error covering the whole import.
   */
  async bulkImport(requesterId: string, sheet: string, records: any[]): Promise<{ inserted: any[]; failed: { row: number; error: string }[] }> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const access = await this.verifyAccess(requesterId);
    if (!access.authorized) throw new Error('Unauthorized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    if (!Array.isArray(records)) throw new Error('Records must be an array.');
    if (records.length > 500) throw new Error('Bulk import limit exceeded (500 records max).');

    const defaultBranchId = access.branchId;
    const noBranch = NO_BRANCH_SHEETS.has(sheet);

    // Computed once up front (not per-row, to avoid 500 extra queries), then
    // advanced in memory after each successful insert. insertWithAutoCode()
    // still re-verifies against the DB and bumps on an actual collision, so
    // this running value is just a starting point, not the source of truth.
    const autoCode = ITService.AUTO_CODE_FIELDS[sheet];
    let runningCode = autoCode
      ? await this.generateNextCode(client, table, autoCode.column, autoCode.prefix(), autoCode.pad)
      : null;

    const inserted: any[] = [];
    const failed: { row: number; error: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        const item: any = {
          ...row,
          created_by: requesterId
        };

        if (noBranch) {
          delete item.branch_id;
        } else {
          const branchId = access.role === 'employee' ? defaultBranchId : (row.branch_id || defaultBranchId);
          if ((access.role === 'employee' || access.role === 'hod') && defaultBranchId && branchId !== defaultBranchId) {
            throw new Error('Row contains a foreign branch ID.');
          }
          item.branch_id = branchId;
        }

        delete item.it_vendors;
        delete item.it_audits;
        delete item.it_assets;
        delete item.it_diagrams;
        delete item.profiles;
        delete item.reporting_to_profile;
        delete item.book_value;
        delete item.days_to_go;
        delete item.id;
        delete item.created_at;
        delete item.updated_at;

        if (sheet === 'audit-schedule') this.computeNextAuditDueDate(item);
        if (autoCode) delete item[autoCode.column];

        this.validatePayload(sheet, item);

        if (autoCode) {
          const result = await this.insertWithAutoCode(client, table, sheet, item, autoCode, runningCode!);
          runningCode = result.nextCode;
          inserted.push(result.data);
        } else {
          const { data, error } = await client.from(table).insert(item).select().single();
          if (error) throw new Error(this.friendlyDbError(sheet, error.message));
          inserted.push(data);
        }
      } catch (err: any) {
        failed.push({ row: i + 1, error: err instanceof Error ? err.message : 'Import failed.' });
      }
    }

    return { inserted, failed };
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

    // Days-to-go helper shared by the audit schedule / AMC / software cards
    // below — same math as getEntries()'s per-row post-processing.
    const daysToGo = (dateStr: string | null): number | null => {
      if (!dateStr) return null;
      const due = new Date(dateStr);
      due.setHours(0, 0, 0, 0);
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      return Math.round((due.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Recurring audit schedule — HO-only, no branch filter.
    const { data: auditSchedule } = await client
      .from('it_audit_schedule')
      .select('audit_type, next_due_date, status, is_ad_hoc')
      .order('next_due_date', { ascending: true });
    const auditScheduleWithCountdown = (auditSchedule || []).map(a => ({ ...a, days_to_go: daysToGo(a.next_due_date) }));
    const auditsOverdueCount = auditScheduleWithCountdown.filter(a => (a.days_to_go ?? 0) < 0 && a.status !== 'Filed').length;

    // AMC contracts — soonest renewals first.
    const { data: amcContracts } = await applyFilters(
      client.from('it_amc_contracts').select('item_covered, amc_renewal_date, status, it_vendors(vendor_name)')
    );
    const amcWithCountdown = (amcContracts || [])
      .map((a: any) => ({ ...a, vendor_name: a.it_vendors?.vendor_name, days_to_go: daysToGo(a.amc_renewal_date) }))
      .sort((a, b) => (a.days_to_go ?? Infinity) - (b.days_to_go ?? Infinity));
    const amcDueSoonCount = amcWithCountdown.filter(a => a.days_to_go !== null && a.days_to_go <= 30 && a.status !== 'Lapsed' && a.status !== 'Renewed').length;

    // Software register — soonest AMC/license renewals first.
    const { data: software } = await applyFilters(
      client.from('it_software').select('software_name, amc_renewal_date, status')
    );
    const softwareWithCountdown = (software || [])
      .map(s => ({ ...s, days_to_go: daysToGo(s.amc_renewal_date) }))
      .sort((a, b) => (a.days_to_go ?? Infinity) - (b.days_to_go ?? Infinity));

    // Purchase Orders log — manual record of POs raised via the embedded
    // PO Generator tool (that tool has no API of its own to pull from).
    const { data: purchaseOrders } = await applyFilters(
      client.from('it_purchase_orders').select('amount, status')
    );
    const posRaisedCount = (purchaseOrders || []).length;
    const totalPoValue = (purchaseOrders || []).reduce((sum, po: any) => sum + Number(po.amount || 0), 0);

    return {
      kpis: {
        totalUsers: usersCount || 0,
        activeDevices: activeDevicesCount,
        openTickets: openTicketsCount,
        criticalIncidents: criticalIncidentsCount,
        systemAvailability,
        slaCompliance,
        ongoingProjects: ongoingProjectsCount,
        auditsOverdue: auditsOverdueCount,
        amcDueSoon: amcDueSoonCount,
        posRaised: posRaisedCount,
        totalPoValue: Number(totalPoValue.toFixed(2))
      },
      compliance: {
        auditSchedule: auditScheduleWithCountdown,
        upcomingAmc: amcWithCountdown.slice(0, 5),
        expiringSoftware: softwareWithCountdown.slice(0, 5)
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
