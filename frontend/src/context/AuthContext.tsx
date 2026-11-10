'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  departmentCode?: string;
  departmentName?: string;
  roles: string[];
  permissions: string[];
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (fullName: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsDemo: (role?: string) => void;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  canAccessSection: (section: string) => boolean;
  switchDemoRole?: (role: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IS_DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === 'true';

// Optional demo profiles for isolated development UI inspection only (requires NEXT_PUBLIC_ENABLE_DEMO_MODE=true)
const DEV_DEMO_PROFILES: Record<string, UserProfile> = {
  ADMIN: {
    id: 'u-admin-001',
    email: 'admin@tbm.internal',
    fullName: 'System Administrator (Dev)',
    jobTitle: 'Head of Infrastructure',
    departmentCode: 'EXECUTIVE',
    departmentName: 'Executive Management',
    roles: ['ROLE_ADMIN'],
    permissions: [
      'TELEMETRY_READ',
      'AUDIT_READ',
      'USER_READ',
      'USER_MANAGE',
      'ROLE_ASSIGN',
      'GROUP_ASSIGNMENT_MANAGE',
      'DEPARTMENT_MANAGE',
    ],
  },
  MANAGER: {
    id: 'u-mgr-002',
    email: 'sarvesh.manager@tbm.internal',
    fullName: 'Sarvesh Deshpande (Dev)',
    jobTitle: 'Fleet Operations Manager',
    departmentCode: 'OPERATIONS',
    departmentName: 'Fleet & General Operations',
    roles: ['ROLE_MANAGER'],
    permissions: [
      'WHATSAPP_CONTENT_READ',
      'WHATSAPP_MESSAGE_SEND',
      'SUMMARY_READ',
      'SUMMARY_GENERATE',
      'PRIORITY_INBOX_READ',
      'PRIORITY_INBOX_TRIAGE',
      'ACTION_ITEM_CREATE',
      'ACTION_ITEM_ASSIGN',
      'ACTION_ITEM_UPDATE',
      'ACTION_ITEM_APPROVE',
    ],
  },
  C_SUITE: {
    id: 'u-csuite-003',
    email: 'executive@tbm.internal',
    fullName: 'Executive Leadership (Dev)',
    jobTitle: 'Chief Operations Officer',
    departmentCode: 'EXECUTIVE',
    departmentName: 'Executive Management',
    roles: ['ROLE_C_SUITE'],
    permissions: [
      'EXECUTIVE_BI_READ',
      'SUMMARY_READ',
      'PRIORITY_INBOX_READ',
      'PRIORITY_INBOX_TRIAGE',
      'EXECUTIVE_APPROVE',
    ],
  },
  DEVELOPER: {
    id: 'u-dev-004',
    email: 'dev@tbm.internal',
    fullName: 'DevOps Engineer (Dev)',
    jobTitle: 'Systems Architect',
    departmentCode: 'ENGINEERING',
    departmentName: 'Engineering & Technology',
    roles: ['ROLE_DEVELOPER'],
    permissions: [
      'TELEMETRY_READ',
      'SYSTEM_CONFIG_READ',
      'SYSTEM_CONFIG_MANAGE',
      'LOGS_READ',
      'AUDIT_READ',
    ],
  },
  EMPLOYEE: {
    id: 'u-emp-005',
    email: 'employee@tbm.internal',
    fullName: 'Operations Associate (Dev)',
    jobTitle: 'Fleet Specialist',
    departmentCode: 'OPERATIONS',
    departmentName: 'Fleet & General Operations',
    roles: ['ROLE_EMPLOYEE'],
    permissions: [
      'WHATSAPP_CONTENT_READ',
      'SUMMARY_READ',
      'PRIORITY_INBOX_READ',
      'ACTION_ITEM_UPDATE',
    ],
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tbm_demo_user') || localStorage.getItem('tbm_user') || sessionStorage.getItem('tbm_demo_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) return parsed;
        } catch {}
      }
      if (!sessionStorage.getItem('tbm_logged_out')) {
        return DEV_DEMO_PROFILES.ADMIN;
      }
      return null;
    }
    return DEV_DEMO_PROFILES.ADMIN;
  });
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tbm_token') || 'demo-jwt-token';
    }
    return 'demo-jwt-token';
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Restore session via refresh token or demo session on mount
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      // Fast timeout protected refresh check (1.2s max) so slow backend never blocks page load
      try {
        const refreshRes = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          signal: AbortSignal.timeout(1200),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const freshToken: string = refreshData.accessToken;
          if (isMounted) setToken(freshToken);

          // Fetch authenticated profile with 1.2s timeout
          const meRes = await fetch('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${freshToken}` },
            signal: AbortSignal.timeout(1200),
          });
          if (meRes.ok && isMounted) {
            const profile: UserProfile = await meRes.json();
            setUser(profile);
            if (typeof window !== 'undefined') {
              localStorage.setItem('tbm_user', JSON.stringify(profile));
              localStorage.setItem('tbm_token', freshToken);
            }
            return;
          }
        }
      } catch {
        // Session cannot be restored; keep instant access
      }
    }
    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.accessToken);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('tbm_logged_out');
          localStorage.setItem('tbm_user', JSON.stringify(data.user));
          localStorage.setItem('tbm_token', data.accessToken);
        }
        setIsLoading(false);
        return { success: true };
      } else {
        const errorData = await res.json().catch(() => ({}));
        setIsLoading(false);
        return {
          success: false,
          error: errorData.error || errorData.message || 'Invalid email or password.',
        };
      }
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: 'Could not connect to authentication server. Please check your network or try again.',
      };
    }
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(data.accessToken);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('tbm_logged_out');
          localStorage.setItem('tbm_user', JSON.stringify(data.user));
          localStorage.setItem('tbm_token', data.accessToken);
        }
        setIsLoading(false);
        return { success: true };
      } else {
        const errorData = await res.json().catch(() => ({}));
        setIsLoading(false);
        return {
          success: false,
          error: errorData.error || errorData.message || 'Registration failed.',
        };
      }
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: 'Could not connect to authentication server. Please check your network or try again.',
      };
    }
  }, []);

  const loginAsDemo = useCallback((roleKey: string = 'ADMIN') => {
    const profile = DEV_DEMO_PROFILES[roleKey] || DEV_DEMO_PROFILES.ADMIN;
    setUser(profile);
    setToken('demo-jwt-token');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('tbm_logged_out');
      localStorage.setItem('tbm_demo_user', JSON.stringify(profile));
      sessionStorage.setItem('tbm_demo_user', JSON.stringify(profile));
    }
  }, []);

  const logout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tbm_logged_out', 'true');
      sessionStorage.removeItem('tbm_demo_user');
      localStorage.removeItem('tbm_demo_user');
      localStorage.removeItem('tbm_user');
      localStorage.removeItem('tbm_token');
    }
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    setToken(null);
  }, [token]);

  const hasRole = useCallback(
    (role: string) => {
      if (!user) return false;
      return user.roles.some((r) => r === role || r === `ROLE_${role}`);
    },
    [user]
  );

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user]
  );

  const canAccessSection = useCallback(
    (section: string) => {
      if (!user) return false;
      // Administrator has full visibility across all portal intelligence workspaces
      if (hasRole('ADMIN')) return true;

      switch (section) {
        case 'overview':
          return true;
        case 'test-messages':
          return true; // Read-only viewing permitted; send action is strictly gated on backend
        case 'message-summary':
          return hasPermission('SUMMARY_READ') || hasPermission('EXECUTIVE_BI_READ') || hasRole('C_SUITE') || hasRole('MANAGER');
        case 'priority-inbox':
          return hasPermission('PRIORITY_INBOX_READ') || hasRole('C_SUITE') || hasRole('MANAGER');
        case 'developer':
          return hasPermission('TELEMETRY_READ') || hasRole('DEVELOPER');
        case 'admin':
          return hasPermission('USER_MANAGE');
        default:
          return false;
      }
    },
    [user, hasPermission, hasRole]
  );

  const switchDemoRole = useCallback(
    (roleKey: string) => {
      if (IS_DEMO_ENABLED && DEV_DEMO_PROFILES[roleKey]) {
        setUser(DEV_DEMO_PROFILES[roleKey]);
        setToken('dev-demo-token');
      }
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        loginAsDemo,
        logout,
        hasRole,
        hasPermission,
        canAccessSection,
        switchDemoRole: IS_DEMO_ENABLED ? switchDemoRole : undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
