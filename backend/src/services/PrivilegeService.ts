import { supabase, supabaseAdmin } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const client = supabaseAdmin || supabase;

export interface PrivilegeAccountRow {
  code: string;
  name: string;
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

const DEFAULT_SAMPLE_ACCOUNTS: PrivilegeAccountRow[] = [
  { code: 'PA1001', name: 'Arjun Mehta', location: 'Mumbai', occupation: 'Business owner', contact: 'Sample account', aum: 8500000, utilised: 6300000, returns: 12.8, stocks: 'HDFCBANK, RELIANCE, INFY' },
  { code: 'PA1002', name: 'Priya Nair', location: 'Bengaluru', occupation: 'Technology', contact: 'Sample account', aum: 6500000, utilised: 4800000, returns: 9.4, stocks: 'TCS, INFY' },
  { code: 'PA1003', name: 'Rohan Shah', location: 'Mumbai', occupation: 'Consultant', contact: 'Sample account', aum: 12000000, utilised: 9600000, returns: 15.2, stocks: 'RELIANCE, ICICIBANK' },
  { code: 'PA1004', name: 'Ananya Iyer', location: 'Chennai', occupation: 'Doctor', contact: 'Sample account', aum: 4500000, utilised: 2700000, returns: 7.6, stocks: 'SUNPHARMA, ITC' },
  { code: 'PA1005', name: 'Vikram Kapoor', location: 'Delhi', occupation: 'Business owner', contact: 'Sample account', aum: 9500000, utilised: 7100000, returns: -2.1, stocks: 'LT, TATAMOTORS' },
  { code: 'PA1006', name: 'Neha Desai', location: 'Pune', occupation: 'Architect', contact: 'Sample account', aum: 5500000, utilised: 3800000, returns: 11.3, stocks: 'HDFCBANK, TCS' }
];

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
      return DEFAULT_SAMPLE_ACCOUNTS;
    }

    try {
      let query = client
        .from('privilege_accounts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (search && search.trim()) {
        const s = search.trim().replace(/[,()]/g, '');
        query = query.or(`name.ilike.%${s}%,code.ilike.%${s}%,location.ilike.%${s}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error querying privilege_accounts from database, using fallback:', error.message);
        return DEFAULT_SAMPLE_ACCOUNTS;
      }

      if (!data || data.length === 0) {
        if (!search) {
          return DEFAULT_SAMPLE_ACCOUNTS;
        }
        return [];
      }

      return data.map(item => ({
        code: item.code,
        name: item.name,
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
      }));
    } catch (e: any) {
      console.warn('Database error in getAccounts:', e.message);
      return DEFAULT_SAMPLE_ACCOUNTS;
    }
  }

  /**
   * Validates and saves or updates a single privilege account.
   */
  async saveAccount(account: Partial<PrivilegeAccountRow>, userId?: string, branchId?: string): Promise<PrivilegeAccountRow> {
    const textFields: (keyof PrivilegeAccountRow)[] = ['code', 'name', 'location', 'occupation', 'contact', 'stocks'];
    for (const key of textFields) {
      const val = (account as any)[key];
      if (typeof val !== 'string' || !val.trim() || val.length > 1000) {
        throw new Error(`Complete all text fields (maximum 1,000 characters). Missing: ${key}`);
      }
    }

    const aum = Number(account.aum);
    const utilised = Number(account.utilised);
    const returns = Number(account.returns);

    if (!Number.isFinite(aum) || !Number.isFinite(utilised) || !Number.isFinite(returns)) {
      throw new Error('Enter valid numeric amounts and returns.');
    }

    if (aum < 0 || utilised < 0 || utilised > aum) {
      throw new Error('Funds utilised must be between zero and AUM.');
    }

    const payload: PrivilegeAccountRow = {
      code: account.code!.trim(),
      name: account.name!.trim(),
      location: account.location!.trim(),
      occupation: account.occupation!.trim(),
      contact: account.contact!.trim(),
      aum,
      utilised,
      returns,
      stocks: account.stocks!.trim(),
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
      throw new Error(`Failed to save account: ${error.message}`);
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

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const code = String(r.code || '').trim();
      const name = String(r.name || '').trim();
      const location = String(r.location || '').trim();
      const occupation = String(r.occupation || '').trim();
      const contact = String(r.contact || '').trim();
      const stocks = String(r.stocks || '').trim();

      if (!code || !name || !location || !occupation || !contact || !stocks) {
        throw new Error(`Row ${i + 1}: Complete all text fields (maximum 1,000 characters).`);
      }

      if (codes.has(code)) {
        throw new Error(`Duplicate client code "${code}" in upload.`);
      }
      codes.add(code);

      const aum = Number(r.aum);
      const utilised = Number(r.utilised);
      const returns = Number(r.returns);

      if (!Number.isFinite(aum) || !Number.isFinite(utilised) || !Number.isFinite(returns)) {
        throw new Error(`Row ${i + 1} (${code}): Enter valid numeric amounts and returns.`);
      }

      if (aum < 0 || utilised < 0 || utilised > aum) {
        throw new Error(`Row ${i + 1} (${code}): Funds utilised must be between zero and AUM.`);
      }

      validated.push({
        code,
        name,
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
      throw new Error(`Bulk import failed: ${error.message}`);
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
      const { data, error } = await client
        .from('privilege_uploads')
        .select('*')
        .order('created_at', { ascending: false });

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
  async getUploadRecord(id: string): Promise<PrivilegeUploadRow | null> {
    if (!client) return null;

    const { data, error } = await client
      .from('privilege_uploads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data;
  }
  /**
   * Deletes a privilege account by client code.
   */
  async deleteAccount(code: string): Promise<boolean> {
    if (!code || !code.trim()) {
      throw new Error('Client code is required to delete account.');
    }

    if (!client) {
      return true;
    }

    const { error } = await client
      .from('privilege_accounts')
      .delete()
      .eq('code', code.trim());

    if (error) {
      throw new Error(`Failed to delete account: ${error.message}`);
    }

    return true;
  }

  /**
   * Deletes an uploaded file and its metadata record.
   */
  async deleteUpload(id: string): Promise<boolean> {
    if (!id || !id.trim()) {
      throw new Error('Upload ID is required.');
    }

    if (!client) {
      return true;
    }

    // Retrieve file record first to clean up physical file from disk
    const { data: record } = await client
      .from('privilege_uploads')
      .select('file_path')
      .eq('id', id.trim())
      .single();

    if (record?.file_path && fs.existsSync(record.file_path)) {
      try {
        fs.unlinkSync(record.file_path);
      } catch (err) {
        console.warn('Could not remove file on disk:', err);
      }
    }

    const { error } = await client
      .from('privilege_uploads')
      .delete()
      .eq('id', id.trim());

    if (error) {
      throw new Error(`Failed to delete upload record: ${error.message}`);
    }

    return true;
  }
}

export const privilegeService = new PrivilegeService();
