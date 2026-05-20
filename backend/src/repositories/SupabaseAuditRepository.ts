import { supabase, supabaseAdmin } from '../config/supabase.js';
import type { AuditLog } from '../models/audit.model.js';
import type { IAuditRepository } from './interfaces/IAuditRepository.js';

export class SupabaseAuditRepository implements IAuditRepository {
  async findFiltered(filters: {
    tableName?: string;
    action?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const client = supabaseAdmin || supabase;
    let query = client.from('audit_logs').select('*', { count: 'exact' });

    if (filters.tableName) {
      query = query.eq('table_name', filters.tableName);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.userEmail) {
      query = query.ilike('user_email', `%${filters.userEmail}%`);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return {
      logs: (data as AuditLog[]) || [],
      total: count || 0,
    };
  }
}
