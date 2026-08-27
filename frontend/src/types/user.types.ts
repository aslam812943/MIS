export const UserRole = {
  ADMIN: 'admin',
  CEO: 'ceo',
  MANAGING_DIRECTOR: 'managing_director',
  DIRECTOR: 'director',
  EXECUTIVE: 'executive',
  HOD: 'hod',
  REGIONAL_MANAGER: 'regional_manager',
  EMPLOYEE: 'employee',
  HR: 'hr',
  CONTENT_CREATOR: 'content_creator',
  SOCIAL_MEDIA_MANAGER: 'social_media_manager',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  phone_number?: string;
  avatar_url?: string;
  branch_id?: string;
  branch_name?: string;
  department_id?: string;
  department_name?: string;
  allowed_modules?: string[];
  status?: 'active' | 'blocked' | 'resigned';
  employee_id?: string;
  joining_date?: string;
  resignation_date?: string;
  resignation_reason?: string;
  last_working_date?: string;
  created_at?: string;
  updated_at?: string;
}
