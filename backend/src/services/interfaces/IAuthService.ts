import type { User } from '../../models/user.model.js';

export interface LoginResponse {
  user: User;
  session: any;
}

export interface IAuthService {
  login(email: string, password: string): Promise<LoginResponse>;
}
