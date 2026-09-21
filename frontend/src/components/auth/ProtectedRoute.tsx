import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { ROUTES } from '../../constants/routes';
import { canAccessDashboardPath, getHomeDashboardRoute } from '../../utils/dashboardAccess';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Higher-Order Component to protect private routes.
 * Checks for a valid session token in local storage.
 * If no token is found, redirects the user to the login page.
 * 
 * @param children The component(s) to render if authenticated.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  if (!authService.isAuthenticated()) {
    // No user profile found, redirect to login
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  const user = authService.getCurrentUser();

  if (['franchise_owner', 'franchise_staff'].includes(user?.role || '') &&
      !location.pathname.startsWith('/franchise/') && !([ROUTES.PROFILE, ROUTES.NOTIFICATIONS] as string[]).includes(location.pathname)) {
    return <Navigate to={ROUTES.FRANCHISE_DASHBOARD} replace />;
  }

  if (user && !canAccessDashboardPath(user, location.pathname)) {
    return <Navigate to={getHomeDashboardRoute(user)} replace />;
  }

  // Token exists, allow access to the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
