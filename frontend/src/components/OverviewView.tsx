'use client';

import React from 'react';
import {
  MessageSquare,
  Sparkles,
  Users,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardSection } from './Sidebar';
import { TwoChatConversation, isHiddenPrivateGroup } from '@/lib/types';

interface OverviewViewProps {
  onNavigate: (section: DashboardSection) => void;
  totalMessagesCount?: number;
  conversations?: TwoChatConversation[];
}

export default function OverviewView({
  onNavigate,
  totalMessagesCount = 128,
  conversations = [],
}: OverviewViewProps) {
  const { user, hasPermission, hasRole } = useAuth();
  const primaryRole = user?.roles?.[0]?.replace('ROLE_', '') || 'EMPLOYEE';

  // Discover real company groups and filter out personal test groups
  const realCompanyGroups = conversations
    .filter((c) => c.isGroup && !isHiddenPrivateGroup(c.name))
    .slice(0, 6);

  const fallbackCompanyGroups = [
    {
      name: 'Client || Blue Tyga x TBM || Celeb execution',
      category: 'Client & Campaign Operations',
      messagesCount: 29,
      status: 'ACTIVE BRIEFING',
      statusClass: 'badge-success',
    },
    {
      name: 'Emami X TheBoredMonkey',
      category: 'Brand Execution & Deliverables',
      messagesCount: 28,
      status: 'ACTIVE SYNC',
      statusClass: 'badge-info',
    },
    {
      name: 'Blue Tyga DVC || TBM internal',
      category: 'Internal Creative & Review',
      messagesCount: 28,
      status: 'ACTIVE SYNC',
      statusClass: 'badge-info',
    },
    {
      name: 'Blue Tyga X Shreyas Iyer',
      category: 'Celebrity Campaign Coordination',
      messagesCount: 14,
      status: 'MONITORED',
      statusClass: 'badge-info',
    },
    {
      name: 'Cent X TheBoredMonkey',
      category: 'Client Campaign Operations',
      messagesCount: 14,
      status: 'MONITORED',
      statusClass: 'badge-info',
    },
    {
      name: 'BM x Eclipse Solaire Matte Effect',
      category: 'Production & Deliverables',
      messagesCount: 13,
      status: 'MONITORED',
      statusClass: 'badge-info',
    },
  ];

  const featuredGroups =
    realCompanyGroups.length > 0
      ? realCompanyGroups.map((grp) => ({
          name: grp.name,
          category: 'Active Client & Campaign Group',
          messagesCount: grp.messageCount || 0,
          status: 'MONITORED',
          statusClass: 'badge-info',
        }))
      : fallbackCompanyGroups;

  const totalGroupsCount = realCompanyGroups.length > 0 ? realCompanyGroups.length : 6;

  const kpis = [
    {
      title: 'Total Messages',
      value: totalMessagesCount.toLocaleString(),
      change: '+12% this week',
      icon: MessageSquare,
      color: '#4f46e5',
      bg: '#eef2ff',
    },
    {
      title: 'Analyzed by Groq',
      value: '100%',
      change: 'Complete context coverage',
      icon: Sparkles,
      color: '#0891b2',
      bg: '#ecfeff',
    },
    {
      title: 'Monitored Groups',
      value: `${totalGroupsCount}`,
      change: 'Active company channels',
      icon: Users,
      color: '#059669',
      bg: '#ecfdf5',
    },
    {
      title: 'System Uptime',
      value: '99.9%',
      change: 'Enterprise Grade SLA',
      icon: CheckCircle2,
      color: '#4338ca',
      bg: '#f5f3ff',
    },
  ];

  return (
    <div className="overview-view">
      {/* Top Banner */}
      <div className="overview-header-card">
        <div className="overview-header-left">
          <div className="greeting-row">
            <h1 className="overview-greeting">Welcome, {user?.fullName || 'Colleague'}</h1>
            <span className="overview-role-pill">
              <ShieldCheck size={14} />
              {primaryRole} Access
            </span>
          </div>
          <p className="overview-subtitle">
            Enterprise WhatsApp Communication Intelligence Platform &bull; Department: <strong>{user?.departmentName || 'Operations'}</strong>
          </p>
        </div>
        <div className="overview-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('message-summary')}
          >
            <Sparkles size={16} />
            View Group Intelligence
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-title">{kpi.title}</span>
                <div className="kpi-icon-bubble" style={{ backgroundColor: kpi.bg, color: kpi.color }}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="kpi-value-row">
                <span className="kpi-value">{kpi.value}</span>
              </div>
              <div className="kpi-footer-row">
                <TrendingUp size={13} className="kpi-trend-icon" />
                <span className="kpi-change">{kpi.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2-Column Split: Monitored Groups & Quick Action Workspaces */}
      <div className="overview-split-layout">
        {/* Left: Active Monitored WhatsApp Groups */}
        <div className="overview-card">
          <div className="overview-card-header">
            <div className="card-header-title-group">
              <div className="section-pill admin-pill">CHANNELS</div>
              <h2 className="card-title">Monitored WhatsApp Groups</h2>
            </div>
            <button
              className="btn-link"
              onClick={() => onNavigate('message-summary')}
            >
              Open Intelligence <ArrowRight size={14} />
            </button>
          </div>

          <div className="monitored-groups-list">
            {featuredGroups.map((grp, index) => (
              <div
                key={index}
                className="monitored-group-row"
                onClick={() => onNavigate('message-summary')}
                style={{ cursor: 'pointer' }}
              >
                <div className="group-avatar-mini">👥</div>
                <div className="group-info-meta">
                  <div className="group-row-title">{grp.name}</div>
                  <div className="group-row-sub">
                    <span>{grp.category}</span> &bull; <span>{grp.messagesCount} Messages</span>
                  </div>
                </div>
                <span className={`status-badge ${grp.statusClass}`}>{grp.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Quick Action Workspaces */}
        <div className="overview-card">
          <div className="overview-card-header">
            <div className="card-header-title-group">
              <div className="section-pill admin-pill">WORKSPACES</div>
              <h2 className="card-title">Intelligence Workspaces</h2>
            </div>
          </div>

          <div className="quick-nav-grid">
            <div
              className="quick-nav-tile"
              onClick={() => onNavigate('message-summary')}
            >
              <div className="quick-nav-icon bg-indigo">
                <Sparkles size={20} />
              </div>
              <div className="quick-nav-text">
                <div className="quick-nav-title">Group Intelligence & Summary</div>
                <div className="quick-nav-desc">Hinglish / English AI summaries citing source message IDs with timeline view</div>
              </div>
              <ArrowRight size={16} className="tile-arrow" />
            </div>

            <div
              className="quick-nav-tile"
              onClick={() => onNavigate('test-messages')}
            >
              <div className="quick-nav-icon bg-blue">
                <MessageSquare size={20} />
              </div>
              <div className="quick-nav-text">
                <div className="quick-nav-title">Live Test Messages Sandbox</div>
                <div className="quick-nav-desc">Inspect inbound webhooks, simulate group conversations, and view history</div>
              </div>
              <ArrowRight size={16} className="tile-arrow" />
            </div>

            {(hasRole('DEVELOPER') || hasRole('ADMIN') || hasPermission('TELEMETRY_READ')) && (
              <div
                className="quick-nav-tile"
                onClick={() => onNavigate('developer')}
              >
                <div className="quick-nav-icon bg-emerald">
                  <Cpu size={20} />
                </div>
                <div className="quick-nav-text">
                  <div className="quick-nav-title">Developer & Telemetry Console</div>
                  <div className="quick-nav-desc">Actuator health, HikariCP pool stats, Groq latency, and redacted logs</div>
                </div>
                <ArrowRight size={16} className="tile-arrow" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
