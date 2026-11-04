'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TwoChatConversation, TwoChatMessage } from '@/lib/types';

function cleanDigits(val: string): string {
  if (!val) return '';
  return val.replace(/[^0-9]/g, '');
}

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [channels, setChannels] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>('');
  const [conversations, setConversations] = useState<TwoChatConversation[]>([]);
  const [selectedChat, setSelectedChat] = useState<TwoChatConversation | null>(null);
  const [allMessages, setAllMessages] = useState<TwoChatMessage[]>([]);
  const [chatFilter, setChatFilter] = useState<'all' | 'groups' | 'direct'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('http://localhost:3000/api/webhook/2chat');
  const [statusText, setStatusText] = useState<string>('');
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load saved state from browser localStorage on startup & fetch from DB/API
  useEffect(() => {
    let keyToUse = '';
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('2chat_api_key') || '';
      const cachedMsgs = localStorage.getItem('cached_2chat_messages');
      const cachedConvs = localStorage.getItem('cached_2chat_conversations');

      keyToUse = savedKey;
      setApiKey(savedKey);
      setApiKeyInput(savedKey);
      setWebhookUrl(`${window.location.origin}/api/webhook/2chat`);

      if (cachedMsgs) {
        try {
          const parsed = JSON.parse(cachedMsgs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllMessages(parsed);
          }
        } catch {
          // ignore
        }
      }

      if (cachedConvs) {
        try {
          const parsed = JSON.parse(cachedConvs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setConversations(parsed);
            setSelectedChat(parsed[0]);
          }
        } catch {
          // ignore
        }
      }
    }
    // Always trigger initial fetch on mount (loads messages from Supabase Postgres / 2Chat)
    loadData(keyToUse);
  }, []);

  // Manual fetch function (NO auto refresh timer)
  const loadData = async (
    key = apiKey,
    targetChatId?: string,
    isGroup?: boolean,
    groupUuid?: string
  ) => {
    try {
      setLoading(true);
      setApiErrors([]);
      const params = new URLSearchParams();
      if (key) params.set('apiKey', key);
      if (targetChatId) params.set('chatId', targetChatId);
      if (isGroup !== undefined) params.set('isGroup', String(isGroup));
      if (groupUuid) params.set('groupUuid', groupUuid);

      const res = await fetch(`/api/2chat/messages?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (data.apiKeyConfigured && !apiKey) {
          setApiKey(data.apiKey || 'configured');
          if (typeof window !== 'undefined') {
            localStorage.setItem('2chat_api_key', data.apiKey || 'configured');
          }
        }

        if (data.apiErrors && data.apiErrors.length > 0) {
          setApiErrors(data.apiErrors);
        }

        if (data.channels && data.channels.length > 0) setChannels(data.channels);
        if (data.activeChannel) setActiveChannel(data.activeChannel);

        // Update messages cumulative store (merging so fresh server data replaces stale entries)
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          setAllMessages((prev) => {
            const map = new Map(prev.map((m) => [m.id, m]));
            for (const m of data.messages) {
              map.set(m.id, m);
            }
            const merged = Array.from(map.values());
            merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            if (typeof window !== 'undefined') {
              localStorage.setItem('cached_2chat_messages', JSON.stringify(merged));
            }
            return merged;
          });
        }

        // Update conversations list
        if (data.conversations && Array.isArray(data.conversations) && data.conversations.length > 0) {
          setConversations(data.conversations);
          if (typeof window !== 'undefined') {
            localStorage.setItem('cached_2chat_conversations', JSON.stringify(data.conversations));
          }
          if (!selectedChat) {
            setSelectedChat(data.conversations[0]);
          }
        }
      } else if (data.error) {
        setApiErrors([data.error]);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setApiErrors([err.message || 'Failed to connect to backend']);
    } finally {
      setLoading(false);
    }
  };

  // Initial load on mount or when API key is saved
  useEffect(() => {
    if (apiKey) {
      loadData(apiKey);
    }
  }, [apiKey]);

  // Click on a chat: instantly switches view and loads any additional history for this chat
  const handleChatClick = (chat: TwoChatConversation) => {
    setSelectedChat(chat);
    loadData(apiKey, chat.id, chat.isGroup, chat.groupUuid);
  };

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat, allMessages]);

  const handleSaveKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      alert('Please paste a valid 2Chat API key.');
      return;
    }
    setApiKey(trimmed);
    localStorage.setItem('2chat_api_key', trimmed);
    setStatusText('Saving...');

    // Save to server config
    try {
      await fetch('/api/2chat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });
    } catch {
      // ignore
    }

    setStatusText('Key saved!');
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

  // Metrics
  const sentCount = allMessages.filter((m) => m.sentBy === 'agent').length;
  const receivedCount = allMessages.filter((m) => m.sentBy === 'customer').length;

  // Filter conversations in left list
  const filteredConversations = conversations
    .filter((c) => {
      if (chatFilter === 'groups') return c.isGroup;
      if (chatFilter === 'direct') return !c.isGroup;
      return true;
    })
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)) ||
        (c.phoneOrId && c.phoneOrId.toLowerCase().includes(q))
      );
    });

  // Messages in the active conversation thread
  const currentChatMessages = React.useMemo(() => {
    if (!selectedChat) return [];

    const chatDigits = cleanDigits(selectedChat.id);
    const chatNameLower = selectedChat.name.toLowerCase();

    return allMessages
      .filter((m) => {
        if (selectedChat.isGroup || m.isGroup) {
          if (selectedChat.groupUuid && (m.groupUuid === selectedChat.groupUuid || m.remoteNumber === selectedChat.groupUuid)) return true;
          if (selectedChat.id && (m.groupUuid === selectedChat.id || m.remoteNumber === selectedChat.id)) return true;
          if (selectedChat.phoneOrId && (m.remoteNumber === selectedChat.phoneOrId || m.groupUuid === selectedChat.phoneOrId || m.receiverNumber === selectedChat.phoneOrId || m.toNumber === selectedChat.phoneOrId)) return true;
          if (selectedChat.name && selectedChat.name !== 'WhatsApp Group') {
            if (m.groupName && m.groupName.toLowerCase() === chatNameLower) return true;
            if (m.chatName && m.chatName.toLowerCase() === chatNameLower) return true;
          }
          return false;
        }

        // Direct chat
        const msgDigits = cleanDigits(m.remoteNumber);
        if (chatDigits && msgDigits) {
          return chatDigits === msgDigits || msgDigits.endsWith(chatDigits) || chatDigits.endsWith(msgDigits);
        }
        return m.remoteNumber === selectedChat.id || m.chatName === selectedChat.name;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [selectedChat, allMessages]);

  // Send message or group reply
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !selectedChat) return;

    if (!apiKey) {
      alert('Please enter and save your 2Chat API Key first.');
      return;
    }

    const fromNum = activeChannel || (channels.length > 0 ? channels[0].phone_number : '');
    if (!fromNum) {
      alert('No connected 2Chat WhatsApp phone number found.');
      return;
    }

    setSending(true);
    try {
      const payload: any = {
        apiKey,
        fromNumber: fromNum,
        text: replyText.trim(),
      };

      if (selectedChat.isGroup) {
        payload.toGroupUuid = selectedChat.groupUuid || selectedChat.id;
        payload.groupName = selectedChat.name;
      } else {
        payload.toNumber = selectedChat.phoneOrId || selectedChat.id;
      }

      const res = await fetch('/api/2chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(`Failed to send message: ${data.error || 'Unknown error'}`);
      } else {
        setReplyText('');
        loadData(apiKey, selectedChat.id);
      }
    } catch (err: any) {
      alert(`Send error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container">
      {/* Top Header */}
      <div className="header-row">
        <h1 className="title">Messages Dashboard</h1>
        <div className="header-actions">
          {allMessages.length > 0 && (
            <button
              className="secondary"
              onClick={async () => {
                if (confirm('Clear all stored messages?')) {
                  await fetch('/api/2chat/clear', { method: 'POST' });
                  setAllMessages([]);
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('cached_2chat_messages');
                    localStorage.removeItem('cached_2chat_conversations');
                  }
                  loadData(apiKey);
                }
              }}
            >
              Clear Messages
            </button>
          )}
          <button className="secondary" onClick={() => loadData(apiKey)} disabled={loading}>
            {loading ? 'Fetching 2Chat...' : '↻ Fetch 2Chat Messages'}
          </button>
        </div>
      </div>

      {/* Configuration Box */}
      <div className="config-section">
        <div className="config-row">
          <span className="config-label">Webhook URL</span>
          <span className="config-code">{webhookUrl}</span>
          <button className="secondary" onClick={handleCopyWebhook}>
            {copied ? 'Copied' : 'Copy URL'}
          </button>
        </div>

        <div className="config-row">
          <span className="config-label">2Chat API Key</span>
          <input
            type="password"
            className="config-input"
            placeholder="Paste your 2Chat API Key (X-User-API-Key) here..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button onClick={handleSaveKey}>
            {statusText ? statusText : 'Save Key'}
          </button>
        </div>
      </div>

      {/* API Key Missing Warning Banner */}
      {!apiKey && (
        <div
          style={{
            border: '2px solid #000000',
            backgroundColor: '#ffffff',
            padding: '16px 20px',
            marginBottom: '20px',
            borderRadius: '4px',
            fontSize: '13px',
            lineHeight: '1.6',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
            ⚠️ 2Chat API Key Required to Fetch Live Chat Messages
          </div>
          <div>
            The dashboard needs your 2Chat API Key (<code>X-User-API-Key</code>) to pull your groups (e.g. <em>Tcs 2025 Rehire Jl Update</em>) and conversations.
          </div>
          <div style={{ marginTop: '8px' }}>
            <strong>How to get it from 2Chat:</strong>
            <ol style={{ margin: '4px 0 0 18px', padding: 0 }}>
              <li>Open your 2Chat tab (<a href="https://app.2chat.io" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>app.2chat.io</a>).</li>
              <li>In the left sidebar menu, scroll to the bottom and click <strong>Developers &lt; &gt;</strong> → <strong>API Keys</strong>.</li>
              <li>Copy your API Key, paste it into the <strong>2Chat API Key</strong> box above, and click <strong>"Save Key"</strong>.</li>
            </ol>
          </div>
        </div>
      )}

      {/* API Errors Banner if 2Chat returns an error */}
      {apiErrors.length > 0 && (
        <div
          style={{
            border: '1px solid #000000',
            backgroundColor: '#f9f9f9',
            padding: '12px 18px',
            marginBottom: '20px',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          <strong>2Chat Connection Diagnostics:</strong>
          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
            {apiErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2 Main KPI Cards */}
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

      {/* WhatsApp / 2Chat Live Chat Split Layout */}
      <div className="livechat-wrapper">
        {/* Left Sidebar: Conversations List */}
        <aside className="livechat-sidebar">
          <div className="sidebar-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="sidebar-title">Live Chat</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#666666' }}>
                {filteredConversations.length} CHATS
              </span>
            </div>

            <input
              type="text"
              className="search-box"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="filter-pills">
              <button
                className={`pill-btn ${chatFilter === 'all' ? 'active' : ''}`}
                onClick={() => setChatFilter('all')}
              >
                All
              </button>
              <button
                className={`pill-btn ${chatFilter === 'groups' ? 'active' : ''}`}
                onClick={() => setChatFilter('groups')}
              >
                Groups
              </button>
              <button
                className={`pill-btn ${chatFilter === 'direct' ? 'active' : ''}`}
                onClick={() => setChatFilter('direct')}
              >
                Direct
              </button>
            </div>
          </div>

          <div className="chat-items-scroll">
            {filteredConversations.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#888888', fontSize: 13 }}>
                {loading ? 'Fetching from 2Chat...' : 'No chats found. Paste your 2Chat API Key and click "Fetch 2Chat Messages".'}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedChat?.id === conv.id;
                let formattedTime = '';
                try {
                  if (conv.lastTimestamp && new Date(conv.lastTimestamp).getTime() > 0) {
                    formattedTime = new Date(conv.lastTimestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  }
                } catch {
                  formattedTime = '';
                }

                const initial = conv.isGroup
                  ? '👥'
                  : (conv.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 1).toUpperCase() || '#');

                return (
                  <div
                    key={conv.id}
                    className={`chat-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleChatClick(conv)}
                  >
                    <div className="chat-avatar">{initial}</div>
                    <div className="chat-info">
                      <div className="chat-info-top">
                        <span className="chat-name">{conv.name}</span>
                        {formattedTime && <span className="chat-time">{formattedTime}</span>}
                      </div>
                      <div className="chat-preview">
                        {conv.lastMessage || (conv.isGroup ? 'Group Conversation' : 'Direct Conversation')}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Pane: Active Chat Conversation Thread */}
        <main className="livechat-thread">
          {selectedChat ? (
            <>
              {/* Thread Header matching 2Chat Live Chat */}
              <div className="thread-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: '#25D366',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: 16,
                  }}>
                    💬
                  </div>
                  <div>
                    <div className="thread-header-title">
                      {selectedChat.name}
                    </div>
                    <div className="thread-header-subtitle">
                      {selectedChat.isGroup
                        ? `Channel: sarvesh (+91 77386 74950) • ${currentChatMessages.length} message${currentChatMessages.length === 1 ? '' : 's'}`
                        : `${selectedChat.phoneOrId} • ${currentChatMessages.length} message${currentChatMessages.length === 1 ? '' : 's'}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="secondary"
                    style={{ padding: '5px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => loadData(apiKey, selectedChat.id, selectedChat.isGroup, selectedChat.groupUuid)}
                    disabled={loading}
                  >
                    ↻ Sync Chat
                  </button>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="thread-messages-scroll">
                {currentChatMessages.length === 0 ? (
                  <div className="empty-chat-state">
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No messages in this chat yet.</p>
                    <p style={{ fontSize: 12 }}>Incoming messages will appear here via 2Chat webhook.</p>
                  </div>
                ) : (
                  currentChatMessages.map((msg) => {
                    const isOutbound = msg.sentBy === 'agent';
                    let formattedTime = '';
                    try {
                      formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    } catch {
                      formattedTime = '';
                    }

                    const senderTitle = isOutbound
                      ? 'sarvesh (You)'
                      : (msg.senderName || msg.senderNumber || 'Participant');

                    return (
                      <div
                        key={msg.id}
                        className={`message-bubble-wrapper ${isOutbound ? 'outbound' : 'inbound'}`}
                      >
                        <div className={`sender-header ${isOutbound ? 'outbound' : 'inbound'}`}>
                          {senderTitle}
                        </div>

                        <div className={`bubble-content ${isOutbound ? 'outbound' : 'inbound'}`}>
                          {msg.quotedMessage && (
                            <div className="quote-box">
                              <span className="quote-icon">“</span>
                              <div className="quote-text">{msg.quotedMessage}</div>
                            </div>
                          )}

                          <div className="bubble-text">
                            {msg.text || (msg.mediaUrl ? `[Media: ${msg.mediaUrl}]` : '(No text content)')}
                          </div>

                          <div className="bubble-time">
                            {formattedTime}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer / Reply Bar */}
              <form className="thread-composer" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="composer-input"
                  placeholder={`Write a reply to ${selectedChat.name}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  style={{ minWidth: 70 }}
                >
                  {sending ? '...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="empty-chat-state">
              <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
              <p style={{ fontWeight: 700, fontSize: 16 }}>Select a chat or group</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                Click on any conversation from the list on the left to open and view the conversation thread.
              </p>
            </div>
          )}
        </main>

        {/* Right Details Panel matching 2Chat Live Chat */}
        <aside className="livechat-info">
          {selectedChat ? (
            <>
              <div className="info-header">
                <div className="info-avatar">
                  {selectedChat.isGroup ? '👥' : '👤'}
                </div>
                <div className="info-name">{selectedChat.name}</div>
                <div className="info-type">
                  {selectedChat.isGroup ? 'WhatsApp Group' : 'Direct WhatsApp Chat'}
                </div>
              </div>

              {selectedChat.isGroup && (
                <>
                  <div className="info-section">
                    <span className="info-label">GROUP DATA</span>
                    {selectedChat.description ? (
                      <div
                        style={{
                          maxHeight: 220,
                          overflowY: 'auto',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          padding: 10,
                          fontSize: 11.5,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: '#334155',
                        }}
                      >
                        {selectedChat.description}
                      </div>
                    ) : (
                      <span className="info-value" style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                        No description provided
                      </span>
                    )}
                  </div>

                  <div className="info-section">
                    <span className="info-label">Group JID / Phone</span>
                    <span className="info-value">{selectedChat.phoneOrId}</span>
                  </div>

                  <div className="info-section">
                    <span className="info-label">ASSIGNED TO</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Assignee</span>
                        <span style={{ fontWeight: 600 }}>Unassigned</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Team Inbox</span>
                        <span style={{ fontWeight: 600 }}>Unassigned</span>
                      </div>
                    </div>
                  </div>

                  <div className="info-section">
                    <span className="info-label">PARTICIPANTS</span>
                    <span className="info-value">
                      {selectedChat.size ? `${selectedChat.size} members` : 'Group'}
                    </span>
                  </div>
                </>
              )}

              {!selectedChat.isGroup && (
                <div className="info-section">
                  <span className="info-label">Phone Number</span>
                  <span className="info-value">{selectedChat.phoneOrId}</span>
                </div>
              )}

              <div className="info-section">
                <span className="info-label">Total Messages</span>
                <span className="info-value">{currentChatMessages.length}</span>
              </div>

              {selectedChat.lastTimestamp && new Date(selectedChat.lastTimestamp).getTime() > 0 && (
                <div className="info-section">
                  <span className="info-label">Last Active</span>
                  <span className="info-value" style={{ fontSize: 11 }}>
                    {new Date(selectedChat.lastTimestamp).toLocaleString()}
                  </span>
                </div>
              )}

              {selectedChat.twoChatLink && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={selectedChat.twoChatLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="secondary"
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      textDecoration: 'none',
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Open in 2Chat Live Chat ↗
                  </a>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#888888', fontSize: 12, textAlign: 'center', marginTop: 30 }}>
              No chat selected
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
