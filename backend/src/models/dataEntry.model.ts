export interface DataEntry {
  id: string;
  module_id: string;
  branch_id: string;
  user_id: string;
  entry_date: string;
  data: Record<string, any>;
  department_id?: string;
  status?: 'pending' | 'verified' | 'rejected';
  verified_by?: string;
  verified_at?: string;
  created_at?: string;
  updated_at?: string;
}
