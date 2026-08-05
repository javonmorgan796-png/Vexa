import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  accountNumber: string;
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
  signOut: () => Promise<void>;
  updatePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    // Restore session from Supabase on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfilePhoto(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('[Auth] fetchProfile error:', error?.message);
      setLoading(false);
      return;
    }

    setUser({
      id:            data.id,
      name:          data.name,
      email:         data.email ?? '',
      phone:         data.phone,
      accountNumber: data.account_number,
      pin:           data.pin,
      level:         data.level,
      verified:      data.verified,
    });
    setProfilePhoto(data.profile_photo ?? null);
    setLoading(false);
  }

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

    const { data, error } = await supabase.auth.signUp({ email, password: passcode });
    if (error) {
      if (error.message?.toLowerCase().includes('already')) {
        return { success: false, error: 'An account with this phone number already exists' };
      }
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'Sign up failed. Please try again.' };
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id:             data.user.id,
      name,
      email:          '',
      phone,
      account_number: accountNumber,
      pin:            '0000',
      level:          1,
      verified:       false,
      balance:        0,
      referral_code:  referralCode,
    });

    if (profileError) {
      console.error('[Auth] profile insert error:', profileError.message);
      return { success: false, error: 'Account created but profile setup failed. Please contact support.' };
    }

    return { success: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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

  const updateProfile = async (name: string, email: string, phone: string): Promise<void> => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ name, email, phone }).eq('id', user.id);
    if (!error) setUser(prev => prev ? { ...prev, name, email, phone } : null);
  };

  const updateProfilePhoto = async (photo: string | null): Promise<void> => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ profile_photo: photo }).eq('id', user.id);
    if (!error) setProfilePhoto(photo);
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, profilePhoto, loading,
      signIn, signUp, signOut,
      updatePin, updatePassword, updateProfile, updateProfilePhoto,
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
