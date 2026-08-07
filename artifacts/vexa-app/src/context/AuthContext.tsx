import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  accountNumber: string;
  referralCode: string;
  pin: string;
  level: number;
  verified: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  profilePhoto: string | null;
  loading: boolean;
  signIn: (phone: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (name: string, phone: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
  verifyPasscode: (passcode: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updatePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  setInitialTransferPin: (newPin: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (name: string, email: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  updateProfilePhoto: (photo: string | null) => Promise<{ success: boolean; error?: string }>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        console.error('[Auth] session restore error:', error.message);
        setUser(null);
        setProfilePhoto(null);
        setLoading(false);
        return;
      }
      if (session?.user) {
        await fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    };

    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        void fetchProfile(session.user);
      } else {
        setUser(null);
        setProfilePhoto(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }) {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('[Auth] fetchProfile error:', error?.message);
      setUser(null);
      setProfilePhoto(null);
      setLoading(false);
      return;
    }

    // A profile is normally created by the database trigger. If an older
    // Supabase project does not have that trigger, create the row from the
    // authenticated user's metadata so the rest of the app can still use
    // one consistent, database-backed profile.
    let profile = data;
    if (!profile) {
      const metadata = authUser.user_metadata ?? {};
      const accountNumber = typeof metadata.account_number === 'string'
        ? metadata.account_number
        : genAccountNumber();
      const referralCode = typeof metadata.referral_code === 'string' && metadata.referral_code
        ? metadata.referral_code
        : `VEXA-${accountNumber.slice(-4)}`;
      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.id,
          name: typeof metadata.name === 'string' ? metadata.name : 'Vexa User',
          email: typeof metadata.email === 'string' ? metadata.email : '',
          phone: typeof metadata.phone === 'string' ? metadata.phone : '',
          account_number: accountNumber,
          pin: '0000',
          level: 1,
          verified: false,
          balance: 0,
          referral_code: referralCode,
        }, { onConflict: 'id' })
        .select('*')
        .single();

      if (createError || !createdProfile) {
        console.error('[Auth] profile creation error:', createError?.message);
        setUser(null);
        setProfilePhoto(null);
        setLoading(false);
        return;
      }
      profile = createdProfile;
    }

    const storedReferralCode = typeof profile.referral_code === 'string' ? profile.referral_code : '';
    const referralCode = storedReferralCode || `VEXA-${String(profile.account_number ?? '').slice(-4)}`;

    // Older rows may have an empty referral code. Persist the value once so
    // every screen reads the same code that is stored in Supabase.
    if (!storedReferralCode && referralCode !== 'VEXA-') {
      const { error: referralError } = await supabase
        .from('profiles')
        .update({ referral_code: referralCode })
        .eq('id', authUser.id);
      if (referralError) {
        console.warn('[Auth] referral code backfill error:', referralError.message);
      }
    }

    setUser({
      id:            profile.id,
      name:          profile.name ?? 'Vexa User',
      email:         profile.email ?? '',
      phone:         profile.phone ?? '',
      accountNumber: profile.account_number ?? '',
      referralCode,
      pin:           profile.pin ?? '0000',
      level:         Number(profile.level ?? 1),
      verified:      Boolean(profile.verified),
    });
    setProfilePhoto(profile.profile_photo ?? null);
    setLoading(false);
  }

  const signIn = async (phone: string, passcode: string): Promise<{ success: boolean; error?: string }> => {
    const email = phoneToEmail(phone);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: passcode });
    if (error) {
      return { success: false, error: 'Invalid phone number or passcode' };
    }
    if (data.user) await fetchProfile(data.user);
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
      await fetchProfile(data.user);
    }

    return { success: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const verifyPasscode = async (passcode: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(user.phone),
      password: passcode,
    });
    return !error;
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

  const updateProfile = async (name: string, email: string, phone: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const { error } = await supabase.from('profiles').update({ name, email, phone }).eq('id', user.id);
    if (error) return { success: false, error: 'Failed to save profile. Please try again.' };
    setUser(prev => prev ? { ...prev, name, email, phone } : null);
    return { success: true };
  };

  const updateProfilePhoto = async (photo: string | null): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const { error } = await supabase.from('profiles').update({ profile_photo: photo }).eq('id', user.id);
    if (error) return { success: false, error: 'Failed to save profile photo. Please try again.' };
    setProfilePhoto(photo);
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, profilePhoto, loading,
       signIn, signUp, verifyPasscode, signOut,
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
