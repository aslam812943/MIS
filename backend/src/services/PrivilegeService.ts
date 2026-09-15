import { supabase, supabaseAdmin } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const client = supabaseAdmin || supabase;

const friendlyDatabaseError = (error: any, action: string): Error => {
  const details = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (error?.code === '23505' || details.includes('duplicate key')) {
    if (details.includes('sl_no')) return new Error('This Sl No already exists. Enter a different Sl No.');
    if (details.includes('code')) return new Error('This client code already exists. Enter a different client code.');
    return new Error('A record with these details already exists.');
  }
  if (error?.code === 'PGRST204' || details.includes('schema cache') || details.includes('column')) {
    return new Error('The Privilege database fields are not set up yet. Ask an administrator to run database_privilege_register_fields.sql.');
  }
  if (error?.code === '23514') return new Error('One or more values are outside the allowed range. Check the amounts and try again.');
  return new Error(`Unable to ${action}. Please check the entered details and try again.`);
};

// Compatibility data for the three demo rows created before the register-field migration.
// Real records use their stored values; created_at is used only when an older row has no date.
const legacySampleDetails: Record<string, Partial<PrivilegeAccountRow>> = {
  PA1001: { sl_no: 1, account_date: '2026-09-02', mobile_no: '9876501001', scheme: 'Privilege Plus', introducer: 'Direct', rm: 'Rahul Menon', dealer: 'Neha Patil', branch: 'Mumbai Central', trading_started: true, remarks: 'Active priority client' },
  PA1002: { sl_no: 2, account_date: '2026-09-06', mobile_no: '9876501002', scheme: 'Privilege Elite', introducer: 'Anil Kumar', rm: 'Meera Shah', dealer: 'Karan Joshi', branch: 'Bengaluru', trading_started: true, remarks: 'Monthly review completed' },
  PA1003: { sl_no: 3, account_date: '2026-09-11', mobile_no: '9876501003', scheme: 'Privilege Select', introducer: 'Direct', rm: 'Rahul Menon', dealer: 'Sneha Rao', branch: 'Ahmedabad', trading_started: false, remarks: 'Trading activation pending' }
};

export interface PrivilegeAccountRow {
  sl_no: number;
  code: string;
  name: string;
  account_date: string;
  mobile_no: string;
  scheme: string;
  introducer: string;
  rm: string;
  dealer: string;
  branch: string;
  trading_started: boolean;
  remarks?: string | null;
  location: string;
  occupation: string;
  contact: string;
  aum: number;
  utilised: number;
  returns: number;
  stocks: string;
  branch_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PrivilegeUploadRow {
  id: string;
  name: string;
  kind: string;
  file_path?: string | null;
  file_size?: number;
  mime_type?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export class PrivilegeService {
  private uploadDir = path.join(process.cwd(), 'uploads', 'privilege');

  constructor() {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (e) {
      console.warn('Could not initialize privilege uploads directory:', e);
    }
  }

  /** Safe lookup values used by the account form's searchable optional fields. */
  async getFormOptions(): Promise<{ branches: Array<{ id: string; name: string }>; employees: Array<{ id: string; name: string }> }> {
    if (!client) throw new Error('The database connection is unavailable.');
    const [branchResult, employeeResult] = await Promise.all([
      client.from('branches').select('id, name').order('name'),
      client.from('profiles').select('id, full_name').eq('status', 'active').order('full_name')
    ]);
    if (branchResult.error) throw new Error('Unable to load branch suggestions.');
    if (employeeResult.error) throw new Error('Unable to load employee suggestions.');
    return {
      branches: (branchResult.data || []).map((branch: any) => ({ id: branch.id, name: branch.name })),
      employees: (employeeResult.data || []).filter((employee: any) => employee.full_name).map((employee: any) => ({ id: employee.id, name: employee.full_name }))
    };
  }

  /**
   * Returns dashboard overview statistics for HOD/Leadership.
   */
  async getDashboardStats(userId?: string, branchId?: string) {
    const accounts = await this.getAccounts(userId, undefined, branchId);
    
    const totalAccounts = accounts.length;
    const totalAUM = accounts.reduce((sum, a) => sum + (Number(a.aum) || 0), 0);
    const totalUtilised = accounts.reduce((sum, a) => sum + (Number(a.utilised) || 0), 0);
    const avgUtilised = totalAccounts > 0 ? totalUtilised / totalAccounts : 0;
    const utilisationRatio = totalAUM > 0 ? (totalUtilised / totalAUM) * 100 : 0;
    const availableCapital = Math.max(0, totalAUM - totalUtilised);

    // Top accounts for utilisation bars
    const topAccounts = accounts.slice(0, 5).map(a => {
      const aum = Number(a.aum) || 0;
      const utilised = Number(a.utilised) || 0;
      const ratio = aum > 0 ? (utilised / aum) * 100 : 0;
      const parts = a.name.trim().split(' ');
      const shortName = parts.length > 1 && parts[1] ? `${parts[0]} ${parts[1].charAt(0)}.` : a.name;
      return {
        code: a.code,
        name: a.name,
        shortName,
        aum,
        utilised,
        ratio: Math.round(ratio),
        returns: Number(a.returns) || 0
      };
    });

    return {
      totalAccounts,
      totalAUM,
      totalUtilised,
      avgUtilised,
      utilisationRatio,
      availableCapital,
      topAccounts,
      accounts
    };
  }

  /**
   * Retrieves all privilege accounts with optional search and branch filtering.
   */
  async getAccounts(userId?: string, search?: string, branchId?: string): Promise<PrivilegeAccountRow[]> {
    if (!client) {
      return [];
    }

    try {
      let query = client
        .from('privilege_accounts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      if (userId) {
        query = query.eq('created_by', userId);
      }

      if (search && search.trim()) {
        const s = search.trim().replace(/[,()]/g, '');
        query = query.or(`name.ilike.%${s}%,code.ilike.%${s}%,location.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error querying privilege_accounts from database:', error.message);
        throw new Error(`Failed to query privilege accounts: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(item => {
        const legacy = legacySampleDetails[item.code] || {};
        const fallbackDate = item.created_at ? String(item.created_at).slice(0, 10) : '';
        return ({
        sl_no: Number(item.sl_no ?? legacy.sl_no ?? 0),
        code: item.code,
        name: item.name,
        account_date: item.account_date || legacy.account_date || fallbackDate,
        mobile_no: item.mobile_no || legacy.mobile_no || item.contact || '',
        scheme: item.scheme || legacy.scheme || '',
        introducer: item.introducer || legacy.introducer || '',
        rm: item.rm || legacy.rm || '',
        dealer: item.dealer || legacy.dealer || '',
        branch: item.branch || legacy.branch || '',
        trading_started: item.trading_started ?? legacy.trading_started ?? false,
        remarks: item.remarks || legacy.remarks || '',
        location: item.location,
        occupation: item.occupation,
        contact: item.contact,
        aum: Number(item.aum) || 0,
        utilised: Number(item.utilised) || 0,
        returns: Number(item.returns) || 0,
        stocks: item.stocks || '',
        branch_id: item.branch_id,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at
        });
      });
    } catch (e: any) {
      console.error('Database error in getAccounts:', e.message);
      throw e;
    }
  }

  /**
   * Validates and saves or updates a single privilege account.
   */
  async saveAccount(account: Partial<PrivilegeAccountRow>, userId?: string, branchId?: string): Promise<PrivilegeAccountRow> {
    const fieldLabels: Partial<Record<keyof PrivilegeAccountRow, string>> = {
      code: 'Client code', name: 'Client name', mobile_no: 'Mobile number', scheme: 'Scheme',
      introducer: 'Introducer', rm: 'RM', dealer: 'Dealer', branch: 'Branch',
      location: 'Location', occupation: 'Occupation', contact: 'Contact info', stocks: 'Stocks in trade'
    };
    const isNewAccount = !account.code;
    if (isNewAccount) {
      if (!client) throw new Error('The database connection is unavailable. Account identifiers could not be generated.');
      const { data: identifiers, error: identifierError } = await client.rpc('next_privilege_account_identifiers');
      if (identifierError) throw friendlyDatabaseError(identifierError, 'generate account identifiers');
      const generated = Array.isArray(identifiers) ? identifiers[0] : identifiers;
      account.sl_no = Number(generated?.sl_no);
      account.code = String(generated?.client_code || '');
    }

    const textFields: (keyof PrivilegeAccountRow)[] = ['code', 'name', 'mobile_no'];
    for (const key of textFields) {
      const val = (account as any)[key];
      if (typeof val !== 'string' || !val.trim()) throw new Error(`${fieldLabels[key] || key} is required.`);
      if (val.trim().length > 1000) throw new Error(`${fieldLabels[key] || key} must be 1,000 characters or fewer.`);
    }

    const slNo = Number(account.sl_no);
    if (!Number.isInteger(slNo) || slNo <= 0) throw new Error('Sl No must be a positive whole number.');
    if (!/^PA\d{4,}$/.test(account.code!)) throw new Error('Client code must use the fixed PA format, for example PA1007.');
    if (!/^\+?[0-9]{10,15}$/.test(account.mobile_no!.replace(/[\s-]/g, ''))) {
      throw new Error('Mobile number must contain 10 to 15 digits.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(account.account_date || '') || Number.isNaN(Date.parse(account.account_date!))) {
      throw new Error('Date is required and must be a valid date.');
    }

    const aum = Number(account.aum);
    const utilised = Number(account.utilised);
    const returns = Number(account.returns ?? 0);

    if (!Number.isFinite(aum) || !Number.isFinite(utilised) || !Number.isFinite(returns)) {
      throw new Error('Enter valid numeric amounts and returns.');
    }

    if (aum < 0 || utilised < 0 || utilised > aum) {
      throw new Error('Funds utilised must be between zero and AUM.');
    }

    const payload: PrivilegeAccountRow = {
      sl_no: slNo,
      code: account.code!.trim(),
      name: account.name!.trim(),
      account_date: account.account_date!,
      mobile_no: account.mobile_no!.trim(),
      scheme: String(account.scheme || '').trim(),
      introducer: String(account.introducer || '').trim(),
      rm: String(account.rm || '').trim(),
      dealer: String(account.dealer || '').trim(),
      branch: String(account.branch || '').trim(),
      trading_started: account.trading_started === true,
      remarks: String(account.remarks || '').trim() || null,
      location: String(account.location || '').trim(),
      occupation: String(account.occupation || '').trim(),
      contact: String(account.contact || '').trim(),
      aum,
      utilised,
      returns,
      stocks: String(account.stocks || '').trim(),
      branch_id: branchId || account.branch_id || null,
      created_by: userId || null,
      updated_at: new Date().toISOString()
    };

    if (!client) {
      return payload;
    }

    const { data, error } = await client
      .from('privilege_accounts')
      .upsert(payload, { onConflict: 'code' })
      .select()
      .single();

    if (error) {
      throw friendlyDatabaseError(error, 'save this account');
    }

    return data;
  }

  /**
   * Bulk imports accounts from CSV rows (up to 500 records).
   */
  async bulkImportAccounts(rows: any[], userId?: string, branchId?: string): Promise<{ count: number }> {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500) {
      throw new Error('Upload between 1 and 500 accounts.');
    }

    const validated: PrivilegeAccountRow[] = [];
    const codes = new Set<string>();
    const serialNumbers = new Set<number>();
    if (client) {
      const { data: existing, error } = await client.from('privilege_accounts').select('sl_no, code');
      if (error) throw friendlyDatabaseError(error, 'check existing account identifiers');
      for (const item of existing || []) {
        if (item.code) codes.add(String(item.code));
        if (item.sl_no != null) serialNumbers.add(Number(item.sl_no));
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let code = String(r.code || '').trim();
      const name = String(r.name || '').trim();
      const location = String(r.location || '').trim();
      const occupation = String(r.occupation || '').trim();
      const contact = String(r.contact || '').trim();
      const stocks = String(r.stocks || '').trim();
      let slNo = Number(r.sl_no);
      const accountDate = String(r.account_date || '').trim();
      const mobileNo = String(r.mobile_no || '').trim();
      const scheme = String(r.scheme || '').trim();
      const introducer = String(r.introducer || '').trim();
      const rm = String(r.rm || '').trim();
      const dealer = String(r.dealer || '').trim();
      const branch = String(r.branch || '').trim();

      if (!name || !accountDate || !mobileNo || r.aum === '' || r.aum === null || r.aum === undefined || r.utilised === '' || r.utilised === null || r.utilised === undefined) {
        throw new Error(`Row ${i + 1}: Complete all required fields.`);
      }
      if (!code || !Number.isFinite(slNo)) {
        if (!client) throw new Error('The database connection is unavailable. Account identifiers could not be generated.');
        let generatedUnique = false;
        for (let attempt = 0; attempt < 100 && !generatedUnique; attempt += 1) {
          const { data: identifiers, error: identifierError } = await client.rpc('next_privilege_account_identifiers');
          if (identifierError) throw friendlyDatabaseError(identifierError, 'generate account identifiers');
          const generated = Array.isArray(identifiers) ? identifiers[0] : identifiers;
          const candidateSlNo = Number(generated?.sl_no);
          const candidateCode = String(generated?.client_code || '');
          if (!serialNumbers.has(candidateSlNo) && !codes.has(candidateCode)) {
            slNo = candidateSlNo;
            code = candidateCode;
            generatedUnique = true;
          }
        }
        if (!generatedUnique) throw new Error('Could not generate unique account identifiers. Please try again.');
      }
      if (!Number.isInteger(slNo) || slNo <= 0) throw new Error(`Row ${i + 1}: Sl No must be a positive whole number.`);
      if (!/^PA\d{4,}$/.test(code)) throw new Error(`Row ${i + 1}: Client code must use the fixed PA format.`);
      if (serialNumbers.has(slNo)) throw new Error(`Row ${i + 1}: Sl No "${slNo}" already exists.`);
      serialNumbers.add(slNo);
      if (!/^\+?[0-9]{10,15}$/.test(mobileNo.replace(/[\s-]/g, ''))) throw new Error(`Row ${i + 1} (${code}): Enter a valid 10 to 15 digit mobile number.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(accountDate) || Number.isNaN(Date.parse(accountDate))) throw new Error(`Row ${i + 1} (${code}): Enter a valid date in YYYY-MM-DD format.`);

      if (codes.has(code)) throw new Error(`Client code "${code}" already exists.`);
      codes.add(code);

      const aum = Number(r.aum);
      const utilised = Number(r.utilised);
      const returns = r.returns === undefined || r.returns === null || r.returns === '' ? 0 : Number(r.returns);

      if (!Number.isFinite(aum) || !Number.isFinite(utilised) || !Number.isFinite(returns)) {
        throw new Error(`Row ${i + 1} (${code}): Enter valid numeric amounts and returns.`);
      }

      if (aum < 0 || utilised < 0 || utilised > aum) {
        throw new Error(`Row ${i + 1} (${code}): Funds utilised must be between zero and AUM.`);
      }

      validated.push({
        sl_no: slNo,
        code,
        name,
        account_date: accountDate,
        mobile_no: mobileNo,
        scheme,
        introducer,
        rm,
        dealer,
        branch,
        trading_started: r.trading_started === true || ['yes', 'true', '1', 'started'].includes(String(r.trading_started).toLowerCase()),
        remarks: String(r.remarks || '').trim() || null,
        location,
        occupation,
        contact,
        aum,
        utilised,
        returns,
        stocks,
        branch_id: branchId || null,
        created_by: userId || null,
        updated_at: new Date().toISOString()
      });
    }

    if (!client) {
      return { count: validated.length };
    }

    const { error } = await client
      .from('privilege_accounts')
      .upsert(validated, { onConflict: 'code' });

    if (error) {
      throw friendlyDatabaseError(error, 'import these accounts');
    }

    return { count: validated.length };
  }

  /**
   * Retrieves all uploaded files metadata.
   */
  async getUploads(userId?: string): Promise<PrivilegeUploadRow[]> {
    if (!client) {
      return [];
    }

    try {
      let query = client
        .from('privilege_uploads')
        .select('*')
        .order('created_at', { ascending: false });
      if (userId) query = query.eq('created_by', userId);
      const { data, error } = await query;

      if (error) {
        console.warn('Error fetching uploads:', error.message);
        return [];
      }

      return data || [];
    } catch (e: any) {
      console.warn('Database error in getUploads:', e.message);
      return [];
    }
  }

  /**
   * Stores an uploaded file and writes record to database.
   */
  async saveUpload(file: Express.Multer.File, kind: string, userId?: string): Promise<PrivilegeUploadRow> {
    if (!file || file.size === 0) {
      throw new Error('Choose a valid file to upload.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File must be under 10 MB.');
    }

    const allowedKinds = ['Accounts CSV', 'Trade log', 'Account documents'];
    if (!allowedKinds.includes(kind)) {
      kind = 'Account documents';
    }

    const safeExt = path.extname(file.originalname).toLowerCase();
    if (!['.csv', '.xlsx', '.xls', '.pdf'].includes(safeExt)) {
      throw new Error('Use a CSV, XLSX or PDF file.');
    }

    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fullPath = path.join(this.uploadDir, uniqueFileName);

    fs.writeFileSync(fullPath, file.buffer);

    const record: PrivilegeUploadRow = {
      id: crypto.randomUUID(),
      name: file.originalname,
      kind,
      file_path: fullPath,
      file_size: file.size,
      mime_type: file.mimetype,
      created_by: userId || null,
      created_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client
        .from('privilege_uploads')
        .insert(record)
        .select()
        .single();

      if (error) {
        try { fs.unlinkSync(fullPath); } catch {}
        throw new Error(`Failed to record upload: ${error.message}`);
      }
      return data;
    }

    return record;
  }

  /**
   * Retrieves upload record for downloading.
   */
  async getUploadRecord(id: string, ownerId?: string): Promise<PrivilegeUploadRow | null> {
    if (!client) return null;

    let query = client
      .from('privilege_uploads')
      .select('*')
      .eq('id', id);
    if (ownerId) query = query.eq('created_by', ownerId);
    const { data, error } = await query.single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Deletes a privilege account by client code.
   */
  async deleteAccount(code: string, ownerId?: string): Promise<boolean> {
    const trimmedCode = (code || '').trim();
    if (!trimmedCode) {
      throw new Error('Client code is required to delete account.');
    }

    if (!client) {
      throw new Error('Database client is not available.');
    }

    let query = client
      .from('privilege_accounts')
      .delete()
      .eq('code', trimmedCode);
    if (ownerId) query = query.eq('created_by', ownerId);
    const { error } = await query;

    if (error) {
      throw new Error(`Failed to delete account: ${error.message}`);
    }

    return true;
  }

  /**
   * Deletes an uploaded file and its metadata record.
   */
  async deleteUpload(id: string, ownerId?: string): Promise<boolean> {
    const trimmedId = (id || '').trim();
    if (!trimmedId) {
      throw new Error('Upload ID is required.');
    }

    if (!client) {
      throw new Error('Database client is not available.');
    }

    // Retrieve file record first to clean up physical file from disk
    let recordQuery = client
      .from('privilege_uploads')
      .select('file_path')
      .eq('id', trimmedId);
    if (ownerId) recordQuery = recordQuery.eq('created_by', ownerId);
    const { data: record } = await recordQuery.single();

    if (record?.file_path && fs.existsSync(record.file_path)) {
      try {
        fs.unlinkSync(record.file_path);
      } catch (err) {
        console.warn('Could not remove file on disk:', err);
      }
    }

    let deleteQuery = client
      .from('privilege_uploads')
      .delete()
      .eq('id', trimmedId);
    if (ownerId) deleteQuery = deleteQuery.eq('created_by', ownerId);
    const { error } = await deleteQuery;

    if (error) {
      throw new Error(`Failed to delete upload record: ${error.message}`);
    }

    return true;
  }
}

export const privilegeService = new PrivilegeService();
