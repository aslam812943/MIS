import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { ROUTES } from '../../constants/routes';

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
  const token = authService.getToken();

  if (!token) {
    // No token found, redirect to login
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Token exists, allow access to the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
