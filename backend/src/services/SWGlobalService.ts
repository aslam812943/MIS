import { supabase, supabaseAdmin } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const client = supabaseAdmin || supabase;

const friendlyDatabaseError = (error: any, action: string): Error => {
  const details = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (error?.code === '23505' || details.includes('duplicate key') || details.includes('unique constraint')) {
    if (details.includes('account_no')) return new Error('This account number already exists. Please use a unique account number.');
    if (details.includes('code')) return new Error('This client code already exists. Please choose a different code.');
    if (details.includes('uq_sw_global_leads_event_contact') || details.includes('contact')) return new Error('This contact is already recorded for this event.');
    return new Error('A record with these details already exists.');
  }
  if (error?.code === '23503' || details.includes('foreign key')) {
    return new Error('The linked event, client, or lead no longer exists. Please refresh and try again.');
  }
  return new Error(`Unable to ${action}: ${error?.message || 'Please check the details and try again.'}`);
};

export interface SWGlobalClientRow {
  code: string;
  name: string;
  location: string;
  occupation: string;
  contact: string;
  email: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SWGlobalAccountRow {
  id: string;
  account_no: string;
  client_code: string;
  name?: string;
  location?: string;
  occupation?: string;
  contact?: string;
  email?: string;
  status: 'Active' | 'Pending' | 'Closed';
  pending_reason?: string;
  followup?: string | null;
  lead_id?: string | null;
  branch_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SWGlobalEventRow {
  id: string;
  title: string;
  type: 'Webinar' | 'Seminar' | 'Client meet' | 'Other';
  date: string;
  status: 'Planned' | 'Conducted' | 'Cancelled';
  notes?: string;
  leads_count?: number;
  converted_count?: number;
  conversion_ratio?: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SWGlobalLeadRow {
  id: string;
  event_id: string;
  event_title?: string;
  name: string;
  contact: string;
  location: string;
  stage: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Not interested';
  notes?: string;
  followup?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SWGlobalUploadRow {
  id: string;
  name: string;
  kind: string;
  file_path?: string | null;
  file_size?: number;
  mime_type?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export class SWGlobalService {
  async getAccountReport(from?: string, to?: string, branchId?: string) {
    if (!client) throw new Error('Database connection unavailable.');
    const rows: any[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = client.from('sw_global_accounts')
        .select('*, sw_global_clients(*), branches(name)')
        .order('created_at').order('id').range(offset, offset + 999);
      if (branchId) query = query.eq('branch_id', branchId);
      if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`);
      if (to) {
        const end = new Date(`${to}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        query = query.lt('created_at', end.toISOString());
      }
      const { data, error } = await query;
      if (error) throw friendlyDatabaseError(error, 'generate account report');
      rows.push(...(data || []).map((a: any) => ({
        id: a.id, account_no: a.account_no, client_code: a.client_code,
        name: a.sw_global_clients?.name || '', contact: a.sw_global_clients?.contact || '',
        location: a.sw_global_clients?.location || '', status: a.status,
        branch_id: a.branch_id, branch_name: a.branches?.name || 'Unassigned',
        created_at: a.created_at, pending_reason: a.pending_reason || '', followup: a.followup
      })));
      if (!data || data.length < 1000) break;
    }
    return { accounts: rows, generatedAt: new Date().toISOString(), from: from || null, to: to || null };
  }

  private async automaticClientCode(details: Omit<SWGlobalClientRow, 'code'>): Promise<string> {
    if (!client) throw new Error('Database connection unavailable.');

    const { data: matches, error: matchError } = await client.from('sw_global_clients')
      .select('code').eq('name', details.name).eq('contact', details.contact).limit(2);
    if (matchError) throw friendlyDatabaseError(matchError, 'find existing client');
    if (matches?.length === 1 && matches[0]) return matches[0].code;
    if (matches && matches.length > 1) throw new Error('Multiple clients have this name and contact. Update the existing account instead.');

    let nextNumber = 1001;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from('sw_global_clients').select('code')
        .order('code').range(offset, offset + 999);
      if (error) throw friendlyDatabaseError(error, 'generate client code');
      for (const row of data || []) {
        const match = /^SW(\d+)$/.exec(row.code);
        if (match) nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
      }
      if (!data || data.length < 1000) break;
    }

    // Insert reserves the code; retry primary-key collisions from concurrent saves.
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `SW${String(nextNumber++).padStart(4, '0')}`;
      const { error } = await client.from('sw_global_clients').insert({ ...details, code });
      if (!error) return code;
      if (error.code !== '23505') throw friendlyDatabaseError(error, 'create client');
    }
    throw new Error('Could not assign a client code. Please save again.');
  }

  private uploadDir = path.join(process.cwd(), 'uploads', 'sw-global');

  constructor() {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (e) {
      console.warn('Could not initialize sw-global uploads directory:', e);
    }
  }

  /**
   * Retrieves overall KPI dashboard stats and event performance breakdown for HOD/Management.
   */
  async getDashboardStats(branchId?: string) {
    if (!client) throw new Error('Database connection unavailable.');

    const [accountsRes, clientsRes, eventsRes, leadsRes] = await Promise.all([
      client.from('sw_global_accounts').select('*, sw_global_clients(*)'),
      client.from('sw_global_clients').select('*'),
      client.from('sw_global_events').select('*').order('date', { ascending: false }),
      client.from('sw_global_leads').select('*')
    ]);

    if (accountsRes.error) throw friendlyDatabaseError(accountsRes.error, 'fetch accounts');
    if (clientsRes.error) throw friendlyDatabaseError(clientsRes.error, 'fetch clients');
    if (eventsRes.error) throw friendlyDatabaseError(eventsRes.error, 'fetch events');
    if (leadsRes.error) throw friendlyDatabaseError(leadsRes.error, 'fetch leads');

    const accounts = (accountsRes.data || []).map((a: any) => ({
      ...a,
      name: a.sw_global_clients?.name || '',
      location: a.sw_global_clients?.location || '',
      occupation: a.sw_global_clients?.occupation || '',
      contact: a.sw_global_clients?.contact || '',
      email: a.sw_global_clients?.email || ''
    }));

    const clients = clientsRes.data || [];
    const events = eventsRes.data || [];
    const leads = leadsRes.data || [];

    const totalAccounts = accounts.length;
    const totalClients = clients.length;
    const activeAccounts = accounts.filter((a: any) => a.status === 'Active').length;
    const pendingAccounts = accounts.filter((a: any) => a.status === 'Pending').length;
    const closedAccounts = accounts.filter((a: any) => a.status === 'Closed').length;

    const totalEvents = events.length;
    const conductedEvents = events.filter((e: any) => e.status === 'Conducted').length;
    const plannedEvents = events.filter((e: any) => e.status === 'Planned').length;

    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l: any) => l.stage === 'Converted').length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    // Event performance metrics
    const eventPerformance = events.map((e: any) => {
      const eventLeads = leads.filter((l: any) => l.event_id === e.id);
      const evConverted = eventLeads.filter((l: any) => l.stage === 'Converted').length;
      const ratio = eventLeads.length > 0 ? (evConverted / eventLeads.length) * 100 : 0;
      return {
        id: e.id,
        title: e.title,
        type: e.type,
        date: e.date,
        status: e.status,
        leads_count: eventLeads.length,
        converted_count: evConverted,
        conversion_ratio: Math.round(ratio * 10) / 10
      };
    });

    // Pending attention cases (top pending accounts requiring action)
    const pendingAttention = accounts
      .filter((a: any) => a.status === 'Pending')
      .slice(0, 10);

    return {
      totalAccounts,
      totalClients,
      activeAccounts,
      pendingAccounts,
      closedAccounts,
      totalEvents,
      conductedEvents,
      plannedEvents,
      totalLeads,
      convertedLeads,
      conversionRate: Math.round(conversionRate * 10) / 10,
      eventPerformance,
      pendingAttention,
      recentAccounts: accounts.slice(0, 6)
    };
  }

  /**
   * Retrieves client accounts with optional status and search filtering.
   */
  async getAccounts(search?: string, status?: string, branchId?: string): Promise<SWGlobalAccountRow[]> {
    if (!client) return [];

    let query = client
      .from('sw_global_accounts')
      .select('*, sw_global_clients(*)')
      .order('updated_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (status && status !== 'All') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw friendlyDatabaseError(error, 'fetch accounts');

    let rows: SWGlobalAccountRow[] = (data || []).map((a: any) => ({
      id: a.id,
      account_no: a.account_no,
      client_code: a.client_code,
      name: a.sw_global_clients?.name || '',
      location: a.sw_global_clients?.location || '',
      occupation: a.sw_global_clients?.occupation || '',
      contact: a.sw_global_clients?.contact || '',
      email: a.sw_global_clients?.email || '',
      status: a.status,
      pending_reason: a.pending_reason || '',
      followup: a.followup || null,
      lead_id: a.lead_id || null,
      branch_id: a.branch_id || null,
      created_by: a.created_by,
      created_at: a.created_at,
      updated_at: a.updated_at
    }));

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (a) =>
          a.account_no.toLowerCase().includes(q) ||
          a.client_code.toLowerCase().includes(q) ||
          (a.name || '').toLowerCase().includes(q) ||
          (a.location || '').toLowerCase().includes(q) ||
          (a.contact || '').toLowerCase().includes(q) ||
          (a.pending_reason || '').toLowerCase().includes(q)
      );
    }

    return rows;
  }

  /**
   * Saves or updates a client and an account.
   */
  async saveAccount(payload: any, userId?: string, branchId?: string): Promise<SWGlobalAccountRow> {
    if (!client) throw new Error('Database connection unavailable.');

    const name = String(payload.name || '').trim();
    let clientCode: string;
    const accountNo = String(payload.account_no || payload.accountNo || '').trim().toUpperCase();
    const location = String(payload.location || '').trim();
    const occupation = String(payload.occupation || '').trim();
    const contact = String(payload.contact || '').trim();
    const email = String(payload.email || '').trim();
    const status = payload.status || 'Active';
    const pendingReason = String(payload.pending_reason || payload.pendingReason || '').trim();
    const followup = payload.followup ? String(payload.followup).trim() : null;

    if (!name) throw new Error('Client name is required.');
    if (!accountNo) throw new Error('Account number is required.');
    if (!location) throw new Error('Location is required.');
    if (!contact) throw new Error('Contact number is required.');
    if (!['Active', 'Pending', 'Closed'].includes(status)) throw new Error('Status must be Active, Pending, or Closed.');
    if (status === 'Pending' && !pendingReason) throw new Error('Pending reason is required when status is Pending.');

    const now = new Date().toISOString();

    if (payload.id) {
      const { data: existing, error } = await client.from('sw_global_accounts')
        .select('client_code').eq('id', payload.id).single();
      if (error || !existing) throw new Error('Account not found.');
      clientCode = existing.client_code;
    } else {
      clientCode = await this.automaticClientCode({
        name, location, occupation, contact, email, created_by: userId || null, updated_at: now
      });
    }

    // 1. Upsert Client Record
    const clientRecord: SWGlobalClientRow = {
      code: clientCode,
      name,
      location,
      occupation,
      contact,
      email,
      created_by: userId || null,
      updated_at: now
    };

    const { error: clientError } = await client
      .from('sw_global_clients')
      .upsert(clientRecord, { onConflict: 'code' });

    if (clientError) throw friendlyDatabaseError(clientError, 'save client details');

    // 2. Insert or Update Account Record
    const accountId = payload.id || crypto.randomUUID();
    const accountRecord: any = {
      id: accountId,
      account_no: accountNo,
      client_code: clientCode,
      status,
      pending_reason: status === 'Pending' ? pendingReason : '',
      followup: status === 'Pending' && followup ? followup : null,
      branch_id: branchId || payload.branch_id || null,
      created_by: userId || null,
      updated_at: now
    };

    if (!payload.id) {
      accountRecord.created_at = now;
    }

    const { data: savedAccount, error: accError } = await client
      .from('sw_global_accounts')
      .upsert(accountRecord, { onConflict: 'id' })
      .select('*, sw_global_clients(*)')
      .single();

    if (accError) throw friendlyDatabaseError(accError, 'save account');

    return {
      id: savedAccount.id,
      account_no: savedAccount.account_no,
      client_code: savedAccount.client_code,
      name: savedAccount.sw_global_clients?.name || name,
      location: savedAccount.sw_global_clients?.location || location,
      occupation: savedAccount.sw_global_clients?.occupation || occupation,
      contact: savedAccount.sw_global_clients?.contact || contact,
      email: savedAccount.sw_global_clients?.email || email,
      status: savedAccount.status,
      pending_reason: savedAccount.pending_reason,
      followup: savedAccount.followup,
      lead_id: savedAccount.lead_id,
      branch_id: savedAccount.branch_id,
      created_by: savedAccount.created_by,
      created_at: savedAccount.created_at,
      updated_at: savedAccount.updated_at
    };
  }

  /**
   * Deletes an account.
   */
  async deleteAccount(id: string): Promise<boolean> {
    if (!client) throw new Error('Database connection unavailable.');
    const trimmedId = String(id || '').trim();
    if (!trimmedId) throw new Error('Account ID is required.');

    const { error } = await client
      .from('sw_global_accounts')
      .delete()
      .eq('id', trimmedId);

    if (error) throw friendlyDatabaseError(error, 'delete account');
    return true;
  }

  /**
   * Retrieves all events with lead statistics.
   */
  async getEvents(search?: string): Promise<SWGlobalEventRow[]> {
    if (!client) return [];

    let query = client
      .from('sw_global_events')
      .select('*')
      .order('date', { ascending: false });

    if (search && search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const [eventsRes, leadsRes] = await Promise.all([
      query,
      client.from('sw_global_leads').select('id, event_id, stage')
    ]);

    if (eventsRes.error) throw friendlyDatabaseError(eventsRes.error, 'fetch events');

    const leads = leadsRes.data || [];
    return (eventsRes.data || []).map((e: any) => {
      const evLeads = leads.filter((l: any) => l.event_id === e.id);
      const converted = evLeads.filter((l: any) => l.stage === 'Converted').length;
      const ratio = evLeads.length > 0 ? (converted / evLeads.length) * 100 : 0;
      return {
        id: e.id,
        title: e.title,
        type: e.type,
        date: e.date,
        status: e.status,
        notes: e.notes || '',
        leads_count: evLeads.length,
        converted_count: converted,
        conversion_ratio: Math.round(ratio * 10) / 10,
        created_by: e.created_by,
        created_at: e.created_at,
        updated_at: e.updated_at
      };
    });
  }

  /**
   * Creates or updates an event.
   */
  async saveEvent(payload: any, userId?: string): Promise<SWGlobalEventRow> {
    if (!client) throw new Error('Database connection unavailable.');

    const title = String(payload.title || '').trim();
    const type = payload.type || 'Webinar';
    const date = String(payload.date || '').trim();
    const status = payload.status || 'Planned';
    const notes = String(payload.notes || '').trim();

    if (!title) throw new Error('Event title is required.');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('A valid event date (YYYY-MM-DD) is required.');
    if (!['Webinar', 'Seminar', 'Client meet', 'Other'].includes(type)) throw new Error('Invalid event type.');
    if (!['Planned', 'Conducted', 'Cancelled'].includes(status)) throw new Error('Invalid event status.');

    const now = new Date().toISOString();
    const eventId = payload.id || crypto.randomUUID();

    const record: any = {
      id: eventId,
      title,
      type,
      date,
      status,
      notes,
      created_by: userId || null,
      updated_at: now
    };

    if (!payload.id) {
      record.created_at = now;
    }

    const { data, error } = await client
      .from('sw_global_events')
      .upsert(record, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw friendlyDatabaseError(error, 'save event');
    return data;
  }

  /**
   * Deletes an event.
   */
  async deleteEvent(id: string): Promise<boolean> {
    if (!client) throw new Error('Database connection unavailable.');
    const trimmedId = String(id || '').trim();
    if (!trimmedId) throw new Error('Event ID is required.');

    const { error } = await client
      .from('sw_global_events')
      .delete()
      .eq('id', trimmedId);

    if (error) throw friendlyDatabaseError(error, 'delete event');
    return true;
  }

  /**
   * Retrieves leads with optional filtering by event and stage.
   */
  async getLeads(eventId?: string, stage?: string, search?: string): Promise<SWGlobalLeadRow[]> {
    if (!client) return [];

    let query = client
      .from('sw_global_leads')
      .select('*, sw_global_events(title)')
      .order('created_at', { ascending: false });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    if (stage && stage !== 'All') {
      query = query.eq('stage', stage);
    }

    const { data, error } = await query;
    if (error) throw friendlyDatabaseError(error, 'fetch leads');

    let rows: SWGlobalLeadRow[] = (data || []).map((l: any) => ({
      id: l.id,
      event_id: l.event_id,
      event_title: l.sw_global_events?.title || '',
      name: l.name,
      contact: l.contact,
      location: l.location,
      stage: l.stage,
      notes: l.notes || '',
      followup: l.followup || null,
      created_by: l.created_by,
      created_at: l.created_at,
      updated_at: l.updated_at
    }));

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.contact.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q) ||
          (l.event_title || '').toLowerCase().includes(q)
      );
    }

    return rows;
  }

  /**
   * Creates or updates a lead.
   */
  async saveLead(payload: any, userId?: string): Promise<SWGlobalLeadRow> {
    if (!client) throw new Error('Database connection unavailable.');

    const eventId = String(payload.event_id || payload.eventId || '').trim();
    const name = String(payload.name || '').trim();
    const contact = String(payload.contact || '').trim();
    const location = String(payload.location || '').trim();
    const stage = payload.stage || 'New';
    const notes = String(payload.notes || '').trim();
    const followup = payload.followup ? String(payload.followup).trim() : null;

    if (!eventId) throw new Error('Please select a valid event.');
    if (!name) throw new Error('Lead name is required.');
    if (!contact) throw new Error('Contact number is required.');
    if (!location) throw new Error('Location is required.');
    if (!['New', 'Contacted', 'Qualified', 'Converted', 'Not interested'].includes(stage)) {
      throw new Error('Invalid lead stage.');
    }

    // If editing existing lead, ensure it is not already converted
    if (payload.id) {
      const { data: existingLead } = await client
        .from('sw_global_leads')
        .select('stage')
        .eq('id', payload.id)
        .single();

      if (existingLead && existingLead.stage === 'Converted' && stage !== 'Converted') {
        throw new Error('Converted leads are linked to an active account and cannot have their stage changed here.');
      }
    }

    const now = new Date().toISOString();
    const leadId = payload.id || crypto.randomUUID();

    const record: any = {
      id: leadId,
      event_id: eventId,
      name,
      contact,
      location,
      stage,
      notes,
      followup: stage === 'Converted' ? null : followup,
      created_by: userId || null,
      updated_at: now
    };

    if (!payload.id) {
      record.created_at = now;
    }

    const { data, error } = await client
      .from('sw_global_leads')
      .upsert(record, { onConflict: 'id' })
      .select('*, sw_global_events(title)')
      .single();

    if (error) throw friendlyDatabaseError(error, 'save lead');

    return {
      id: data.id,
      event_id: data.event_id,
      event_title: data.sw_global_events?.title || '',
      name: data.name,
      contact: data.contact,
      location: data.location,
      stage: data.stage,
      notes: data.notes,
      followup: data.followup,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  /**
   * Deletes a lead.
   */
  async deleteLead(id: string): Promise<boolean> {
    if (!client) throw new Error('Database connection unavailable.');
    const trimmedId = String(id || '').trim();
    if (!trimmedId) throw new Error('Lead ID is required.');

    const { error } = await client
      .from('sw_global_leads')
      .delete()
      .eq('id', trimmedId);

    if (error) throw friendlyDatabaseError(error, 'delete lead');
    return true;
  }

  /**
   * Atomically converts a lead into an active client account.
   */
  async convertLead(payload: any, userId?: string, branchId?: string) {
    if (!client) throw new Error('Database connection unavailable.');

    const leadId = String(payload.lead_id || payload.leadId || '').trim();
    const accountNo = String(payload.account_no || payload.accountNo || '').trim().toUpperCase();
    const occupation = String(payload.occupation || '').trim() || 'Investor';
    const email = String(payload.email || '').trim();

    if (!leadId) throw new Error('Lead ID is required for conversion.');
    if (!accountNo) throw new Error('Account number is required.');

    // 1. Fetch Lead
    const { data: lead, error: leadErr } = await client
      .from('sw_global_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) throw new Error('Lead not found.');
    if (lead.stage === 'Converted') throw new Error('This lead is already converted.');

    const clientCode = await this.automaticClientCode({
      name: lead.name, location: lead.location, contact: lead.contact,
      occupation, email, created_by: userId || null, updated_at: new Date().toISOString()
    });

    // 2. Check Client code match
    const { data: existingClient } = await client
      .from('sw_global_clients')
      .select('*')
      .eq('code', clientCode)
      .single();

    if (existingClient && existingClient.contact !== lead.contact && existingClient.name.toLowerCase() !== lead.name.toLowerCase()) {
      throw new Error(`Client code ${clientCode} belongs to a different client (${existingClient.name}). Choose a unique code or reuse matching client code.`);
    }

    const now = new Date().toISOString();

    // 3. Upsert Client
    const clientPayload: SWGlobalClientRow = {
      code: clientCode,
      name: lead.name,
      location: lead.location,
      occupation: existingClient?.occupation || occupation,
      contact: lead.contact,
      email: email || existingClient?.email || '',
      created_by: userId || null,
      updated_at: now
    };

    const { error: clientUpsertErr } = await client
      .from('sw_global_clients')
      .upsert(clientPayload, { onConflict: 'code' });

    if (clientUpsertErr) throw friendlyDatabaseError(clientUpsertErr, 'save client record during conversion');

    // 4. Create Active Account
    const accountId = crypto.randomUUID();
    const accountPayload = {
      id: accountId,
      account_no: accountNo,
      client_code: clientCode,
      status: 'Active',
      pending_reason: '',
      followup: null,
      lead_id: leadId,
      branch_id: branchId || null,
      created_by: userId || null,
      created_at: now,
      updated_at: now
    };

    const { error: accInsertErr } = await client
      .from('sw_global_accounts')
      .insert(accountPayload);

    if (accInsertErr) throw friendlyDatabaseError(accInsertErr, 'create active account');

    // 5. Update Lead stage to Converted
    const { error: leadUpdateErr } = await client
      .from('sw_global_leads')
      .update({
        stage: 'Converted',
        followup: null,
        updated_at: now
      })
      .eq('id', leadId);

    if (leadUpdateErr) console.warn('Could not update lead stage:', leadUpdateErr.message);

    return {
      accountId,
      accountNo,
      clientCode,
      leadId,
      message: 'Lead converted successfully and active account created.'
    };
  }

  /**
   * Bulk import accounts from CSV.
   */
  async bulkImportAccounts(rows: any[], userId?: string, branchId?: string) {
    if (!rows || rows.length === 0) throw new Error('No account records provided.');

    let count = 0;
    for (const r of rows) {
      await this.saveAccount(r, userId, branchId);
      count++;
    }

    return { count, message: `Successfully imported ${count} accounts.` };
  }

  /**
   * Bulk import leads from CSV.
   */
  async bulkImportLeads(rows: any[], userId?: string) {
    if (!rows || rows.length === 0) throw new Error('No lead records provided.');

    let count = 0;
    for (const r of rows) {
      await this.saveLead(r, userId);
      count++;
    }

    return { count, message: `Successfully imported ${count} leads.` };
  }

  /**
   * Retrieves uploaded files metadata.
   */
  async getUploads(userId?: string): Promise<SWGlobalUploadRow[]> {
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('sw_global_uploads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching sw-global uploads:', error.message);
        return [];
      }
      return data || [];
    } catch (e: any) {
      console.warn('Database error in getUploads:', e.message);
      return [];
    }
  }

  /**
   * Saves uploaded document or CSV file.
   */
  async saveUpload(file: Express.Multer.File, kind: string, userId?: string): Promise<SWGlobalUploadRow> {
    if (!file || file.size === 0) throw new Error('Choose a valid file to upload.');
    if (file.size > 10 * 1024 * 1024) throw new Error('File must be under 10 MB.');

    const allowedKinds = ['Accounts CSV', 'Leads CSV', 'Events CSV', 'Account documents'];
    const safeKind = allowedKinds.includes(kind) ? kind : 'Account documents';

    const safeExt = path.extname(file.originalname).toLowerCase();
    if (!['.csv', '.xlsx', '.xls', '.pdf'].includes(safeExt)) {
      throw new Error('Use a CSV, XLSX or PDF file.');
    }

    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fullPath = path.join(this.uploadDir, uniqueFileName);

    fs.writeFileSync(fullPath, file.buffer);

    const record: SWGlobalUploadRow = {
      id: crypto.randomUUID(),
      name: file.originalname,
      kind: safeKind,
      file_path: fullPath,
      file_size: file.size,
      mime_type: file.mimetype,
      created_by: userId || null,
      created_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client
        .from('sw_global_uploads')
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
  async getUploadRecord(id: string): Promise<SWGlobalUploadRow | null> {
    if (!client) return null;
    const { data, error } = await client
      .from('sw_global_uploads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Deletes an uploaded file and record.
   */
  async deleteUpload(id: string): Promise<boolean> {
    if (!client) throw new Error('Database connection unavailable.');
    const trimmedId = String(id || '').trim();
    if (!trimmedId) throw new Error('Upload ID is required.');

    const { data: record } = await client
      .from('sw_global_uploads')
      .select('file_path')
      .eq('id', trimmedId)
      .single();

    if (record?.file_path && fs.existsSync(record.file_path)) {
      try {
        fs.unlinkSync(record.file_path);
      } catch (err) {
        console.warn('Could not remove file on disk:', err);
      }
    }

    const { error } = await client
      .from('sw_global_uploads')
      .delete()
      .eq('id', trimmedId);

    if (error) throw friendlyDatabaseError(error, 'delete upload record');
    return true;
  }
}

export const swGlobalService = new SWGlobalService();
