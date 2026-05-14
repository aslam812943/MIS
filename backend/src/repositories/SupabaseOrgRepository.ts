import { supabase, supabaseAdmin } from '../config/supabase.js';
import type { Branch, Department, Module } from '../models/org.model.js';
import type { IBranchRepository, IDepartmentRepository, IModuleRepository } from './interfaces/IOrgRepository.js';

/**
 * Supabase implementation for Branch repository.
 */
export class SupabaseBranchRepository implements IBranchRepository {
  async findAll(): Promise<Branch[]> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('branches').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async findById(id: string): Promise<Branch | null> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('branches').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data;
  }

  async findByName(name: string): Promise<Branch | null> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('branches').select('*').eq('name', name).single();
    if (error || !data) return null;
    return data;
  }

  async create(branch: Partial<Branch>): Promise<Branch> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('branches').insert([branch]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, branch: Partial<Branch>): Promise<Branch> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('branches').update(branch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string): Promise<void> {
    const client = supabaseAdmin || supabase;
    const { error } = await client.from('branches').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

/**
 * Supabase implementation for Department repository.
 */
export class SupabaseDepartmentRepository implements IDepartmentRepository {
  async findAll(): Promise<Department[]> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('departments').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async findById(id: string): Promise<Department | null> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('departments').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data;
  }

  async findByName(name: string): Promise<Department | null> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('departments').select('*').eq('name', name).single();
    if (error || !data) return null;
    return data;
  }

  async create(department: Partial<Department>): Promise<Department> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('departments').insert([department]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, department: Partial<Department>): Promise<Department> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('departments').update(department).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string): Promise<void> {
    const client = supabaseAdmin || supabase;
    const { error } = await client.from('departments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

/**
 * Supabase implementation for Module repository.
 */
export class SupabaseModuleRepository implements IModuleRepository {
  async findAll(): Promise<Module[]> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('modules').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
  }

  async findById(id: string): Promise<Module | null> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('modules').select('*').eq('id', id).single();
    if (error || !data) return null;
    return data;
  }

  async findByName(name: string): Promise<Module | null> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('modules').select('*').eq('name', name).single();
    if (error || !data) return null;
    return data;
  }

  async create(module: Partial<Module>): Promise<Module> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('modules').insert([module]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, module: Partial<Module>): Promise<Module> {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client.from('modules').update(module).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string): Promise<void> {
    const client = supabaseAdmin || supabase;
    const { error } = await client.from('modules').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
