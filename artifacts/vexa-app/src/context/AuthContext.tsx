import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  balance: number;
  accountNumber: string;
  referralCode: string;
  pin: string;
  level: number;
  verified: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  profilePhoto: string | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  verifyPasscode: (passcode: string) => Promise<boolean>;
  signIn: (phone: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (name: string, phone: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updatePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  setInitialTransferPin: (newPin: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (name: string, email: string, phone: string) => Promise<void>;
  updateProfilePhoto: (photo: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@vexa.app`;
}

function genAccountNumber(): string {
  return '9' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
}

const PROFILE_LOAD_TIMEOUT_MS = 10000;
const SESSION_RESTORE_TIMEOUT_MS = 12000;
const LAST_PROFILE_CACHE_KEY = 'vexa_last_profile_cache';

function readCachedProfile(): { user: User; profilePhoto: string | null } | null {
  try {
    const raw = localStorage.getItem(LAST_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.user?.id || !cached.user.accountNumber) return null;
    return cached;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cachedProfile = readCachedProfile();
  const [user, setUser]               = useState<User | null>(cachedProfile?.user ?? null);
  const [session, setSession]         = useState<Session | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(cachedProfile?.profilePhoto ?? null);
  const [loading, setLoading]         = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, showLoading = true) => {
    if (showLoading) setLoading(true);
    setProfileError(null);
    const profileRequest = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    const timeoutRequest = new Promise<{
      data: null;
      error: { message: string };
    }>(resolve => {
      window.setTimeout(() => resolve({
        data: null,
        error: { message: 'Profile request timed out' },
      }), PROFILE_LOAD_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([profileRequest, timeoutRequest]);

    if (error || !data) {
      console.error('[Auth] fetchProfile error:', error?.message);
      setLoading(false);
      setProfileError('We could not load your profile. Your session is still active.');
      return;
    }

    setUser({
      id:            data.id,
      name:          data.name,
      email:         data.email ?? '',
      phone:         data.phone,
      balance:       Number(data.balance ?? 0),
      accountNumber: data.account_number,
      referralCode:  data.referral_code ?? '',
      pin:           data.pin,
      level:         data.level,
      verified:      data.verified,
    });
    setProfilePhoto(data.profile_photo ?? null);
    try {
      localStorage.setItem(LAST_PROFILE_CACHE_KEY, JSON.stringify({
        user: {
          id: data.id,
          name: data.name,
          email: data.email ?? '',
          phone: data.phone,
          balance: Number(data.balance ?? 0),
          accountNumber: data.account_number,
          referralCode: data.referral_code ?? '',
          pin: data.pin,
          level: data.level,
          verified: data.verified,
        },
        profilePhoto: data.profile_photo ?? null,
      }));
    } catch {
      // Cached data is only an instant-render optimization.
    }
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await fetchProfile(session.user.id, false);
  }, [fetchProfile, session?.user?.id]);

  useEffect(() => {
    let mounted = true;
    let restoreSettled = false;

    const applySession = async (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setUser(null);
        setProfilePhoto(null);
        setProfileError(null);
        setLoading(false);
        return;
      }
      await fetchProfile(nextSession.user.id);
    };

    // Subscribe before restoring the session so a refresh cannot miss an auth event.
    // Supabase recommends keeping this callback synchronous: starting another
    // Supabase request directly inside it can block session restoration.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (mounted) void applySession(nextSession);
      }, 0);
    });

    const restoreTimer = window.setTimeout(() => {
      if (!mounted || restoreSettled) return;
      console.warn('[Auth] Session restoration timed out; showing sign-in.');
      setSession(null);
      setUser(null);
      setProfilePhoto(null);
      setProfileError(null);
      setLoading(false);
    }, SESSION_RESTORE_TIMEOUT_MS);

    void supabase.auth.getSession()
      .then(({ data: { session: restoredSession } }) => {
        restoreSettled = true;
        window.clearTimeout(restoreTimer);
        void applySession(restoredSession);
      })
      .catch(error => {
        restoreSettled = true;
        window.clearTimeout(restoreTimer);
        console.error('[Auth] Session restoration failed:', error);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setProfilePhoto(null);
        setProfileError(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      window.clearTimeout(restoreTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (phone: string, passcode: string): Promise<{ success: boolean; error?: string }> => {
    const email = phoneToEmail(phone);
    const { error } = await supabase.auth.signInWithPassword({ email, password: passcode });
    if (error) {
      return { success: false, error: 'Invalid phone number or passcode' };
    }
    return { success: true };
  };

  const signUp = async (
    name: string,
    phone: string,
    passcode: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const normalized    = normalizePhone(phone);
    const email         = `${normalized}@vexa.app`;
    const accountNumber = genAccountNumber();
    const referralCode  = 'VEXA-' + accountNumber.slice(-4);

    // Pass user data as metadata so the DB trigger can create the profile
    // even when email confirmation is enabled (no session yet at that point)
    const { data, error } = await supabase.auth.signUp({
      email,
      password: passcode,
      options: {
        data: { name, phone, account_number: accountNumber, referral_code: referralCode },
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already registered') ||
          error.message?.toLowerCase().includes('already exists')) {
        return { success: false, error: 'An account with this phone number already exists' };
      }
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'Sign up failed. Please try again.' };
    }

    // The DB trigger (handle_new_user) creates the profile automatically.
    // If there is a session (email confirmation OFF), also upsert to ensure
    // all fields are correct in case the trigger ran with partial data.
    if (data.session) {
      await supabase.from('profiles').upsert({
        id: data.user.id, name, email: '', phone,
        account_number: accountNumber, pin: '0000',
        level: 1, verified: false, balance: 0, referral_code: referralCode,
      }, { onConflict: 'id' });
    }

    return { success: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem(LAST_PROFILE_CACHE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
  };

  const setInitialTransferPin = async (newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.pin !== '0000') return { success: false, error: 'Use Change PIN to update an existing PIN' };
    const { error } = await supabase.from('profiles').update({ pin: newPin }).eq('id', user.id);
    if (error) return { success: false, error: 'Failed to save PIN. Please try again.' };
    setUser(prev => prev ? { ...prev, pin: newPin } : null);
    return { success: true };
  };

  const updatePin = async (oldPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.pin !== oldPin) return { success: false, error: 'Current PIN is incorrect' };

    const { error } = await supabase.from('profiles').update({ pin: newPin }).eq('id', user.id);
    if (error) return { success: false, error: 'Failed to update PIN' };

    setUser(prev => prev ? { ...prev, pin: newPin } : null);
    return { success: true };
  };

  const updatePassword = async (oldPass: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Verify old password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email:    phoneToEmail(user.phone),
      password: oldPass,
    });
    if (verifyError) return { success: false, error: 'Current passcode is incorrect' };

    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) return { success: false, error: 'Failed to update passcode' };

    return { success: true };
  };

  const verifyPasscode = async (passcode: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(user.phone),
      password: passcode,
    });
    return !error;
  };

  const updateProfile = async (name: string, email: string, phone: string): Promise<void> => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ name, email, phone }).eq('id', user.id);
    if (!error) {
      setUser(prev => prev ? { ...prev, name, email, phone } : null);
      await refreshProfile();
    }
  };

  const updateProfilePhoto = async (photo: string | null): Promise<void> => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ profile_photo: photo }).eq('id', user.id);
    if (!error) {
      setProfilePhoto(photo);
      await refreshProfile();
    }
  };

  return (
    <AuthContext.Provider value={{
      user, session, isAuthenticated: !!user, profilePhoto, loading, profileError, refreshProfile, verifyPasscode,
      signIn, signUp, signOut,
      updatePin, setInitialTransferPin, updatePassword, updateProfile, updateProfilePhoto,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
