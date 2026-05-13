export enum UserRole {
  ADMIN = 'admin',
  HOD = 'hod',
  EMPLOYEE = 'employee',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}
