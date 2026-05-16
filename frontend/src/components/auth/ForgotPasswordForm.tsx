import React, { useState } from 'react';
import { authService } from '../../services/auth.service';
import { UserRole } from '../../types/user.types';

interface ForgotPasswordFormProps {
  selectedRole: UserRole;
  onBackToLogin: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ selectedRole, onBackToLogin }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.requestOTP(email, selectedRole);
      setSuccess('OTP has been sent to your email.');
      // Small delay before moving to step 2 so user can see the success message
      setTimeout(() => {
        setStep(2);
        setSuccess(''); // Clear success message for Step 2
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(email, otp, newPassword, selectedRole);
      setSuccess('Password changed successfully! Redirecting to login...');
      setTimeout(() => {
        onBackToLogin();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
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
          {getRoleLabel()} Security
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {step === 1 ? 'Forgot Password' : 'Reset Password'}
        </h1>
        <p className="text-slate-400 text-sm">
          {step === 1 
            ? 'Enter your email to receive a 6-digit verification code' 
            : 'Enter the code sent to your email and your new password'}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleRequestOTP} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="reset-email" className="text-sm font-medium text-slate-300 ml-1">
              Email Address
            </label>
            <input
              type="email"
              id="reset-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
              required
            />
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
                Send Reset Code
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="otp" className="text-sm font-medium text-slate-300 ml-1">
              6-Digit Code
            </label>
            <input
              type="text"
              id="otp"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] font-bold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" title="New Password" className="text-sm font-medium text-slate-300 ml-1">
              New Password
            </label>
            <input
              type="password"
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" title="Confirm Password" className="text-sm font-medium text-slate-300 ml-1">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm py-3 px-4 rounded-xl flex items-center gap-2">
              <span>✅</span> {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-brand-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      )}

      <button
        onClick={onBackToLogin}
        className="w-full mt-6 text-slate-400 hover:text-white text-sm font-medium transition-colors"
      >
        ← Back to Sign In
      </button>
    </div>
  );
};

export default ForgotPasswordForm;
