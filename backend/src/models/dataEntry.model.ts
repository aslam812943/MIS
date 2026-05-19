export interface DataEntry {
  id: string;
  module_id: string;
  branch_id: string;
  user_id: string;
  entry_date: string;
  data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}
