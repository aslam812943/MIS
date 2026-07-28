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
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    const roleEmails: Record<UserRole, string> = {
      [UserRole.ADMIN]: 'admin@gmail.com',
      [UserRole.CEO]: 'ceo@mis.com',
      [UserRole.MANAGING_DIRECTOR]: 'md@mis.com',
      [UserRole.DIRECTOR]: 'director@mis.com',
      [UserRole.EXECUTIVE]: 'executive@mis.com',
      [UserRole.HOD]: 'hod@gmail.com',
      [UserRole.REGIONAL_MANAGER]: 'regional@mis.com',
      [UserRole.EMPLOYEE]: 'employee@gmail.com',
      [UserRole.HR]: 'hr@gmail.com',
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
    <div className="glass rounded-[var(--radius-2xl)] p-4 sm:p-6 w-full shadow-2xl mis-animate-in">
      <div className="text-center mb-3 sm:mb-4">
        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 mis-badge mis-badge-info">
          {getRoleLabel()} Portal
        </div>
        <h2 className="text-lg sm:text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Sign In</h2>
        <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
          Enter your credentials to access your dashboard
        </p>
      </div>

      <form onSubmit={handleLoginSubmission} className="space-y-3 sm:space-y-4">
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
          <div className="relative w-full">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mis-input pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:opacity-70 focus:outline-none"
              style={{ background: 'none', border: 'none', padding: 0 }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
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
          className="mis-btn mis-btn-primary w-full justify-center py-2.5"
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
