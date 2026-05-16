import axios from 'axios';
import { ROUTES } from '../constants/routes';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Interface representing the login response from the backend.
 */
interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  session: {
    access_token: string;
    [key: string]: unknown;
  };
}

/**
 * Service to handle authentication-related API calls and session management.
 * Provides abstraction between UI components and the backend API.
 */
export const authService = {
  /**
   * Authenticates a user against the backend API.
   * On success, stores user data in local storage.
   * 
   * @param email User's email address.
   * @param password User's password.
   * @param role User's selected role.
   * @returns A Promise resolving to the authentication data.
   */
  async login(email: string, password: string, role: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_URL}/auth/login`, {
        email,
        password,
        role
      }, {
        withCredentials: true // Essential for sending/receiving cookies
      });

      const authData = response.data;
      
      // Persistent storage of user data
      localStorage.setItem('user', JSON.stringify(authData.user));
      
      return authData;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Authentication failed');
      }
      throw error;
    }
  },

  /**
   * Clears the current user session from local storage and backend cookies.
   */
  async logout(): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      window.location.href = ROUTES.LOGIN;
    }
  },

  /**
   * Retrieves the currently logged-in user's profile from local storage.
   */
  getCurrentUser(): AuthResponse['user'] | null {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Checks if a user is currently authenticated (has a profile in local storage).
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('user');
  },

  /**
   * Requests a password reset OTP.
   */
  async requestOTP(email: string, role: string): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/forgot-password/request-otp`, { email, role });
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to request OTP');
      }
      throw error;
    }
  },

  /**
   * Resets the password using the OTP.
   */
  async resetPassword(email: string, otp: string, newPassword: string, role: string): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/forgot-password/reset`, { email, otp, newPassword, role });
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Failed to reset password');
      }
      throw error;
    }
  }
};
