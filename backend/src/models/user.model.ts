export enum UserRole {
  ADMIN = 'admin',
  CEO = 'ceo',
  MANAGING_DIRECTOR = 'managing_director',
  DIRECTOR = 'director',
  EXECUTIVE = 'executive',
  HOD = 'hod',
  REGIONAL_MANAGER = 'regional_manager',
  EMPLOYEE = 'employee',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string | undefined;
  branch_id?: string | undefined;
  department_id?: string | undefined;
  allowed_modules?: string[] | undefined;
  status?: 'active' | 'blocked' | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}
