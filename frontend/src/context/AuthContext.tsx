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
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  canAccessSection: (section: string) => boolean;
  switchDemoRole?: (role: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Standard mock demo profiles for paired frontend testing when backend is offline
const DEMO_PROFILES: Record<string, UserProfile> = {
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
    ],
  },
  MANAGER: {
    id: 'u-mgr-002',
    email: 'sarvesh.manager@tbm.internal',
    fullName: 'Sarvesh Deshpande',
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
    fullName: 'Executive Leadership',
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
    fullName: 'DevOps Engineer',
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
    fullName: 'Operations Associate',
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
  const [user, setUser] = useState<UserProfile | null>(() => DEMO_PROFILES.MANAGER);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Attempt to restore session via refresh token on mount
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok && isMounted) {
          const profile: UserProfile = await res.json();
          setUser(profile);
        }
      } catch {
        // Fallback to active demo state if running detached
      }
    }
    restoreSession();
    return () => { isMounted = false; };
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
        setIsLoading(false);
        return { success: true };
      } else {
        const errorData = await res.json().catch(() => ({}));
        setIsLoading(false);
        return { success: false, error: errorData.error || errorData.message || 'Login failed' };
      }
    } catch {
      // Local fallback for dev/preview
      const matched = Object.values(DEMO_PROFILES).find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        setUser(matched);
        setIsLoading(false);
        return { success: true };
      }
      setIsLoading(false);
      return { success: false, error: 'Could not connect to authentication server' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    setToken(null);
  }, []);

  const hasRole = useCallback((role: string) => {
    if (!user) return false;
    return user.roles.some((r) => r === role || r === `ROLE_${role}`);
  }, [user]);

  const hasPermission = useCallback((permission: string) => {
    if (!user) return false;
    return user.permissions.includes(permission);
  }, [user]);

  const canAccessSection = useCallback((section: string) => {
    if (!user) return false;
    switch (section) {
      case 'overview':
        return true;
      case 'test-messages':
        return true; // Read-only viewing permitted; send action is gated by WHATSAPP_MESSAGE_SEND
      case 'message-summary':
        return hasPermission('SUMMARY_READ') || hasPermission('EXECUTIVE_BI_READ');
      case 'priority-inbox':
        return hasPermission('PRIORITY_INBOX_READ');
      case 'developer':
        return hasPermission('TELEMETRY_READ') || hasRole('DEVELOPER') || hasRole('ADMIN');
      case 'admin':
        return hasPermission('USER_MANAGE') || hasRole('ADMIN');
      default:
        return false;
    }
  }, [user, hasPermission, hasRole]);

  const switchDemoRole = useCallback((roleKey: string) => {
    if (DEMO_PROFILES[roleKey]) {
      setUser(DEMO_PROFILES[roleKey]);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole,
        hasPermission,
        canAccessSection,
        switchDemoRole,
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
