'use client';

import React, { useState, useEffect } from 'react';
import { TwoChatMessage } from '@/lib/types';

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [messages, setMessages] = useState<TwoChatMessage[]>([]);
  const [filter, setFilter] = useState<'all' | 'groups' | 'direct' | 'received' | 'sent'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('http://localhost:3000/api/webhook/2chat');
  const [statusText, setStatusText] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('2chat_api_key') || '';
      setApiKey(savedKey);
      setApiKeyInput(savedKey);
      setWebhookUrl(`${window.location.origin}/api/webhook/2chat`);
    }
  }, []);

  const loadData = async (key = apiKey) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (key) params.set('apiKey', key);

      const res = await fetch(`/api/2chat/messages?${params.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(apiKey);
  }, [apiKey]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(apiKey);
    }, 5000);
    return () => clearInterval(interval);
  }, [apiKey]);

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    setApiKey(trimmed);
    localStorage.setItem('2chat_api_key', trimmed);
    setStatusText('Key saved');
    setTimeout(() => setStatusText(''), 2500);
    loadData(trimmed);
  };

  const handleCopyWebhook = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Metrics calculation
  const sentCount = messages.filter((m) => m.sentBy === 'agent').length;
  const receivedCount = messages.filter((m) => m.sentBy === 'customer').length;

  // Filter & Search messages
  const filteredMessages = messages
    .filter((m) => {
      if (filter === 'received') return m.sentBy === 'customer';
      if (filter === 'sent') return m.sentBy === 'agent';
      if (filter === 'groups') return Boolean(m.isGroup);
      if (filter === 'direct') return !m.isGroup;
      return true;
    })
    .filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (m.chatName && m.chatName.toLowerCase().includes(q)) ||
        (m.groupName && m.groupName.toLowerCase().includes(q)) ||
        (m.senderName && m.senderName.toLowerCase().includes(q)) ||
        (m.senderNumber && m.senderNumber.toLowerCase().includes(q)) ||
        (m.text && m.text.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="container">
      {/* Top Header */}
      <div className="header-row">
        <h1 className="title">Messages Dashboard</h1>
        <div className="header-actions">
          {messages.length > 0 && (
            <button
              className="secondary"
              onClick={async () => {
                if (confirm('Clear all stored messages?')) {
                  await fetch('/api/2chat/clear', { method: 'POST' });
                  loadData(apiKey);
                }
              }}
            >
              Clear Messages
            </button>
          )}
          <button className="secondary" onClick={() => loadData(apiKey)} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Configuration Box */}
      <div className="config-section">
        {/* Webhook URL */}
        <div className="config-row">
          <span className="config-label">Webhook URL</span>
          <span className="config-code">{webhookUrl}</span>
          <button className="secondary" onClick={handleCopyWebhook}>
            {copied ? 'Copied' : 'Copy URL'}
          </button>
        </div>

        {/* API Key */}
        <div className="config-row">
          <span className="config-label">2Chat API Key</span>
          <input
            type="password"
            className="config-input"
            placeholder="Paste 2Chat API Key here..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button onClick={handleSaveKey}>
            {statusText ? statusText : 'Save Key'}
          </button>
        </div>
      </div>

      {/* 2 Main Cards */}
      <div className="cards-grid">
        <div className="card">
          <div className="card-title">Messages Sent</div>
          <div className="card-count">{sentCount}</div>
        </div>

        <div className="card">
          <div className="card-title">Messages Received</div>
          <div className="card-count">{receivedCount}</div>
        </div>
      </div>

      {/* Messages Header, Search & Filters */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h2 className="section-title">All Messages ({filteredMessages.length})</h2>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="config-input"
            style={{ width: 220, padding: '4px 10px', fontSize: 12 }}
            placeholder="Search group, name, text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="filter-row">
            <button
              className={`filter-btn ${filter === 'all' ? '' : 'secondary'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'groups' ? '' : 'secondary'}`}
              onClick={() => setFilter('groups')}
            >
              Groups
            </button>
            <button
              className={`filter-btn ${filter === 'direct' ? '' : 'secondary'}`}
              onClick={() => setFilter('direct')}
            >
              Direct
            </button>
            <button
              className={`filter-btn ${filter === 'received' ? '' : 'secondary'}`}
              onClick={() => setFilter('received')}
            >
              Received
            </button>
            <button
              className={`filter-btn ${filter === 'sent' ? '' : 'secondary'}`}
              onClick={() => setFilter('sent')}
            >
              Sent
            </button>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="messages-list">
        {filteredMessages.length === 0 ? (
          <div className="empty-box">
            No messages found. Messages received via 2Chat, group chats, or your webhook will appear here with proper group and sender details.
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isReceived = msg.sentBy === 'customer';
            let formattedDate = msg.timestamp;
            try {
              formattedDate = new Date(msg.timestamp).toLocaleString();
            } catch {
              // fallback
            }

            // Determine proper sender display: Name (+Number), or Number if not saved
            let senderDisplay = msg.senderName;
            if (msg.senderNumber && msg.senderName !== msg.senderNumber && !msg.senderName.includes(msg.senderNumber)) {
              senderDisplay = `${msg.senderName} (${msg.senderNumber})`;
            } else if (!msg.senderName || msg.senderName === msg.senderNumber) {
              senderDisplay = msg.senderNumber || 'Unknown Number';
            }

            return (
              <div key={msg.id} className="message-item">
                <div className="message-header">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${isReceived ? 'received' : 'sent'}`}>
                      {isReceived ? 'Received' : 'Sent'}
                    </span>

                    {/* Proper Group Name if group message */}
                    {msg.isGroup && (
                      <span
                        className="badge"
                        style={{ backgroundColor: '#f0f0f0', color: '#000000', border: '1px solid #d0d0d0' }}
                      >
                        GROUP: {msg.groupName || msg.chatName}
                      </span>
                    )}

                    {/* Proper Chat Name */}
                    <div style={{ fontSize: 13, color: '#333333' }}>
                      <span style={{ color: '#777777', fontSize: 11, marginRight: 4, textTransform: 'uppercase' }}>
                        Chat:
                      </span>
                      <strong>{msg.chatName || msg.groupName || senderDisplay}</strong>
                    </div>

                    {/* Proper Sender Name or Number if not saved */}
                    <div style={{ fontSize: 13, color: '#333333', marginLeft: 6 }}>
                      <span style={{ color: '#777777', fontSize: 11, marginRight: 4, textTransform: 'uppercase' }}>
                        Sender:
                      </span>
                      <span>{senderDisplay}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#888888', textTransform: 'uppercase' }}>
                      {msg.source}
                    </span>
                    <span className="meta-time">{formattedDate}</span>
                  </div>
                </div>

                {/* The text message what it says */}
                <div className="message-text" style={{ fontSize: 15, marginTop: 4 }}>
                  {msg.text || '(No text content)'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
