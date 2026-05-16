import type { User } from '../../models/user.model.js';

export interface AuthResponse {
  user: User;
  session: Record<string, unknown>;
}

export interface IAuthService {
  /**
   * Authenticates a user with email, password, and selected role.
   * 
   * @param email User's email address.
   * @param password User's password.
   * @param role User's selected role.
   * @returns A Promise resolving to an AuthResponse.
   */
  login(email: string, password: string, role: string): Promise<AuthResponse>;

  /**
   * Requests a password reset OTP for the given email and role.
   * 
   * @param email User's email address.
   * @param role User's selected role.
   */
  requestPasswordReset(email: string, role: string): Promise<void>;

  /**
   * Resets the user's password using the provided OTP.
   * 
   * @param email User's email address.
   * @param otp 6-digit OTP.
   * @param newPassword New password to set.
   * @param role User's selected role.
   */
  resetPassword(email: string, otp: string, newPassword: string, role: string): Promise<void>;
}
