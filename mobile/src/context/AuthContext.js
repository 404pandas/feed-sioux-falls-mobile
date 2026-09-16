import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, clearToken } from '../api/client';
import { startAutoSync } from '../utils/offlineQueue';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = guest / logged out
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to restore a session on app launch.
    (async () => {
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        // No valid session - stay logged out / guest. Not an error state.
      } finally {
        setLoading(false);
      }
    })();

    const unsubscribe = startAutoSync();
    return unsubscribe;
  }, []);

  async function login(userId, pin) {
    const { token, user: loggedInUser } = await api.login(userId, pin);
    await setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isGuest: !user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
