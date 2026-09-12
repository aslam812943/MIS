import type { IBaseModel } from './IBaseModel.js';

export type KRAUpdationStatus = 'Pending' | 'In Progress' | 'Completed' | 'Updated';
export type CalculatedSubscriptionStatus = 'ACTIVE' | 'EXPIRING SOON' | 'EXPIRED' | 'UPCOMING';

export interface RAPackage extends IBaseModel {
  name: string;
  description?: string | null | undefined;
  segment?: string | null | undefined;
  price: number;
  duration_days: number;
  is_active: boolean;
  created_by?: string | null | undefined;
  creator_name?: string | null | undefined;
}

export interface RAClient extends IBaseModel {
  client_name: string;
  package: string;
  amount: number;
  payment_date?: string | null | undefined;
  mobile_number?: string | null | undefined;
  research_date?: string | null | undefined;
  email_id?: string | null | undefined;
  sw_code?: string | null | undefined;
  pan?: string | null | undefined;
  aadhaar_no?: string | null | undefined;
  reference?: string | null | undefined;
  kyc_fetch_date?: string | null | undefined;
  kra_modify_date?: string | null | undefined;
  kra_reference_number?: string | null | undefined;
  kra_updation_status?: KRAUpdationStatus | null | undefined;
  kra_user?: string | null | undefined;
  ckyc_number?: string | null | undefined;
  remarks?: string | null | undefined;
  subscription_start_date?: string | null | undefined;
  subscription_end_date?: string | null | undefined;
  branch_id?: string | null | undefined;
  created_by?: string | null | undefined;
  creator_name?: string | null | undefined;
  branch_name?: string | null | undefined;
  calculated_status?: CalculatedSubscriptionStatus | undefined;
  days_left?: number | undefined;
}

export interface RATestimonial extends IBaseModel {
  client_id: string;
  client_name: string;
  rating: number;
  feedback_text: string;
  testimonial_date: string;
  package_name?: string | null | undefined;
  screenshot_url?: string | null | undefined;
  is_featured?: boolean | undefined;
  is_verified?: boolean | undefined;
  branch_id?: string | null | undefined;
  created_by?: string | null | undefined;
  creator_name?: string | null | undefined;
  branch_name?: string | null | undefined;
  client?: RAClient | undefined;
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
  branchName?: string | undefined;
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
