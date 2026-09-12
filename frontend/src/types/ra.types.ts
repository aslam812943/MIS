export type KRAUpdationStatus = 'Pending' | 'In Progress' | 'Completed' | 'Updated';
export type CalculatedSubscriptionStatus = 'ACTIVE' | 'EXPIRING SOON' | 'EXPIRED' | 'UPCOMING';

export interface RAPackage {
  id: string;
  name: string;
  description?: string | null;
  segment?: string | null;
  price: number;
  duration_days: number;
  is_active: boolean;
  created_by?: string | null;
  creator_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RAClient {
  id: string;
  client_name: string;
  package: string;
  amount: number;
  payment_date?: string | null;
  mobile_number?: string | null;
  research_date?: string | null;
  email_id?: string | null;
  sw_code?: string | null;
  pan?: string | null;
  aadhaar_no?: string | null;
  reference?: string | null;
  kyc_fetch_date?: string | null;
  kra_modify_date?: string | null;
  kra_reference_number?: string | null;
  kra_updation_status?: KRAUpdationStatus | null;
  kra_user?: string | null;
  ckyc_number?: string | null;
  remarks?: string | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  branch_id?: string | null;
  created_by?: string | null;
  creator_name?: string | null;
  branch_name?: string | null;
  calculated_status?: CalculatedSubscriptionStatus;
  days_left?: number;
  created_at: string;
  updated_at: string;
}

export interface RATestimonial {
  id: string;
  client_id: string;
  client_name: string;
  rating: number;
  feedback_text: string;
  testimonial_date: string;
  package_name?: string | null;
  screenshot_url?: string | null;
  is_featured?: boolean;
  is_verified?: boolean;
  branch_id?: string | null;
  created_by?: string | null;
  creator_name?: string | null;
  branch_name?: string | null;
  client?: RAClient;
  created_at: string;
  updated_at: string;
}

export interface RAPackageStat {
  clients: number;
  revenue: number;
  active: number;
  expiring: number;
  expired: number;
}

export interface RADashboardStats {
  totalClients: number;
  totalRevenue: number;
  thisMonthRevenue: number;
  thisYearRevenue: number;
  active: number;
  expiring: number;
  expired: number;
  monthlyRevenue: Record<string, number>;
  packageRevenue: Record<string, number>;
  upcomingRenewals: Array<RAClient & { daysLeft: number; renewalStatus: string }>;
  kycSummary: {
    kycCompleted: number;
    kycPending: number;
    kraCompleted: number;
    kraPending: number;
    ckycAvailable: number;
    ckycMissing: number;
  };
}

export interface RAPeriodicReport {
  periodType: 'weekly' | 'monthly' | 'custom';
  startDate: string;
  endDate: string;
  branchName?: string;
  summary: {
    totalClientsAcquired: number;
    totalRevenue: number;
    activeSubscriptions: number;
    expiringSubscriptions: number;
    expiredSubscriptions: number;
    renewalsDue: number;
    kycCompletedCount: number;
    kraCompletedCount: number;
  };
  packageBreakdown: Record<string, RAPackageStat>;
  clientRecords: RAClient[];
  renewalRecords: Array<RAClient & { daysLeft: number; renewalStatus: string }>;
  recentTestimonials: RATestimonial[];
}
