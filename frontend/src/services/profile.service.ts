import api from './api';
import type { User } from '../types/user.types';

export const profileService = {
  /**
   * Fetches the current user profile from the backend.
   */
  async getProfile(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Updates the user profile details and avatar.
   */
  async updateProfile(data: { full_name?: string; phone_number?: string }, avatarFile?: File): Promise<User> {
    const formData = new FormData();
    if (data.full_name) formData.append('full_name', data.full_name);
    if (data.phone_number) formData.append('phone_number', data.phone_number);
    if (avatarFile) formData.append('avatar', avatarFile);

    const response = await api.patch<User>('/auth/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // Update local storage cache
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  },

  /**
   * Changes the user's password.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.patch('/auth/change-password', { currentPassword, newPassword });
  }
};
