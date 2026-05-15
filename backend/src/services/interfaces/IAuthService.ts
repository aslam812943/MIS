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
}
