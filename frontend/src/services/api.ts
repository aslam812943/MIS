import axios from 'axios';
import { apiErrorMessage } from '../utils/apiErrorMessage';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:5000/api');

/**
 * Global Axios instance with default configuration.
 * Automatically includes the authentication token in headers.
 */
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Enable cookies for all requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (Simplified as tokens are now handled by cookies)
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Normalize API failures before pages display toasts or error banners.
api.interceptors.response.use(
  response => response,
  error => {
    const message = apiErrorMessage(error);
    error.message = message;
    if (error.response) {
      const data = error.response.data;
      error.response.data = { ...(data && typeof data === 'object' ? data : {}), message };
    }
    return Promise.reject(error);
  }
);

// Response interceptor to handle unauthorized access (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear user data and redirect to login if token is invalid/expired
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
