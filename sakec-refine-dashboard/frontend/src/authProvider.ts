import type { AuthProvider } from '@refinedev/core';
import { msalInstance, loginRequest } from './config/msalConfig';

import { API_URL } from './config/constants';

export const authProvider: AuthProvider = {
  login: async () => {
    try {
      if (typeof msalInstance.initialize === 'function') {
        try { await msalInstance.initialize(); } catch (e) { /* ignore */ }
      }
      await msalInstance.loginRedirect(loginRequest);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: { name: 'LoginError', message: error?.message || 'Login failed' },
      };
    }
  },

  logout: async () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    try {
      await msalInstance.logoutRedirect();
    } catch {}
    return { success: true, redirectTo: '/login' };
  },

check: async () => {
    // --- 1. FAST TRACK ---
    // If we already have the VIP pass, let the user stay where they are.
    const currentToken = sessionStorage.getItem('access_token');
    const currentUser = sessionStorage.getItem('user');
    
    if (currentToken && currentUser) {
      return { authenticated: true };
    }

    console.log("[Auth] 1. Checking authentication...");
    
    // --- God Mode Short-Circuit ---
    if (currentToken === 'dev-bypass-token') return { authenticated: true };
    
    try {
      if (typeof msalInstance.initialize === 'function') {
        try { await msalInstance.initialize(); } catch (e) {}
      }

      console.log("[Auth] 2. Waiting for MSAL redirect results...");
      const redirectResponse = await msalInstance.handleRedirectPromise().catch(() => null);

      const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
      if (account) {
        msalInstance.setActiveAccount(account);
        console.log("[Auth] 3. Microsoft Account Found:", account.username);
      } else {
        console.log("[Auth] 3. No Microsoft account found. Booting to login.");
        return { authenticated: false, redirectTo: '/login' };
      }

      // 4. Verify with SAKEC Backend if no local session exists
      if (!currentToken) {
        console.log("[Auth] 4. Getting secure token for backend...");
        let tokenToSend = redirectResponse?.accessToken;

        if (!tokenToSend) {
           const silentResult = await msalInstance.acquireTokenSilent({
               ...loginRequest,
               account: account
           });
           tokenToSend = silentResult.accessToken;
        }

        console.log("[Auth] 5. Sending POST request to backend...");
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenToSend}`,
          },
        });

        console.log("[Auth] 6. Backend Responded with Status:", response.status);

        if (response.ok) {
          const data = await response.json();
          sessionStorage.setItem('access_token', tokenToSend);
          sessionStorage.setItem('user', JSON.stringify(data.user));
          
          console.log("[Auth] 7. Success! FORCING HARD REDIRECT...");
          
          // --- THE NUCLEAR OPTION (NEW) ---
          // This forces the browser to physically change the URL and refresh the app state.
          window.location.replace("/"); 
          
          return { authenticated: true };
        } else {
          console.error("[Auth] Backend rejected the login.");
          sessionStorage.removeItem('access_token');
          return { authenticated: false, redirectTo: '/login' };
        }
      }

      return { authenticated: true };
    } catch (error) {
      console.error("[Auth] Critical Error during check:", error);
      return { authenticated: false, redirectTo: '/login' };
    }
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
    if (error?.statusCode === 401) {
      return { logout: true, redirectTo: '/login' };
    }
    return { error };
  },
};