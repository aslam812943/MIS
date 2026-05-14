import { supabase } from '../config/supabase.js';
import { type User, UserRole } from '../models/user.model.js';
import type { IUserRepository } from './interfaces/IUserRepository.js';

/**
 * Interface representing the database schema for the profiles table.
 */
interface ProfileRow {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  branch_id?: string;
  department_id?: string;
  allowed_modules?: string[];
  status?: 'active' | 'blocked';
  created_at: string;
  updated_at: string;
}

/**
 * Supabase-specific implementation of the user repository.
 * Interacts with the 'profiles' table.
 */
export class SupabaseUserRepository implements IUserRepository {
  /**
   * Finds a user profile by its unique identifier.
   * 
   * @param id The UUID of the user.
   * @returns A Promise resolving to the User or null if not found.
   */
  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToUser(data as ProfileRow);
  }

  /**
   * Finds a user profile by their email address.
   * 
   * @param email The email address to search for.
   * @returns A Promise resolving to the User or null if not found.
   */
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;
    return this.mapToUser(data as ProfileRow);
  }

  /**
   * Retrieves all user profiles.
   */
  async findAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as ProfileRow[]).map(row => this.mapToUser(row));
  }

  /**
   * Creates a new user profile record.
   * 
   * @param user Partial user data to be inserted.
   * @returns A Promise resolving to the newly created User.
   * @throws Error if the database insertion fails.
   */
  async create(user: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .insert([user])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToUser(data as ProfileRow);
  }

  /**
   * Updates an existing user profile.
   * 
   * @param id The UUID of the user.
   * @param user Partial user data to be updated.
   * @returns A Promise resolving to the updated User.
   */
  async update(id: string, user: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .update(user)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapToUser(data as ProfileRow);
  }

  /**
   * Deletes a user profile record.
   * 
   * @param id The UUID of the user.
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  /**
   * Maps a raw database row to the User model.
   * 
   * @param data The raw ProfileRow from the database.
   * @returns A formatted User object.
   * @private
   */
  private mapToUser(data: ProfileRow): User {
    return {
      id: data.id,
      email: data.email,
      role: data.role as UserRole,
      full_name: data.full_name,
      branch_id: data.branch_id,
      department_id: data.department_id,
      allowed_modules: data.allowed_modules,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }
}
