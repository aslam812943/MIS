import { supabase, supabaseAdmin } from '../config/supabase.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';
import type { IAuthService, AuthResponse } from './interfaces/IAuthService.js';
import { UserRole } from '../models/user.model.js';
import { EmailService } from './EmailService.js';

/**
 * Implementation of the authentication service.
 * Handles the business logic for user authentication via Supabase.
 */
export class AuthService implements IAuthService {
  /**
   * @param userRepository Repository for accessing user profile data.
   * @param emailService Service for sending emails.
   */
  constructor(
    private userRepository: IUserRepository,
    private emailService: EmailService
  ) {}

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

  /**
   * Requests a password reset OTP.
   */
  async requestPasswordReset(email: string, role: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      // Security: Use generic message to prevent user enumeration
      throw new Error('If an account exists with this email and role, you will receive an OTP.');
    }

    if (user.role !== role) {
      throw new Error('If an account exists with this email and role, you will receive an OTP.');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store OTP in user metadata using Supabase Admin
    if (!supabaseAdmin) {
      throw new Error('Auth admin service is not configured');
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        reset_otp: otp,
        reset_otp_expires: expiresAt,
        otp_attempts: 0 // Initialize attempts
      }
    });

    if (updateError) {
      throw new Error('Failed to generate reset code. Please try again.');
    }

    // Send email
    await this.emailService.sendPasswordResetOTP(email, user.full_name || 'User', otp);
  }

  /**
   * Resets the password using the OTP.
   */
  async resetPassword(email: string, otp: string, newPassword: string, role: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);

    // Security Fix: Re-verify role to prevent cross-role reset attacks
    if (!user || user.role !== role) {
      throw new Error('Invalid reset request');
    }

    // Get user metadata from auth
    if (!supabaseAdmin) {
      throw new Error('Auth admin service is not configured');
    }

    const { data: authUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(user.id);

    if (fetchError || !authUser.user) {
      throw new Error('User not found');
    }

    const metadata = authUser.user.user_metadata;
    const storedOtp = metadata?.reset_otp;
    const expiresAt = metadata?.reset_otp_expires;
    const attempts = metadata?.otp_attempts || 0;

    // Security: Check for too many failed attempts
    if (attempts >= 3) {
      // Invalidate the OTP immediately
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          reset_otp: null,
          reset_otp_expires: null,
          otp_attempts: 0
        }
      });
      throw new Error('Too many failed attempts. Please request a new code.');
    }

    if (!storedOtp || storedOtp !== otp) {
      // Increment attempt counter
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...metadata,
          otp_attempts: attempts + 1
        }
      });
      throw new Error(`Invalid OTP code. ${2 - attempts} attempts remaining.`);
    }

    if (!expiresAt || new Date() > new Date(expiresAt)) {
      throw new Error('OTP has expired');
    }

    // Security: Sign out user from all devices after password change
    await supabaseAdmin.auth.admin.signOut(user.id);

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
      user_metadata: {
        reset_otp: null,
        reset_otp_expires: null,
        otp_attempts: 0
      }
    });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }
}
