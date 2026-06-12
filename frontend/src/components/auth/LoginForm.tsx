import React, { useState, useEffect } from 'react';
import { authService } from '../../services/auth.service';
import { ROUTES } from '../../constants/routes';
import { UserRole } from '../../types/user.types';

interface LoginFormProps {
  selectedRole: UserRole;
  onForgotPassword: () => void;
}

/**
 * Component for the authenticated login form.
 * Handles user input, validation, and interaction with the Auth Service.
 */
const LoginForm: React.FC<LoginFormProps> = ({ selectedRole, onForgotPassword }) => {
  const [email, setEmail] = useState<string>('admin@gmail.com');
  const [password, setPassword] = useState<string>('111111');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const roleEmails: Record<UserRole, string> = {
      [UserRole.ADMIN]: 'admin@gmail.com',
      [UserRole.CEO]: 'ceo@mis.com',
      [UserRole.MANAGING_DIRECTOR]: 'md@mis.com',
      [UserRole.DIRECTOR]: 'director@mis.com',
      [UserRole.EXECUTIVE]: 'executive@mis.com',
      [UserRole.HOD]: 'hod@mis.com',
      [UserRole.REGIONAL_MANAGER]: 'regional@mis.com',
      [UserRole.EMPLOYEE]: 'employee@mis.com',
    };
    setEmail(roleEmails[selectedRole] || 'user@mis.com');
  }, [selectedRole]);

  const handleLoginSubmission = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login(email, password, selectedRole);
      window.location.href = ROUTES.DASHBOARD;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = () => {
    return selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1).replace('_', ' ');
  };

  return (
    <div className="glass rounded-[var(--radius-2xl)] p-6 sm:p-8 w-full shadow-2xl mis-animate-in">
      <div className="text-center mb-7">
        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 mis-badge mis-badge-info">
          {getRoleLabel()} Portal
        </div>
        <h2 className="text-xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>Sign In</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Enter your credentials to access your dashboard
        </p>
      </div>

      <form onSubmit={handleLoginSubmission} className="space-y-5">
        <div className="mis-field">
          <label htmlFor="email" className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="mis-input"
            required
          />
        </div>

        <div className="mis-field">
          <label htmlFor="password" title="Password" className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mis-input"
            required
          />
        </div>

        <div className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs font-semibold transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            Forgot Password?
          </button>
        </div>

        {error && (
          <div className="mis-alert mis-alert-error">
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mis-btn mis-btn-primary w-full justify-center py-3"
        >
          {loading ? (
            <span className="mis-spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} />
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
