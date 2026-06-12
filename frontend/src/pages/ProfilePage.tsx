import React, { useState, useEffect } from 'react';
import { profileService } from '../services/profile.service';
import type { User } from '../types/user.types';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/layout/DashboardLayout';

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const profile = await profileService.getProfile();
      setUser(profile);
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.phone_number || '');
      setAvatarPreview(profile.avatar_url || null);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a valid image file (PNG, JPG, or GIF)');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be less than 2MB');
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneRegex = /^\d{10}$/;
    if (phoneNumber && !phoneRegex.test(phoneNumber)) {
      toast.error('Phone number must be exactly 10 digits (numbers only)');
      return;
    }

    if (!fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Saving your profile...');
    try {
      const updated = await profileService.updateProfile({
        full_name: fullName,
        phone_number: phoneNumber
      }, avatarFile || undefined);
      setUser(updated);
      toast.success('Profile details updated successfully!', { id: loadingToast });
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update profile details';
      toast.error(msg, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password for verification');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match. Please check and try again.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Security requirement: Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    const passToast = toast.loading('Verifying and updating password...');
    try {
      await profileService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Your password has been securely updated!', { id: passToast });
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Password update failed. Please verify your current password.';
      toast.error(msg, { id: passToast });
    } finally {
      setSaving(false);
    }
  };

  const displayInitial =
    (fullName && fullName.charAt(0).toUpperCase()) ||
    (user?.email && user.email.charAt(0).toUpperCase()) ||
    '?';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="mis-loading-center">
          <div className="mis-spinner" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in">
        <div className="mis-profile-layout">
          <header className="mis-page-header mb-0">
            <h1 className="mis-page-title">My Profile</h1>
            <p className="mis-page-desc">Manage your personal information and security settings.</p>
          </header>

          {/* Identity strip — avatar never overlaps section titles */}
          <div className="mis-profile-hero">
            <div className="mis-profile-avatar-block">
              <div className="mis-profile-avatar" aria-hidden={!!avatarPreview}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" />
                ) : (
                  displayInitial
                )}
              </div>
              <label className="mis-profile-avatar-edit">
                Change photo
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </label>
            </div>
            <div className="mis-profile-identity">
              <h2>{fullName || 'Your name'}</h2>
              <p>{user?.email}</p>
              <span className="mis-profile-role-pill">
                {user?.role?.replace(/_/g, ' ') || 'member'}
              </span>
            </div>
          </div>

          <div className="mis-profile-body">
            <div className="flex flex-col gap-4 min-w-0">
              <section className="mis-profile-section">
                <div className="mis-profile-section-head">
                  <h3>Personal Information</h3>
                </div>
                <div className="mis-profile-section-body">
                  <form onSubmit={handleProfileUpdate}>
                    <div className="mis-profile-form-grid">
                      <div className="mis-field">
                        <label className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                          Full Name
                        </label>
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mis-input" required />
                      </div>
                      <div className="mis-field">
                        <label className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="mis-input"
                          placeholder="10-digit number"
                        />
                      </div>
                    </div>
                    <div className="mis-profile-actions">
                      <button type="submit" disabled={saving} className="mis-btn mis-btn-primary min-w-[9rem]">
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              <section className="mis-profile-section">
                <div className="mis-profile-section-head">
                  <h3>Professional Details</h3>
                </div>
                <div className="mis-profile-section-body">
                  <div className="mis-profile-readonly-grid">
                    <div className="mis-readonly-box">
                      <span className="label">Access Role</span>
                      <span className="value">{user?.role?.replace(/_/g, ' ') || '—'}</span>
                    </div>
                    <div className="mis-readonly-box">
                      <span className="label">Assigned Branch</span>
                      <span className="value" style={{ textTransform: 'none' }}>
                        {user?.branch_name || user?.branch_id || 'Global / Main'}
                      </span>
                    </div>
                    <div className="mis-readonly-box">
                      <span className="label">Department</span>
                      <span className="value" style={{ textTransform: 'none' }}>
                        {user?.department_name || user?.department_id || 'Not Assigned'}
                      </span>
                    </div>
                  </div>
                  <p className="mis-alert mis-alert-info mt-4 mb-0">
                    Managed by your administrator — not editable on this page.
                  </p>
                </div>
              </section>

              <section className="mis-profile-section">
                <div className="mis-profile-section-head">
                  <h3>Security Settings</h3>
                </div>
                <div className="mis-profile-section-body">
                  <form onSubmit={handlePasswordChange}>
                    <div className="mis-profile-form-grid">
                      <div className="mis-field span-full">
                        <label className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="mis-input"
                          placeholder="Verify your identity"
                        />
                      </div>
                      <div className="mis-field">
                        <label className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                          New Password
                        </label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mis-input" placeholder="••••••••" />
                      </div>
                      <div className="mis-field">
                        <label className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                          Confirm New Password
                        </label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mis-input" placeholder="••••••••" />
                      </div>
                    </div>
                    <div className="mis-profile-actions">
                      <button type="submit" disabled={saving || !newPassword} className="mis-btn mis-btn-ghost min-w-[9rem]">
                        {saving ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            </div>

            <aside className="mis-profile-aside">
              <div className="mis-profile-info-card accent-edge">
                <h4>Profile tip</h4>
                <p>Keep your phone number up to date so administrators and security alerts can reach you.</p>
              </div>
              <div className="mis-profile-info-card">
                <h4>Account status</h4>
                <div className="mis-profile-status-row">
                  <span className="mis-profile-status-dot" aria-hidden />
                  <span className="capitalize">{user?.status || 'Active'}</span>
                </div>
                <div className="mis-profile-member-since">
                  Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
