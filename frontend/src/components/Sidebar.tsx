'use client';

import React, { useState } from 'react';
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
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import TheBoredMonkeyLogo from './TheBoredMonkeyLogo';
import TheBoredMonkeyCompactLogo from './TheBoredMonkeyCompactLogo';

export type DashboardSection =
  | 'test-messages'
  | 'message-summary'
  | 'overview'
  | 'admin'
  | 'developer';

interface SidebarProps {
  currentSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  mobileOpen: boolean;
  onToggleMobile: () => void;
  channelInfo?: string;
}

export default function Sidebar({
  currentSection,
  onSelectSection,
  mobileOpen,
  onToggleMobile,
}: SidebarProps) {
  const { user, logout, canAccessSection } = useAuth();
  const { isDark } = useTheme();
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Desktop hover detection (only active on desktop viewports)
  const handleMouseEnter = () => {
    if (typeof window !== 'undefined' && window.innerWidth > 900) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (typeof window !== 'undefined' && window.innerWidth > 900) {
      setIsHovered(false);
    }
  };

  // On desktop: expanded if hovered. On mobile: expanded if mobileOpen is active
  const isExpanded = mobileOpen || isHovered;
  const isCollapsed = !isExpanded;

  const allNavItems = [
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
      id: 'overview' as DashboardSection,
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

      {/* Desktop Rail Slot holding 70px in layout (hidden on mobile <= 900px) */}
      <div
        className="sidebar-rail-slot desktop-only"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-hidden="true"
      />

      {/* App Workspace Sidebar (Drawer on mobile, icon-rail with hover expand on desktop) */}
      <aside
        className={`app-sidebar ${mobileOpen ? 'open' : ''} ${isHovered ? 'hover-expanded' : ''} ${isCollapsed ? 'collapsed' : 'expanded'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Brand Header: TheBoredMonkey Official Animated Logo */}
        <div className="sidebar-brand">
          <div
            className="brand-header-left"
            onClick={() => onSelectSection('test-messages')}
            title="TheBoredMonkey - WhatsApp Intelligence"
            role="button"
            tabIndex={0}
          >
            {/* 1. Compact Icon View for 70px collapsed desktop rail (When panel closes) */}
            <div className="brand-compact-logo" title="TheBoredMonkey">
              <TheBoredMonkeyCompactLogo
                size={38}
                textColor={isDark ? '#E2E8F0' : '#0F172A'}
                bgColor={isDark ? '#11141B' : '#ffffff'}
              />
            </div>

            {/* 2. Full Animated Logo for expanded drawer / desktop hover */}
            <div className="brand-expanded-logo" title="TheBoredMonkey Creations & Connections">
              <TheBoredMonkeyLogo
                width={185}
                height={35}
                textColor={isDark ? '#E2E8F0' : '#0F172A'}
                subtitleColor={isDark ? '#FDC727' : '#d97706'}
              />
            </div>
          </div>

          <button
            type="button"
            className="mobile-close-btn"
            onClick={onToggleMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item-btn ${isActive ? 'active' : ''}`}
                title={isCollapsed ? item.label : undefined}
                onClick={() => {
                  onSelectSection(item.id);
                  if (mobileOpen) onToggleMobile();
                }}
              >
                <div className="nav-item-content">
                  <Icon className="nav-item-icon" size={18} />
                  {!isCollapsed && <span className="nav-item-label">{item.label}</span>}
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
            {!isCollapsed && (
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
            {!isCollapsed && (
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
