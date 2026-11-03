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
  const [threadMessages, setThreadMessages] = useState<TwoChatMessage[]>([]);
  const [allMessages, setAllMessages] = useState<TwoChatMessage[]>([]);
  const [chatFilter, setChatFilter] = useState<'all' | 'groups' | 'direct'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [threadLoading, setThreadLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('http://localhost:3000/api/webhook/2chat');
  const [statusText, setStatusText] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('2chat_api_key') || '';
      setApiKey(savedKey);
      setApiKeyInput(savedKey);
      setWebhookUrl(`${window.location.origin}/api/webhook/2chat`);
    }
  }, []);

  // Fetch conversations directory and all cumulative messages
  const loadConversations = async (key = apiKey) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (key) params.set('apiKey', key);

      const res = await fetch(`/api/2chat/messages?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (data.channels && data.channels.length > 0) setChannels(data.channels);
        if (data.activeChannel) setActiveChannel(data.activeChannel);
        if (data.conversations && data.conversations.length > 0) setConversations(data.conversations);
        if (data.messages && data.messages.length > 0) {
          setAllMessages(data.messages);
        }
      }
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages specifically for the selected chat (silent by default on polling)
  const loadThread = async (chat: TwoChatConversation, key = apiKey, isInitialClick = false) => {
    try {
      if (isInitialClick) {
        setThreadLoading(true);
      }
      const params = new URLSearchParams();
      if (key) params.set('apiKey', key);
      params.set('chatId', chat.id);
      if (chat.isGroup) {
        params.set('isGroup', 'true');
        if (chat.groupUuid) params.set('groupUuid', chat.groupUuid);
      }

      const res = await fetch(`/api/2chat/messages?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        if (data.threadMessages && data.threadMessages.length > 0) {
          setThreadMessages(data.threadMessages);
        }
        if (data.messages && data.messages.length > 0) {
          setAllMessages(data.messages);
        }
        if (data.conversations && data.conversations.length > 0) {
          setConversations(data.conversations);
        }
      }
    } catch (err: any) {
      console.error('Error fetching thread:', err);
    } finally {
      if (isInitialClick) {
        setThreadLoading(false);
      }
    }
  };

  // Click on a chat
  const handleChatClick = (chat: TwoChatConversation) => {
    setSelectedChat(chat);
    loadThread(chat, apiKey, true);
  };

  useEffect(() => {
    loadConversations(apiKey);
  }, [apiKey]);

  // Periodic polling every 5 seconds (runs silently without blinking/wiping messages)
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations(apiKey);
      if (selectedChat) {
        loadThread(selectedChat, apiKey, false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [apiKey, selectedChat]);

  // Auto-scroll to bottom of thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  const handleSaveKey = () => {
    const trimmed = apiKeyInput.trim();
    setApiKey(trimmed);
    localStorage.setItem('2chat_api_key', trimmed);
    setStatusText('Key saved');
    setTimeout(() => setStatusText(''), 2500);
    loadConversations(trimmed);
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

  // Fallback client-side resolution of thread messages to prevent any disappearing
  const displayedMessages = React.useMemo(() => {
    if (!selectedChat) return [];

    // Filter from allMessages
    const chatDigits = cleanDigits(selectedChat.id);
    const chatNameLower = selectedChat.name.toLowerCase();

    const matched = allMessages.filter((m) => {
      if (selectedChat.isGroup || m.isGroup) {
        if (selectedChat.groupUuid && m.groupUuid === selectedChat.groupUuid) return true;
        if (m.groupUuid === selectedChat.id || m.remoteNumber === selectedChat.id) return true;
        if (m.groupName && m.groupName.toLowerCase() === chatNameLower) return true;
        if (m.chatName && m.chatName.toLowerCase() === chatNameLower) return true;
        return false;
      }

      // Direct chat
      const msgDigits = cleanDigits(m.remoteNumber);
      if (chatDigits && msgDigits) {
        return chatDigits === msgDigits || msgDigits.endsWith(chatDigits) || chatDigits.endsWith(msgDigits);
      }
      return m.remoteNumber === selectedChat.id || m.chatName === selectedChat.name;
    });

    if (matched.length > 0) return matched;
    return threadMessages;
  }, [selectedChat, allMessages, threadMessages]);

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
        loadThread(selectedChat, apiKey, false);
        loadConversations(apiKey);
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
                  setThreadMessages([]);
                  setAllMessages([]);
                  loadConversations(apiKey);
                }
              }}
            >
              Clear Messages
            </button>
          )}
          <button className="secondary" onClick={() => loadConversations(apiKey)} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
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
            placeholder="Paste 2Chat API Key here..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
          <button onClick={handleSaveKey}>
            {statusText ? statusText : 'Save Key'}
          </button>
        </div>
      </div>

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
                No chats found.
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
              {/* Thread Header */}
              <div className="thread-header">
                <div>
                  <div className="thread-header-title">
                    {selectedChat.isGroup ? `👥 ${selectedChat.name}` : selectedChat.name}
                  </div>
                  <div className="thread-header-subtitle">
                    {selectedChat.isGroup
                      ? `WhatsApp Group • ${displayedMessages.length} message${displayedMessages.length === 1 ? '' : 's'}`
                      : `${selectedChat.phoneOrId} • ${displayedMessages.length} message${displayedMessages.length === 1 ? '' : 's'}`}
                  </div>
                </div>

                <div>
                  <button
                    className="secondary"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    onClick={() => loadThread(selectedChat, apiKey, true)}
                    disabled={threadLoading}
                  >
                    {threadLoading ? 'Syncing...' : '↻ Sync Thread'}
                  </button>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="thread-messages-scroll">
                {threadLoading && displayedMessages.length === 0 ? (
                  <div className="empty-chat-state">
                    <p style={{ fontWeight: 600 }}>Loading conversation...</p>
                  </div>
                ) : displayedMessages.length === 0 ? (
                  <div className="empty-chat-state">
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>No messages in this chat yet.</p>
                    <p style={{ fontSize: 12 }}>Send a message below or wait for live updates.</p>
                  </div>
                ) : (
                  displayedMessages.map((msg) => {
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
                      ? 'You'
                      : (msg.senderName || msg.senderNumber || 'Unknown');

                    return (
                      <div
                        key={msg.id}
                        className={`message-bubble-wrapper ${isOutbound ? 'outbound' : 'inbound'}`}
                      >
                        {!isOutbound && (
                          <div className="sender-label">
                            {senderTitle}
                          </div>
                        )}

                        <div className={`bubble-content ${isOutbound ? 'outbound' : 'inbound'}`}>
                          {msg.quotedMessage && (
                            <div className="quote-box">
                              {msg.quotedMessage}
                            </div>
                          )}

                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            {msg.text || '(No text content)'}
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

        {/* Right Details Panel */}
        <aside className="livechat-info">
          {selectedChat ? (
            <>
              <div className="info-header">
                <div className="info-avatar">
                  {selectedChat.isGroup ? '👥' : '👤'}
                </div>
                <div className="info-name">{selectedChat.name}</div>
                <div className="info-type">
                  {selectedChat.isGroup ? 'WhatsApp Group' : 'Direct Contact'}
                </div>
              </div>

              <div className="info-section">
                <span className="info-label">
                  {selectedChat.isGroup ? 'Group ID / UUID' : 'Phone Number'}
                </span>
                <span className="info-value">{selectedChat.phoneOrId}</span>
              </div>

              <div className="info-section">
                <span className="info-label">Total Messages</span>
                <span className="info-value">{displayedMessages.length}</span>
              </div>

              {selectedChat.lastTimestamp && new Date(selectedChat.lastTimestamp).getTime() > 0 && (
                <div className="info-section">
                  <span className="info-label">Last Active</span>
                  <span className="info-value" style={{ fontSize: 11 }}>
                    {new Date(selectedChat.lastTimestamp).toLocaleString()}
                  </span>
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
