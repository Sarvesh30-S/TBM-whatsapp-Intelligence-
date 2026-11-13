'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import TheBoredMonkeyLogo from '@/components/TheBoredMonkeyLogo';

interface LoginViewProps {
  onSuccess?: () => void;
}

export default function LoginView({ onSuccess }: LoginViewProps) {
  const { signInWithGoogle } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL query parameters for error codes from NextAuth
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errCode = params.get('error');
      if (errCode === 'InvalidDomain' || errCode === 'AccessDenied') {
        setError('Access Restricted: Only @theboredmonkey.com accounts are permitted.');
      } else if (errCode === 'AccountDeactivated') {
        setError('Your account is currently inactive. Please contact an administrator.');
      } else if (errCode === 'OAuthSignin' || errCode === 'OAuthCallback') {
        setError('Google authentication encountered an issue. Please try again.');
      } else if (errCode) {
        setError('Authentication was unsuccessful. Please use your official account.');
      }
    }
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Could not initiate Google Sign-In.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? '#08090C' : '#F8FAFC',
        padding: 20,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color 0.25s ease',
      }}
    >
      {/* Subtle ambient background glow in dark mode */}
      {isDark && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 380,
            height: 380,
            backgroundColor: 'rgba(253, 199, 39, 0.04)',
            borderRadius: '9999px',
            filter: 'blur(70px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Login Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: isDark ? '#11141B' : '#FFFFFF',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
          borderRadius: 16,
          padding: '36px 30px 28px 30px',
          boxShadow: isDark
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
            : '0 20px 40px -15px rgba(0, 0, 0, 0.06)',
          textAlign: 'center',
          color: isDark ? '#E2E8F0' : '#0F172A',
          position: 'relative',
          zIndex: 10,
          transition: 'all 0.25s ease',
        }}
      >
        {/* TheBoredMonkey Official Animated Brand Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <TheBoredMonkeyLogo
            width={260}
            height={56}
            showSubtitle={true}
            textColor={isDark ? '#E2E8F0' : '#0F172A'}
            subtitleColor={isDark ? '#FDC727' : '#d97706'}
          />
        </div>

        {/* Title & Subtitle */}
        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: isDark ? '#E2E8F0' : '#0F172A',
            margin: '0 0 6px 0',
            letterSpacing: '-0.2px',
          }}
        >
          TBM WhatsApp Intelligence
        </h1>
        <p
          style={{
            fontSize: 13,
            color: isDark ? '#94A3B8' : '#64748B',
            margin: '0 0 24px 0',
            lineHeight: 1.5,
          }}
        >
          Sign in with your official TheBoredMonkey account.
        </p>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
              border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #FCA5A5',
              borderRadius: 8,
              color: isDark ? '#FCA5A5' : '#B91C1C',
              fontSize: 12,
              marginBottom: 20,
              lineHeight: 1.4,
              textAlign: 'left',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, color: '#EF4444' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 18px',
            borderRadius: 10,
            backgroundColor: isDark ? '#1E242E' : '#FFFFFF',
            color: isDark ? '#E2E8F0' : '#0F172A',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #CBD5E1',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.75 : 1,
            transition: 'all 0.15s ease',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = isDark ? '#252D3A' : '#F8FAFC';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = isDark ? '#1E242E' : '#FFFFFF';
          }}
        >
          {/* Official Google 'G' icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        {/* Footer Restriction Note */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: isDark ? '#64748B' : '#94A3B8',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Restricted to approved{' '}
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontWeight: 500,
                color: isDark ? '#E2E8F0' : '#0F172A',
              }}
            >
              @theboredmonkey.com
            </span>{' '}
            accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
