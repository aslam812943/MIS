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
  ROOT: '/',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];
