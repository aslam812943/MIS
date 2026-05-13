/**
 * Centralized route paths for the application.
 * Use these constants instead of hardcoded strings in components.
 */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ROOT: '/',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];
