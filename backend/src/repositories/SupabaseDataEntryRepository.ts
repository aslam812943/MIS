import { supabase, supabaseAdmin } from '../config/supabase.js';
import type { DataEntry } from '../models/dataEntry.model.js';
import type { IDataEntryRepository } from './interfaces/IDataEntryRepository.js';

export class SupabaseDataEntryRepository implements IDataEntryRepository {
  async findByDateAndModule(date: string, moduleId: string, userId: string): Promise<DataEntry | null> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('data_entries')
      .select('*')
      .eq('entry_date', date)
      .eq('module_id', moduleId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(error.message);
    }
    return data;
  }

  async upsert(entry: Partial<DataEntry>): Promise<DataEntry> {
    // Determine if an entry already exists for this date, module, user
    if (entry.entry_date && entry.module_id && entry.user_id) {
      const existing = await this.findByDateAndModule(entry.entry_date, entry.module_id, entry.user_id);
      if (existing) {
        // Update
        const client = supabaseAdmin || supabase;
        const { data, error } = await client
          .from('data_entries')
          .update(entry)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data;
      }
    }
    
    // Insert
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('data_entries')
      .insert([entry])
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    return data;
  }

  async findByDepartment(departmentId: string, date: string): Promise<any[]> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('data_entries')
      .select('*, profiles!data_entries_user_id_fkey!inner(full_name, email, branches(name)), modules(name, fields)')
      .eq('department_id', departmentId)
      .eq('entry_date', date);

    if (error) throw new Error(error.message);
    return data || [];
  }

  async verify(id: string, verifiedBy: string): Promise<DataEntry> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('data_entries')
      .update({
        status: 'verified',
        verified_by: verifiedBy,
        verified_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async findById(id: string): Promise<DataEntry | null> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('data_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(error.message);
    }
    return data;
  }
}
