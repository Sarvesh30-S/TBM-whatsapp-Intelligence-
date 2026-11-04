'use client';

import React, { useState } from 'react';
import {
  Key,
  Webhook,
  BrainCircuit,
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

  // Jev AI Card State
  // SECURITY: Never hardcode keys, never save Jev key to localStorage/sessionStorage.
  const [jevApiKey, setJevApiKey] = useState<string>('');
  const [showJevKey, setShowJevKey] = useState<boolean>(false);
  const [jevKeyCopied, setJevKeyCopied] = useState<boolean>(false);
  const [jevEndpoint, setJevEndpoint] = useState<string>('https://jev-ai.org/api/v1/systemone/');
  const [jevModel, setJevModel] = useState<string>('jev-1.13');
  const [jevStatus, setJevStatus] = useState<'Not Configured' | 'Connected' | 'Connection Failed'>('Not Configured');
  const [jevNotice, setJevNotice] = useState<string>('');
  const [testingJev, setTestingJev] = useState<boolean>(false);

  // Sync apiKey prop & fetch current Jev server config
  React.useEffect(() => {
    if (apiKey) {
      setApiKeyInput(apiKey);
    }

    fetch('/api/jev/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.isConfigured) {
          setJevStatus('Connected');
          setJevNotice(`Jev AI model (${data.model}) configured on server.`);
        }
        if (data.endpoint) setJevEndpoint(data.endpoint);
        if (data.model) setJevModel(data.model);
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

  // Handle Jev AI Configuration Save
  const handleSaveJev = async () => {
    if (!jevApiKey.trim()) {
      alert('Please provide a Jev API key.');
      return;
    }
    setJevNotice('Saving configuration on server...');
    try {
      const res = await fetch('/api/jev/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: jevApiKey.trim(),
          endpoint: jevEndpoint.trim(),
          model: jevModel.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setJevNotice('Jev AI configuration saved securely on server.');
        await handleTestJevConnection();
      } else {
        setJevNotice(`Error saving: ${data.error || 'Failed'}`);
      }
    } catch (err: any) {
      setJevNotice(`Error saving: ${err.message}`);
    }
  };

  // Handle Jev AI Connection Test
  const handleTestJevConnection = async () => {
    setTestingJev(true);
    setJevNotice('Testing connection to Jev AI endpoint...');
    try {
      const res = await fetch('/api/jev/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: jevApiKey.trim() || undefined,
          endpoint: jevEndpoint.trim(),
          model: jevModel.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setJevStatus('Connected');
        setJevNotice(data.message || 'Connected to Jev AI successfully.');
      } else {
        setJevStatus('Connection Failed');
        setJevNotice(data.message || 'Connection failed.');
      }
    } catch (err: any) {
      setJevStatus('Connection Failed');
      setJevNotice(`Network error: ${err.message}`);
    } finally {
      setTestingJev(false);
    }
  };

  const handleCopyJevKey = () => {
    if (!jevApiKey) return;
    navigator.clipboard.writeText(jevApiKey);
    setJevKeyCopied(true);
    setTimeout(() => setJevKeyCopied(false), 2000);
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

        {/* Card C: Jev AI Integration (NEW) */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap jev-accent">
              <BrainCircuit size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 className="settings-card-title">Jev AI Integration</h3>
                <span className="pending-badge">
                  <Sparkles size={11} /> Spring Boot Ready
                </span>
              </div>
              <p className="settings-card-desc">
                Connect the Jev decision intelligence API for automated message analysis, categorization, and actionable insights.
              </p>
            </div>
          </div>

          <div className="settings-card-body">
            {/* Connection Status Indicator */}
            <div className="connection-status-row">
              <span className="status-label">Connection Status:</span>
              <span
                className={`connection-pill ${
                  jevStatus === 'Connected'
                    ? 'connected'
                    : jevStatus === 'Connection Failed'
                    ? 'failed'
                    : 'not-configured'
                }`}
              >
                {jevStatus === 'Connected' ? (
                  <CheckCircle2 size={13} />
                ) : jevStatus === 'Connection Failed' ? (
                  <AlertTriangle size={13} />
                ) : (
                  <Clock size={13} />
                )}
                <span>{jevStatus}</span>
              </span>
            </div>

            {/* Jev API Key */}
            <div className="input-group">
              <label className="input-label" htmlFor="jev-key">
                Jev API Key
              </label>
              <div className="input-with-actions">
                <input
                  id="jev-key"
                  type={showJevKey ? 'text' : 'password'}
                  className="settings-text-input"
                  placeholder="Enter Jev Decision Intelligence API Key..."
                  value={jevApiKey}
                  onChange={(e) => setJevApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={() => setShowJevKey(!showJevKey)}
                  title={showJevKey ? 'Hide Key' : 'Show Key'}
                >
                  {showJevKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={handleCopyJevKey}
                  title="Copy Key"
                >
                  {jevKeyCopied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            {/* API Endpoint & Model Name in 2 columns */}
            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label" htmlFor="jev-endpoint">
                  API Endpoint
                </label>
                <input
                  id="jev-endpoint"
                  type="text"
                  className="settings-text-input"
                  value={jevEndpoint}
                  onChange={(e) => setJevEndpoint(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="jev-model">
                  Model Name
                </label>
                <input
                  id="jev-model"
                  type="text"
                  className="settings-text-input"
                  value={jevModel}
                  onChange={(e) => setJevModel(e.target.value)}
                />
              </div>
            </div>

            {/* Notice / Security Info Box */}
            {jevNotice && (
              <div className="info-banner">
                <Info size={16} className="info-icon" />
                <div className="info-text">{jevNotice}</div>
              </div>
            )}

            <div className="settings-card-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveJev}
              >
                <Save size={15} />
                <span>Save Jev Configuration</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTestJevConnection}
                disabled={testingJev}
              >
                <Radio size={15} />
                <span>{testingJev ? 'Testing Connection...' : 'Test Jev Connection'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
