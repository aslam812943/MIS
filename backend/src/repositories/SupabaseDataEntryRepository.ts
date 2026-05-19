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
}
