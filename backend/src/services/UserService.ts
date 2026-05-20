import { supabaseAdmin } from '../config/supabase.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { EmailService } from './EmailService.js';
import { type User, UserRole } from '../models/user.model.js';

/**
 * Service to manage users in the MIS system.
 */
export class UserService {
  constructor(
    private userRepository: IUserRepository,
    private emailService: EmailService
  ) {}

  /**
   * Creates a new user in Supabase Auth and the MIS profiles table.
   * 
   * @param userData Data for the new user.
   * @param password Password for the new user.
   * @returns The created user profile.
   */
  async createUser(userData: Partial<User> & { password?: string }): Promise<User> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user creation.');
    }

    const { email, role, full_name, branch_id, department_id, allowed_modules, password } = userData;

    if (!email || !role || !password) {
      throw new Error('Email, role, and password are required.');
    }

    // SANITIZATION: Trim whitespace
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = full_name?.trim();

    // VALIDATION: Check if Branch exists
    if (branch_id) {
      const { data: branch } = await supabaseAdmin.from('branches').select('id').eq('id', branch_id).single();
      if (!branch) throw new Error(`Invalid Branch ID: ${branch_id} does not exist.`);
    }

    // VALIDATION: Check if Department exists
    if (department_id) {
      const { data: dept } = await supabaseAdmin.from('departments').select('id').eq('id', department_id).single();
      if (!dept) throw new Error(`Invalid Department ID: ${department_id} does not exist.`);
    }

    // VALIDATION: Check if Modules exist
    if (allowed_modules && allowed_modules.length > 0) {
      const { data: validModules } = await supabaseAdmin.from('modules').select('id').in('id', allowed_modules);
      if (!validModules || validModules.length !== allowed_modules.length) {
        throw new Error('One or more selected modules are invalid.');
      }
    }

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: sanitizedEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      throw new Error(`Auth creation failed: ${authError.message}`);
    }

    const authUser = authData.user;

    try {
      // 2. Create profile in 'profiles' table
      const profile = await this.userRepository.create({
        id: authUser.id,
        email: sanitizedEmail,
        role: role as UserRole,
        full_name: sanitizedName,
        branch_id,
        department_id,
        allowed_modules,
        status: 'active',
      });

      // 3. Send welcome email
      await this.emailService.sendWelcomeEmail(sanitizedEmail, sanitizedName || sanitizedEmail, password);

      return profile;
    } catch (error) {
      // Cleanup: Delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      throw error;
    }
  }

  /**
   * Retrieves all users.
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  /**
   * Deletes a user from both Supabase Auth and the profiles table.
   * 
   * @param id User ID to delete.
   */
  async deleteUser(id: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user deletion.');
    }

    // 1. Delete from auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      throw new Error(`Auth deletion failed: ${authError.message}`);
    }

    // 2. Delete from profiles table
    await this.userRepository.delete(id);
  }

  /**
   * Updates an existing user's profile and optionally their email/role in Auth.
   */
  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user updates.');
    }

    // 1. If email is being updated, update in Supabase Auth
    if (userData.email) {
      const sanitizedEmail = userData.email.trim().toLowerCase();
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: sanitizedEmail,
        email_confirm: true
      });
      if (authError) throw new Error(`Auth email update failed: ${authError.message}`);
      userData.email = sanitizedEmail;
    }

    if (userData.full_name) {
      userData.full_name = userData.full_name.trim();
    }

    // VALIDATION: Re-verify Branch/Dept/Modules if they are being changed
    if (userData.branch_id) {
      const { data: branch } = await supabaseAdmin.from('branches').select('id').eq('id', userData.branch_id).single();
      if (!branch) throw new Error('Invalid Branch ID');
    }
    if (userData.department_id) {
      const { data: dept } = await supabaseAdmin.from('departments').select('id').eq('id', userData.department_id).single();
      if (!dept) throw new Error('Invalid Department ID');
    }
    if (userData.allowed_modules && userData.allowed_modules.length > 0) {
      const { data: validModules } = await supabaseAdmin.from('modules').select('id').in('id', userData.allowed_modules);
      if (!validModules || validModules.length !== userData.allowed_modules.length) {
        throw new Error('One or more selected modules are invalid.');
      }
    }

    // 2. Update profile in database
    return this.userRepository.update(id, userData);
  }

  /**
   * Blocks or unblocks a user.
   */
  async updateUserStatus(id: string, status: 'active' | 'blocked'): Promise<User> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for status updates.');
    }

    // 1. Update status in Supabase Auth (ban/unban)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: status === 'blocked' ? '876000h' : '0s'
    });

    if (authError) {
      throw new Error(`Auth status update failed: ${authError.message}`);
    }

    // 2. Update status in profiles table
    return this.userRepository.update(id, { status });
  }

  /**
   * Helper method to retrieve user profiles for auditing/history.
   */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}
