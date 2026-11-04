'use client';

import React from 'react';
import {
  MessageSquare,
  BarChart3,
  Code2,
  Radio,
  X,
  Menu,
  ShieldCheck,
} from 'lucide-react';

export type DashboardSection = 'test-messages' | 'message-summary' | 'developer';

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
  channelInfo,
}: SidebarProps) {
  const navItems = [
    {
      id: 'test-messages' as DashboardSection,
      label: 'Test Messages',
      icon: MessageSquare,
      badge: 'Live',
    },
    {
      id: 'message-summary' as DashboardSection,
      label: 'Message Summary',
      icon: BarChart3,
      badge: 'AI',
    },
    {
      id: 'developer' as DashboardSection,
      label: 'Developer',
      icon: Code2,
      badge: undefined,
    },
  ];

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
            <div className="brand-subtitle">Business Intelligence SaaS</div>
          </div>
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
          <div className="nav-group-label">NAVIGATION</div>
          {navItems.map((item) => {
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
                      item.badge === 'Live' ? 'badge-live' : 'badge-ai'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / Channel Status */}
        <div className="sidebar-footer">
          <div className="system-status-box">
            <div className="status-indicator">
              <span className="status-dot-pulse" />
              <span className="status-title">System Status</span>
            </div>
            <div className="status-channel">
              <ShieldCheck size={14} className="channel-shield" />
              <span className="channel-text">
                {channelInfo || 'WhatsApp Channel Active'}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
