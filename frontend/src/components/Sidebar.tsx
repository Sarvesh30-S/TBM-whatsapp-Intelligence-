'use client';

import React from 'react';
import {
  LayoutGrid,
  MessageSquare,
  Sparkles,
  BarChart3,
  FileDown,
  Settings,
  Check,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type DashboardSection =
  | 'overview'
  | 'test-messages'
  | 'message-summary'
  | 'developer'
  | 'admin';

interface SidebarProps {
  currentSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  channelInfo?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  currentSection,
  onSelectSection,
  mobileOpen,
  onToggleMobile,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { user, logout, canAccessSection } = useAuth();

  const allNavItems = [
    {
      id: 'overview' as DashboardSection,
      label: 'Workspace',
      icon: LayoutGrid,
    },
    {
      id: 'test-messages' as DashboardSection,
      label: 'Groups & Chats',
      icon: MessageSquare,
    },
    {
      id: 'message-summary' as DashboardSection,
      label: 'Intelligence Views',
      icon: Sparkles,
    },
    {
      id: 'developer' as DashboardSection,
      label: 'Analytics & Console',
      icon: BarChart3,
    },
    {
      id: 'admin' as DashboardSection,
      label: 'Administration',
      icon: Settings,
    },
  ];

  // Filter items according to the user's role permissions
  const visibleNavItems = allNavItems.filter((item) => canAccessSection(item.id));

  // Determine primary display role dynamically
  const primaryRole = (user?.roles?.[0]?.replace('ROLE_', '') || 'User')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

  // Derive user initials dynamically from logged-in account (no hardcoded initials)
  const displayName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Admin User');
  const userInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || displayName.slice(0, 2).toUpperCase();

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

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-header-left">
            <div className="brand-icon-wrapper" title="TBM WhatsApp Intelligence">
              <Sparkles className="brand-icon" size={19} />
            </div>
            {!collapsed && (
              <div className="brand-text">
                <div className="brand-title">TBM WhatsApp Intelligence</div>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Button */}
          {onToggleCollapse && (
            <button
              type="button"
              className="sidebar-collapse-btn desktop-only"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand Workspace Menu' : 'Collapse Workspace Menu'}
              aria-label={collapsed ? 'Expand Workspace Menu' : 'Collapse Workspace Menu'}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          )}

          <button
            className="mobile-close-btn"
            onClick={onToggleMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {!collapsed && <div className="nav-group-label">Workspace</div>}
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item-btn ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
                onClick={() => {
                  onSelectSection(item.id);
                  if (mobileOpen) onToggleMobile();
                }}
              >
                <div className="nav-item-content">
                  <Icon className="nav-item-icon" size={18} />
                  {!collapsed && <span className="nav-item-label">{item.label}</span>}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with WhatsApp Status & Dynamic User Account */}
        <div className="sidebar-footer">
          {/* Connection Pill */}
          <div
            className="whatsapp-connection-card"
            title="Connected to WhatsApp • Last sync: 1 min ago"
          >
            <div className="connection-icon-dot">
              <Check size={11} strokeWidth={3} />
            </div>
            {!collapsed && (
              <div className="connection-meta">
                <span className="connection-title">Connected to WhatsApp</span>
                <span className="connection-sub">Last sync: 1 min ago</span>
              </div>
            )}
          </div>

          {/* User Account Profile */}
          <div
            className="user-profile-card"
            title={`${displayName} (${primaryRole})`}
          >
            <div className="user-avatar-initials">{userInitials}</div>
            {!collapsed && (
              <>
                <div className="user-info">
                  <div className="user-name" title={displayName}>
                    {displayName}
                  </div>
                  <div className="user-role-label">{primaryRole}</div>
                </div>
                <button
                  type="button"
                  className="logout-action-btn"
                  onClick={() => logout()}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
