/**
 * Centralized route paths for the application.
 * Use these constants instead of hardcoded strings in components.
 */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ADMIN_PANEL: '/admin-panel',
  PROFILE: '/profile',
  NOTIFICATIONS: '/notifications',
  DATA_ENTRY: '/data-entry',
  VERIFY_ENTRIES: '/verify-entries',
  IEPF_DATA_ENTRY: '/iepf-entry',
  IEPF_DASHBOARD: '/iepf-dashboard',
  SETTLEMENTS_DATA_ENTRY: '/settlements-entry',
  SETTLEMENTS_DASHBOARD: '/settlements-dashboard',
  KYC_DATA_ENTRY: '/kyc-entry',
  KYC_DASHBOARD: '/kyc-dashboard',
  DP_DATA_ENTRY: '/dp-entry',
  DP_DASHBOARD: '/dp-dashboard',
  IT_DATA_ENTRY: '/it-entry',
  IT_DASHBOARD: '/it-dashboard',
  FINANCE_DATA_ENTRY: '/finance-entry',
  FINANCE_DASHBOARD: '/finance-dashboard',
  COMPARISON: '/comparison/:dept',
  HR_DATA_ENTRY: '/hr-entry',
  ROOT: '/',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];
