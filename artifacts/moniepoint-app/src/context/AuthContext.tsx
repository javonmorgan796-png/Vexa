import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  name: string;
  email: string;
  phone: string;
  accountNumber: string;
  pin: string;
  password: string;
  level: number;
  verified: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => { success: boolean; error?: string };
  signUp: (name: string, email: string, phone: string, password: string) => { success: boolean; error?: string };
  signOut: () => void;
  updatePin: (oldPin: string, newPin: string) => { success: boolean; error?: string };
  updatePassword: (oldPass: string, newPass: string) => { success: boolean; error?: string };
  updateProfile: (name: string, email: string, phone: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_USER: User = {
  name: 'Chibuzor Emmanuel Dike',
  email: 'chibuzor@vexa.com',
  phone: '08067212032',
  accountNumber: '9067212032',
  pin: '1234',
  password: 'vexa1234',
  level: 3,
  verified: true,
};

function getUsers(): User[] {
  try { return JSON.parse(localStorage.getItem('vexa_users') || 'null') ?? [DEFAULT_USER]; }
  catch { return [DEFAULT_USER]; }
}
function saveUsers(users: User[]) {
  localStorage.setItem('vexa_users', JSON.stringify(users));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem('vexa_session');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  useEffect(() => {
    // Seed default users list on first load
    if (!localStorage.getItem('vexa_users')) {
      saveUsers([DEFAULT_USER]);
    }
  }, []);

  function persist(u: User | null) {
    setUser(u);
    if (u) localStorage.setItem('vexa_session', JSON.stringify(u));
    else localStorage.removeItem('vexa_session');
  }

  const signIn = (email: string, password: string) => {
    const users = getUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!found) return { success: false, error: 'Invalid email or password' };
    persist(found);
    return { success: true };
  };

  const signUp = (name: string, email: string, phone: string, password: string) => {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: 'An account with this email already exists' };
    }
    const digits = () => Math.floor(Math.random() * 10).toString();
    const accountNumber = '9' + Array.from({ length: 9 }, digits).join('');
    const newUser: User = { name, email, phone, accountNumber, pin: '0000', password, level: 1, verified: false };
    saveUsers([...users, newUser]);
    persist(newUser);
    return { success: true };
  };

  const signOut = () => persist(null);

  const updatePin = (oldPin: string, newPin: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.pin !== oldPin) return { success: false, error: 'Current PIN is incorrect' };
    const updated = { ...user, pin: newPin };
    persist(updated);
    saveUsers(getUsers().map(u => u.email === user.email ? updated : u));
    return { success: true };
  };

  const updatePassword = (oldPass: string, newPass: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.password !== oldPass) return { success: false, error: 'Current password is incorrect' };
    const updated = { ...user, password: newPass };
    persist(updated);
    saveUsers(getUsers().map(u => u.email === user.email ? updated : u));
    return { success: true };
  };

  const updateProfile = (name: string, email: string, phone: string) => {
    if (!user) return;
    const updated = { ...user, name, email, phone };
    persist(updated);
    saveUsers(getUsers().map(u => u.email === user.email ? updated : u));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, signIn, signUp, signOut, updatePin, updatePassword, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
