'use client';

import React, { useRef, useEffect, useState } from 'react';
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
  Search,
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
  const [mobileChatView, setMobileChatView] = useState<'list' | 'thread'>('list');

  // Switch to thread view on mobile if a specific message or chat is targeted
  useEffect(() => {
    if (targetMessageId && selectedChat) {
      setMobileChatView('thread');
    }
  }, [targetMessageId, selectedChat]);

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

  const allCount = conversations.length;
  const groupsCount = conversations.filter((c) => c.isGroup).length;
  const directCount = conversations.filter((c) => !c.isGroup).length;

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

  const formatChatTimestamp = (ts?: string | number): string => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
      }
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getConvMsgCount = (conv: TwoChatConversation): number => {
    const matchingCount = allMessages.filter((m) => {
      if (conv.isGroup) {
        return (
          (conv.groupUuid && m.groupUuid === conv.groupUuid) ||
          m.chatName === conv.name ||
          m.groupName === conv.name
        );
      }
      return (
        m.remoteNumber === conv.phoneOrId ||
        m.senderNumber === conv.phoneOrId ||
        m.fromNumber === conv.phoneOrId ||
        m.toNumber === conv.phoneOrId ||
        m.chatName === conv.name
      );
    }).length;

    return matchingCount > 0 ? matchingCount : conv.messageCount || 0;
  };

  return (
    <div className="test-messages-view">
      {/* Sleek Workspace Header with Inline Stats */}
      <div className="chat-workspace-header">
        <div className="chat-workspace-title-row">
          <div className="chat-workspace-title-block">
            <h2 className="chat-workspace-title">Active Groups &amp; Live Chat</h2>
            <div className="chat-workspace-stats-pill">
              <span className="live-dot" />
              <span>Live Sync</span>
              <span className="stats-divider">•</span>
              <span>{conversations.length} Active Groups</span>
              <span className="stats-divider">•</span>
              <span>{allMessages.length} Messages Synced</span>
            </div>
          </div>

          <div className="chat-workspace-actions">
            {allMessages.length > 0 && (
              <button
                type="button"
                className="btn-chat-action secondary"
                onClick={onClearMessages}
                title="Clear local messages cache"
              >
                <Trash2 size={13} />
                <span>Clear Cache</span>
              </button>
            )}
            <button
              type="button"
              className="btn-chat-action primary"
              onClick={() => onLoadData(apiKey)}
              disabled={loading}
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Syncing...' : 'Sync Messages'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connection Diagnostics Banner if needed */}
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

      {/* Live Chat Split Window */}
      <div className="livechat-wrapper">
        {/* Left Sidebar: Active Groups List Pane */}
        <aside className={`livechat-sidebar ${mobileChatView === 'thread' ? 'mobile-hidden-pane' : ''}`}>
          <div className="active-groups-header">
            <div className="active-groups-title-row">
              <span className="active-groups-title">Active Groups</span>
              <span className="active-groups-count-badge">
                {conversations.length} groups
              </span>
            </div>

            <div className="active-groups-search-wrapper">
              <Search size={14} className="active-groups-search-icon" />
              <input
                type="text"
                className="active-groups-search-input"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => onSetSearchQuery(e.target.value)}
              />
            </div>

            <div className="active-groups-pills">
              <button
                type="button"
                className={`active-group-pill ${chatFilter === 'all' ? 'active' : ''}`}
                onClick={() => onSetChatFilter('all')}
              >
                All ({allCount})
              </button>
              <button
                type="button"
                className={`active-group-pill ${chatFilter === 'groups' ? 'active' : ''}`}
                onClick={() => onSetChatFilter('groups')}
              >
                Groups ({groupsCount})
              </button>
              <button
                type="button"
                className={`active-group-pill ${chatFilter === 'direct' ? 'active' : ''}`}
                onClick={() => onSetChatFilter('direct')}
              >
                Direct ({directCount})
              </button>
            </div>
          </div>

          <div className="chat-items-scroll">
            {filteredConversations.length === 0 ? (
              <div className="empty-groups-state">
                {loading ? 'Fetching groups...' : 'No conversations found.'}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedChat?.id === conv.id;
                const formattedTime = formatChatTimestamp(conv.lastTimestamp);
                const msgCount = getConvMsgCount(conv);

                return (
                  <div
                    key={conv.id}
                    className={`active-group-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      onSelectChat(conv);
                      setMobileChatView('thread');
                    }}
                  >
                    <div className="group-card-top">
                      <span className="group-card-name" title={conv.name}>
                        {conv.name}
                      </span>
                      {formattedTime && (
                        <span className="group-card-time">{formattedTime}</span>
                      )}
                    </div>
                    <div className="group-card-bottom">
                      <span className="group-card-snippet">
                        {conv.lastMessage || (conv.isGroup ? 'Group Conversation' : 'Direct Conversation')}
                      </span>
                      {msgCount > 0 && (
                        <span className="group-card-badge">{msgCount}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Pane: Active Conversation */}
        <main className={`livechat-thread ${mobileChatView === 'list' ? 'mobile-hidden-pane' : ''}`}>
          {selectedChat ? (
            <>
              {/* Thread Header (Clean, professional, strictly NO DPs) */}
              <div className="thread-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    type="button"
                    className="mobile-back-to-chats-btn"
                    onClick={() => setMobileChatView('list')}
                    aria-label="Back to conversations list"
                  >
                    ← Groups
                  </button>
                  <div className="thread-header-info">
                    <div className="thread-header-title">
                      {selectedChat.name}
                    </div>
                    <div className="thread-header-subtitle">
                      {selectedChat.isGroup
                        ? `${currentChatMessages.length} messages • Active now`
                        : `${formatPhone(selectedChat.phoneOrId) || selectedChat.phoneOrId} • ${currentChatMessages.length} messages`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-chat-action secondary"
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
