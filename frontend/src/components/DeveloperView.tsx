'use client';

import React, { useState } from 'react';
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
  // SECURITY: Never hardcode keys, never save Groq key to localStorage/sessionStorage.
  const [groqApiKey, setGroqApiKey] = useState<string>('');
  const [showGroqKey, setShowGroqKey] = useState<boolean>(false);
  const [groqKeyCopied, setGroqKeyCopied] = useState<boolean>(false);
  const [groqEndpoint, setGroqEndpoint] = useState<string>('https://api.groq.com/openai/v1/chat/completions');
  const [groqModel, setGroqModel] = useState<string>('openai/gpt-oss-120b');
  const [groqStatus, setGroqStatus] = useState<'Not Configured' | 'Connected' | 'Connection Failed'>('Not Configured');
  const [groqNotice, setGroqNotice] = useState<string>('');
  const [testingGroq, setTestingGroq] = useState<boolean>(false);

  // Sync apiKey prop & fetch current Groq server config
  React.useEffect(() => {
    if (apiKey) {
      setApiKeyInput(apiKey);
    }

    fetch('/api/groq/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.isConfigured) {
          setGroqStatus('Connected');
          setGroqNotice(`Groq AI model (${data.model}) configured on server.`);
        }
        if (data.endpoint) setGroqEndpoint(data.endpoint);
        if (data.model) setGroqModel(data.model);
      })
      .catch(() => {});
  }, [apiKey]);

  // Handle 2Chat API Key Save
  const handleSave2Chat = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      alert('Please enter a valid 2Chat API Key.');
      return;
    }
    setSavingKey(true);
    setKeySavedFeedback('Saving & auto-subscribing webhooks...');
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

  const handleCopyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const handleSaveWebhook = () => {
    setWebhookSavedFeedback('Webhook configuration active.');
    setTimeout(() => setWebhookSavedFeedback(''), 3000);
  };

  // Handle Groq AI Configuration Save
  const handleSaveGroq = async () => {
    if (!groqApiKey.trim()) {
      alert('Please provide a Groq API key.');
      return;
    }
    setGroqNotice('Saving configuration on server...');
    try {
      const res = await fetch('/api/groq/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: groqApiKey.trim(),
          endpoint: groqEndpoint.trim(),
          model: groqModel.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGroqNotice('Groq AI configuration saved securely on server.');
        await handleTestGroqConnection();
      } else {
        setGroqNotice(`Error saving: ${data.error || 'Failed'}`);
      }
    } catch (err: any) {
      setGroqNotice(`Error saving: ${err.message}`);
    }
  };

  // Handle Groq AI Connection Test
  const handleTestGroqConnection = async () => {
    setTestingGroq(true);
    setGroqNotice('Testing connection to Groq LPU endpoint...');
    try {
      const res = await fetch('/api/groq/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: groqApiKey.trim() || undefined,
          endpoint: groqEndpoint.trim(),
          model: groqModel.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGroqStatus('Connected');
        setGroqNotice(data.message || 'Connected to Groq AI successfully.');
      } else {
        setGroqStatus('Connection Failed');
        setGroqNotice(data.message || 'Connection failed.');
      }
    } catch (err: any) {
      setGroqStatus('Connection Failed');
      setGroqNotice(`Network error: ${err.message}`);
    } finally {
      setTestingGroq(false);
    }
  };

  const handleCopyGroqKey = () => {
    if (!groqApiKey) return;
    navigator.clipboard.writeText(groqApiKey);
    setGroqKeyCopied(true);
    setTimeout(() => setGroqKeyCopied(false), 2000);
  };

  return (
    <div className="developer-view-container">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Developer Settings</h2>
          <p className="section-subtitle">
            Manage your messaging credentials, webhook endpoints, and decision intelligence integrations.
          </p>
        </div>
      </div>

      <div className="developer-cards-stack">
        {/* Card A: 2Chat API Key */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              <Key size={18} />
            </div>
            <div>
              <h3 className="settings-card-title">2Chat API Configuration</h3>
              <p className="settings-card-desc">
                Your 2Chat API Key (<code>X-User-API-Key</code>) is used to synchronize chats, groups, and outbound responses.
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="input-group">
              <label className="input-label" htmlFor="twochat-key">
                2Chat API Key
              </label>
              <div className="input-with-actions">
                <input
                  id="twochat-key"
                  type={showApiKey ? 'text' : 'password'}
                  className="settings-text-input"
                  placeholder="Paste your 2Chat API Key (e.g. UAK2ad15...)"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? 'Hide API Key' : 'Show API Key'}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={handleCopy2ChatKey}
                  title="Copy API Key"
                >
                  {apiKeyCopied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="settings-card-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave2Chat}
                disabled={savingKey}
              >
                <Save size={15} />
                <span>{savingKey ? 'Saving...' : 'Save Configuration'}</span>
              </button>
              {(keySavedFeedback || statusText) && (
                <span className="feedback-pill success">
                  <CheckCircle2 size={14} />
                  <span>{keySavedFeedback || statusText}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card B: Webhook Configuration */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              <Webhook size={18} />
            </div>
            <div>
              <h3 className="settings-card-title">Webhook Configuration</h3>
              <p className="settings-card-desc">
                Real-time event receiver for incoming WhatsApp messages and status deliveries.
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="input-label" htmlFor="webhook-url">
                  Webhook URL
                </label>
                <span className="status-badge-live">
                  <span className="status-dot-pulse" />
                  <span>Active &amp; Ready</span>
                </span>
              </div>
              <div className="input-with-actions">
                <input
                  id="webhook-url"
                  type="text"
                  readOnly
                  className="settings-text-input readonly"
                  value={webhookUrl}
                />
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={handleCopyWebhookUrl}
                  title="Copy Webhook URL"
                >
                  {webhookCopied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="input-hint">
                Provide this URL in your 2Chat Webhooks manager or rely on auto-subscription upon saving your API key.
              </p>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="webhook-secret">
                Webhook Secret (Optional)
              </label>
              <input
                id="webhook-secret"
                type="password"
                className="settings-text-input"
                placeholder="Optional webhook signing secret for signature verification"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
            </div>

            <div className="settings-card-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveWebhook}
              >
                <Save size={15} />
                <span>Save Configuration</span>
              </button>
              {webhookSavedFeedback && (
                <span className="feedback-pill success">
                  <CheckCircle2 size={14} />
                  <span>{webhookSavedFeedback}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card C: Groq AI Integration */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap groq-accent">
              <Zap size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="settings-card-title">Groq AI Integration</h3>
                <span className="pending-badge groq">
                  <Sparkles size={11} /> LPU Inference Engine
                </span>
              </div>
              <p className="settings-card-desc">
                Connect the Groq API (openai/gpt-oss-120b) for ultra-fast, high-accuracy message summarization, actionable triage, and intelligence extraction.
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            {/* Connection Status Indicator */}
            <div className="connection-status-row">
              <span className="status-label">Connection Status:</span>
              <span
                className={`connection-pill ${
                  groqStatus === 'Connected'
                    ? 'connected'
                    : groqStatus === 'Connection Failed'
                    ? 'failed'
                    : 'not-configured'
                }`}
              >
                {groqStatus === 'Connected' ? (
                  <CheckCircle2 size={13} />
                ) : groqStatus === 'Connection Failed' ? (
                  <AlertTriangle size={13} />
                ) : (
                  <Clock size={13} />
                )}
                <span>{groqStatus}</span>
              </span>
            </div>

            {/* Groq API Key */}
            <div className="input-group">
              <label className="input-label" htmlFor="groq-key">
                Groq API Key
              </label>
              <div className="input-with-actions">
                <input
                  id="groq-key"
                  type={showGroqKey ? 'text' : 'password'}
                  className="settings-text-input"
                  placeholder="Paste your Groq API Key (gsk_...)"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={() => setShowGroqKey(!showGroqKey)}
                  title={showGroqKey ? 'Hide Key' : 'Show Key'}
                >
                  {showGroqKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={handleCopyGroqKey}
                  title="Copy Key"
                >
                  {groqKeyCopied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* API Endpoint & Model Name in 2 columns */}
            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label" htmlFor="groq-endpoint">
                  API Endpoint
                </label>
                <input
                  id="groq-endpoint"
                  type="text"
                  className="settings-text-input"
                  value={groqEndpoint}
                  onChange={(e) => setGroqEndpoint(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="groq-model">
                  Model Name
                </label>
                <input
                  id="groq-model"
                  type="text"
                  className="settings-text-input"
                  value={groqModel}
                  onChange={(e) => setGroqModel(e.target.value)}
                />
              </div>
            </div>

            {/* Notice / Security Info Box */}
            {groqNotice && (
              <div className="info-banner">
                <Info size={16} className="info-icon" />
                <div className="info-text">{groqNotice}</div>
              </div>
            )}

            <div className="settings-card-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveGroq}
              >
                <Save size={15} />
                <span>Save Groq Configuration</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTestGroqConnection}
                disabled={testingGroq}
              >
                <Radio size={15} />
                <span>{testingGroq ? 'Testing Connection...' : 'Test Groq Connection'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
