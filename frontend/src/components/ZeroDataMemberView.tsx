'use client';

import React from 'react';
import {
  ShieldAlert,
  MessageSquare,
  BarChart3,
  Sparkles,
  RefreshCw,
  Building,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { UserProfile } from '@/context/AuthContext';

interface ZeroDataMemberViewProps {
  user: UserProfile;
  onRefresh: () => void;
  loading: boolean;
}

export default function ZeroDataMemberView({ user, onRefresh, loading }: ZeroDataMemberViewProps) {
  return (
    <div style={{ maxWidth: 880, margin: '40px auto', padding: '0 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Welcome & Authorization Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 16,
          padding: '32px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          textAlign: 'center',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: '#3B82F6',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Clock size={28} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Welcome, {user.fullName}!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 20px auto', lineHeight: 1.6 }}>
          Your Google account (<strong style={{ color: 'var(--text-primary)' }}>{user.email}</strong>) has been verified and authorized on the TBM Intelligence Portal.
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 20,
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#10B981',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <CheckCircle size={14} />
          <span>Account Authorized • Member Tier</span>
        </div>
      </div>

      {/* Zero Data Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <MessageSquare size={22} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>0</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Assigned WhatsApp Groups</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <Sparkles size={22} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>0</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Messages & Intelligence Summaries</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 12,
            padding: '20px',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <BarChart3 size={22} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>0</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Active Operations Tasks</div>
        </div>
      </div>

      {/* Instructions Card */}
      <div
        style={{
          borderRadius: 14,
          padding: '24px',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#D97706', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building size={18} />
          <span>Awaiting Group Chat Assignment</span>
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
          By company security policy, every newly authorized colleague begins with a clean empty state. Your department manager or administrator will grant you access to specific client campaigns and production groups.
        </p>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 8,
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Checking for updates...' : 'Check for Group Assignments'}</span>
        </button>
      </div>
    </div>
  );
}
