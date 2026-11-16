'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  MessageSquare,
  BarChart3,
  Sparkles,
  RefreshCw,
  Building,
  Bell,
  Send,
  Check,
  AlertCircle,
  Clock,
  UserCheck,
  Mail,
  Shield,
  MessageSquarePlus,
} from 'lucide-react';
import { UserProfile } from '@/context/AuthContext';

interface ZeroDataMemberViewProps {
  user: UserProfile;
  onRefresh: () => void;
  loading: boolean;
}

interface AccessRequestRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  requested_groups: string[];
  message: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export default function ZeroDataMemberView({ user, onRefresh, loading }: ZeroDataMemberViewProps) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingRequests, setExistingRequests] = useState<AccessRequestRecord[]>([]);

  // Fetch user's previous submitted requests
  const fetchRequestHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/access-requests?email=${encodeURIComponent(user.email || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.requests)) {
          setExistingRequests(data.requests);
        }
      }
    } catch (err) {
      console.warn('Could not load access request history:', err);
    }
  }, [user.email]);

  useEffect(() => {
    fetchRequestHistory();
  }, [fetchRequestHistory]);

  const handleSendAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setSubmitError('Please enter a message mentioning which group(s) you need access to.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName || user.email.split('@')[0],
          message: trimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit access request');
      }

      setSubmitSuccess(
        'Alert sent to Super Admin (Sarvesh)! Your request has been delivered to their notification feed. Once approved, your live chats will activate.'
      );
      setMessage('');
      fetchRequestHistory();
    } catch (err: any) {
      setSubmitError(err.message || 'Unable to alert super admin. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingRequests = existingRequests.filter((r) => r.status === 'PENDING');

  return (
    <div
      style={{
        width: '100%',
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '4px 0 24px 0',
      }}
    >
      {/* 1. Full-Width Hero / Welcome & Authorization Banner */}
      <div
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
          borderRadius: 16,
          padding: '28px 32px',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 300 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Shield size={30} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary, #0F172A)', margin: 0 }}>
                Welcome, {user.fullName}!
              </h1>
              {/* Neutral / Amber Tier Badge - NO GREEN */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 20,
                  backgroundColor: 'rgba(217, 119, 6, 0.08)',
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                  color: '#D97706',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.2px',
                }}
              >
                <ShieldCheck size={14} />
                <span>Account Authorized • Member Tier</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', margin: 0, lineHeight: 1.5 }}>
              Your Google Workspace identity (
              <strong style={{ color: 'var(--text-primary, #0F172A)' }}>{user.email}</strong>
              ) is verified. Under company security policy, request access from the Super Admin below to unlock specific client and internal WhatsApp groups.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-surface-subtle, #F1F5F9)',
              color: 'var(--text-primary, #0F172A)',
              border: '1px solid var(--border-subtle, #CBD5E1)',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Checking...' : 'Check for Group Assignments'}</span>
          </button>
        </div>
      </div>

      {/* 2. Full-Width Metrics Row (4 Cards) */}
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            borderRadius: 14,
            padding: '20px 24px',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(217, 119, 6, 0.08)',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageSquare size={22} />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #0F172A)', lineHeight: 1.1 }}>
              0
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', marginTop: 4 }}>
              Assigned WhatsApp Groups
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            borderRadius: 14,
            padding: '20px 24px',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #0F172A)', lineHeight: 1.1 }}>
              0
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', marginTop: 4 }}>
              Messages & AI Summaries
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            borderRadius: 14,
            padding: '20px 24px',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(100, 116, 139, 0.08)',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BarChart3 size={22} />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #0F172A)', lineHeight: 1.1 }}>
              0
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', marginTop: 4 }}>
              Active Operations Tasks
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            borderRadius: 14,
            padding: '20px 24px',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: pendingRequests.length > 0 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(59, 130, 246, 0.08)',
              color: pendingRequests.length > 0 ? '#D97706' : '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={22} />
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #0F172A)', lineHeight: 1.1 }}>
              {pendingRequests.length > 0 ? `${pendingRequests.length} Pending` : 'Ready'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', marginTop: 4 }}>
              Super Admin Alert Status
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace Split: (Left: Direct Message Box to Super Admin | Right: Super Admin Channel & Policy) */}
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)',
          gap: 20,
        }}
      >
        {/* Left Column: Focused Group Access Request Message Box */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            borderRadius: 16,
            padding: '28px',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(217, 119, 6, 0.1)',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquarePlus size={18} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #0F172A)', margin: 0 }}>
                Request WhatsApp Group Access
              </h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', margin: 0, lineHeight: 1.5 }}>
              Write a message to the Super Admin (Sarvesh) specifying which WhatsApp group(s) or campaign you need
              access to. Submitting will send an instant alert notification directly to the Super Admin's notification
              feed.
            </p>
          </div>

          {/* Feedback Alerts */}
          {submitSuccess && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 10,
                backgroundColor: 'rgba(217, 119, 6, 0.08)',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                color: '#B45309',
                fontSize: 13,
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Check size={18} color="#D97706" style={{ flexShrink: 0 }} />
              <span>{submitSuccess}</span>
            </div>
          )}

          {submitError && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 10,
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#DC2626',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSendAccessRequest} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary, #0F172A)',
                  marginBottom: 8,
                }}
              >
                Which WhatsApp group or campaign do you need access to?
              </label>
              <textarea
                rows={4}
                placeholder="e.g. Please add me or give me access to the Blue Tyga Celeb Execution group / Q4 campaign deliverables..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle, #CBD5E1)',
                  backgroundColor: 'var(--bg-surface, #FFFFFF)',
                  color: 'var(--text-primary, #0F172A)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} />
                <span>Super Admin is notified immediately in their notification feed</span>
              </div>

              <button
                type="submit"
                disabled={submitting || !message.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 22px',
                  borderRadius: 8,
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submitting || !message.trim() ? 'not-allowed' : 'pointer',
                  opacity: submitting || !message.trim() ? 0.65 : 1,
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Send size={15} className={submitting ? 'animate-pulse' : ''} />
                <span>{submitting ? 'Sending Request...' : 'Send Access Request to Super Admin'}</span>
              </button>
            </div>
          </form>

          {/* Previous / Pending Requests Tracker */}
          {existingRequests.length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid var(--border-subtle, #E2E8F0)', paddingTop: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #0F172A)', margin: '0 0 10px 0' }}>
                Your Submitted Requests:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {existingRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      backgroundColor: 'var(--bg-surface-subtle, #F8FAFC)',
                      border: '1px solid var(--border-subtle, #E2E8F0)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 12,
                            backgroundColor:
                              req.status === 'APPROVED'
                                ? 'rgba(59, 130, 246, 0.12)'
                                : req.status === 'REJECTED'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(217, 119, 6, 0.12)',
                            color:
                              req.status === 'APPROVED'
                                ? '#2563EB'
                                : req.status === 'REJECTED'
                                ? '#DC2626'
                                : '#D97706',
                          }}
                        >
                          {req.status === 'PENDING' ? 'PENDING SUPER ADMIN REVIEW' : req.status}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted, #94A3B8)' }}>
                          {new Date(req.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary, #0F172A)', fontWeight: 500, marginTop: 4 }}>
                        "{req.message}"
                      </div>
                    </div>

                    {req.status === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={onRefresh}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          backgroundColor: '#2563EB',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Load Chats Now
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Super Administrator Profile & Security Policy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Super Admin Direct Escalation Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #FFFFFF)',
              borderRadius: 16,
              padding: '24px',
              border: '1px solid var(--border-subtle, #E2E8F0)',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserCheck size={18} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0F172A)', margin: 0 }}>
                Super Administrator
              </h3>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px',
                borderRadius: 10,
                backgroundColor: 'var(--bg-surface-subtle, #F8FAFC)',
                border: '1px solid var(--border-subtle, #E2E8F0)',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                SY
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>
                  Sarvesh S
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)' }}>
                  Head of Infrastructure & Super Admin
                </div>
                <div style={{ fontSize: 12, color: '#D97706', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={12} />
                  <span>sarvesh@theboredmonkey.com</span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary, #64748B)', lineHeight: 1.5, margin: 0 }}>
              Group access requests are routed directly to Sarvesh's topbar alert bell. Once approved, your assigned
              client groups will unlock automatically.
            </p>
          </div>

          {/* Security & Access Policy Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #FFFFFF)',
              borderRadius: 16,
              padding: '24px',
              border: '1px solid var(--border-subtle, #E2E8F0)',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(217, 119, 6, 0.1)',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building size={18} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0F172A)', margin: 0 }}>
                Awaiting Chat Assignment
              </h3>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary, #64748B)', lineHeight: 1.6, margin: '0 0 14px 0' }}>
              By company security policy, every newly authorized colleague begins with zero group exposure. Your department
              manager or Super Admin grants access to specific client campaigns and production groups.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 12,
                color: 'var(--text-secondary, #64748B)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>1</span>
                <span>Type which WhatsApp group you need & submit</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</span>
                <span>Super Admin is alerted in their Bell icon</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>3</span>
                <span>Super Admin assigns you access in Console</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>4</span>
                <span>Click "Check for Group Assignments" to view live chats</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
