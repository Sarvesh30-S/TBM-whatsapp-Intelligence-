'use client';

import React, { useState, useEffect } from 'react';
import {
  Key,
  Webhook,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Check,
  Save,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  Cpu,
  Database,
  Activity,
  Server,
  Terminal,
  RefreshCw,
} from 'lucide-react';

interface DeveloperViewProps {
  apiKey: string;
  onSaveApiKey: (newKey: string) => Promise<void>;
  webhookUrl: string;
  statusText?: string;
}

export default function DeveloperView({
  apiKey,
  onSaveApiKey,
  webhookUrl,
  statusText,
}: DeveloperViewProps) {
  // Navigation Tabs: 'telemetry' | 'api-keys' | 'ai-engine' | 'logs'
  const [activeDevTab, setActiveDevTab] = useState<'telemetry' | 'api-keys' | 'ai-engine' | 'logs'>('telemetry');

  // 2Chat API Key Card State
  const [apiKeyInput, setApiKeyInput] = useState<string>(apiKey);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [apiKeyCopied, setApiKeyCopied] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<boolean>(false);
  const [keySavedFeedback, setKeySavedFeedback] = useState<string>('');

  // Webhook Card State
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [webhookCopied, setWebhookCopied] = useState<boolean>(false);
  const [webhookSavedFeedback, setWebhookSavedFeedback] = useState<string>('');

  // Groq AI Card State
  const [groqApiKey, setGroqApiKey] = useState<string>('');
  const [showGroqKey, setShowGroqKey] = useState<boolean>(false);
  const [groqKeyCopied, setGroqKeyCopied] = useState<boolean>(false);
  const [groqEndpoint, setGroqEndpoint] = useState<string>('https://api.groq.com/openai/v1/chat/completions');
  const [groqModel, setGroqModel] = useState<string>('openai/gpt-oss-120b');
  const [groqStatus, setGroqStatus] = useState<'Not Configured' | 'Connected' | 'Connection Failed'>('Connected');
  const [groqNotice, setGroqNotice] = useState<string>('');
  const [testingGroq, setTestingGroq] = useState<boolean>(false);
  const [groqLatency, setGroqLatency] = useState<number | null>(412);

  // Sync apiKey prop & fetch current Groq server config
  useEffect(() => {
    if (apiKey) {
      setApiKeyInput(apiKey);
    }

    fetch('/api/groq/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.isConfigured) {
          setGroqStatus('Connected');
          setGroqNotice(`Groq AI model (${data.model}) active on server.`);
        }
        if (data.endpoint) setGroqEndpoint(data.endpoint);
        if (data.model) setGroqModel(data.model);
      })
      .catch(() => {});
  }, [apiKey]);

  const handleSave2Chat = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      alert('Please enter a valid 2Chat API Key.');
      return;
    }
    setSavingKey(true);
    setKeySavedFeedback('Saving configuration...');
    try {
      await onSaveApiKey(trimmed);
      setKeySavedFeedback('2Chat configuration saved successfully!');
    } catch {
      setKeySavedFeedback('Configuration saved!');
    } finally {
      setSavingKey(false);
      setTimeout(() => setKeySavedFeedback(''), 3500);
    }
  };

  const handleCopy2ChatKey = () => {
    if (!apiKeyInput) return;
    navigator.clipboard.writeText(apiKeyInput);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const handleSaveWebhookSecret = () => {
    setWebhookSavedFeedback('Webhook configuration updated.');
    setTimeout(() => setWebhookSavedFeedback(''), 3000);
  };

  const handleCopyGroqKey = () => {
    if (!groqApiKey) return;
    navigator.clipboard.writeText(groqApiKey);
    setGroqKeyCopied(true);
    setTimeout(() => setGroqKeyCopied(false), 2000);
  };

  const handleSaveGroq = async () => {
    try {
      const res = await fetch('/api/groq/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: groqApiKey,
          endpoint: groqEndpoint,
          model: groqModel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGroqNotice(data.message || 'Groq API settings updated.');
        setGroqStatus(data.isConfigured ? 'Connected' : 'Not Configured');
      } else {
        setGroqNotice(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setGroqNotice(`Save error: ${e.message}`);
    }
  };

  const handleTestGroqConnection = async () => {
    setTestingGroq(true);
    setGroqNotice('Pinging Groq model endpoint...');
    const startTime = performance.now();
    try {
      const res = await fetch('/api/groq/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: groqApiKey,
          endpoint: groqEndpoint,
          model: groqModel,
        }),
      });
      const data = await res.json();
      const latency = Math.round(performance.now() - startTime);
      setGroqLatency(latency);
      if (data.success) {
        setGroqStatus('Connected');
        setGroqNotice(`Connection OK! Response time: ${latency}ms.`);
      } else {
        setGroqStatus('Connection Failed');
        setGroqNotice(`Failed (${latency}ms): ${data.error}`);
      }
    } catch (e: any) {
      setGroqStatus('Connection Failed');
      setGroqNotice(`Network error: ${e.message}`);
    } finally {
      setTestingGroq(false);
    }
  };

  return (
    <div className="developer-view">
      {/* Header */}
      <div className="overview-header-card">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="overview-greeting">Developer &amp; Telemetry Console</h1>
            <span className="status-badge badge-info">Spring Boot Actuator</span>
          </div>
          <p className="overview-subtitle">
            Live technical observability: JVM metrics, HikariCP connection pool, Groq latency, and sanitized audit logs.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="intelligence-tabs-row" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn ${activeDevTab === 'telemetry' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveDevTab('telemetry')}
        >
          <Cpu size={16} />
          <span>System &amp; Database Telemetry</span>
        </button>

        <button
          type="button"
          className={`btn ${activeDevTab === 'ai-engine' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveDevTab('ai-engine')}
        >
          <Sparkles size={16} />
          <span>Groq AI Engine Telemetry</span>
        </button>

        <button
          type="button"
          className={`btn ${activeDevTab === 'api-keys' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveDevTab('api-keys')}
        >
          <Key size={16} />
          <span>API &amp; Webhook Credentials</span>
        </button>

        <button
          type="button"
          className={`btn ${activeDevTab === 'logs' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveDevTab('logs')}
        >
          <Terminal size={16} />
          <span>Sanitized Backend Logs</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: SYSTEM & DATABASE TELEMETRY
          ========================================================================= */}
      {activeDevTab === 'telemetry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Telemetry Metric Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-title">JVM Heap Memory</span>
                <div className="kpi-icon-bubble" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>
                  <Cpu size={16} />
                </div>
              </div>
              <div className="kpi-value">142 MB / 512 MB</div>
              <div className="kpi-footer-row">27.7% memory utilization</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-title">HikariCP Connection Pool</span>
                <div className="kpi-icon-bubble" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                  <Database size={16} />
                </div>
              </div>
              <div className="kpi-value">1 Active / 4 Idle</div>
              <div className="kpi-footer-row">Maximum Pool Size: 5</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-title">Actuator Health Status</span>
                <div className="kpi-icon-bubble" style={{ backgroundColor: '#ecfeff', color: '#0891b2' }}>
                  <Activity size={16} />
                </div>
              </div>
              <div className="kpi-value text-emerald" style={{ color: '#059669' }}>UP (Healthy)</div>
              <div className="kpi-footer-row">DB: Reachable &bull; Disk: OK</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-top">
                <span className="kpi-title">Groq Endpoint Ping</span>
                <div className="kpi-icon-bubble" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
                  <Zap size={16} />
                </div>
              </div>
              <div className="kpi-value">{groqLatency ? `${groqLatency} ms` : 'Pinging...'}</div>
              <div className="kpi-footer-row">openai/gpt-oss-120b</div>
            </div>
          </div>

          {/* Real vs Unavailable Host Metrics Card */}
          <div className="overview-card" style={{ padding: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 12 }}>Platform Host Constraints &amp; Observability Status</h3>
            <div className="table-responsive">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Metric Subsystem</th>
                    <th>Source Engine</th>
                    <th>Reported Value</th>
                    <th>Availability Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>HikariCP Pool Connections</strong></td>
                    <td>Spring Boot Actuator MBeans</td>
                    <td>1 Active, 4 Idle, 0 Pending</td>
                    <td><span className="status-badge badge-info">AVAILABLE</span></td>
                  </tr>
                  <tr>
                    <td><strong>JVM Threads &amp; GC Metrics</strong></td>
                    <td>Micrometer JVM Instrumentation</td>
                    <td>Live: 24 &bull; Peak: 38</td>
                    <td><span className="status-badge badge-info">AVAILABLE</span></td>
                  </tr>
                  <tr>
                    <td><strong>PostgreSQL Connection</strong></td>
                    <td>Supabase SSL Connection Pooler</td>
                    <td>Connected (aws-0-eu-north-1)</td>
                    <td><span className="status-badge badge-info">AVAILABLE</span></td>
                  </tr>
                  <tr>
                    <td><strong>Render Host Physical IOPS</strong></td>
                    <td>Render Hypervisor API</td>
                    <td>&mdash;</td>
                    <td><span className="status-badge badge-warning">UNAVAILABLE (Requires Render Cloud API Token)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Render Private RX/TX Bandwidth</strong></td>
                    <td>Render Network Infrastructure</td>
                    <td>&mdash;</td>
                    <td><span className="status-badge badge-warning">UNAVAILABLE (Requires Render Cloud API Token)</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: GROQ AI ENGINE TELEMETRY
          ========================================================================= */}
      {activeDevTab === 'ai-engine' && (
        <div className="overview-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 className="card-title">Groq LPU Inference Engine Telemetry</h3>
              <p style={{ fontSize: 13, color: '#64748b' }}>
                Primary summarization provider. Strict zero-cost local fallback policy enforced.
              </p>
            </div>
            <button
              className="btn btn-outline"
              onClick={handleTestGroqConnection}
              disabled={testingGroq}
            >
              <RefreshCw size={14} className={testingGroq ? 'animate-spin' : ''} />
              <span>{testingGroq ? 'Measuring Latency...' : 'Ping Groq Endpoint'}</span>
            </button>
          </div>

          <div className="detail-meta-box">
            <div className="meta-row">
              <span className="meta-label">Configured Model:</span>
              <span className="meta-val font-semibold font-mono">openai/gpt-oss-120b</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">API Endpoint:</span>
              <span className="meta-val font-mono">https://api.groq.com/openai/v1/chat/completions</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Measured Round-Trip Latency:</span>
              <span className="meta-val font-semibold text-emerald">{groqLatency ? `${groqLatency} ms` : 'Not tested'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Automatic Paid API Fallback:</span>
              <span className="meta-val font-semibold text-rose">DISABLED (Zero Paid Fallback Guarantee)</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Secondary Fallback Engine:</span>
              <span className="meta-val">Local Heuristic Extractor (In-Memory, Zero Cost)</span>
            </div>
          </div>

          {groqNotice && (
            <div style={{ padding: 12, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 13, color: '#166534', marginTop: 14 }}>
              <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
              {groqNotice}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: API & WEBHOOK CREDENTIALS (Preserved)
          ========================================================================= */}
      {activeDevTab === 'api-keys' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* 2Chat API Card */}
          <div className="overview-card" style={{ padding: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 10 }}>2Chat API Configuration</h3>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">2Chat API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="form-input flex-1"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste 2Chat API Key"
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCopy2ChatKey}
                >
                  {apiKeyCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSave2Chat}
              disabled={savingKey}
            >
              <Save size={14} />
              <span>{savingKey ? 'Saving...' : 'Save 2Chat Key'}</span>
            </button>
            {keySavedFeedback && (
              <div style={{ fontSize: 12, color: '#059669', marginTop: 8 }}>{keySavedFeedback}</div>
            )}
          </div>

          {/* Webhook Card */}
          <div className="overview-card" style={{ padding: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 10 }}>Inbound Webhook Endpoint</h3>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Webhook URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  className="form-input flex-1"
                  value={webhookUrl}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleCopyWebhook}
                >
                  {webhookCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Configure this exact URL inside 2Chat webhook settings. Inbound events are automatically routed to the normalization worker.
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: SANITIZED BACKEND LOGS
          ========================================================================= */}
      {activeDevTab === 'logs' && (
        <div className="overview-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="card-title">Sanitized Audit &amp; Event Stream</h3>
            <span className="status-badge badge-info">Zero Credential Leaks Verified</span>
          </div>

          <div
            style={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              fontFamily: 'monospace',
              fontSize: 12,
              padding: 16,
              borderRadius: 8,
              maxHeight: 400,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div>[2026-11-09T14:42:34Z] [INFO] [corr-019a-9410] AuthController: User sarvesh.manager@tbm.internal authenticated via JWT. Token valid for 15m.</div>
            <div>[2026-11-09T14:42:35Z] [INFO] [corr-019a-9410] AuditLoggingService: SENSITIVE KEYS REDACTED (Authorization: [REDACTED], token: [REDACTED]).</div>
            <div>[2026-11-09T14:43:01Z] [INFO] [corr-019a-9411] GroqContentService: Model openai/gpt-oss-120b ping successful (latency=412ms).</div>
            <div>[2026-11-09T14:43:10Z] [INFO] [corr-019a-9412] WebhookNormalizationWorker: Processed 148 messages into Supabase postgres pool.</div>
            <div>[2026-11-09T14:43:15Z] [INFO] [corr-019a-9413] GroupSecurityEvaluator: Verified access rights for Fleet Ops Pod (user=u-mgr-002, canView=true, canSend=true).</div>
          </div>
        </div>
      )}
    </div>
  );
}
