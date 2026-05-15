import React, { useState, useEffect } from 'react';
import { profileService } from '../services/profile.service';
import type { User } from '../types/user.types';
import toast from 'react-hot-toast';

const ProfilePage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Password Form State
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
      // Image Validation
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

    // Phone Number Validation: Exactly 10 digits
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-bold text-white">My Profile</h1>
        <p className="text-slate-400">Manage your personal information and security settings</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-2 space-y-8">
          <section className="glass p-8 rounded-3xl space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <span className="text-brand-primary">👤</span> Personal Information
            </h2>

            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="flex flex-col md:flex-row items-center gap-8 pb-6 border-b border-white/5">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 bg-slate-800 shadow-xl">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-slate-500 bg-slate-800">
                        {fullName.charAt(0) || user?.email.charAt(0)}
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-2 bg-brand-primary rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                    <span className="text-xs text-white font-bold">📷</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                </div>
                <div className="flex-1 space-y-1 text-center md:text-left">
                  <h3 className="text-lg font-medium text-white">{user?.email}</h3>
                  <p className="text-sm text-brand-primary uppercase font-bold tracking-wider">
                    {user?.role?.replace('_', ' ')} Portal Access
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-brand-primary/25 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>

          {/* Professional Details Section (Read Only) */}
          <section className="glass p-8 rounded-3xl space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <span className="text-brand-primary">🏢</span> Professional Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500 ml-1">Access Role</label>
                <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-slate-400 capitalize">
                  {user?.role?.replace('_', ' ')}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500 ml-1">Assigned Branch</label>
                <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-slate-400">
                  {user?.branch_name || user?.branch_id || 'Global / Main'}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500 ml-1">Department</label>
                <div className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-slate-400">
                  {user?.department_name || user?.department_id || 'Not Assigned'}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 bg-slate-800/30 p-3 rounded-lg border border-white/5">
              💡 These details are managed by the System Administrator and cannot be edited by users for security reasons.
            </p>
          </section>

          {/* Security Section */}
          <section className="glass p-8 rounded-3xl space-y-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <span className="text-brand-primary">🔒</span> Security Settings
            </h2>

            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                  placeholder="Verify your identity"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !newPassword}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-8 py-3 rounded-xl transition-all disabled:opacity-50"
                >
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-8">
          <section className="glass p-6 rounded-3xl border-l-4 border-brand-primary">
            <h3 className="font-bold text-white mb-2">Profile Tip</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Updating your profile helps other team members identify you within the MIS Portal. Ensure your phone number is correct for security alerts.
            </p>
          </section>

          <section className="glass p-6 rounded-3xl space-y-4">
            <h3 className="font-bold text-white">Account Status</h3>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-slate-300 capitalize">{user?.status || 'Active'}</span>
            </div>
            <div className="text-xs text-slate-500 pt-2 border-t border-white/5">
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
