import type { AuthProvider } from '@refinedev/core';
import { API_URL } from './config/constants';

export const authProvider: AuthProvider = {
  login: async ({ credential }) => {
    if (!credential) {
      return {
        success: false,
        error: { name: 'LoginError', message: 'No credential token received from Google' },
      };
    }

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${credential}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: { name: 'Auth Error', message: errorData.error || 'Server rejected login' },
        };
      }

      const data = await response.json();
      sessionStorage.setItem('access_token', credential);
      sessionStorage.setItem('user', JSON.stringify(data.user));

      return {
        success: true,
        redirectTo: '/dashboard',
      };
    } catch (error: any) {
      return {
        success: false,
        error: { name: 'Server Error', message: error.message || 'Unable to connect to server' },
      };
    }
  },

  logout: async () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    return { success: true, redirectTo: '/login' };
  },

  check: async () => {
    const currentToken = sessionStorage.getItem('access_token');
    const currentUser = sessionStorage.getItem('user');

    if (currentToken && currentUser) {
      return { authenticated: true };
    }

    // Dev mode bypass option
    if (currentToken === 'dev-bypass-token') {
      return { authenticated: true };
    }

    return { authenticated: false, redirectTo: '/login' };
  },

  getPermissions: async () => null,

  getIdentity: async () => {
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return {
        id: user.teacherId,
        name: user.full_name || user.name,
        email: user.email,
      };
    }
    return null;
  },

  onError: async (error) => {
    if (error?.status === 401 || error?.status === 403) {
      return { logout: true, redirectTo: '/login' };
    }
    return { error };
  },
};