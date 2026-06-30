export enum UserRole {
  ADMIN = 'admin',
  CEO = 'ceo',
  MANAGING_DIRECTOR = 'managing_director',
  DIRECTOR = 'director',
  EXECUTIVE = 'executive',
  HOD = 'hod',
  REGIONAL_MANAGER = 'regional_manager',
  EMPLOYEE = 'employee',
  HR = 'hr',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string | undefined;
  phone_number?: string | undefined;
  avatar_url?: string | undefined;
  branch_id?: string | undefined;
  branch_name?: string | undefined;
  department_id?: string | undefined;
  department_name?: string | undefined;
  allowed_modules?: string[] | undefined;
  status?: 'active' | 'blocked' | 'resigned' | undefined;
  employee_id?: string | undefined;
  joining_date?: string | undefined;
  resignation_date?: string | undefined;
  resignation_reason?: string | undefined;
  last_working_date?: string | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}
