import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { getAccessToken, mobileApi, saveTokens } from '@/services/apiClient';
import { disconnectRealtimeSocket } from '@/services/realtimeSocket';
import { supabase } from '@/services/supabaseClient';

export interface MobileBuddyProfile {
  id: string;
  headline: string;
  servicesOffered: string[];
  languages: string[];
  hourlyRateInr: number;
  isAvailable: boolean;
  city: string;
  ratingAverage: number;
  reviewCount: number;
  isVerified: boolean;
}

export interface MobileUser {
  id: string;
  email: string;
  fullName: string;
  homeCity?: string;
  bio?: string;
  dateOfBirth?: string | null;
  gender?: string;
  avatarUrl?: string | null;
  travelPreferencesJson?: Record<string, unknown> | null;
  buddyProfile?: MobileBuddyProfile | null;
  roles: string[];
  languages: string[];
  interests: string[];
  preferredDestinations?: string[];
  discoverableAsTraveller?: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
}

interface AuthContextValue {
  user: MobileUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<MobileUser>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    homeCity: string;
    dateOfBirth?: string;
    consentAccepted: boolean;
  }) => Promise<MobileUser>;
  signInWithSupabaseOAuth: (provider: 'google' | 'apple') => Promise<void>;
  exchangeSupabaseToken: (supabaseAccessToken: string) => Promise<MobileUser>;
  updateLocalUser: (patch: Partial<MobileUser>) => Promise<void>;
  refreshProfile: () => Promise<MobileUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_KEY = 'herway_mobile_user_v2';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const exchangeInFlightRef = useRef<Promise<MobileUser> | null>(null);

  async function refreshProfile(): Promise<MobileUser | null> {
    let accessToken = await getAccessToken();
    if (!accessToken && supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        try {
          return await exchangeSupabaseToken(data.session.access_token);
        } catch {
          // Fall through to unauthenticated state if backend exchange fails
        }
      }
    }
    if (!accessToken) {
      await AsyncStorage.removeItem(USER_KEY);
      setUser(null);
      setToken(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await mobileApi<MobileUser>('/auth/me');
      const latestToken = await getAccessToken();
      setToken(latestToken);
      setUser(me);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(me));
      return me;
    } catch {
      await saveTokens(null, null);
      await AsyncStorage.removeItem(USER_KEY);
      setUser(null);
      setToken(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [cachedRaw, cachedToken] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          getAccessToken(),
        ]);
        if (cachedRaw && cachedToken) {
          setUser(JSON.parse(cachedRaw) as MobileUser);
          setToken(cachedToken);
          setLoading(false);
        }
      } catch {
        // Ignore cache parse issues
      }
      refreshProfile();
    })();
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.access_token) {
        const existingToken = await getAccessToken();
        if (!existingToken) {
          try {
            await exchangeSupabaseToken(session.access_token);
          } catch {
            // Surface exchange errors when user triggers login explicitly
          }
        }
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function persistSession(accessToken: string, refreshToken: string, nextUser: MobileUser) {
    await saveTokens(accessToken, refreshToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(accessToken);
    setUser(nextUser);
  }

  async function login(email: string, password: string): Promise<MobileUser> {
    const res = await mobileApi<{
      accessToken: string;
      refreshToken: string;
      user: MobileUser;
    }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, deviceInfo: 'Herway Client' }),
      },
      null,
    );
    await persistSession(res.accessToken, res.refreshToken, res.user);
    return res.user;
  }

  async function register(payload: {
    email: string;
    password: string;
    fullName: string;
    homeCity: string;
    dateOfBirth?: string;
    consentAccepted: boolean;
  }): Promise<MobileUser> {
    const res = await mobileApi<{
      accessToken: string;
      refreshToken: string;
      user: MobileUser;
    }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      null,
    );
    await persistSession(res.accessToken, res.refreshToken, res.user);
    return res.user;
  }

  async function exchangeSupabaseToken(supabaseAccessToken: string): Promise<MobileUser> {
    if (exchangeInFlightRef.current) {
      return exchangeInFlightRef.current;
    }
    const promise = (async () => {
      const res = await mobileApi<{
        accessToken: string;
        refreshToken: string;
        user: MobileUser;
      }>(
        '/auth/supabase-exchange',
        {
          method: 'POST',
          body: JSON.stringify({ supabaseAccessToken, deviceInfo: 'Herway Client' }),
        },
        null,
      );
      await persistSession(res.accessToken, res.refreshToken, res.user);
      return res.user;
    })();
    exchangeInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      exchangeInFlightRef.current = null;
    }
  }

  async function signInWithSupabaseOAuth(provider: 'google' | 'apple'): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase Auth is not configured in EXPO_PUBLIC_SUPABASE_URL.');
    }
    const label = provider === 'google' ? 'Google' : 'Apple';
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: supabaseAnonKey },
        });
        if (res.ok) {
          const settings = (await res.json()) as { external?: Record<string, boolean> };
          if (settings.external && settings.external[provider] === false) {
            throw new Error(
              `${label} Sign-In is disabled in your Supabase project. Enable ${label} under Supabase Dashboard → Authentication → Sign In / Providers, or use email & password above.`,
            );
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('disabled in your Supabase project')) {
          throw err;
        }
      }
    }

    const redirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/login`
        : Linking.createURL('login');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });
    if (error) {
      throw new Error(error.message);
    }
    if (Platform.OS !== 'web' && data?.url) {
      await Linking.openURL(data.url);
    }
  }

  async function updateLocalUser(patch: Partial<MobileUser>) {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...patch };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  }

  async function logout() {
    try {
      if (token) await mobileApi('/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless of network connectivity
    }
    try {
      await supabase?.auth.signOut();
    } catch {
      // Clear Supabase session regardless of network connectivity
    }
    disconnectRealtimeSocket();
    await saveTokens(null, null);
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        signInWithSupabaseOAuth,
        exchangeSupabaseToken,
        updateLocalUser,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
