export interface SWGlobalClient {
  code: string;
  name: string;
  location: string;
  occupation: string;
  contact: string;
  email: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SWGlobalAccountReport {
  accounts: Array<Pick<SWGlobalAccount, 'id' | 'account_no' | 'client_code' | 'name' | 'contact' | 'location' | 'status' | 'branch_id' | 'created_at' | 'pending_reason' | 'followup'> & { branch_name: string }>;
  generatedAt: string;
  from: string | null;
  to: string | null;
}

export interface SWGlobalAccount {
  id: string;
  account_no: string;
  client_code: string;
  name: string;
  location: string;
  occupation: string;
  contact: string;
  email: string;
  status: 'Active' | 'Pending' | 'Closed';
  pending_reason?: string;
  followup?: string | null;
  lead_id?: string | null;
  branch_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SWGlobalEvent {
  id: string;
  title: string;
  type: 'Webinar' | 'Seminar' | 'Client meet' | 'Other';
  date: string;
  status: 'Planned' | 'Conducted' | 'Cancelled';
  notes?: string;
  leads_count?: number;
  converted_count?: number;
  conversion_ratio?: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SWGlobalLead {
  id: string;
  event_id: string;
  event_title?: string;
  name: string;
  contact: string;
  location: string;
  stage: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Not interested';
  notes?: string;
  followup?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SWGlobalUpload {
  id: string;
  name: string;
  kind: string;
  file_path?: string | null;
  file_size?: number;
  mime_type?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface SWGlobalEventMetric {
  id: string;
  title: string;
  type: string;
  date: string;
  status: string;
  leads_count: number;
  converted_count: number;
  conversion_ratio: number;
}

export interface SWGlobalDashboardStats {
  totalAccounts: number;
  totalClients: number;
  activeAccounts: number;
  pendingAccounts: number;
  closedAccounts: number;
  totalEvents: number;
  conductedEvents: number;
  plannedEvents: number;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  eventPerformance: SWGlobalEventMetric[];
  pendingAttention: SWGlobalAccount[];
  recentAccounts: SWGlobalAccount[];
}
