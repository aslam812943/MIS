import type { User } from '../../models/user.model.js';

export interface AuthResponse {
  user: User;
  session: Record<string, unknown>;
}

export interface IAuthService {
  login(email: string, password: string): Promise<AuthResponse>;
}
