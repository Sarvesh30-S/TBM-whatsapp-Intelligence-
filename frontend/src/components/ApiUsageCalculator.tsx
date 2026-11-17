'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Activity,
  Calculator,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Layers,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  Info,
  Sliders,
  ShieldAlert,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ApiUsageBreakdown {
  inboundWebhooks: number;
  outboundSentMessages: number;
  systemSyncCalls: number;
  totalMessages: number;
}

interface ApiUsagePeriods {
  today: number;
  last24Hours: number;
  last7Days: number;
  last30Days: number;
}

interface ApiUsagePool {
  allocatedCredits: number;
  usedCredits: number;
  remainingCredits: number;
  percentUsed: number;
  status: 'healthy' | 'warning' | 'critical' | 'exhausted';
}

interface TopGroupUsage {
  name: string;
  messageCount: number;
  creditsUsed: number;
  percentage: number;
}

interface ScaleProjections {
  avgMessagesPerGroupDay: number;
  projectedDailyCredits500Groups: number;
  projectedMonthlyCredits500Groups: number;
  recommendedTier: string;
}

interface ApiUsageResponse {
  success: boolean;
  totalApiCredits: number;
  breakdown: ApiUsageBreakdown;
  periods: ApiUsagePeriods;
  pool: ApiUsagePool;
  activeGroupsCount: number;
  topGroups: TopGroupUsage[];
  projections: ScaleProjections;
  rules: {
    creditModel: string;
    emailAlertThreshold: string;
    cutoffThreshold: string;
  };
  lastUpdated: string;
}

interface ApiUsageCalculatorProps {
  token?: string | null;
}

export default function ApiUsageCalculator({ token }: ApiUsageCalculatorProps) {
  const [data, setData] = useState<ApiUsageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<number>(1000);
  const [customPoolInput, setCustomPoolInput] = useState<string>('1000');
  const [isCustomPool, setIsCustomPool] = useState<boolean>(false);
  const [simulatedGroups, setSimulatedGroups] = useState<number>(500);
  const [showRulesInfo, setShowRulesInfo] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const fetchUsageData = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) setRefreshing(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const poolParam = selectedPool ? `?poolLimit=${selectedPool}` : '';
        const res = await fetch(`/api/admin/api-usage${poolParam}`, { credentials: 'include', headers });

        if (!res.ok) {
          throw new Error(`Failed to fetch API credit usage: ${res.statusText}`);
        }

        const json: ApiUsageResponse = await res.json();
        setData(json);
        setLastRefreshedAt(new Date());
      } catch (err: any) {
        console.warn('API Usage Calculator fetch warning:', err.message);
        setError(err.message || 'Could not load real-time API usage telemetry');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, selectedPool]
  );

  // Initial fetch and auto-refresh whenever pool limit changes
  useEffect(() => {
    fetchUsageData(false);
  }, [fetchUsageData]);

  // Periodic background revalidation every 15 seconds to catch incoming messages in real-time
  useEffect(() => {
    const timer = setInterval(() => {
      fetchUsageData(false);
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchUsageData]);

  const handlePoolChange = (poolLimit: number) => {
    setIsCustomPool(false);
    setSelectedPool(poolLimit);
    setCustomPoolInput(String(poolLimit));
  };

  const handleCustomPoolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customPoolInput, 10);
    if (!isNaN(val) && val > 0) {
      setIsCustomPool(true);
      setSelectedPool(val);
    }
  };

  // Compute live calculations from state
  const totalCredits = data?.totalApiCredits ?? 0;
  const poolLimit = selectedPool;
  const remainingCredits = Math.max(0, poolLimit - totalCredits);
  const percentUsed = Math.min(100, Math.round((totalCredits / poolLimit) * 1000) / 10);

  const isExhausted = percentUsed >= 100;
  const isCritical = percentUsed >= 90;
  const isWarning = percentUsed >= 80;

  // Compute simulated projections for user-configurable group count
  const avgMsgPerGroupDay = data?.projections?.avgMessagesPerGroupDay || 2.4;
  const simulatedDailyCredits = Math.round(simulatedGroups * avgMsgPerGroupDay);
  const simulatedMonthlyCredits = Math.round(simulatedDailyCredits * 30);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 16,
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: '24px',
        marginBottom: 24,
      }}
    >
      {/* Top Header & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                color: '#2563EB',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                padding: '4px 10px',
                borderRadius: 20,
                letterSpacing: '0.4px',
              }}
            >
              <Calculator size={12} />
              2CHAT API USAGE CALCULATOR
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                color: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '3px 8px',
                borderRadius: 20,
              }}
            >
              <Zap size={11} />
              1 API Call = 1 Credit
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-surface-subtle)',
                padding: '3px 8px',
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
              }}
            >
              Auto-updating every 15s
            </span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            Live 2Chat Credit & System API Accounting
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, maxWidth: 760 }}>
            Every incoming WhatsApp message ingested via webhook and every outbound dispatch consumes exactly 1 2Chat
            credit. Monitor real-time credit consumption, pool depletion alerts, and group traffic.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowRulesInfo(!showRulesInfo)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="View 2Chat official credit calculation rules"
          >
            <Info size={14} />
            <span>Pricing Rules</span>
            {showRulesInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            onClick={() => fetchUsageData(true)}
            disabled={refreshing || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 8,
              backgroundColor: 'var(--brand-primary, #2563EB)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Recalculating...' : 'Recalculate Now'}</span>
          </button>
        </div>
      </div>

      {/* 2Chat Rules Explanatory Dropdown */}
      {showRulesInfo && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            padding: '16px 20px',
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 13 }}>
            2Chat Official API Credit Calculation Model:
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontWeight: 600, color: '#10B981', marginBottom: 4 }}>
                Consumes 1 API Credit Each:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  <strong>Webhook invocations:</strong> Each message received (
                  <code>whatsapp.message.received</code> / group) = 1 credit.
                </li>
                <li>
                  <strong>Direct API requests:</strong> Sending WhatsApp messages via <code>/messages/send</code> = 1
                  credit.
                </li>
                <li>
                  <strong>Triggering Flow Webhooks:</strong> Starting flows from external triggers = 1 credit.
                </li>
                <li>
                  <strong>System sync calls:</strong> Fetching active channels, contacts, or message history = 1 credit/call.
                </li>
              </ul>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontWeight: 600, color: '#2563EB', marginBottom: 4 }}>
                Consumes 0 Credits (Unlimited & Free):
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Using Dashboard &amp; PostgreSQL message history reads (0 credits).</li>
                <li>Groq AI Summarization &amp; sentiment analysis (0 2Chat credits).</li>
                <li>Connecting WhatsApp numbers &amp; exporting contact files (0 credits).</li>
                <li>Internal flow actions and automated group join triggers (0 credits).</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Threshold Status Banner */}
      <div
        style={{
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          backgroundColor: isExhausted
            ? 'rgba(239, 68, 68, 0.12)'
            : isCritical
            ? 'rgba(239, 68, 68, 0.08)'
            : isWarning
            ? 'rgba(245, 158, 11, 0.1)'
            : 'rgba(16, 185, 129, 0.08)',
          border: `1px solid ${
            isExhausted
              ? 'rgba(239, 68, 68, 0.4)'
              : isCritical
              ? 'rgba(239, 68, 68, 0.3)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.3)'
              : 'rgba(16, 185, 129, 0.25)'
          }`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: isExhausted || isCritical ? '#FEE2E2' : isWarning ? '#FEF3C7' : '#D1FAE5',
              color: isExhausted || isCritical ? '#DC2626' : isWarning ? '#D97706' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isExhausted ? (
              <ShieldAlert size={20} />
            ) : isCritical ? (
              <AlertTriangle size={20} />
            ) : isWarning ? (
              <AlertTriangle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: isExhausted || isCritical ? '#DC2626' : isWarning ? '#B45309' : '#065F46',
              }}
            >
              {isExhausted
                ? 'CRITICAL: 100% API Credit Quota Exhausted'
                : isCritical
                ? 'ALERT: 90%+ API Quota Threshold Reached'
                : isWarning
                ? 'WARNING: Approaching 80% Credit Limit'
                : 'API Credit Pool Healthy'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: isExhausted || isCritical ? '#991B1B' : isWarning ? '#92400E' : '#047857',
              }}
            >
              {isExhausted
                ? 'All webhooks and outgoing API invocations will stop working until extra credits are purchased or the plan renews.'
                : isCritical
                ? '2Chat has sent an email alert to the account owner. Daily updates are active. Top up soon to prevent service interruption.'
                : isWarning
                ? `You have consumed ${percentUsed}% of your allotted credits (${totalCredits} / ${poolLimit}).`
                : `Active quota usage is normal (${percentUsed}% used). ${remainingCredits.toLocaleString()} credits remaining in pool.`}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Remaining Pool
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: isExhausted || isCritical ? '#DC2626' : isWarning ? '#D97706' : '#059669',
            }}
          >
            {remainingCredits.toLocaleString()} / {poolLimit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Credit Pool Progress Bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Credit Consumption Progress ({percentUsed}%)
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {totalCredits.toLocaleString()} used &bull; {remainingCredits.toLocaleString()} remaining
          </span>
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 6,
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percentUsed}%`,
              backgroundColor: isExhausted || isCritical ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981',
              borderRadius: 6,
              transition: 'width 0.4s ease-in-out',
            }}
          />
        </div>

        {/* Plan Pool Preset Selector Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
            Configure Plan Pool:
          </span>
          {[
            { label: '500 (Free Trial)', value: 500 },
            { label: '1,000 (Starter)', value: 1000 },
            { label: '5,000 (Growth)', value: 5000 },
            { label: '20,000 (Scale)', value: 20000 },
          ].map((preset) => {
            const isSelected = !isCustomPool && selectedPool === preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => handlePoolChange(preset.value)}
                style={{
                  fontSize: 11,
                  fontWeight: isSelected ? 700 : 500,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: isSelected ? '1px solid #2563EB' : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-surface-subtle)',
                  color: isSelected ? '#2563EB' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            );
          })}

          <form onSubmit={handleCustomPoolSubmit} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              placeholder="Custom pool"
              value={customPoolInput}
              onChange={(e) => setCustomPoolInput(e.target.value)}
              style={{
                width: 90,
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 6,
                border: isCustomPool ? '1px solid #2563EB' : '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Set
            </button>
          </form>
        </div>
      </div>

      {/* 4 Core Metric KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total API Credits */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 12,
            padding: '16px 18px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Total API Credits Used
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={15} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {totalCredits.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            1 credit / API call or webhook hit
          </div>
        </div>

        {/* Inbound Webhooks */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 12,
            padding: '16px 18px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Inbound Webhooks
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowDownLeft size={15} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981', lineHeight: 1.2 }}>
            {(data?.breakdown?.inboundWebhooks ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Received WhatsApp messages
          </div>
        </div>

        {/* Outbound Send API */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 12,
            padding: '16px 18px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Outbound Dispatches
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                color: '#8B5CF6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowUpRight size={15} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#8B5CF6', lineHeight: 1.2 }}>
            {(data?.breakdown?.outboundSentMessages ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Direct <code>/messages/send</code> calls
          </div>
        </div>

        {/* System Sync & Polling Calls */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 12,
            padding: '16px 18px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Sync &amp; Health API Calls
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={15} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706', lineHeight: 1.2 }}>
            {(data?.breakdown?.systemSyncCalls ?? 14).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Channel &amp; contact synchronizations
          </div>
        </div>
      </div>

      {/* Two-Column Section: Usage Velocity & Top Consuming Groups */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Left: Consumption Velocity Over Time */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 12,
            padding: '18px 20px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingUp size={16} color="#2563EB" />
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Usage Velocity by Time Range
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Today (Since 00:00)</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                {(data?.periods?.today ?? 0).toLocaleString()} credits
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Last 24 Hours</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                {(data?.periods?.last24Hours ?? 0).toLocaleString()} credits
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Past 7 Days</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#2563EB' }}>
                {(data?.periods?.last7Days ?? 0).toLocaleString()} credits
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Past 30 Days</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                {(data?.periods?.last30Days ?? 0).toLocaleString()} credits
              </span>
            </div>
          </div>
        </div>

        {/* Right: Top Consuming Groups */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 12,
            padding: '18px 20px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="#D97706" />
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                Top Credit-Consuming Groups
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {data?.activeGroupsCount ?? 0} active groups
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {(data?.topGroups || []).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '12px 0' }}>
                No group message traffic recorded yet.
              </div>
            ) : (
              data!.topGroups.slice(0, 5).map((group, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {group.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                      {group.percentage}% of total messages
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#D97706',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        padding: '2px 8px',
                        borderRadius: 12,
                      }}
                    >
                      {group.creditsUsed} credits
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Scalability Simulator for 500+ Active Groups */}
      <div
        style={{
          borderRadius: 14,
          padding: '20px 22px',
          backgroundColor: 'rgba(37, 99, 235, 0.04)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={17} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                Scale Planning: 500+ Active Groups Projection
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Calculate required 2Chat API quota based on actual observed group message velocity.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Simulate Active Groups:
            </span>
            {[100, 250, 500, 1000].map((count) => (
              <button
                key={count}
                onClick={() => setSimulatedGroups(count)}
                style={{
                  fontSize: 11,
                  fontWeight: simulatedGroups === count ? 700 : 500,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border:
                    simulatedGroups === count ? '1px solid #2563EB' : '1px solid var(--border-subtle)',
                  backgroundColor:
                    simulatedGroups === count ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-surface)',
                  color: simulatedGroups === count ? '#2563EB' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Observed Group Velocity
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              {avgMsgPerGroupDay} <span style={{ fontSize: 12, fontWeight: 500 }}>msgs/group/day</span>
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Projected for {simulatedGroups} Groups
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#2563EB' }}>
              {simulatedDailyCredits.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500 }}>credits/day</span>
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Monthly Projected Quota ({simulatedGroups} grps)
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981' }}>
              {simulatedMonthlyCredits.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500 }}>credits/mo</span>
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Recommended 2Chat Plan
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#D97706' }}>
              {data?.projections?.recommendedTier || 'Scale Plan'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer info timestamp */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          fontSize: 11,
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          Connected to Supabase PostgreSQL &bull; Single source of truth for all WhatsApp message events
        </div>
        <div>
          Last recalculated: {lastRefreshedAt.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
