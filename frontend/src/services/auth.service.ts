import axios from 'axios';

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
   * On success, stores the session and user data in local storage.
   * 
   * @param email User's email address.
   * @param password User's password.
   * @returns A Promise resolving to the authentication data.
   * @throws Error if the API call fails or returns an error status.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const authData = response.data;
      
      // Persistent storage of session details
      localStorage.setItem('session', JSON.stringify(authData.session));
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
   * Clears the current user session from local storage.
   */
  logout(): void {
    localStorage.removeItem('session');
    localStorage.removeItem('user');
  },

  /**
   * Retrieves the currently logged-in user's profile from local storage.
   * 
   * @returns The user object or null if no session exists.
   */
  getCurrentUser(): AuthResponse['user'] | null {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Retrieves the current access token from the stored session.
   * 
   * @returns The access token string or null if not found.
   */
  getToken(): string | null {
    const sessionData = localStorage.getItem('session');
    if (!sessionData) return null;
    try {
      const session = JSON.parse(sessionData);
      return (session as Record<string, string>).access_token || null;
    } catch {
      return null;
    }
  }
};
