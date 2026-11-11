'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, getStoredTokens, setStoredTokens } from '@/features/api';

export interface WebUser {
  id: string;
  email: string;
  fullName: string;
  homeCity?: string;
  roles: string[];
}

interface AuthContextValue {
  user: WebUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<WebUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WebUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<WebUser>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
      setStoredTokens(null, null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshUser();
  }, []);

  async function login(email: string, password: string): Promise<WebUser> {
    const res = await apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: WebUser;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceInfo: 'Herway Web Console' }),
    });
    setStoredTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    return res.user;
  }

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless of network response
    }
    setStoredTokens(null, null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useWebAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useWebAuth must be used inside AuthProvider');
  return ctx;
}
