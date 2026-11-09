'use client';

import React from 'react';
import {
  LayoutDashboard,
  MessageSquareCode,
  FileText,
  Inbox,
  Terminal,
  ShieldAlert,
  Radio,
  X,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type DashboardSection =
  | 'overview'
  | 'test-messages'
  | 'message-summary'
  | 'priority-inbox'
  | 'developer'
  | 'admin';

interface SidebarProps {
  currentSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  channelInfo?: string;
  unresolvedPriorityCount?: number;
}

export default function Sidebar({
  currentSection,
  onSelectSection,
  mobileOpen,
  onToggleMobile,
  channelInfo,
  unresolvedPriorityCount = 3,
}: SidebarProps) {
  const { user, logout, canAccessSection, switchDemoRole } = useAuth();

  const allNavItems = [
    {
      id: 'overview' as DashboardSection,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'test-messages' as DashboardSection,
      label: 'Test Messages',
      icon: MessageSquareCode,
      badge: 'Live',
    },
    {
      id: 'message-summary' as DashboardSection,
      label: 'Summary',
      icon: FileText,
      badge: 'AI',
    },
    {
      id: 'priority-inbox' as DashboardSection,
      label: 'Priority Inbox',
      icon: Inbox,
      badge: unresolvedPriorityCount > 0 ? `${unresolvedPriorityCount}` : undefined,
      isAlertBadge: unresolvedPriorityCount > 0,
    },
    {
      id: 'developer' as DashboardSection,
      label: 'Developer Console',
      icon: Terminal,
      badge: undefined,
    },
    {
      id: 'admin' as DashboardSection,
      label: 'Administration',
      icon: ShieldAlert,
      badge: undefined,
    },
  ];

  // Filter items according to the user's role permissions
  const visibleNavItems = allNavItems.filter((item) => canAccessSection(item.id));

  // Determine primary display role
  const primaryRole = user?.roles?.[0]?.replace('ROLE_', '') || 'GUEST';

  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
    ADMIN: { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' },
    MANAGER: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    C_SUITE: { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' },
    DEVELOPER: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    EMPLOYEE: { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
  };

  const currentRoleStyle = roleColors[primaryRole] || roleColors.EMPLOYEE;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon-wrapper">
            <Radio className="brand-icon" size={20} />
          </div>
          <div className="brand-text">
            <div className="brand-title">WhatsApp Intelligence</div>
            <div className="brand-subtitle">Company Intelligence Portal</div>
          </div>
          <button
            className="mobile-close-btn"
            onClick={onToggleMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Demo Role Switcher for Rapid Architecture Testing */}
        {switchDemoRole && (
          <div className="role-switcher-banner">
            <span className="role-switcher-label">VIEW AS ROLE:</span>
            <select
              className="role-switcher-select"
              value={primaryRole}
              onChange={(e) => switchDemoRole(e.target.value)}
              aria-label="Switch Active Role Persona"
            >
              <option value="MANAGER">Manager (Operations)</option>
              <option value="EMPLOYEE">Employee (Read-Only)</option>
              <option value="C_SUITE">C-Suite (Executive BI)</option>
              <option value="DEVELOPER">Developer (Telemetry)</option>
              <option value="ADMIN">Admin (Full Control)</option>
            </select>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <div className="nav-group-label">WORKSPACE</div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectSection(item.id);
                  if (mobileOpen) onToggleMobile();
                }}
              >
                <div className="nav-item-content">
                  <Icon className="nav-item-icon" size={18} />
                  <span className="nav-item-label">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`nav-item-badge ${
                      item.isAlertBadge
                        ? 'badge-alert'
                        : item.badge === 'Live'
                        ? 'badge-live'
                        : 'badge-ai'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Card & Footer */}
        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar-circle">
              <User size={16} />
            </div>
            <div className="user-info">
              <div className="user-name">{user?.fullName || 'Signed In'}</div>
              <div className="user-role-row">
                <span
                  className="role-badge"
                  style={{
                    backgroundColor: currentRoleStyle.bg,
                    color: currentRoleStyle.text,
                    borderColor: currentRoleStyle.border,
                  }}
                >
                  {primaryRole}
                </span>
                <span className="department-tag">
                  {user?.departmentCode || 'TBM'}
                </span>
              </div>
            </div>
            <button
              className="logout-btn"
              onClick={() => logout()}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
