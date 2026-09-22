import { ROUTES } from '../constants/routes';
import type { User } from '../types/user.types';

const normalizeDepartment = (department?: string): string =>
  (department || '').trim().toUpperCase();

const DEPARTMENT_DASHBOARDS: Record<string, string> = {
  IEPF: ROUTES.IEPF_DASHBOARD,
  SETTLEMENTS: ROUTES.SETTLEMENTS_DASHBOARD,
  KYC: ROUTES.KYC_DASHBOARD,
  DP: ROUTES.DP_DASHBOARD,
  IT: ROUTES.IT_DASHBOARD,
  FINANCE: ROUTES.FINANCE_DASHBOARD,
  SALES: ROUTES.SALES_DASHBOARD,
  RA: ROUTES.RA_DASHBOARD,
  'RESEARCH ANALYST': ROUTES.RA_DASHBOARD,
  'RESEARCH & ANALYSIS': ROUTES.RA_DASHBOARD,
  RESEARCH: ROUTES.RA_DASHBOARD,
  'PRIVILEGE ACCOUNT': ROUTES.PRIVILEGE_DASHBOARD,
  PRIVILEGE: ROUTES.PRIVILEGE_DASHBOARD,
  'SW GLOBAL': ROUTES.SW_GLOBAL_DASHBOARD,
  'SW-GLOBAL': ROUTES.SW_GLOBAL_DASHBOARD,
  GLOBAL: ROUTES.SW_GLOBAL_DASHBOARD,
  FRANCHISE: ROUTES.FRANCHISE_DASHBOARD,
  CREATIVE: ROUTES.CREATOR_DASHBOARD,
  MARKETING: ROUTES.CREATOR_DASHBOARD,
  'CONTENT CREATION': ROUTES.CREATOR_DASHBOARD,
  'CONTENT CREATOR': ROUTES.CREATOR_DASHBOARD,
  HR: ROUTES.HR_USER_MANAGEMENT,
};

const ROLE_DASHBOARDS: Record<string, string> = {
  dealer_calculation: ROUTES.DEALER_CALCULATION,
  franchise_owner: ROUTES.FRANCHISE_DASHBOARD,
  franchise_staff: ROUTES.FRANCHISE_DASHBOARD,
  content_creator: ROUTES.CREATOR_DASHBOARD,
  social_media_manager: ROUTES.SMM_DASHBOARD,
  hr: ROUTES.HR_USER_MANAGEMENT,
};

export const hasAllDashboardAccess = (user?: User | null): boolean =>
  user?.role === 'admin' || user?.role === 'ceo';

export const getHomeDashboardRoute = (user?: User | null): string => {
  if (!user || hasAllDashboardAccess(user)) return ROUTES.DASHBOARD;
  return ROLE_DASHBOARDS[user.role]
    || DEPARTMENT_DASHBOARDS[normalizeDepartment(user.department_name)]
    || ROUTES.DATA_ENTRY;
};

const DASHBOARD_OWNERS: Record<string, string[]> = {
  [ROUTES.IEPF_DASHBOARD]: ['IEPF'],
  [ROUTES.SETTLEMENTS_DASHBOARD]: ['SETTLEMENTS'],
  [ROUTES.KYC_DASHBOARD]: ['KYC'],
  [ROUTES.DP_DASHBOARD]: ['DP'],
  [ROUTES.IT_DASHBOARD]: ['IT'],
  [ROUTES.FINANCE_DASHBOARD]: ['FINANCE'],
  [ROUTES.SALES_DASHBOARD]: ['SALES'],
  [ROUTES.RA_DASHBOARD]: ['RA', 'RESEARCH ANALYST', 'RESEARCH & ANALYSIS', 'RESEARCH'],
  [ROUTES.PRIVILEGE_DASHBOARD]: ['PRIVILEGE ACCOUNT', 'PRIVILEGE'],
  [ROUTES.SW_GLOBAL_DASHBOARD]: ['SW GLOBAL', 'SW-GLOBAL', 'GLOBAL'],
  [ROUTES.FRANCHISE_DASHBOARD]: ['FRANCHISE'],
  [ROUTES.CREATOR_DASHBOARD]: ['CREATIVE', 'MARKETING', 'CONTENT CREATION', 'CONTENT CREATOR'],
  [ROUTES.SMM_DASHBOARD]: [],
};

/** Restricts dashboard pages themselves; other workspace pages keep their existing rules. */
export const canAccessDashboardPath = (user: User, pathname: string): boolean => {
  if (hasAllDashboardAccess(user)) return true;
  if (pathname === ROUTES.DASHBOARD || pathname.startsWith('/comparison/')) {
    return false;
  }
  if (pathname === ROUTES.SMM_DASHBOARD) return user.role === 'social_media_manager';
  if (pathname === ROUTES.CREATOR_DASHBOARD && user.role === 'content_creator') return true;
  if (pathname === ROUTES.FRANCHISE_DASHBOARD && ['franchise_owner', 'franchise_staff'].includes(user.role)) return true;
  if (pathname === ROUTES.DEALER_CALCULATION) return user.role === 'dealer_calculation';

  const owners = DASHBOARD_OWNERS[pathname];
  return owners ? owners.includes(normalizeDepartment(user.department_name)) : true;
};
