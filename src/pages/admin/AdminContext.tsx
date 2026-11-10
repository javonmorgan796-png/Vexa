import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export type AdminTab =
  | 'overview'
  | 'users'
  | 'business'
  | 'crypto'
  | 'rewards'
  | 'kyc'
  | 'transactions'
  | 'deposits'
  | 'withdrawals'
  | 'cards'
  | 'support'
  | 'security'
  | 'integrations'
  | 'audit-logs'
  | 'system-settings';

export interface AdminUser {
  id: string;
  phone: string;
  name: string;
  role: 'super_admin' | 'admin' | 'finance_manager' | 'support_agent' | 'auditor';
  permissions: string[];
}

export interface AdminBadgeCounts {
  kyc: number;
  withdrawals: number;
  deposits: number;
  support: number;
  security: number;
  total: number;
}

export interface AdminNotificationItem {
  id: string;
  type: 'kyc' | 'withdrawal' | 'deposit' | 'support' | 'security';
  title: string;
  description: string;
  timestamp: string;
  targetTab: AdminTab;
  severity: 'info' | 'warning' | 'critical';
}

interface AdminContextValue {
  adminUser: AdminUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  isElevated: boolean;
  elevateAdminSession: (token: string) => void;
  lockAdminSession: () => void;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  adminTheme: 'dark' | 'light';
  toggleAdminTheme: () => void;
  hasPermission: (permission: string) => boolean;
  fetchAdminApi: <T = any>(url: string, options?: RequestInit) => Promise<T>;
  badgeCounts: AdminBadgeCounts;
  adminNotifications: AdminNotificationItem[];
  refreshBadgeCounts: () => Promise<void>;
}

const ADMIN_SESSION_STORAGE_KEY = 'vexa_admin_elevated_token';
const ADMIN_THEME_STORAGE_KEY = 'vexa_admin_theme';

const EMPTY_BADGES: AdminBadgeCounts = {
  kyc: 0,
  withdrawals: 0,
  deposits: 0,
  support: 0,
  security: 0,
  total: 0,
};

const AdminContext = createContext<AdminContextValue | null>(null);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session, loading: authLoading } = useAuth();

  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [elevatedToken, setElevatedToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isElevated, setIsElevated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });
  const [badgeCounts, setBadgeCounts] = useState<AdminBadgeCounts>(EMPTY_BADGES);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationItem[]>([]);

  const toggleAdminTheme = useCallback(() => {
    setAdminTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(ADMIN_THEME_STORAGE_KEY, next);
      } catch {
        // Ignore storage error
      }
      return next;
    });
  }, []);

  const elevateAdminSession = useCallback((token: string) => {
    try {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, token);
    } catch {
      // Ignore storage error
    }
    setElevatedToken(token);
    setIsElevated(true);
    setIsAdmin(true);
  }, []);

  const lockAdminSession = useCallback(() => {
    const token = elevatedToken;
    try {
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
    setElevatedToken('');
    setIsElevated(false);
    if (token) {
      void fetch('/api/admin/auth/lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-session-token': token,
        },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }
  }, [elevatedToken]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    async function verifyAdminAccess() {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        if (user?.phone) {
          headers['x-vexa-phone'] = user.phone;
        }
        if (elevatedToken) {
          headers['x-admin-session-token'] = elevatedToken;
        }

        const resp = await fetch('/api/admin/auth/check', { headers });
        const data = await resp.json().catch(() => ({ isAdmin: false, isElevated: false }));

        if (!active) return;

        if (data?.isAdmin) {
          setIsAdmin(true);
          setAdminUser({
            id: data.id || 'admin-master-001',
            phone: data.phone || user?.phone || '',
            name: data.name || user?.name || 'Super Administrator',
            role: data.role || 'super_admin',
            permissions: Array.isArray(data.permissions) ? data.permissions : ['overview.view'],
          });

          if (elevatedToken && data.isElevated) {
            setIsElevated(true);
          } else if (elevatedToken) {
            const elevRes = await fetch('/api/admin/auth/elevation-status', {
              headers: { 'x-admin-session-token': elevatedToken },
            });
            const elevData = await elevRes.json().catch(() => ({ elevated: false }));
            if (!active) return;
            if (elevData?.elevated) {
              setIsElevated(true);
            } else {
              try {
                sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
              } catch {
                // Ignore storage error
              }
              setElevatedToken('');
              setIsElevated(false);
            }
          } else {
            setIsElevated(false);
          }
        } else {
          setIsAdmin(false);
          setIsElevated(false);
          setAdminUser(null);
        }
      } catch {
        if (!active) return;
        setIsAdmin(false);
        setIsElevated(false);
      } finally {
        if (active) setLoading(false);
      }
    }

    void verifyAdminAccess();
    return () => {
      active = false;
    };
  }, [authLoading, user?.phone, user?.name, session?.access_token, elevatedToken]);

  const fetchAdminApi = useCallback(
    async <T = any>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }
      if (elevatedToken) {
        headers.set('x-admin-session-token', elevatedToken);
      }
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }
      if (user?.phone) {
        headers.set('x-vexa-phone', user.phone);
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403 && payload?.error === 'Unauthorized' && elevatedToken) {
          lockAdminSession();
        }
        throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
      }

      return payload as T;
    },
    [elevatedToken, session?.access_token, user?.phone, lockAdminSession],
  );

  const refreshBadgeCounts = useCallback(async () => {
    if (!isAdmin || !isElevated) return;
    try {
      const res = await fetchAdminApi<{
        counts?: AdminBadgeCounts;
        notifications?: AdminNotificationItem[];
      }>('/api/admin/notifications/badge-counts');
      if (res?.counts) setBadgeCounts(res.counts);
      if (Array.isArray(res?.notifications)) setAdminNotifications(res.notifications);
    } catch {
      // Ignore silent polling errors
    }
  }, [isAdmin, isElevated, fetchAdminApi]);

  useEffect(() => {
    if (!isAdmin || !isElevated) return;
    void refreshBadgeCounts();
    const interval = window.setInterval(() => {
      void refreshBadgeCounts();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isAdmin, isElevated, refreshBadgeCounts]);

  const isSuperAdmin = adminUser?.role === 'super_admin';

  const hasPermission = useCallback(
    (permission: string) => {
      if (!adminUser) return false;
      if (adminUser.role === 'super_admin') return true;
      return adminUser.permissions.includes(permission);
    },
    [adminUser],
  );

  return (
    <AdminContext.Provider
      value={{
        adminUser,
        isAdmin,
        isSuperAdmin,
        loading,
        isElevated,
        elevateAdminSession,
        lockAdminSession,
        activeTab,
        setActiveTab,
        adminTheme,
        toggleAdminTheme,
        hasPermission,
        fetchAdminApi,
        badgeCounts,
        adminNotifications,
        refreshBadgeCounts,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return ctx;
}
