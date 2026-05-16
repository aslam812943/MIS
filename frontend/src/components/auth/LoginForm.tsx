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

  // Update default email based on role for demo purposes
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

  /**
   * Handles the submission of the login form.
   */
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
    <div className="glass p-8 rounded-3xl w-full max-w-md animate-in fade-in zoom-in duration-500 shadow-2xl">
      <div className="text-center mb-8">
        <div className="inline-block px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase tracking-wider mb-4 border border-brand-primary/20">
          {getRoleLabel()} Portal
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Sign In</h1>
        <p className="text-slate-400 text-sm">Enter your credentials to access your dashboard</p>
      </div>
      
      <form onSubmit={handleLoginSubmission} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-300 ml-1">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" title="Password" className="text-sm font-medium text-slate-300 ml-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
            required
          />
        </div>

        <div className="flex justify-end -mt-4">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
          >
            Forgot Password?
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-brand-primary/25 disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Sign In
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
