export interface AuditLog {
  id: string;
  table_name: string;
  record_id?: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: any;
  new_data?: any;
  user_id?: string;
  user_email: string;
  user_role?: string;
  created_at: string;
}
