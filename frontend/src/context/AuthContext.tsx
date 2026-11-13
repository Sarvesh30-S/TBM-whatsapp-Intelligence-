'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  departmentCode?: string;
  departmentName?: string;
  roles: string[];
  permissions: string[];
  assignedGroups?: string[];
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
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

const DEV_DEMO_PROFILES: Record<string, UserProfile> = {
  ADMIN: {
    id: 'u-admin-001',
    email: 'admin@tbm.internal',
    fullName: 'System Administrator',
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
      'WHATSAPP_CONTENT_READ',
      'WHATSAPP_MESSAGE_SEND',
      'SUMMARY_READ',
    ],
    assignedGroups: ['*'],
  },
  EMPLOYEE: {
    id: 'u-emp-005',
    email: 'employee@theboredmonkey.com',
    fullName: 'Operations Associate',
    jobTitle: 'Operations Associate',
    departmentCode: 'OPERATIONS',
    departmentName: 'Fleet & General Operations',
    roles: ['ROLE_EMPLOYEE'],
    permissions: [
      'WHATSAPP_CONTENT_READ',
      'SUMMARY_READ',
    ],
    assignedGroups: [],
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync session from NextAuth (Google Sign-In)
  useEffect(() => {
    if (sessionStatus === 'loading') {
      setIsLoading(true);
      return;
    }

    if (sessionStatus === 'authenticated' && session?.user) {
      const u = session.user as any;
      const profile: UserProfile = {
        id: u.id || 'u-session',
        email: u.email || '',
        fullName: u.name || (u.email ? u.email.split('@')[0] : 'Member'),
        jobTitle: u.jobTitle || 'Team Member',
        departmentCode: u.department || 'OPERATIONS',
        roles: u.roles || ['ROLE_EMPLOYEE'],
        permissions: u.permissions || ['WHATSAPP_CONTENT_READ'],
        assignedGroups: u.assignedGroups || [],
      };
      setUser(profile);
      setToken('google-session-active');
      setIsLoading(false);
      return;
    }

    // Check localStorage fallback for development
    if (typeof window !== 'undefined') {
      const isLoggedOut = sessionStorage.getItem('tbm_logged_out');
      if (isLoggedOut) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      const storedUser = localStorage.getItem('tbm_user') || localStorage.getItem('tbm_demo_user');
      const storedToken = localStorage.getItem('tbm_token');
      if (storedUser && storedToken) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && parsed.id) {
            setUser(parsed);
            setToken(storedToken);
            setIsLoading(false);
            return;
          }
        } catch {}
      }
    }

    setUser(null);
    setToken(null);
    setIsLoading(false);
  }, [session, sessionStatus]);

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    await nextAuthSignIn('google', { callbackUrl: '/' });
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
    } catch {
      setIsLoading(false);
      return {
        success: false,
        error: 'Could not connect to authentication server. Please check your network.',
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
    } catch {
      setIsLoading(false);
      return {
        success: false,
        error: 'Could not connect to authentication server.',
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
      await nextAuthSignOut({ redirect: false });
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
      if (hasRole('ADMIN')) return true;

      switch (section) {
        case 'overview':
          return true;
        case 'test-messages':
          return true;
        case 'message-summary':
          return hasPermission('SUMMARY_READ') || hasPermission('EXECUTIVE_BI_READ') || hasRole('C_SUITE') || hasRole('MANAGER');
        case 'developer':
          return hasPermission('TELEMETRY_READ') || hasRole('DEVELOPER');
        case 'admin':
          return hasRole('ADMIN') || hasPermission('USER_MANAGE');
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
        signInWithGoogle,
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
