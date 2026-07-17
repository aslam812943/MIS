import { randomBytes } from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { UserService } from './UserService.js';
import { UserRole } from '../models/user.model.js';

const SHEET_TABLE_MAPPING: { [key: string]: string } = {
  'open-positions': 'hr_open_positions',
  'candidates': 'hr_candidates',
  'policies': 'hr_policies',
  'documents': 'hr_documents',
};

const SHEET_STATUS_OPTIONS: { [key: string]: string[] } = {
  'open-positions': ['Open', 'On Hold', 'Closed', 'Filled'],
  'policies': ['Active', 'Superseded', 'Draft'],
};

/**
 * HR access is purely role-based (admin or hr) — enforced at the route
 * layer via requireAdminOrHR, same as the existing /users/* routes. Unlike
 * IT/DP there is no department-membership or branch-scoping concept for
 * HR anywhere in this app, so this service — deliberately — has no
 * verifyAccess()/branch-lock logic to replicate.
 */
export class HRService {
  constructor(private userService: UserService) {}

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

  private validatePayload(sheet: string, payload: any) {
    if (!payload) throw new Error('Data payload is required.');

    this.sanitizePayload(payload);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const dateFields = ['date_opened', 'joining_date', 'effective_date', 'superseded_date', 'upload_date', 'expiry_date'];
    for (const field of dateFields) {
      if (payload[field] !== undefined && payload[field] !== null && String(payload[field]).trim() !== '') {
        const val = String(payload[field]).substring(0, 10);
        if (!dateRegex.test(val)) {
          throw new Error(`Field ${field} must be a valid date in YYYY-MM-DD format.`);
        }
      }
    }

    const numberFields = ['number_of_openings', 'expected_salary', 'offered_salary'];
    for (const field of numberFields) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        const val = Number(payload[field]);
        if (isNaN(val) || val < 0) {
          throw new Error(`Field ${field} must be a positive number.`);
        }
      }
    }

    const longTextFields = ['job_description', 'feedback_notes', 'rejection_reason'];
    for (const key of Object.keys(payload)) {
      if (typeof payload[key] === 'string') {
        const len = payload[key].length;
        if (longTextFields.includes(key)) {
          if (len > 4000) throw new Error(`Field ${key.replace(/_/g, ' ')} exceeds maximum length limit of 4000 characters.`);
        } else if (len > 255) {
          throw new Error(`Field ${key.replace(/_/g, ' ')} exceeds maximum length limit of 255 characters.`);
        }
      }
    }

    if (payload.status !== undefined && payload.status !== null && String(payload.status).trim() !== '') {
      const allowed = SHEET_STATUS_OPTIONS[sheet];
      if (!allowed || !allowed.includes(String(payload.status).trim())) {
        throw new Error('Invalid status value for this sheet.');
      }
    }
  }

  async getOpenPositionsDropdown(): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');
    const { data, error } = await client
      .from('hr_open_positions')
      .select('id, position_title')
      .in('status', ['Open', 'On Hold'])
      .order('position_title', { ascending: true });
    if (error) throw new Error(`Failed to load open positions: ${error.message}`);
    return data || [];
  }

  async getEntries(sheet: string, search?: string, startDate?: string, endDate?: string): Promise<any[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    let selectString = '*';
    if (sheet === 'candidates') selectString = '*, hr_open_positions(position_title)';
    // hr_documents has TWO foreign keys to profiles (employee_id and
    // created_by) — an unqualified profiles(...) embed is ambiguous and
    // PostgREST rejects the whole query ("more than one relationship was
    // found"). Disambiguate with the FK constraint name (Postgres's default
    // auto-generated name for an unnamed inline REFERENCES constraint).
    if (sheet === 'documents') selectString = '*, profiles!hr_documents_employee_id_fkey(full_name, employee_id)';

    let query = client.from(table).select(selectString);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);

    if (search) {
      const safeSearch = search.replace(/[,()]/g, '').slice(0, 100).trim();
      if (safeSearch) {
        if (sheet === 'open-positions') {
          query = query.ilike('position_title', `%${safeSearch}%`);
        } else if (sheet === 'candidates') {
          query = query.or(`candidate_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
        } else if (sheet === 'policies') {
          query = query.ilike('policy_name', `%${safeSearch}%`);
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

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    const payload = { ...data, created_by: requesterId };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.hr_open_positions;
    delete payload.profiles;
    delete payload.created_profile_id; // system-managed, never client-writable

    this.validatePayload(sheet, payload);

    const { data: result, error } = await client.from(table).insert(payload).select().single();
    if (error) throw new Error(`Operation failed: ${error.message}`);
    return result;
  }

  /**
   * Generates a random password for auto-created employee accounts — the
   * existing createUser() flow always takes an admin-typed password today,
   * so there's nothing to reuse here. 16 chars from a wide alphabet is well
   * past the app's MIN_PASSWORD_LENGTH floor.
   */
  private generateTempPassword(): string {
    return randomBytes(12).toString('base64url').slice(0, 16);
  }

  /**
   * When a Candidate's stage moves to 'Joined' for the first time, creates
   * their real employee login by calling the EXISTING UserService.createUser
   * — not reimplemented — so this inherits its employee_id collision-retry
   * logic and welcome email for free. Failures here (e.g. the email already
   * has an account) are caught and returned as a warning string rather than
   * thrown, so the stage change itself still saves.
   */
  private async maybeCreateEmployeeAccount(existingRow: any, payload: any): Promise<{ created_profile_id?: string; accountWarning?: string }> {
    const movingToJoined = existingRow.stage !== 'Joined' && payload.stage === 'Joined';
    if (!movingToJoined || existingRow.created_profile_id) return {};

    const email = (payload.email ?? existingRow.email)?.trim();
    if (!email) {
      return { accountWarning: 'No email on file for this candidate — create their login manually via Admin Panel.' };
    }

    let departmentId: string | undefined;
    let branchId: string | undefined;
    if (existingRow.position_id) {
      const client = supabaseAdmin!;
      const { data: position } = await client.from('hr_open_positions').select('department_id, branch_id').eq('id', existingRow.position_id).single();
      departmentId = position?.department_id || undefined;
      branchId = position?.branch_id || undefined;
    }

    try {
      const profile = await this.userService.createUser({
        email,
        role: UserRole.EMPLOYEE,
        full_name: payload.candidate_name ?? existingRow.candidate_name,
        phone_number: payload.mobile ?? existingRow.mobile,
        joining_date: payload.joining_date ?? existingRow.joining_date,
        department_id: departmentId,
        branch_id: branchId,
        password: this.generateTempPassword(),
      });
      return { created_profile_id: profile.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Account creation failed.';
      return { accountWarning: `Stage updated, but account creation failed: ${message} — create their login manually via Admin Panel.` };
    }
  }

  async updateEntry(requesterId: string, sheet: string, id: string, updates: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    const { data: existingRow, error: fetchError } = await client.from(table).select('*').eq('id', id).single();
    if (fetchError || !existingRow) throw new Error('Record not found.');

    const payload = { ...updates };
    delete payload.id;
    delete payload.created_by;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.hr_open_positions;
    delete payload.profiles;
    delete payload.created_profile_id;

    this.validatePayload(sheet, payload);

    let accountWarning: string | undefined;
    if (sheet === 'candidates') {
      const accountResult = await this.maybeCreateEmployeeAccount(existingRow, payload);
      if (accountResult.created_profile_id) payload.created_profile_id = accountResult.created_profile_id;
      accountWarning = accountResult.accountWarning;
    }

    const { data: result, error } = await client.from(table).update(payload).eq('id', id).select().single();
    if (error) throw new Error(`Operation failed: ${error.message}`);
    return { ...result, accountWarning };
  }

  async deleteEntry(sheet: string, id: string): Promise<void> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');

    const { error } = await client.from(table).delete().eq('id', id);
    if (error) throw new Error(`Delete failed: ${error.message}`);
  }

  async bulkUpdate(sheet: string, ids: string[], updates: any): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('At least one record id is required.');

    const safeUpdates: any = {};
    if (updates?.status !== undefined) {
      const cleanStatus = String(updates.status).trim();
      const allowedStatuses = SHEET_STATUS_OPTIONS[sheet];
      if (!allowedStatuses || !allowedStatuses.includes(cleanStatus)) {
        throw new Error('Invalid status value for this sheet.');
      }
      safeUpdates.status = cleanStatus;
    }
    if (Object.keys(safeUpdates).length === 0) throw new Error('No valid update properties provided.');

    const { data, error } = await client.from(table).update(safeUpdates).in('id', ids).select();
    if (error) throw new Error(`Bulk update failed: ${error.message}`);
    return data;
  }

  async bulkImport(requesterId: string, sheet: string, records: any[]): Promise<{ inserted: any[]; failed: { row: number; error: string }[] }> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const table = SHEET_TABLE_MAPPING[sheet];
    if (!table) throw new Error('Invalid sheet mapping.');
    if (!Array.isArray(records)) throw new Error('Records must be an array.');
    if (records.length > 500) throw new Error('Bulk import limit exceeded (500 records max).');

    const inserted: any[] = [];
    const failed: { row: number; error: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const item: any = { ...records[i], created_by: requesterId };
        delete item.id;
        delete item.created_at;
        delete item.updated_at;
        delete item.hr_open_positions;
        delete item.profiles;
        delete item.created_profile_id;

        this.validatePayload(sheet, item);

        const { data, error } = await client.from(table).insert(item).select().single();
        if (error) throw new Error(error.message);
        inserted.push(data);
      } catch (err) {
        failed.push({ row: i + 1, error: err instanceof Error ? err.message : 'Import failed.' });
      }
    }

    return { inserted, failed };
  }

  async uploadDocument(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const fileExt = fileName.split('.').pop() || 'bin';
    const filePath = `documents/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { error } = await client.storage.from('hr-documents').upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = client.storage.from('hr-documents').getPublicUrl(filePath);
    return urlData.publicUrl;
  }

  /**
   * Dashboard aggregates for the HR tab's recruitment/policy KPIs and the
   * Candidates-by-Stage chart. Kept separate from UserService's employee
   * headcount aggregates (which own the KPI tiles about people already on
   * staff) — this is specifically about the hiring pipeline and documents.
   */
  async getDashboardStats(startDate?: string, endDate?: string): Promise<any> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase client not initialized.');

    const applyRange = (query: any) => {
      let q = query;
      if (startDate) q = q.gte('created_at', startDate);
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59.999Z`);
      return q;
    };

    const { data: positions } = await applyRange(client.from('hr_open_positions').select('status'));
    const openPositionsCount = (positions || []).filter((p: any) => p.status === 'Open').length;

    const { data: candidates } = await applyRange(client.from('hr_candidates').select('stage'));
    const inPipelineCount = (candidates || []).filter((c: any) => c.stage !== 'Joined' && c.stage !== 'Rejected').length;

    const stageBreakdown: Record<string, number> = {};
    (candidates || []).forEach((c: any) => {
      stageBreakdown[c.stage] = (stageBreakdown[c.stage] || 0) + 1;
    });

    const { data: policies } = await client.from('hr_policies').select('status');
    const activePoliciesCount = (policies || []).filter((p: any) => p.status === 'Active').length;

    return {
      kpis: {
        openPositions: openPositionsCount,
        candidatesInPipeline: inPipelineCount,
        activePolicies: activePoliciesCount,
      },
      charts: {
        candidatesByStage: Object.entries(stageBreakdown).map(([name, value]) => ({ name, value })),
      }
    };
  }
}
