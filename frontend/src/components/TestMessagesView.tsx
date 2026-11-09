'use client';

import React, { useRef, useEffect } from 'react';
import {
  RotateCw,
  Trash2,
  Send,
  Users,
  MessageSquare,
  AlertCircle,
  ChevronRight,
  Key,
  Lock,
} from 'lucide-react';
import { TwoChatConversation, TwoChatMessage } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';

interface TestMessagesViewProps {
  apiKey: string;
  channels: any[];
  activeChannel: string;
  conversations: TwoChatConversation[];
  selectedChat: TwoChatConversation | null;
  onSelectChat: (chat: TwoChatConversation) => void;
  allMessages: TwoChatMessage[];
  currentChatMessages: TwoChatMessage[];
  chatFilter: 'all' | 'groups' | 'direct';
  onSetChatFilter: (filter: 'all' | 'groups' | 'direct') => void;
  searchQuery: string;
  onSetSearchQuery: (query: string) => void;
  replyText: string;
  onSetReplyText: (text: string) => void;
  loading: boolean;
  sending: boolean;
  apiErrors: string[];
  onLoadData: (key?: string, targetChatId?: string, isGroup?: boolean, groupUuid?: string) => Promise<void>;
  onSendMessage: (e?: React.FormEvent) => Promise<void>;
  onClearMessages: () => Promise<void>;
  onNavigateToDeveloper: () => void;
  targetMessageId?: string;
}

function cleanDigits(val: string): string {
  if (!val) return '';
  return val.replace(/[^0-9]/g, '');
}

function formatPhone(phone?: string): string {
  if (!phone) return '';
  const digits = cleanDigits(phone);
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

function formatSenderDisplay(msg: TwoChatMessage, channelNum?: string): string {
  const isOutbound = msg.sentBy === 'agent';
  if (isOutbound) {
    const name = msg.senderName && msg.senderName.toLowerCase() !== 'you' ? msg.senderName : '';
    const num = msg.senderNumber || channelNum || '';
    if (name && num) return `${name} (${formatPhone(num)})`;
    if (name) return `${name} (You)`;
    if (num) return `${formatPhone(num)} (You)`;
    return 'You';
  }

  const name = msg.senderName?.trim();
  const num = msg.senderNumber?.trim();
  const isGeneric = !name || ['whatsapp group', 'participant', 'unknown', 'contact', 'user'].includes(name.toLowerCase());

  if (!isGeneric && num && cleanDigits(name) !== cleanDigits(num)) {
    return `${name} (${formatPhone(num)})`;
  }
  if (!isGeneric) return name!;
  if (num) return formatPhone(num);
  return 'Unknown Sender';
}

export default function TestMessagesView({
  apiKey,
  channels,
  activeChannel,
  conversations,
  selectedChat,
  onSelectChat,
  allMessages,
  currentChatMessages,
  chatFilter,
  onSetChatFilter,
  searchQuery,
  onSetSearchQuery,
  replyText,
  onSetReplyText,
  loading,
  sending,
  apiErrors,
  onLoadData,
  onSendMessage,
  onClearMessages,
  onNavigateToDeveloper,
  targetMessageId,
}: TestMessagesViewProps) {
  const { hasPermission, hasRole } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when active chat or messages change, or scroll to targeted message
  useEffect(() => {
    if (targetMessageId) {
      const el = document.getElementById(`msg-${targetMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat, currentChatMessages, targetMessageId]);

  const sentCount = allMessages.filter((m) => m.sentBy === 'agent').length;
  const receivedCount = allMessages.filter((m) => m.sentBy === 'customer').length;

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

  const channelDisplayName = activeChannel
    ? formatPhone(activeChannel)
    : channels.length > 0
    ? `${channels[0].name || ''} (${formatPhone(channels[0].phone_number)})`.trim()
    : 'Connected Channel';

  return (
    <div className="test-messages-view">
      {/* Top Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Test Messages &amp; Live Chat</h2>
          <p className="section-subtitle">
            Send test messages, view live conversations, and verify real-time WhatsApp webhook delivery.
          </p>
        </div>
        <div className="header-actions">
          {allMessages.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onClearMessages}
            >
              <Trash2 size={14} />
              <span>Clear Messages</span>
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => onLoadData(apiKey)}
            disabled={loading}
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Fetching 2Chat...' : 'Sync Messages'}</span>
          </button>
        </div>
      </div>

      {/* Banner if 2Chat API Key is Missing */}
      {!apiKey && (
        <div className="warning-banner">
          <div className="warning-content">
            <Key size={18} className="warning-icon" />
            <div>
              <strong>2Chat API Key Required:</strong> To fetch conversations and send replies, configure your API Key in the Developer section.
            </div>
          </div>
          <button
            type="button"
            className="btn-banner-action"
            onClick={onNavigateToDeveloper}
          >
            Configure in Developer →
          </button>
        </div>
      )}

      {/* API Errors Banner */}
      {apiErrors.length > 0 && (
        <div className="error-banner">
          <AlertCircle size={18} className="error-icon" />
          <div>
            <strong>Connection Diagnostics:</strong>
            <ul style={{ marginTop: 4, paddingLeft: 18 }}>
              {apiErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2 KPI Metric Cards */}
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

      {/* Live Chat Split Window */}
      <div className="livechat-wrapper">
        {/* Left Sidebar: Conversations List */}
        <aside className="livechat-sidebar">
          <div className="sidebar-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="sidebar-title">Chats</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#666666' }}>
                {filteredConversations.length} CONVERSATION{filteredConversations.length === 1 ? '' : 'S'}
              </span>
            </div>

            <input
              type="text"
              className="search-box"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => onSetSearchQuery(e.target.value)}
            />

            <div className="filter-pills">
              <button
                type="button"
                className={`pill-btn ${chatFilter === 'all' ? 'active' : ''}`}
                onClick={() => onSetChatFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`pill-btn ${chatFilter === 'groups' ? 'active' : ''}`}
                onClick={() => onSetChatFilter('groups')}
              >
                Groups
              </button>
              <button
                type="button"
                className={`pill-btn ${chatFilter === 'direct' ? 'active' : ''}`}
                onClick={() => onSetChatFilter('direct')}
              >
                Direct
              </button>
            </div>
          </div>

          <div className="chat-items-scroll">
            {filteredConversations.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#888888', fontSize: 13 }}>
                {loading ? 'Fetching from 2Chat...' : 'No chats found. Configure your 2Chat API Key in Developer and click "Sync Messages".'}
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
                    onClick={() => onSelectChat(conv)}
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

        {/* Center Pane: Active Conversation in LIST-TYPE View */}
        <main className="livechat-thread">
          {selectedChat ? (
            <>
              {/* Thread Header */}
              <div className="thread-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: '#25D366',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: 18,
                    fontWeight: 700,
                  }}>
                    {selectedChat.isGroup ? '👥' : '💬'}
                  </div>
                  <div>
                    <div className="thread-header-title">
                      {selectedChat.name}
                    </div>
                    <div className="thread-header-subtitle">
                      {selectedChat.isGroup
                        ? `Channel: ${channelDisplayName} • ${currentChatMessages.length} message${currentChatMessages.length === 1 ? '' : 's'}`
                        : `${formatPhone(selectedChat.phoneOrId) || selectedChat.phoneOrId} • ${currentChatMessages.length} message${currentChatMessages.length === 1 ? '' : 's'}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="secondary"
                    style={{ padding: '5px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => onLoadData(apiKey, selectedChat.id, selectedChat.isGroup, selectedChat.groupUuid)}
                    disabled={loading}
                  >
                    <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
                    <span>Sync Chat</span>
                  </button>
                </div>
              </div>

              {/* Messages Stream: LIST TYPE */}
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

                    const senderDisplay = formatSenderDisplay(msg, activeChannel);

                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className={`message-list-row ${targetMessageId === msg.id ? 'highlight-pulse' : ''}`}
                      >
                        {/* Header: Sender's name, direction badge, and timestamp */}
                        <div className="message-list-header">
                          <div className="message-sender-info">
                            <span className={`sender-badge ${isOutbound ? 'outbound-badge' : 'inbound-badge'}`}>
                              {isOutbound ? 'Sent' : 'Received'}
                            </span>
                            <span className="sender-display-name">
                              {senderDisplay}
                            </span>
                          </div>
                          <span className="message-timestamp">{formattedTime}</span>
                        </div>

                        {/* Quoted Message / Reply Preview if present */}
                        {msg.quotedMessage && (
                          <div className="message-quote-box">
                            <span className="quote-mark">“</span>
                            <div className="quote-content">{msg.quotedMessage}</div>
                          </div>
                        )}

                        {/* Message Text */}
                        <div className="message-body-text">
                          {msg.text || (msg.mediaUrl ? `[Media: ${msg.mediaUrl}]` : '(No text content)')}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer / Reply Testing Form - Gated by WHATSAPP_MESSAGE_SEND or ADMIN */}
              {(hasPermission('WHATSAPP_MESSAGE_SEND') || hasRole('ADMIN')) ? (
                <form className="thread-composer" onSubmit={onSendMessage}>
                  <input
                    type="text"
                    className="composer-input"
                    placeholder={`Write a test message or reply to ${selectedChat.name}...`}
                    value={replyText}
                    onChange={(e) => onSetReplyText(e.target.value)}
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !replyText.trim()}
                    style={{ minWidth: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Send size={13} />
                    <span>{sending ? '...' : 'Send'}</span>
                  </button>
                </form>
              ) : (
                <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
                  <Lock size={15} style={{ color: '#94a3b8' }} />
                  <span>Outbound messaging disabled: Requires <strong>WHATSAPP_MESSAGE_SEND</strong> permission. Contact an Administrator to request sending privileges.</span>
                </div>
              )}
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
      </div>
    </div>
  );
}
