import { supabase, supabaseAdmin } from '../config/supabase.js';
import type { IUserRepository } from '../repositories/interfaces/IUserRepository.js';

// Use the admin client to bypass RLS for backend operations
const client = supabaseAdmin || supabase;

export class ProfileService {
  constructor(private userRepository: IUserRepository) {}

  /**
   * Updates the user's profile metadata and optionally their avatar.
   * Includes backend validation and automatic old-file cleanup.
   */
  async updateProfile(userId: string, data: { full_name?: string; phone_number?: string }, file?: Express.Multer.File) {
    // 1. BACKEND VALIDATION (Defense in depth)
    if (data.full_name !== undefined) {
      const trimmedName = data.full_name.trim();
      if (trimmedName.length === 0) {
        throw new Error('Full Name cannot be empty.');
      }
      if (trimmedName.length < 2 || trimmedName.length > 50) {
        throw new Error('Full Name must be between 2 and 50 characters.');
      }
    }

    if (data.phone_number && !/^\d{10}$/.test(data.phone_number)) {
      throw new Error('Invalid phone number: Must be exactly 10 digits.');
    }

    let avatar_url = undefined;

    if (file) {
      // 2. FILE HARDENING
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedMimes.includes(file.mimetype)) {
        throw new Error('Security violation: Only image files (JPG, PNG, GIF) are allowed.');
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File too large: Maximum size is 2MB.');
      }

      // 3. CLEANUP OLD AVATAR (Prevent storage bloat)
      const existingUser = await this.userRepository.findById(userId);
      if (existingUser?.avatar_url) {
        try {
          const oldPath = existingUser.avatar_url.split('/public/avatars/').pop();
          if (oldPath) await client.storage.from('avatars').remove([oldPath]);
        } catch (e) {
          // Non-critical, just log and continue
          console.warn('Could not cleanup old avatar:', e);
        }
      }

      // 4. SECURE UPLOAD
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`; // Use timestamp for uniqueness
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await client.storage
        .from('avatars')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = client.storage.from('avatars').getPublicUrl(filePath);
      avatar_url = urlData.publicUrl;
    }

    const updateData: any = { ...data };
    if (avatar_url) updateData.avatar_url = avatar_url;

    try {
      await this.userRepository.update(userId, updateData);
      return await this.getProfile(userId);
    } catch (dbError) {
      throw new Error('Profile update failed. Please verify your data.');
    }
  }

  /**
   * Updates the user's password in Supabase Auth.
   */
  /**
   * Updates the user's password in Supabase Auth.
   * Now requires the current password for verification.
   */
  async changePassword(userId: string, email: string, currentPassword: string, newPassword: string) {
    try {
      const profile = await this.userRepository.findById(userId);
      if (!profile) throw new Error('User profile not found');
      // Verify against the account identity, which may differ from its contact email.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Verification failed: Current password is incorrect.');
      }

      // 2. If verification successful, update the password using Admin API
      const { error: updateError } = await client.auth.admin.updateUserById(userId, { 
        password: newPassword 
      });
      
      if (updateError) {
        throw new Error(`Failed to set new password: ${updateError.message}`);
      }
      
      return true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Fetches the current user profile.
   */
  async getProfile(userId: string) {
    const profile = await this.userRepository.findById(userId);
    if (profile && ['franchise_owner', 'franchise_staff'].includes(profile.role)) {
      const { data, error } = await client.from('franchise_users').select('login_email').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('Could not load franchise login');
      if (data?.login_email) return { ...profile, email: data.login_email };
    }
    return profile;
  }
}
