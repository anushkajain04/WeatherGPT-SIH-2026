import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { getMe, updateMe, logout as apiLogout } from '../api';
import { setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

function normalizeUser(raw) {
  if (!raw) return null;
  const contact = raw.phone || raw.email || raw.contact || '';
  const preferredLanguage =
    raw.preferredLanguage ||
    (typeof raw.language === 'string' && raw.language.length <= 3 ? raw.language : 'en');

  return {
    ...raw,
    name: raw.name || null,
    contact,
    role: raw.role || 'normal_user',
    location: raw.location || 'Pune, Maharashtra',
    preferredLanguage,
    language: preferredLanguage,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check existing session on initial load
  useEffect(() => {
    let isMounted = true;
    async function initSession() {
      try {
        const res = await getMe();
        if (isMounted && res?.user) {
          setUser(normalizeUser(res.user));
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initSession();

    // Register 401 callback from API client
    setUnauthorizedHandler(() => {
      if (isMounted) setUser(null);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = (userData) => {
    setUser(normalizeUser(userData));
  };

  const logout = async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  };

  const updateUser = async (profileUpdates) => {
    try {
      const res = await updateMe(profileUpdates);
      if (res?.user) {
        const updated = normalizeUser(res.user);
        setUser(updated);
        return updated;
      }
    } catch (err) {
      setError(err?.message || 'Failed to update profile');
      throw err;
    }
  };

  const refreshUser = async () => {
    try {
      const res = await getMe();
      if (res?.user) {
        const refreshed = normalizeUser(res.user);
        setUser(refreshed);
        return refreshed;
      }
    } catch {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      logout,
      updateUser,
      refreshUser,
      setUser,
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
