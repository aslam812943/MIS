/**
 * Centralized route paths for the application.
 * Use these constants instead of hardcoded strings in components.
 */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ADMIN_PANEL: '/admin-panel',
  PROFILE: '/profile',
  DATA_ENTRY: '/data-entry',
  VERIFY_ENTRIES: '/verify-entries',
  IEPF_DATA_ENTRY: '/iepf-entry',
  IEPF_DASHBOARD: '/iepf-dashboard',
  SETTLEMENTS_DATA_ENTRY: '/settlements-entry',
  SETTLEMENTS_DASHBOARD: '/settlements-dashboard',
  KYC_DATA_ENTRY: '/kyc-entry',
  KYC_DASHBOARD: '/kyc-dashboard',
  ROOT: '/',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];
