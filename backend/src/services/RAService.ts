import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import type {
  RAClient,
  RATestimonial,
  RAPackage,
  RADashboardStats,
  RAPackageStat,
  RAPeriodicReport,
  CalculatedSubscriptionStatus
} from '../models/ra.model.js';

export interface RAClientsQueryOptions {
  search?: string | undefined;
  branchId?: string | undefined;
  package?: string | undefined;
  kraStatus?: string | undefined;
}

export interface RATestimonialsQueryOptions {
  search?: string | undefined;
  branchId?: string | undefined;
  clientId?: string | undefined;
  featuredOnly?: boolean | undefined;
}

const DEFAULT_PACKAGES: RAPackage[] = [
  {
    id: 'pkg-default-1',
    name: 'Diamond Equity Portfolio',
    description: 'Long term high conviction equity advisory with disciplined rebalancing',
    segment: 'Equity',
    price: 50000,
    duration_days: 90,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'pkg-default-2',
    name: 'Platinum Momentum Pro',
    description: 'High alpha momentum equity swing trading recommendations',
    segment: 'Equity',
    price: 35000,
    duration_days: 90,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'pkg-default-3',
    name: 'Options & Futures Alpha',
    description: 'Index and stock options strategies with strict risk-to-reward hedging',
    segment: 'Futures & Options',
    price: 25000,
    duration_days: 30,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'pkg-default-4',
    name: 'Gold Commodity Specialist',
    description: 'Bullion and crude oil swing trading advisory signals',
    segment: 'Commodity',
    price: 20000,
    duration_days: 30,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'pkg-default-5',
    name: 'HNI Wealth Advisory Multi-Cap',
    description: 'Exclusive bespoke multi-asset allocation for high net-worth investors',
    segment: 'HNI Alpha',
    price: 100000,
    duration_days: 365,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export class RAService {
  private maskIdentity<T extends { pan?: any; aadhaar_no?: any }>(data: T): T {
    const mask = (value: unknown) => value ? `******${String(value).slice(-4)}` : null;
    return { ...data, pan: mask(data.pan), aadhaar_no: mask(data.aadhaar_no) };
  }

  async getIdentityRequests(userId: string) {
    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized.');
    let query = supabaseAdmin!.from('ra_identity_requests').select('*, client:client_id(client_name), requester:requester_id(full_name), branch:branch_id(name), decider:decided_by(full_name)').order('requested_at', { ascending: false });
    // CEO oversight is read-only; approval remains restricted to admins.
    if (!this.canViewAllRecords(access)) query = query.eq('requester_id', userId);
    const { data, error } = await query;
    if (error) throw new Error('Unable to load identity requests. Run database_ra_identity_access.sql if not installed.');
    const groups = new Map<string, any>();
    for (const row of data || []) {
      const key = row.batch_id || row.id;
      if (!groups.has(key)) groups.set(key,{...row,clients:[]});
      if(row.revoked_at) groups.get(key).revoked_at=row.revoked_at;
      groups.get(key).clients.push({id:row.client_id,name:row.client?.client_name || row.client_name,status:row.status,consumed_at:row.consumed_at,branch:row.branch?.name});
    }
    return [...groups.values()].map(group=>({...group, status:group.clients.some((c:any)=>c.status==='Pending')?'Pending':group.clients.some((c:any)=>c.status==='Approved')?'Approved':group.clients.some((c:any)=>c.status==='Revoked')?'Revoked':group.status, client:{client_name:`${group.clients.length} client${group.clients.length===1?'':'s'}`}, consumed_at:group.clients.every((c:any)=>c.status==='Consumed')?group.clients.map((c:any)=>c.consumed_at).sort().at(-1):null}));
  }

  async requestIdentityAccess(userId: string, ids: string[], reason: string) {
    const access = await this.verifyAccess(userId);
    if (!access.authorized || !['employee','hod','admin'].includes(access.role || '')) throw new Error('Unauthorized to request identity access.');
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || typeof reason !== 'string' || reason.trim().length < 5) throw new Error('Select clients and enter a reason of at least five characters.');
    const visible = await this.getClients(userId);
    const permitted = new Set(visible.map(client => client.id));
    if (ids.some(id => !permitted.has(id))) throw new Error('One or more clients are outside your access.');
    const batchId=randomUUID();
    const requestedAt=new Date().toISOString();
    const { error } = await supabaseAdmin!.from('ra_identity_requests').insert([...new Set(ids)].map(id => ({ batch_id:batchId, requested_at:requestedAt, client_id:id, client_name:visible.find(client=>client.id===id)!.client_name, requester_id:userId, requester_role:access.role, branch_id:visible.find(client=>client.id===id)?.branch_id || null, reason:reason.trim() })));
    if (error) {
      // Do not log submitted names, reasons, or identity values.
      console.error('RA identity request submission failed', { code: error.code });
      if (['PGRST204', 'PGRST205', '42P01', '42703'].includes(error.code)) {
        throw new Error('Identity access database needs an upgrade. Ask your admin to run the complete backend/database_ra_identity_access.sql in Supabase SQL Editor, then retry.');
      }
      if (error.code === '23505') throw new Error('A pending or approved request already exists for one of these clients. Check Identity Request History before requesting again.');
      if (error.code === '23503') throw new Error('A selected client, branch, or requester no longer exists. Refresh the client directory and try again.');
      if (error.code === '42501') throw new Error('Identity request storage permissions are missing. Ask your admin to rerun backend/database_ra_identity_access.sql.');
      throw new Error(`Unable to submit identity requests (${error.code || 'connection error'}). Please retry or share this error code with your admin.`);
    }
  }

  async decideIdentityRequest(userId: string, id: string, approve: boolean, note: string, approvedClientIds?: string[]) {
    const access = await this.verifyAccess(userId);
    if (access.role !== 'admin') throw new Error('Only admins can decide identity requests.');
    const { data: request, error: lookupError } = await supabaseAdmin!.from('ra_identity_requests').select('requester_id,batch_id').eq('id',id).single();
    if (lookupError) throw new Error('Request not found.');
    if (request.requester_id === userId) throw new Error('Another admin must verify your own request.');
    if (approvedClientIds !== undefined) {
      if (!Array.isArray(approvedClientIds) || approvedClientIds.some(value => typeof value !== 'string')) throw new Error('Invalid client selection.');
      const { error } = await supabaseAdmin!.rpc('decide_ra_identity_batch', {
        p_admin_id:userId, p_request_id:id, p_approved_client_ids:approvedClientIds,
        p_note:String(note || '').trim()
      });
      if (error) throw new Error(['PGRST202','42883'].includes(error.code) ? 'Run the updated database_ra_identity_access.sql before approving selected clients.' : 'Unable to record client decisions. Refresh the request and try again.');
      return;
    }
    const { data, error } = await supabaseAdmin!.from('ra_identity_requests').update({ status:approve?'Approved':'Rejected', decided_by:userId, decided_at:new Date().toISOString(), decision_note:String(note || '').trim() }).eq('batch_id',request.batch_id).eq('requester_id',request.requester_id).eq('status','Pending').select('id');
    if (error || !data?.length) throw new Error('Request was already decided or could not be updated.');
  }

  async getApprovedIdentity(userId: string, id: string) {
    if (!(await this.getClients(userId)).some(client=>client.id===id)) throw new Error('Client is outside your access.');
    const { data: grant, error } = await supabaseAdmin!.from('ra_identity_requests').select('id').eq('requester_id',userId).eq('client_id',id).eq('status','Approved').maybeSingle();
    if (error || !grant) throw new Error('Approved access is required to view full identity details.');
    const { data: identity, error: identityError } = await supabaseAdmin!.from('ra_clients').select('pan,aadhaar_no').eq('id',id).single();
    if (identityError) throw new Error('Unable to load identity.');
    return identity;
  }

  async revokeIdentityAccess(userId:string,id:string) {
    if ((await this.verifyAccess(userId)).role !== 'admin') throw new Error('Only admins can revoke access.');
    const {data:request,error:lookupError}=await supabaseAdmin!.from('ra_identity_requests').select('batch_id,requester_id').eq('id',id).single();
    if(lookupError) throw new Error('Request not found.');
    const {data,error}=await supabaseAdmin!.from('ra_identity_requests').update({status:'Revoked',revoked_by:userId,revoked_at:new Date().toISOString()}).eq('batch_id',request.batch_id).eq('requester_id',request.requester_id).eq('status','Approved').select('id');
    if(error || !data?.length) throw new Error('No active approved access remains in this request.');
  }

  async saveApprovedIdentity(userId: string, id: string, pan: string, aadhaar: string) {
    await this.getApprovedIdentity(userId,id);
    const { error } = await supabaseAdmin!.rpc('save_ra_identity', { p_user_id:userId, p_client_id:id, p_pan:pan?.trim().toUpperCase() || null, p_aadhaar:aadhaar?.trim() || null });
    if (error) throw new Error(error.message);
  }
  private canViewAllRecords(access: { role?: string | undefined; isHOD?: boolean | undefined }): boolean {
    const role = String(access.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return Boolean(access.isHOD) || role === 'admin' || role === 'ceo';
  }
  private sanitizeText(str: string): string {
    if (!str) return '';
    const controlCharPattern = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');
    return str.replace(controlCharPattern, '').trim();
  }

  private getFallbackPackagesPath(): string {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {}
    }
    return path.join(dataDir, 'ra_packages.json');
  }

  private readFallbackPackages(): RAPackage[] {
    try {
      const pPath = this.getFallbackPackagesPath();
      if (!fs.existsSync(pPath)) {
        fs.writeFileSync(pPath, JSON.stringify(DEFAULT_PACKAGES, null, 2), 'utf8');
        return [...DEFAULT_PACKAGES];
      }
      const raw = fs.readFileSync(pPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return [...DEFAULT_PACKAGES];
    } catch (e) {
      console.warn('Could not read fallback packages file, returning defaults:', e);
      return [...DEFAULT_PACKAGES];
    }
  }

  private writeFallbackPackages(packages: RAPackage[]): void {
    try {
      const pPath = this.getFallbackPackagesPath();
      fs.writeFileSync(pPath, JSON.stringify(packages, null, 2), 'utf8');
    } catch (e) {
      console.error('Could not write fallback packages:', e);
    }
  }

  public calculateSubscriptionStatus(
    startDateStr?: string | null | undefined,
    endDateStr?: string | null | undefined
  ): { status: CalculatedSubscriptionStatus; daysLeft: number } {
    if (!endDateStr) {
      return { status: 'ACTIVE', daysLeft: 999 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(endDateStr);
    endDate.setHours(0, 0, 0, 0);

    if (startDateStr) {
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
      if (startDate > today) {
        const diffMs = startDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return { status: 'UPCOMING', daysLeft: diffDays };
      }
    }

    const diffMs = endDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { status: 'EXPIRED', daysLeft };
    } else if (daysLeft <= 30) {
      return { status: 'EXPIRING SOON', daysLeft };
    } else {
      return { status: 'ACTIVE', daysLeft };
    }
  }

  private async verifyAccess(userId: string): Promise<{
    authorized: boolean;
    branchId?: string | undefined;
    role?: string | undefined;
    isExecutive?: boolean | undefined;
    isHOD?: boolean | undefined;
    deptName?: string | undefined;
  }> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const { data: profile, error } = await client
      .from('profiles')
      .select('*, departments(name)')
      .eq('id', userId)
      .single();

    if (error || !profile) return { authorized: false };

    const role = profile.role || 'employee';
    const isExecutive = ['admin', 'ceo', 'managing_director', 'director', 'executive'].includes(role);
    const deptName = (profile.departments as any)?.name || '';
    const isRADept = deptName.toUpperCase() === 'RA' || deptName.toUpperCase() === 'RESEARCH ANALYST' || role === 'ra' || role === 'employee' || role === 'hod';
    const isHOD = role === 'hod';

    if (!isExecutive && !isRADept) return { authorized: false };

    return {
      authorized: true,
      branchId: profile.branch_id || undefined,
      role: profile.role,
      isExecutive,
      isHOD,
      deptName
    };
  }

  // ── Packages Catalog Management ──────────────────────
  async getPackages(userId: string, activeOnly = false): Promise<RAPackage[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to view packages.');

    try {
      let query = client
        .from('ra_packages')
        .select('*, profiles:created_by(full_name)')
        .order('price', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Could not load packages: ${error.message}`);
      if (Array.isArray(data)) {
        return data.map((p: any) => ({
          ...p,
          creator_name: p.profiles?.full_name || undefined
        }));
      }
      throw new Error('Package query returned an invalid response.');
    } catch (err: any) {
      console.error('ra_packages database read failed:', err.message);
      throw new Error('Packages could not be loaded from the database. Please refresh and try again.');
    }
  }

  async createPackage(data: Partial<RAPackage>, userId: string): Promise<RAPackage> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to create packages.');

    if (!data.name || !data.name.trim()) {
      throw new Error('Package name is required.');
    }

    const trimmedName = this.sanitizeText(data.name);

    const payload = {
      name: trimmedName,
      description: data.description ? this.sanitizeText(data.description) : null,
      segment: data.segment || 'Equity',
      price: Number(data.price) || 0,
      duration_days: Number(data.duration_days) || 90,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_by: userId
    };

    try {
      const { data: inserted, error } = await client
        .from('ra_packages')
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);
      if (inserted) {
        const currentList = this.readFallbackPackages();
        const existingIdx = currentList.findIndex((p) => p.name.toLowerCase() === trimmedName.toLowerCase());
        if (existingIdx >= 0) {
          currentList[existingIdx] = inserted;
        } else {
          currentList.push(inserted);
        }
        this.writeFallbackPackages(currentList);
        return inserted;
      }
      throw new Error('The database did not return the created package.');
    } catch (err: any) {
      console.error('Package database insert failed:', err.message);
      throw new Error(`Package could not be created: ${err.message}`);
    }
  }

  async updatePackage(id: string, data: Partial<RAPackage>, userId: string): Promise<RAPackage> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to update packages.');

    const payload: any = {
      updated_at: new Date().toISOString()
    };
    if (data.name !== undefined) payload.name = this.sanitizeText(data.name);
    if (data.description !== undefined) payload.description = data.description ? this.sanitizeText(data.description) : null;
    if (data.segment !== undefined) payload.segment = data.segment;
    if (data.price !== undefined) payload.price = Number(data.price) || 0;
    if (data.duration_days !== undefined) payload.duration_days = Number(data.duration_days) || 90;
    if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);

    try {
      const { data: updated, error } = await client
        .from('ra_packages')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      if (updated) {
        const currentList = this.readFallbackPackages();
        const idx = currentList.findIndex((p) => p.id === id || p.name === updated.name);
        if (idx >= 0) {
          currentList[idx] = { ...currentList[idx], ...updated };
          this.writeFallbackPackages(currentList);
        }
        return updated;
      }
      throw new Error('Package was not found or the database did not return the update.');
    } catch (err: any) {
      console.error('Package database update failed:', err.message);
      throw new Error(`Package could not be updated: ${err.message}`);
    }
  }

  async deletePackage(id: string, userId: string): Promise<boolean> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to delete packages.');

    try {
      const { data: deleted, error } = await client
        .from('ra_packages')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw new Error(error.message);
      if (deleted && deleted.length > 0) {
        const currentList = this.readFallbackPackages().filter((p) => p.id !== id);
        this.writeFallbackPackages(currentList);
        return true;
      }
      throw new Error('Package was not found or has already been deleted.');
    } catch (err: any) {
      console.error('Package database deletion failed:', err.message);
      throw new Error(`Package could not be deleted: ${err.message}`);
    }
  }

  // ── Clients Management ──────────────────────────────
  async getClients(
    userId: string,
    options: RAClientsQueryOptions = {}
  ): Promise<RAClient[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized access to RA department.');

    let query = client
      .from('ra_clients')
      .select('*, profiles:created_by(full_name), branches:branch_id(name)')
      .order('created_at', { ascending: false });

    if (!this.canViewAllRecords(access)) {
      query = query.eq('created_by', userId);
    } else if (options.branchId) {
      query = query.eq('branch_id', options.branchId);
    }

    if (options.package) {
      query = query.eq('package', options.package);
    }
    if (options.kraStatus) {
      query = query.eq('kra_updation_status', options.kraStatus);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results: RAClient[] = (data || []).map((item: any) => {
      const calculated = this.calculateSubscriptionStatus(
        item.subscription_start_date,
        item.subscription_end_date
      );
      return {
        ...this.maskIdentity(item),
        creator_name: item.profiles?.full_name || 'Known User',
        branch_name: item.branches?.name || '-',
        calculated_status: calculated.status,
        days_left: calculated.daysLeft
      };
    });

    if (options.search) {
      const sq = options.search.toLowerCase().trim();
      results = results.filter((c) => {
        return (
          (c.client_name && c.client_name.toLowerCase().includes(sq)) ||
          (c.package && c.package.toLowerCase().includes(sq)) ||
          (c.mobile_number && c.mobile_number.toLowerCase().includes(sq)) ||
          (c.pan && c.pan.toLowerCase().includes(sq)) ||
          (c.email_id && c.email_id.toLowerCase().includes(sq)) ||
          (c.sw_code && c.sw_code.toLowerCase().includes(sq)) ||
          (c.reference && c.reference.toLowerCase().includes(sq))
        );
      });
    }

    return results;
  }

  async getClientById(id: string, userId: string): Promise<RAClient | null> {
    const clients = await this.getClients(userId);
    return clients.find((c) => c.id === id) || null;
  }

  async createClient(data: Partial<RAClient>, creatorId: string): Promise<RAClient> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(creatorId);
    if (!access.authorized) throw new Error('Unauthorized to add RA clients.');

    if (!data.client_name || !data.package) {
      throw new Error('Client name and package are required.');
    }
    if (data.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.pan.trim().toUpperCase())) throw new Error('Enter a valid 10-character PAN.');
    if (data.aadhaar_no && !/^[0-9]{12}$/.test(data.aadhaar_no.trim())) throw new Error('Enter a valid 12-digit Aadhaar.');

    const payload = {
      client_name: this.sanitizeText(data.client_name),
      package: this.sanitizeText(data.package),
      amount: Number(data.amount) || 0,
      payment_date: data.payment_date || null,
      mobile_number: data.mobile_number ? this.sanitizeText(data.mobile_number) : null,
      research_date: data.research_date || null,
      email_id: data.email_id ? this.sanitizeText(data.email_id) : null,
      sw_code: data.sw_code ? this.sanitizeText(data.sw_code) : null,
      pan: data.pan ? this.sanitizeText(data.pan).toUpperCase() : null,
      aadhaar_no: data.aadhaar_no ? this.sanitizeText(data.aadhaar_no) : null,
      reference: data.reference ? this.sanitizeText(data.reference) : null,
      kyc_fetch_date: data.kyc_fetch_date || null,
      kra_modify_date: data.kra_modify_date || null,
      kra_reference_number: data.kra_reference_number ? this.sanitizeText(data.kra_reference_number) : null,
      kra_updation_status: data.kra_updation_status || 'Pending',
      kra_user: data.kra_user ? this.sanitizeText(data.kra_user) : null,
      ckyc_number: data.ckyc_number ? this.sanitizeText(data.ckyc_number) : null,
      remarks: data.remarks ? this.sanitizeText(data.remarks) : null,
      subscription_start_date: data.subscription_start_date || null,
      subscription_end_date: data.subscription_end_date || null,
      branch_id: this.canViewAllRecords(access) ? (data.branch_id || access.branchId || null) : (access.branchId || null),
      created_by: creatorId
    };

    const { data: inserted, error } = await client
      .from('ra_clients')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return this.maskIdentity(inserted);
  }

  async bulkCreateClients(rows: any[], creatorId: string): Promise<{ inserted: number; failed: Array<{ row: number; error: string }> }> {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('The CSV does not contain any client rows.');
    if (rows.length > 500) throw new Error('A maximum of 500 clients can be imported at one time.');

    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');
    const access = await this.verifyAccess(creatorId);
    if (!access.authorized) throw new Error('Unauthorized to import RA clients.');
    const { data: branches, error: branchError } = await client.from('branches').select('id, name');
    if (branchError) throw branchError;
    const branchByName = new Map((branches || []).map((branch: any) => [String(branch.name).trim().toLowerCase(), branch.id]));

    let inserted = 0;
    const failed: Array<{ row: number; error: string }> = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = { ...rows[index] };
      try {
        const branchName = String(row.branch_name || row.branch || '').trim();
        if (branchName && !this.canViewAllRecords(access) && branchByName.get(branchName.toLowerCase()) !== access.branchId) {
          throw new Error('Only management can import clients into another branch or create a new branch.');
        }
        if (branchName && this.canViewAllRecords(access)) {
          const key = branchName.toLowerCase();
          let branchId = branchByName.get(key);
          if (!branchId) {
            const { data: created, error } = await client.from('branches')
              .upsert({ name: branchName }, { onConflict: 'name' }).select('id').single();
            if (error) throw new Error(`Unable to create branch "${branchName}": ${error.message}`);
            branchId = created.id;
            branchByName.set(key, branchId);
          }
          row.branch_id = branchId;
        }
        await this.createClient(row, creatorId);
        inserted += 1;
      } catch (error: any) {
        failed.push({ row: index + 2, error: error?.message || 'Unable to import row' });
      }
    }
    return { inserted, failed };
  }

  async updateClient(id: string, data: Partial<RAClient>, userId: string): Promise<RAClient> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to update RA clients.');
    if (data.pan !== undefined || data.aadhaar_no !== undefined) throw new Error('Use approved identity access to change PAN or Aadhaar. Other fields remain editable.');
    if (!this.canViewAllRecords(access)) {
      const { data: owned } = await client.from('ra_clients').select('id').eq('id', id).eq('created_by', userId).maybeSingle();
      if (!owned) throw new Error('You can update only clients entered by you.');
    }

    const updatePayload: any = {};
    if (data.client_name !== undefined) updatePayload.client_name = this.sanitizeText(data.client_name);
    if (data.package !== undefined) updatePayload.package = this.sanitizeText(data.package);
    if (data.amount !== undefined) updatePayload.amount = Number(data.amount) || 0;
    if (data.payment_date !== undefined) updatePayload.payment_date = data.payment_date || null;
    if (data.mobile_number !== undefined) updatePayload.mobile_number = data.mobile_number ? this.sanitizeText(data.mobile_number) : null;
    if (data.research_date !== undefined) updatePayload.research_date = data.research_date || null;
    if (data.email_id !== undefined) updatePayload.email_id = data.email_id ? this.sanitizeText(data.email_id) : null;
    if (data.sw_code !== undefined) updatePayload.sw_code = data.sw_code ? this.sanitizeText(data.sw_code) : null;
    if (data.pan !== undefined) updatePayload.pan = data.pan ? this.sanitizeText(data.pan).toUpperCase() : null;
    if (data.aadhaar_no !== undefined) updatePayload.aadhaar_no = data.aadhaar_no ? this.sanitizeText(data.aadhaar_no) : null;
    if (data.reference !== undefined) updatePayload.reference = data.reference ? this.sanitizeText(data.reference) : null;
    if (data.kyc_fetch_date !== undefined) updatePayload.kyc_fetch_date = data.kyc_fetch_date || null;
    if (data.kra_modify_date !== undefined) updatePayload.kra_modify_date = data.kra_modify_date || null;
    if (data.kra_reference_number !== undefined) updatePayload.kra_reference_number = data.kra_reference_number ? this.sanitizeText(data.kra_reference_number) : null;
    if (data.kra_updation_status !== undefined) updatePayload.kra_updation_status = data.kra_updation_status;
    if (data.kra_user !== undefined) updatePayload.kra_user = data.kra_user ? this.sanitizeText(data.kra_user) : null;
    if (data.ckyc_number !== undefined) updatePayload.ckyc_number = data.ckyc_number ? this.sanitizeText(data.ckyc_number) : null;
    if (data.remarks !== undefined) updatePayload.remarks = data.remarks ? this.sanitizeText(data.remarks) : null;
    if (data.subscription_start_date !== undefined) updatePayload.subscription_start_date = data.subscription_start_date || null;
    if (data.subscription_end_date !== undefined) updatePayload.subscription_end_date = data.subscription_end_date || null;
    if (data.branch_id !== undefined && this.canViewAllRecords(access)) updatePayload.branch_id = data.branch_id || null;
    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error } = await client
      .from('ra_clients')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.maskIdentity(updated);
  }

  async deleteClient(id: string, userId: string): Promise<boolean> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to delete RA clients.');

    let query = client
      .from('ra_clients')
      .delete()
      .eq('id', id);
    if (!this.canViewAllRecords(access)) query = query.eq('created_by', userId);
    const { error } = await query;

    if (error) throw error;
    return true;
  }

  // ── Analytics & Dashboard Metrics ───────────────────
  async getDashboardStats(userId: string, branchId?: string): Promise<RADashboardStats> {
    const clients = await this.getClients(userId, { branchId });

    let totalRevenue = 0;
    let thisMonthRevenue = 0;
    let thisYearRevenue = 0;
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let kycCompleted = 0;
    let kraCompleted = 0;
    let ckycAvailable = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRevenue: Record<string, number> = {};
    const packageRevenue: Record<string, number> = {};

    clients.forEach((c) => {
      const amt = Number(c.amount) || 0;
      totalRevenue += amt;

      if (c.payment_date) {
        const pDate = new Date(c.payment_date);
        const mKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue[mKey] = (monthlyRevenue[mKey] || 0) + amt;

        if (pDate.getFullYear() === currentYear) {
          thisYearRevenue += amt;
          if (pDate.getMonth() === currentMonth) {
            thisMonthRevenue += amt;
          }
        }
      }

      if (c.package) {
        packageRevenue[c.package] = (packageRevenue[c.package] || 0) + amt;
      }

      if (c.calculated_status === 'ACTIVE') active++;
      if (c.calculated_status === 'EXPIRING SOON') {
        expiring++;
        active++;
      }
      if (c.calculated_status === 'EXPIRED') expired++;

      if (c.kyc_fetch_date) kycCompleted++;
      if (c.kra_updation_status === 'Completed' || c.sw_code) kraCompleted++;
      if (c.ckyc_number) ckycAvailable++;
    });

    const upcomingRenewals = clients
      .filter((c) => c.days_left !== undefined && c.days_left >= 0 && c.days_left <= 30)
      .map((c) => ({
        ...c,
        daysLeft: c.days_left!,
        renewalStatus: c.days_left! <= 7 ? 'URGENT' : 'SOON'
      }));

    upcomingRenewals.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      totalClients: clients.length,
      totalRevenue,
      thisMonthRevenue,
      thisYearRevenue,
      active,
      expiring,
      expired,
      monthlyRevenue,
      packageRevenue,
      upcomingRenewals,
      kycSummary: {
        kycCompleted,
        kycPending: clients.length - kycCompleted,
        kraCompleted,
        kraPending: clients.length - kraCompleted,
        ckycAvailable,
        ckycMissing: clients.length - ckycAvailable
      }
    };
  }

  async getPackageReport(userId: string, branchId?: string): Promise<Record<string, RAPackageStat>> {
    const clients = await this.getClients(userId, { branchId });
    const stats: Record<string, RAPackageStat> = {};

    clients.forEach((c) => {
      const pkg = c.package || 'Unassigned';
      if (!stats[pkg]) {
        stats[pkg] = { clients: 0, revenue: 0, active: 0, expiring: 0, expired: 0 };
      }
      const amt = Number(c.amount) || 0;
      stats[pkg].clients++;
      stats[pkg].revenue += amt;

      if (c.calculated_status === 'ACTIVE') stats[pkg].active++;
      if (c.calculated_status === 'EXPIRING SOON') {
        stats[pkg].expiring++;
        stats[pkg].active++;
      }
      if (c.calculated_status === 'EXPIRED') stats[pkg].expired++;
    });

    return stats;
  }

  async getPayments(userId: string, search?: string, branchId?: string): Promise<any[]> {
    const clients = await this.getClients(userId, { search, branchId });
    return clients.map((c) => {
      const baseAmount = Number(c.amount) || 0;
      const gstAmount = Math.round(baseAmount * 0.18 * 100) / 100;
      return {
        id: c.id,
        client_name: c.client_name,
        pan: c.pan,
        mobile_number: c.mobile_number,
        package: c.package,
        payment_date: c.payment_date || c.subscription_start_date,
        base_amount: baseAmount,
        gst_amount: gstAmount,
        total_paid: baseAmount + gstAmount,
        payment_mode: 'Online / Bank Transfer',
        sw_code: c.sw_code,
        reference: c.reference,
        branch_name: c.branch_name,
        creator_name: c.creator_name
      };
    });
  }

  async getRenewals(days = 30, userId: string, branchId?: string): Promise<any[]> {
    const clients = await this.getClients(userId, { branchId });
    return clients
      .filter((c) => c.days_left !== undefined && c.days_left >= 0 && c.days_left <= days)
      .map((c) => ({
        ...c,
        urgency: c.days_left! <= 7 ? 'CRITICAL' : 'UPCOMING'
      }))
      .sort((a, b) => a.days_left! - b.days_left!);
  }

  async getExpired(userId: string, branchId?: string): Promise<any[]> {
    const clients = await this.getClients(userId, { branchId });
    return clients
      .filter((c) => c.calculated_status === 'EXPIRED')
      .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0));
  }

  async getKycReport(userId: string, branchId?: string): Promise<any> {
    const clients = await this.getClients(userId, { branchId });
    return {
      total: clients.length,
      kycVerified: clients.filter((c) => !!c.kyc_fetch_date).length,
      kraCompleted: clients.filter((c) => c.kra_updation_status === 'Completed').length,
      ckycAvailable: clients.filter((c) => !!c.ckyc_number).length,
      clients: clients.map((c) => ({
        id: c.id,
        name: c.client_name,
        pan: c.pan,
        mobile: c.mobile_number,
        kycDate: c.kyc_fetch_date,
        kraStatus: c.kra_updation_status,
        kraUser: c.kra_user,
        ckyc: c.ckyc_number
      }))
    };
  }

  // ── Testimonials & Feedback Hub ─────────────────────
  async getTestimonials(
    userId: string,
    options: RATestimonialsQueryOptions = {}
  ): Promise<RATestimonial[]> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to view testimonials.');

    let query = client
      .from('ra_testimonials')
      .select('*, ra_clients(client_name, package, mobile_number, pan), profiles:created_by(full_name), branches:branch_id(name)')
      .order('created_at', { ascending: false });

    if (!this.canViewAllRecords(access)) {
      query = query.eq('created_by', userId);
    } else if (options.branchId) {
      query = query.eq('branch_id', options.branchId);
    }

    if (options.clientId) {
      query = query.eq('client_id', options.clientId);
    }

    if (options.featuredOnly) {
      query = query.eq('is_featured', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results: RATestimonial[] = (data || []).map((item: any) => {
      return {
        ...item,
        ra_clients: item.ra_clients ? this.maskIdentity(item.ra_clients) : undefined,
        client: item.ra_clients ? this.maskIdentity(item.ra_clients) : undefined,
        creator_name: item.profiles?.full_name || 'Known User',
        branch_name: item.branches?.name || '-'
      };
    });

    if (options.search) {
      const sq = options.search.toLowerCase().trim();
      results = results.filter((f) => {
        return (
          (f.client_name && f.client_name.toLowerCase().includes(sq)) ||
          (f.feedback_text && f.feedback_text.toLowerCase().includes(sq)) ||
          (f.package_name && f.package_name.toLowerCase().includes(sq))
        );
      });
    }

    return results;
  }

  async createTestimonial(data: Partial<RATestimonial>, creatorId: string): Promise<RATestimonial> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(creatorId);
    if (!access.authorized) throw new Error('Unauthorized to add testimonials.');

    if (!data.client_id || !data.feedback_text) {
      throw new Error('Client ID and feedback text are required.');
    }

    let clientQuery = client
      .from('ra_clients')
      .select('client_name, package, branch_id')
      .eq('id', data.client_id);
    if (!this.canViewAllRecords(access)) clientQuery = clientQuery.eq('created_by', creatorId);
    const { data: raClient } = await clientQuery.maybeSingle();
    if (!raClient) throw new Error('Select a client entered by you.');

    const ratingVal = Number(data.rating) || 5;
    const rating = Math.max(1, Math.min(5, ratingVal));

    const payload = {
      client_id: data.client_id,
      client_name: this.sanitizeText(data.client_name || raClient?.client_name || 'Client'),
      rating,
      feedback_text: this.sanitizeText(data.feedback_text),
      testimonial_date: data.testimonial_date || new Date().toISOString().split('T')[0],
      package_name: data.package_name ? this.sanitizeText(data.package_name) : (raClient?.package || null),
      screenshot_url: data.screenshot_url || null,
      is_featured: Boolean(data.is_featured),
      is_verified: data.is_verified !== undefined ? Boolean(data.is_verified) : true,
      branch_id: this.canViewAllRecords(access) ? (data.branch_id || raClient.branch_id || access.branchId || null) : (raClient.branch_id || access.branchId || null),
      created_by: creatorId
    };

    const { data: inserted, error } = await client
      .from('ra_testimonials')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return inserted;
  }

  async updateTestimonial(id: string, data: Partial<RATestimonial>, userId: string): Promise<RATestimonial> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to update testimonials.');
    if (!this.canViewAllRecords(access)) {
      const { data: owned } = await client.from('ra_testimonials').select('id').eq('id', id).eq('created_by', userId).maybeSingle();
      if (!owned) throw new Error('You can update only testimonials entered by you.');
    }

    const updatePayload: any = {};
    if (data.client_name !== undefined) updatePayload.client_name = this.sanitizeText(data.client_name);
    if (data.rating !== undefined) updatePayload.rating = Math.max(1, Math.min(5, Number(data.rating) || 5));
    if (data.feedback_text !== undefined) updatePayload.feedback_text = this.sanitizeText(data.feedback_text);
    if (data.testimonial_date !== undefined) updatePayload.testimonial_date = data.testimonial_date;
    if (data.package_name !== undefined) updatePayload.package_name = data.package_name ? this.sanitizeText(data.package_name) : null;
    if (data.screenshot_url !== undefined) updatePayload.screenshot_url = data.screenshot_url || null;
    if (data.is_featured !== undefined) updatePayload.is_featured = Boolean(data.is_featured);
    if (data.is_verified !== undefined) updatePayload.is_verified = Boolean(data.is_verified);
    updatePayload.updated_at = new Date().toISOString();

    const { data: updated, error } = await client
      .from('ra_testimonials')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  }

  async deleteTestimonial(id: string, userId: string): Promise<boolean> {
    const client = supabaseAdmin;
    if (!client) throw new Error('Supabase admin client is not configured.');

    const access = await this.verifyAccess(userId);
    if (!access.authorized) throw new Error('Unauthorized to delete testimonials.');

    let query = client
      .from('ra_testimonials')
      .delete()
      .eq('id', id);
    if (!this.canViewAllRecords(access)) query = query.eq('created_by', userId);
    const { error } = await query;

    if (error) throw error;
    return true;
  }

  async getPeriodicReport(
    userId: string,
    options: {
      periodType: 'weekly' | 'monthly' | 'custom';
      startDate: string;
      endDate: string;
      branchId?: string | undefined;
    }
  ): Promise<RAPeriodicReport> {
    const allClients = await this.getClients(userId, { branchId: options.branchId });
    const allTestimonials = await this.getTestimonials(userId, { branchId: options.branchId });

    const start = new Date(options.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(options.endDate);
    end.setHours(23, 59, 59, 999);

    const filteredClients = allClients.filter((c) => {
      if (!c.payment_date && !c.subscription_start_date) return true;
      const d = new Date(c.payment_date || c.subscription_start_date || '');
      return d >= start && d <= end;
    });

    let totalRevenue = 0;
    let activeSubscriptions = 0;
    let expiringSubscriptions = 0;
    let expiredSubscriptions = 0;
    let kycCompletedCount = 0;
    let kraCompletedCount = 0;
    const packageBreakdown: Record<string, RAPackageStat> = {};

    filteredClients.forEach((c) => {
      const amt = Number(c.amount) || 0;
      totalRevenue += amt;

      const pkg = c.package || 'Unspecified';
      if (!packageBreakdown[pkg]) {
        packageBreakdown[pkg] = { clients: 0, revenue: 0, active: 0, expiring: 0, expired: 0 };
      }
      packageBreakdown[pkg].clients++;
      packageBreakdown[pkg].revenue += amt;

      if (c.calculated_status === 'ACTIVE') {
        activeSubscriptions++;
        packageBreakdown[pkg].active++;
      }
      if (c.calculated_status === 'EXPIRING SOON') {
        expiringSubscriptions++;
        activeSubscriptions++;
        packageBreakdown[pkg].expiring++;
        packageBreakdown[pkg].active++;
      }
      if (c.calculated_status === 'EXPIRED') {
        expiredSubscriptions++;
        packageBreakdown[pkg].expired++;
      }

      if (c.kyc_fetch_date) kycCompletedCount++;
      if (c.kra_updation_status === 'Completed' || c.sw_code) {
        kraCompletedCount++;
      }
    });

    const renewalRecords = filteredClients
      .filter((c) => c.days_left !== undefined && c.days_left >= 0 && c.days_left <= 60)
      .map((c) => ({
        ...c,
        daysLeft: c.days_left!,
        renewalStatus: c.days_left! <= 7 ? 'URGENT' : 'SOON'
      }));

    renewalRecords.sort((a, b) => a.daysLeft - b.daysLeft);

    const recentTestimonials = allTestimonials.filter((t) => {
      const d = new Date(t.testimonial_date);
      return d >= start && d <= end;
    });

    return {
      periodType: options.periodType,
      startDate: options.startDate,
      endDate: options.endDate,
      summary: {
        totalClientsAcquired: filteredClients.length,
        totalRevenue,
        activeSubscriptions,
        expiringSubscriptions,
        expiredSubscriptions,
        renewalsDue: renewalRecords.length,
        kycCompletedCount,
        kraCompletedCount
      },
      packageBreakdown,
      clientRecords: filteredClients,
      renewalRecords,
      recentTestimonials
    };
  }
}

export const raService = new RAService();
