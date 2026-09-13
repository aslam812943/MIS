export interface PrivilegeAccount {
  code: string;
  name: string;
  location: string;
  occupation: string;
  contact: string;
  aum: number;
  utilised: number;
  returns: number;
  stocks: string;
  branch_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PrivilegeUpload {
  id: string;
  name: string;
  kind: string;
  file_path?: string | null;
  file_size?: number;
  mime_type?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface TopAccountStat {
  code: string;
  name: string;
  shortName: string;
  aum: number;
  utilised: number;
  ratio: number;
  returns: number;
}

export interface PrivilegeDashboardStats {
  totalAccounts: number;
  totalAUM: number;
  totalUtilised: number;
  avgUtilised: number;
  utilisationRatio: number;
  availableCapital: number;
  topAccounts: TopAccountStat[];
  accounts: PrivilegeAccount[];
}
