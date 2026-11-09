'use client';

import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface LoginViewProps {
  onSuccess?: () => void;
}

export default function LoginView({ onSuccess }: LoginViewProps) {
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password change state (if mustChangePassword is true)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Authentication failed. Please verify your credentials.');
      } else {
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Network error communicating with authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Password update failed.');
      } else {
        setPasswordChangeSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit password change.');
    } finally {
      setChangingPassword(false);
    }
  };

  // If user is logged in but must change temporary password
  if (user?.mustChangePassword) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-canvas)', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 440, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 32, boxShadow: 'var(--shadow-elevated)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: 'var(--accent-warning-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-warning)' }}>
              <KeyRound size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Password Change Required</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>You must update your initial password before proceeding.</p>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'var(--accent-danger-subtle)', border: '1px solid var(--accent-danger)', borderRadius: 8, color: 'var(--accent-danger)', fontSize: 13, marginBottom: 16 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {passwordChangeSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'var(--accent-success-subtle)', border: '1px solid var(--accent-success)', borderRadius: 8, color: 'var(--accent-success)', fontSize: 13, marginBottom: 16 }}>
              <ShieldCheck size={16} />
              <span>Password updated successfully! Refreshing session...</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Current Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter current password"
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>New Password (min 8 chars)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 14 }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 14 }}
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              style={{ width: '100%', padding: '12px', borderRadius: 8, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: changingPassword ? 'not-allowed' : 'pointer' }}
            >
              {changingPassword ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-canvas)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 32, boxShadow: 'var(--shadow-elevated)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 16, boxShadow: '0 4px 8px rgba(79, 70, 229, 0.25)' }}>
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>TBM Intelligence Portal</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Enterprise Communication & Fleet Intelligence</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'var(--accent-danger-subtle)', border: '1px solid var(--accent-danger)', borderRadius: 8, color: 'var(--accent-danger)', fontSize: 13, marginBottom: 20 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Work Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                autoComplete="email"
                style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 14, outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--bg-surface)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: 14, outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'var(--bg-surface)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 8, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'background-color 0.2s' }}
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Security badge footer */}
        <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent-success)' }} />
            Role-Based Access Control • Spring Boot Enterprise Security
          </p>
        </div>
      </div>
    </div>
  );
}
