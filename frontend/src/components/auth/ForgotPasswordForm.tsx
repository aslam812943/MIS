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
      setTimeout(() => {
        setStep(2);
        setSuccess('');
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
    <div className="glass rounded-[var(--radius-2xl)] p-6 sm:p-8 w-full shadow-2xl mis-animate-in">
      <div className="text-center mb-7">
        <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 mis-badge mis-badge-info">
          {getRoleLabel()} Security
        </div>
        <h2 className="text-xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
          {step === 1 ? 'Forgot Password' : 'Reset Password'}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {step === 1
            ? 'Enter your email to receive a 6-digit verification code'
            : 'Enter the code sent to your email and your new password'}
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleRequestOTP} className="space-y-5">
          <div className="mis-field">
            <label htmlFor="reset-email" className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Email Address
            </label>
            <input
              type="email"
              id="reset-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="mis-input"
              required
            />
          </div>

          {error && <div className="mis-alert mis-alert-error"><span>{error}</span></div>}

          <button type="submit" disabled={loading} className="mis-btn mis-btn-primary w-full justify-center py-3">
            {loading ? (
              <span className="mis-spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} />
            ) : (
              'Send Reset Code'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="mis-field">
            <label htmlFor="otp" className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              6-Digit Code
            </label>
            <input
              type="text"
              id="otp"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="mis-input text-center text-2xl tracking-[0.5em] font-bold"
              required
            />
          </div>

          <div className="mis-field">
            <label htmlFor="new-password" title="New Password" className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              New Password
            </label>
            <input
              type="password"
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="mis-input"
              required
            />
          </div>

          <div className="mis-field">
            <label htmlFor="confirm-password" title="Confirm Password" className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="mis-input"
              required
            />
          </div>

          {error && <div className="mis-alert mis-alert-error"><span>{error}</span></div>}
          {success && <div className="mis-alert mis-alert-success"><span>{success}</span></div>}

          <button type="submit" disabled={loading} className="mis-btn mis-btn-primary w-full justify-center py-3">
            {loading ? (
              <span className="mis-spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} />
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onBackToLogin}
        className="w-full mt-5 text-sm font-medium transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        ← Back to Sign In
      </button>
    </div>
  );
};

export default ForgotPasswordForm;
