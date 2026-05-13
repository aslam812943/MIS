import { supabase } from '../config/supabase.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { IAuthService, AuthResponse } from './interfaces/IAuthService.js';
import { UserRole } from '../models/user.model.js';

/**
 * Implementation of the authentication service.
 * Handles the business logic for user authentication via Supabase.
 */
export class AuthService implements IAuthService {
  /**
   * @param userRepository Repository for accessing user profile data.
   */
  constructor(private userRepository: IUserRepository) {}

  /**
   * Authenticates a user with email and password.
   * Verifies credentials via Supabase Auth and validates the user role.
   * 
   * @param email User's email address.
   * @param password User's password.
   * @returns A Promise resolving to an AuthResponse containing user profile and session.
   * @throws Error if credentials are invalid, profile is missing, or user lacks admin role.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Invalid login credentials');
    }

    const userProfile = await this.userRepository.findById(authData.user.id);

    if (!userProfile) {
      throw new Error('User profile not found in MIS database');
    }

    // Role-Based Access Control: Ensure only administrators can access this portal
    if (userProfile.role !== UserRole.ADMIN) {
      // Security: Sign out the user immediately if they lack the required role
      await supabase.auth.signOut();
      throw new Error('Access denied: Administrator privileges are required');
    }

    return {
      user: userProfile,
      session: authData.session as unknown as Record<string, unknown>,
    };
  }
}
