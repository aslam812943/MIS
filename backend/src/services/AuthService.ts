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
   * Authenticates a user with email, password, and selected role.
   * Verifies credentials via Supabase Auth and validates the user role.
   * 
   * @param email User's email address.
   * @param password User's password.
   * @param role User's selected role.
   * @returns A Promise resolving to an AuthResponse containing user profile and session.
   */
  async login(email: string, password: string, role: string): Promise<AuthResponse> {
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

    // Security: Prevent login if account is blocked
    if (userProfile.status === 'blocked') {
      await supabase.auth.signOut();
      throw new Error('Access denied: Your account has been suspended. Please contact the administrator.');
    }

    // Role-Based Access Control: Validate selected role against database role
    if (userProfile.role !== role) {
      // Security: Sign out the user immediately if the role doesn't match
      await supabase.auth.signOut();
      // Secure Message: Don't reveal the user's actual role to prevent mapping
      throw new Error('Access denied: Invalid role selection for this account');
    }

    return {
      user: userProfile,
      session: authData.session as unknown as Record<string, unknown>,
    };
  }
}
