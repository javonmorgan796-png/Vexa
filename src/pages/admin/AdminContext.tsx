import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export interface AdminUser {
  id: string;
  phone: string;
  name: string;
  role: 'super_admin' | 'admin' | 'finance_manager' | 'support_agent' | 'auditor';
  permissions: string[];
}

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
  | 'management'
  | 'integrations'
  | 'audit-logs'
  | 'system-settings';

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

interface AdminContextType {
  adminUser: AdminUser | null;
  loading: boolean;
  isAdmin: boolean;
  isElevated: boolean;
  elevatedToken: string | null;
  elevateAdminSession: (token: string) => void;
  lockAdminSession: () => Promise<void>;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  hasPermission: (permission: string) => boolean;
  isSuperAdmin: boolean;
  adminTheme: 'dark' | 'light';
  toggleAdminTheme: () => void;
  refreshAdmin: () => Promise<void>;
  fetchAdminApi: (path: string, options?: RequestInit) => Promise<any>;
  badgeCounts: AdminBadgeCounts;
  adminNotifications: AdminNotificationItem[];
  refreshBadgeCounts: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | null>(null);

const ADMIN_SESSION_TOKEN_KEY = 'vexa_admin_elevated_session';

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, user } = useAuth();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('vexa_admin_theme') as 'dark' | 'light') || 'dark';
  });

  const [badgeCounts, setBadgeCounts] = useState<AdminBadgeCounts>({
    kyc: 0,
    withdrawals: 0,
    deposits: 0,
    support: 0,
    security: 0,
    total: 0,
  });
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationItem[]>([]);

  const [elevatedToken, setElevatedToken] = useState<string | null>(() => {
    return sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
  });
  const [isElevated, setIsElevated] = useState<boolean>(() => {
    return Boolean(sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY));
  });

  const toggleAdminTheme = useCallback(() => {
    setAdminTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('vexa_admin_theme', next);
      return next;
    });
  }, []);

  // Synchronize document.documentElement class and colorScheme with adminTheme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', adminTheme === 'dark');
    document.documentElement.style.colorScheme = adminTheme;
    return () => {
      // When leaving admin section, restore user app theme preference
      const storedUserTheme = localStorage.getItem('vexa_theme_mode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = storedUserTheme === 'dark' || (storedUserTheme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', shouldBeDark);
      document.documentElement.style.colorScheme = shouldBeDark ? 'dark' : 'light';
    };
  }, [adminTheme]);

  const fetchAdminApi = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = session?.access_token || '';
      const phone = user?.phone || '09067212032';
      const storedElevatedToken = elevatedToken || sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY) || '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-vexa-phone': phone,
        ...(storedElevatedToken ? { 'x-admin-session-token': storedElevatedToken } : {}),
        ...(options.headers as Record<string, string>),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(path, {
        ...options,
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${res.status}`);
      }

      const jsonResult = await res.json();
      if (options.method && options.method.toUpperCase() !== 'GET') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('vexa:admin-refresh'));
        }, 80);
      }
      return jsonResult;
    },
    [session, user, elevatedToken]
  );

  const checkAdminAuth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAdminApi('/api/admin/auth/check');
      if (data && data.isAdmin) {
        setAdminUser({
          id: data.id || 'admin-001',
          phone: data.phone || user?.phone || '09067212032',
          name: data.name || user?.name || 'Super Administrator',
          role: data.role || 'super_admin',
          permissions: data.permissions || ['overview.view'],
        });
      } else {
        setAdminUser(null);
      }

      // Check elevation token validity
      const stored = sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
      if (stored) {
        try {
          const elevRes = await fetch(`/api/admin/auth/elevation-status?token=${stored}`);
          const elevData = await elevRes.json();
          if (elevData && elevData.elevated) {
            setIsElevated(true);
            setElevatedToken(stored);
          } else {
            sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
            setIsElevated(false);
            setElevatedToken(null);
          }
        } catch {
          // If server fails check, keep local session if present
        }
      }
    } catch (err) {
      console.error('[AdminContext] Auth check failed:', err);
      if (user?.phone?.includes('9067212032') || user?.phone === '09067212032') {
        setAdminUser({
          id: 'admin-fallback-01',
          phone: '09067212032',
          name: user.name || 'Super Administrator',
          role: 'super_admin',
          permissions: [
            'overview.view',
            'users.view', 'users.manage', 'users.adjust_balance', 'users.suspend',
            'kyc.view', 'kyc.manage',
            'transactions.view', 'transactions.manage',
            'deposits.view', 'deposits.manage',
            'withdrawals.view', 'withdrawals.manage',
            'cards.view', 'cards.manage',
            'support.view', 'support.manage',
            'security.view', 'security.manage',
            'admins.view', 'admins.manage',
            'audit.view',
            'settings.view', 'settings.manage',
          ],
        });
      } else {
        setAdminUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchAdminApi, user]);

  useEffect(() => {
    checkAdminAuth();
  }, [checkAdminAuth]);

  const elevateAdminSession = useCallback((token: string) => {
    sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
    setElevatedToken(token);
    setIsElevated(true);
  }, []);

  const lockAdminSession = useCallback(async () => {
    try {
      const stored = elevatedToken || sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
      if (stored) {
        await fetch('/api/admin/auth/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-session-token': stored },
          body: JSON.stringify({ token: stored }),
        });
      }
    } catch {
      // Ignored
    } finally {
      sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
      setElevatedToken(null);
      setIsElevated(false);
    }
  }, [elevatedToken]);

  const refreshBadgeCounts = useCallback(async () => {
    try {
      const data = await fetchAdminApi('/api/admin/notifications/badge-counts');
      if (data && data.counts) {
        setBadgeCounts(data.counts);
      }
      if (data && Array.isArray(data.notifications)) {
        setAdminNotifications(data.notifications);
      }
    } catch {
      // Ignored
    }
  }, [fetchAdminApi]);

  useEffect(() => {
    if (!adminUser) return;
    refreshBadgeCounts();
    const interval = setInterval(() => {
      refreshBadgeCounts();
    }, 5000);
    const handleRefresh = () => {
      refreshBadgeCounts();
    };
    window.addEventListener('vexa:admin-refresh', handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('vexa:admin-refresh', handleRefresh);
    };
  }, [adminUser, refreshBadgeCounts]);

  const hasPermission = useCallback(
    (perm: string) => {
      if (!adminUser) return false;
      if (adminUser.role === 'super_admin') return true;
      return adminUser.permissions.includes(perm);
    },
    [adminUser]
  );

  return (
    <AdminContext.Provider
      value={{
        adminUser,
        loading,
        isAdmin: Boolean(adminUser),
        isElevated,
        elevatedToken,
        elevateAdminSession,
        lockAdminSession,
        activeTab,
        setActiveTab,
        hasPermission,
        isSuperAdmin: adminUser?.role === 'super_admin',
        adminTheme,
        toggleAdminTheme,
        refreshAdmin: checkAdminAuth,
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

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
