'use client';

import React from 'react';
import {
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardSection } from './Sidebar';

interface OverviewViewProps {
  onNavigate: (section: DashboardSection) => void;
  totalMessagesCount?: number;
}

export default function OverviewView({ onNavigate, totalMessagesCount = 148 }: OverviewViewProps) {
  const { user, hasPermission, hasRole } = useAuth();
  const primaryRole = user?.roles?.[0]?.replace('ROLE_', '') || 'EMPLOYEE';

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
      value: '148',
      change: '100% processed',
      icon: Sparkles,
      color: '#0891b2',
      bg: '#ecfeff',
    },
    {
      title: 'Priority Inbox Alerts',
      value: '3',
      change: '2 require immediate triage',
      icon: AlertTriangle,
      color: '#e11d48',
      bg: '#fff1f2',
      alert: true,
    },
    {
      title: 'Active Groups & Pods',
      value: '1',
      change: 'Fleet Ops Pod',
      icon: Users,
      color: '#059669',
      bg: '#ecfdf5',
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
          {hasPermission('PRIORITY_INBOX_READ') && (
            <button
              className="btn btn-primary"
              onClick={() => onNavigate('priority-inbox')}
            >
              <AlertTriangle size={16} />
              Triage Priority Inbox (3)
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className={`kpi-card ${kpi.alert ? 'kpi-card-alert' : ''}`}>
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

      {/* 2-Column Split: Priority Alerts & Quick Action Workspaces */}
      <div className="overview-split-layout">
        {/* Left: Active Urgent Matters */}
        <div className="overview-card">
          <div className="overview-card-header">
            <div className="card-header-title-group">
              <div className="section-pill alert-pill">HIGH URGENCY</div>
              <h2 className="card-title">Priority Inbox Items Requiring Action</h2>
            </div>
            <button
              className="btn-link"
              onClick={() => onNavigate('priority-inbox')}
            >
              View All (3) <ArrowRight size={14} />
            </button>
          </div>

          <div className="priority-items-list">
            <div className="priority-item-row alert-critical">
              <div className="priority-dot dot-critical" />
              <div className="priority-item-info">
                <div className="priority-item-title">Urgent driver payment clearance required for Fleet Pod #4</div>
                <div className="priority-item-meta">
                  <span>Group: <strong>Fleet Ops Pod</strong></span> &bull; 
                  <span>Urgency: <strong>0.95 / 1.00</strong></span> &bull; 
                  <span>Source: <strong>Sarvesh (+91 77386 74950)</strong></span>
                </div>
              </div>
              <span className="status-badge badge-danger">NEW</span>
            </div>

            <div className="priority-item-row alert-financial">
              <div className="priority-dot dot-warning" />
              <div className="priority-item-info">
                <div className="priority-item-title">Diesel reimbursement claim submitted with receipt attachment</div>
                <div className="priority-item-meta">
                  <span>Group: <strong>Fleet Ops Pod</strong></span> &bull; 
                  <span>Category: <strong>FINANCIAL</strong></span> &bull; 
                  <span>Due: <strong>Today, 5:00 PM</strong></span>
                </div>
              </div>
              <span className="status-badge badge-warning">ACKNOWLEDGED</span>
            </div>

            <div className="priority-item-row">
              <div className="priority-dot dot-info" />
              <div className="priority-item-info">
                <div className="priority-item-title">Vehicle schedule change requested for tomorrow 08:00 AM dispatch</div>
                <div className="priority-item-meta">
                  <span>Group: <strong>Fleet Ops Pod</strong></span> &bull; 
                  <span>Category: <strong>OPERATIONS</strong></span>
                </div>
              </div>
              <span className="status-badge badge-info">VIEWED</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Workspaces */}
        <div className="overview-card">
          <div className="overview-card-header">
            <h2 className="card-title">Intelligence Workspaces</h2>
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
                <div className="quick-nav-desc">Verifiable AI summaries citing original message IDs with timeline view</div>
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
                  <CheckCircle2 size={20} />
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
