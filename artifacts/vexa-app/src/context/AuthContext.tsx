import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  twoFactorEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  profilePhoto: string | null;
  loading: boolean;
  twoFactorPending: boolean;
  signIn: (phone: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (name: string, phone: string, passcode: string) => Promise<{ success: boolean; error?: string }>;
  verifyPasscode: (passcode: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updatePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  setInitialTransferPin: (newPin: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (name: string, email: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  updateProfilePhoto: (photo: string | null) => Promise<{ success: boolean; error?: string }>;
  sendTwoFactorCode: () => Promise<{ success: boolean; error?: string }>;
  verifyTwoFactorCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  updateTwoFactorEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Keep one canonical Nigerian representation so 080... and +234...
  // resolve to the same Supabase Auth identity.
  if (digits.startsWith('234') && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@vexa.app`;
}

function phoneToEmailCandidates(phone: string): string[] {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) digits = `0${digits.slice(3)}`;
  if (digits.startsWith('2340')) digits = `0${digits.slice(4)}`;
  const local = digits.startsWith('0') ? digits : `0${digits}`;
  const candidates = [
    `${local}@vexa.app`,
    `${local.slice(1)}@vexa.app`,
    `${digits}@vexa.app`,
    phoneToEmail(phone),
  ];
  return [...new Set(candidates.filter(Boolean))];
}

function genAccountNumber(): string {
  return '9' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const verifiedTwoFactorUser = useRef<string | null>(null);
  const profileRequestRef = useRef<{ userId: string; promise: Promise<{ success: boolean; error?: string }> } | null>(null);

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
        setTwoFactorPending(false);
        verifiedTwoFactorUser.current = null;
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(
    authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
  ): Promise<{ success: boolean; error?: string }> {
    const existing = profileRequestRef.current;
    if (existing?.userId === authUser.id) return existing.promise;

    const promise = hydrateProfile(authUser);
    profileRequestRef.current = { userId: authUser.id, promise };
    try {
      return await promise;
    } finally {
      if (profileRequestRef.current?.promise === promise) {
        profileRequestRef.current = null;
      }
    }
  }

  async function hydrateProfile(
    authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
  ): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: 'Could not load your account profile' };
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
        return { success: false, error: 'Could not create your account profile' };
      }
      profile = createdProfile;
    }

    const storedReferralCode = typeof profile.referral_code === 'string' ? profile.referral_code : '';
    const referralCode = storedReferralCode || `VEXA-${String(profile.account_number ?? '').slice(-4)}`;
    const profileEmail = profile.email || authUser.email || '';

    // Older rows may have an empty referral code or email. Persist these
    // values once so every screen reads the same data that is stored in
    // Supabase, while never overwriting a user-entered profile email.
    if ((!storedReferralCode && referralCode !== 'VEXA-') || (!profile.email && authUser.email)) {
      const { error: referralError } = await supabase
        .from('profiles')
        .update({
          ...(storedReferralCode ? {} : { referral_code: referralCode }),
          ...(profile.email || !authUser.email ? {} : { email: authUser.email }),
        })
        .eq('id', authUser.id);
      if (referralError) {
        console.warn('[Auth] profile backfill error:', referralError.message);
      }
    }

    setUser({
      id:            profile.id,
      name:          profile.name ?? 'Vexa User',
      email:         profileEmail,
      phone:         profile.phone ?? '',
      accountNumber: profile.account_number ?? '',
      referralCode,
      pin:           profile.pin ?? '0000',
      level:         Number(profile.level ?? 1),
      verified:      Boolean(profile.verified),
      twoFactorEnabled: Boolean(profile.two_factor_enabled),
    });
    if (profile.two_factor_enabled && verifiedTwoFactorUser.current !== authUser.id) {
      setTwoFactorPending(true);
    }
    setProfilePhoto(profile.profile_photo ?? null);
    setLoading(false);

    // Supabase Auth is the credential/identity record. Keep the safe,
    // non-secret account fields visible in raw_user_meta_data too, while
    // public.profiles remains the source of truth for the app.
    const currentMetadata = authUser.user_metadata ?? {};
    const mirroredMetadata = {
      ...currentMetadata,
      name: profile.name ?? 'Vexa User',
      phone: profile.phone ?? '',
      account_number: profile.account_number ?? '',
      referral_code: referralCode,
    };
    const metadataKeys = ['name', 'phone', 'account_number', 'referral_code'] as const;
    const metadataChanged = metadataKeys
      .some(key => currentMetadata[key] !== mirroredMetadata[key]);
    if (metadataChanged) {
      const { error: metadataError } = await supabase.auth.updateUser({ data: mirroredMetadata });
      if (metadataError) {
        console.warn('[Auth] auth metadata sync error:', metadataError.message);
      }
    }

    return { success: true };
  }

  const signIn = async (phone: string, passcode: string): Promise<{ success: boolean; error?: string }> => {
    const candidates = phoneToEmailCandidates(phone);
    if (!candidates.length || passcode.length !== 6) {
      return { success: false, error: 'Enter a valid phone number and 6-digit passcode' };
    }

    let lastError: string | undefined;
    for (const email of candidates) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: passcode });
      if (error || !data.user) {
        lastError = error?.message;
        continue;
      }

      // Wait for the profile before reporting success. The route guard relies
      // on this state and must not redirect a valid user back to sign-in.
      const profileResult = await fetchProfile(data.user);
      if (!profileResult.success) {
        await supabase.auth.signOut();
        return { success: false, error: profileResult.error };
      }
      return { success: true };
    }

    // Keep the UI message generic while logging only the provider's error
    // category locally during development; never expose auth internals.
    if (lastError) {
      console.warn('[Auth] sign-in rejected');
      if (lastError.toLowerCase().includes('email not confirmed')) {
        return {
          success: false,
          error: 'Your account was created but is not activated yet. Disable email confirmations in Supabase Auth, then create the account again.',
        };
      }
    }
    return { success: false, error: 'Invalid phone number or passcode' };
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
    if (!data.session) {
      return {
        success: false,
        error: 'Account created but not activated. Disable email confirmations in Supabase Auth so phone-based Vexa accounts can sign in immediately.',
      };
    }

    // The DB trigger (handle_new_user) creates the profile automatically.
    // If there is a session (email confirmation OFF), also upsert to ensure
    // all fields are correct in case the trigger ran with partial data.
    await supabase.from('profiles').upsert({
      id: data.user.id, name, email, phone: normalizePhone(phone),
      account_number: accountNumber, pin: '0000',
      level: 1, verified: false, balance: 0, referral_code: referralCode,
    }, { onConflict: 'id' });
    await fetchProfile(data.user);

    return { success: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setTwoFactorPending(false);
    verifiedTwoFactorUser.current = null;
  };

  function smsPhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('234')) return `+${digits}`;
    if (digits.startsWith('0')) return `+234${digits.slice(1)}`;
    return phone.startsWith('+') ? phone : `+${digits}`;
  }

  const sendTwoFactorCode = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user?.phone) return { success: false, error: 'Add a phone number to your profile first' };
    const { error } = await supabase.auth.signInWithOtp({
      phone: smsPhone(user.phone),
      options: { shouldCreateUser: false },
    });
    if (error) return { success: false, error: 'SMS could not be sent. Enable phone SMS in Supabase Auth first.' };
    return { success: true };
  };

  const verifyTwoFactorCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.phone) return { success: false, error: 'No phone number is available for verification' };
    const { error } = await supabase.auth.verifyOtp({
      phone: smsPhone(user.phone),
      token: code,
      type: 'sms',
    });
    if (error) return { success: false, error: 'That SMS code is invalid or expired' };
    verifiedTwoFactorUser.current = user.id;
    setTwoFactorPending(false);
    return { success: true };
  };

  const updateTwoFactorEnabled = async (enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const { error } = await supabase.from('profiles').update({
      two_factor_enabled: enabled,
      two_factor_phone: enabled ? user.phone : null,
    }).eq('id', user.id);
    if (error) return { success: false, error: 'Could not update two-factor authentication' };
    setUser(prev => prev ? { ...prev, twoFactorEnabled: enabled } : null);
    if (!enabled) setTwoFactorPending(false);
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

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        name,
        phone,
        account_number: user.accountNumber,
        referral_code: user.referralCode,
      },
    });
    if (metadataError) {
      console.warn('[Auth] profile metadata sync error:', metadataError.message);
    }

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
       user, isAuthenticated: !!user, profilePhoto, loading, twoFactorPending,
       signIn, signUp, verifyPasscode, signOut,
      updatePin, setInitialTransferPin, updatePassword, updateProfile, updateProfilePhoto,
       sendTwoFactorCode, verifyTwoFactorCode, updateTwoFactorEnabled,
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
