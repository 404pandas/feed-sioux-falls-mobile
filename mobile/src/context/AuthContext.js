import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setToken, clearToken, setUnauthorizedHandler } from '../api/client';
import { startAutoSync, syncQueue } from '../utils/offlineQueue';
import { offerToStaffOnce, syncNotifications } from '../notifications';

const AuthContext = createContext(null);

// The logged-in person, saved on the phone so opening the app with no
// signal (outreach, mostly) still shows the staff screens instead of
// dropping back to the public ones. The server still checks the login on
// every request.
const USER_KEY = 'fsf_user';

function isStaffRole(role) {
  return role === 'admin' || role === 'volunteer';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = guest / logged out
  const [loading, setLoading] = useState(true);
  const userRef = useRef(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  async function rememberUser(next) {
    setUser(next);
    if (next) await AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
    else await AsyncStorage.removeItem(USER_KEY).catch(() => {});
  }

  async function logout() {
    await clearToken();
    await rememberUser(null);
    // The phone stays signed up for any public notifications, but stops
    // getting staff notices and team chat.
    syncNotifications();
  }

  useEffect(() => {
    // Try to restore a session on app launch.
    (async () => {
      try {
        const me = await api.me();
        await rememberUser(me);
      } catch (err) {
        if (typeof err.status === 'number') {
          // The server answered: no valid login. Not an error state.
          await clearToken();
          await AsyncStorage.removeItem(USER_KEY).catch(() => {});
        } else {
          // No signal: keep whoever was logged in.
          const cached = await AsyncStorage.getItem(USER_KEY).catch(() => null);
          if (cached) setUser(JSON.parse(cached));
        }
      } finally {
        setLoading(false);
        syncNotifications();
      }
    })();

    // A login that expires mid-use (they last 30 days): say so once, then
    // go back to the log in screen. Anything waiting in the offline queue
    // stays queued and sends after logging back in.
    let asking = false;
    setUnauthorizedHandler(() => {
      if (!userRef.current || asking) return;
      asking = true;
      Alert.alert('Please log in again', 'Your login has expired. Anything waiting to sync is saved and will send after you log in.', [
        {
          text: 'OK',
          onPress: () => {
            asking = false;
            logout();
          },
        },
      ]);
    });

    const unsubscribe = startAutoSync();
    return () => {
      setUnauthorizedHandler(null);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(userId, pin) {
    const { token, user: loggedInUser } = await api.login(userId, pin);
    await setToken(token);
    await rememberUser(loggedInUser);
    syncQueue();
    // Staff are asked once to turn notifications on; everyone else's phone
    // just gets re-linked if they already had them on.
    if (isStaffRole(loggedInUser.role)) offerToStaffOnce();
    else syncNotifications();
    return loggedInUser;
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
