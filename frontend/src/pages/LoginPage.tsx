import React, { useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm';
import RoleSelector from '../components/auth/RoleSelector';
import { UserRole } from '../types/user.types';
import { useTheme } from '../context/ThemeContext';

const LoginPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.ADMIN);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="mis-login-shell">
      <button
        type="button"
        className="mis-theme-toggle mis-login-theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
      </button>
      <div className="w-full max-w-6xl z-10 flex flex-col items-center gap-8 sm:gap-12 mis-animate-in px-0 sm:px-2">
        <div className="mis-login-brand">
          <h1>
            <span style={{ color: 'var(--text-primary)' }}>MIS</span>{' '}
            <span className="mis-page-title-accent">Portal</span>
          </h1>
          <p className="mis-page-desc mx-auto text-center">
            Management Information System — secure access for organizational efficiency and data-driven decisions.
          </p>
        </div>

        <div className="mis-login-grid w-full">
          <div className="flex-1 w-full min-w-0">
            <RoleSelector selectedRole={selectedRole} onSelect={setSelectedRole} />
          </div>

          <div className="w-full max-w-md flex flex-col items-center shrink-0 mx-auto lg:mx-0">
            {showForgotPassword ? (
              <ForgotPasswordForm
                selectedRole={selectedRole}
                onBackToLogin={() => setShowForgotPassword(false)}
              />
            ) : (
              <LoginForm
                selectedRole={selectedRole}
                onForgotPassword={() => setShowForgotPassword(true)}
              />
            )}
          </div>
        </div>

        <footer className="text-center text-sm relative z-10" style={{ color: 'var(--text-muted)' }}>
          &copy; {new Date().getFullYear()} Management Information System. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default LoginPage;
