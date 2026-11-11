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
  Plus,
  Smile,
  Paperclip,
  FileText,
  Download,
  CheckCheck,
  Image as ImageIcon,
  Link2,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { TwoChatConversation, TwoChatMessage } from '@/lib/types';
import { GroupIntelligenceBriefing } from '@/lib/groq-client';
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
  const [mobileChatView, setMobileChatView] = useState<'list' | 'thread' | 'summary'>('list');
  const [threadTab, setThreadTab] = useState<'messages' | 'media' | 'files' | 'links'>('messages');
  const [showSummaryPane, setShowSummaryPane] = useState<boolean>(true);
  const [summaryBriefing, setSummaryBriefing] = useState<GroupIntelligenceBriefing | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryLanguage, setSummaryLanguage] = useState<'hinglish' | 'english'>('english');
  const [recentDevelopmentsOpen, setRecentDevelopmentsOpen] = useState<boolean>(false);

  // Flexible Panel Widths (Resizable by dragging splitters)
  const [groupsWidth, setGroupsWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tbm_chat_groups_width');
      if (saved) return Math.max(200, Math.min(550, parseInt(saved, 10)));
    }
    return 290;
  });

  const [summaryWidth, setSummaryWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tbm_chat_summary_width');
      if (saved) return Math.max(260, Math.min(650, parseInt(saved, 10)));
    }
    return 380;
  });

  const [isResizingGroups, setIsResizingGroups] = useState<boolean>(false);
  const [isResizingSummary, setIsResizingSummary] = useState<boolean>(false);

  const handleGroupsResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingGroups(true);
    const startX = e.clientX;
    const startWidth = groupsWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(550, startWidth + delta));
      setGroupsWidth(newWidth);
      if (typeof window !== 'undefined') {
        localStorage.setItem('tbm_chat_groups_width', newWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizingGroups(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSummaryResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSummary(true);
    const startX = e.clientX;
    const startWidth = summaryWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(260, Math.min(650, startWidth + delta));
      setSummaryWidth(newWidth);
      if (typeof window !== 'undefined') {
        localStorage.setItem('tbm_chat_summary_width', newWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizingSummary(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const resetColumnWidths = () => {
    setGroupsWidth(290);
    setSummaryWidth(380);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tbm_chat_groups_width');
      localStorage.removeItem('tbm_chat_summary_width');
    }
  };

  // Fetch AI Summary briefing for active chat
  useEffect(() => {
    if (!selectedChat) {
      setSummaryBriefing(null);
      return;
    }
    let isCancelled = false;
    setSummaryLoading(true);

    fetch('/api/groq/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'group_intelligence',
        groupName: selectedChat.name,
        messages: currentChatMessages.length > 0 ? currentChatMessages : undefined,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!isCancelled && json.success && json.data) {
          setSummaryBriefing(json.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setSummaryLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedChat?.id, currentChatMessages.length]);

  // Switch to thread view on mobile if a specific message or chat is targeted
  useEffect(() => {
    if (targetMessageId && selectedChat) {
      setMobileChatView('thread');
    }
  }, [targetMessageId, selectedChat]);

  // Auto-scroll when active chat or messages change, or scroll to targeted message
  useEffect(() => {
    if (threadTab !== 'messages') return;
    if (targetMessageId) {
      const el = document.getElementById(`msg-${targetMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat, currentChatMessages, targetMessageId, threadTab]);

  const sentCount = allMessages.filter((m) => m.sentBy === 'agent' || m.sentBy === 'user').length;
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

  const formatDateSeparator = (ts?: string | number): string => {
    if (!ts) return 'Today';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return 'Today';
      const now = new Date();
      if (d.toDateString() === now.toDateString()) return 'Today';
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Today';
    }
  };

  const extractFileName = (url?: string, fallback: string = 'Document'): string => {
    if (!url) return fallback;
    try {
      const clean = url.split('?')[0];
      const parts = clean.split('/');
      const last = parts[parts.length - 1];
      if (last && last.includes('.')) {
        return decodeURIComponent(last);
      }
    } catch {
      // ignore
    }
    return fallback;
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

  // Filter media, files, and links for subtabs
  const mediaMessages = currentChatMessages.filter((m) => {
    if (!m.mediaUrl) return false;
    const url = m.mediaUrl.toLowerCase();
    return url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.webp') || url.endsWith('.gif') || url.includes('image');
  });

  const fileMessages = currentChatMessages.filter((m) => {
    if (!m.mediaUrl) return false;
    const url = m.mediaUrl.toLowerCase();
    return url.endsWith('.pdf') || url.endsWith('.doc') || url.endsWith('.docx') || url.endsWith('.xls') || url.endsWith('.xlsx') || url.includes('document');
  });

  const linkMessages = currentChatMessages.filter((m) => {
    return /https?:\/\/[^\s]+/gi.test(m.text || '');
  });

  // Track dates for separator insertion
  let lastDateLabel = '';

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
            <button
              type="button"
              className="btn-chat-action secondary desktop-only"
              onClick={resetColumnWidths}
              title="Reset column widths to default (Double-click any divider to reset)"
            >
              <span>Reset Layout</span>
            </button>
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

      {/* Live Chat 3-Pane Window (Groups | Conversation | AI Summary) */}
      <div className={`livechat-wrapper ${showSummaryPane ? 'summary-expanded' : 'summary-collapsed'}`}>
        {/* Left Sidebar: Active Groups List Pane (Flexible Resizable Width) */}
        <aside
          className={`livechat-sidebar ${mobileChatView === 'thread' || mobileChatView === 'summary' ? 'mobile-hidden-pane' : ''}`}
          style={{ width: groupsWidth, minWidth: groupsWidth, maxWidth: groupsWidth, flexShrink: 0 }}
        >
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

        {/* Left Resizer: Drag to resize Active Groups */}
        <div
          className={`pane-resizer groups-resizer desktop-only ${isResizingGroups ? 'resizing' : ''}`}
          onMouseDown={handleGroupsResizeStart}
          onDoubleClick={() => setGroupsWidth(290)}
          title="Drag to resize Active Groups • Double-click to reset"
          role="separator"
          aria-orientation="vertical"
        >
          <div className="resizer-handle-line" />
        </div>

        {/* Center Pane: Active Conversation (Flexible Stretch Width) */}
        <main
          className={`livechat-thread ${mobileChatView === 'list' || mobileChatView === 'summary' ? 'mobile-hidden-pane' : ''}`}
          style={{ flex: 1, minWidth: 280 }}
        >
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
                    className={`btn-chat-action ${showSummaryPane ? 'primary' : 'secondary'}`}
                    onClick={() => {
                      setShowSummaryPane(!showSummaryPane);
                      if (mobileChatView === 'thread') {
                        setMobileChatView('summary');
                      }
                    }}
                    title="Toggle AI Summary Pane"
                  >
                    <Sparkles size={12} />
                    <span>AI Summary</span>
                  </button>
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

              {/* Subheader Tabs: Messages, Media, Files, Links */}
              <div className="thread-subtabs">
                <button
                  type="button"
                  className={`thread-subtab-pill ${threadTab === 'messages' ? 'active' : ''}`}
                  onClick={() => setThreadTab('messages')}
                >
                  Messages
                </button>
                <button
                  type="button"
                  className={`thread-subtab-pill ${threadTab === 'media' ? 'active' : ''}`}
                  onClick={() => setThreadTab('media')}
                >
                  Media ({mediaMessages.length})
                </button>
                <button
                  type="button"
                  className={`thread-subtab-pill ${threadTab === 'files' ? 'active' : ''}`}
                  onClick={() => setThreadTab('files')}
                >
                  Files ({fileMessages.length})
                </button>
                <button
                  type="button"
                  className={`thread-subtab-pill ${threadTab === 'links' ? 'active' : ''}`}
                  onClick={() => setThreadTab('links')}
                >
                  Links ({linkMessages.length})
                </button>
              </div>

              {/* View 1: Main Conversation Stream */}
              {threadTab === 'messages' && (
                <>
                  <div className="thread-messages-scroll">
                    {currentChatMessages.length === 0 ? (
                      <div className="empty-chat-state">
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>No messages in this chat yet.</p>
                        <p style={{ fontSize: 12 }}>Incoming messages will appear here via 2Chat webhook.</p>
                      </div>
                    ) : (
                      currentChatMessages.map((msg) => {
                        const isOutbound = msg.sentBy === 'agent' || msg.sentBy === 'user';
                        let formattedTime = '';
                        try {
                          formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          });
                        } catch {
                          formattedTime = '';
                        }

                        const senderDisplay = formatSenderDisplay(msg, activeChannel);
                        const dateLabel = formatDateSeparator(msg.timestamp);
                        const showDateSep = dateLabel !== lastDateLabel;
                        if (showDateSep) {
                          lastDateLabel = dateLabel;
                        }

                        const hasFileAttachment = msg.mediaUrl && (
                          msg.mediaUrl.toLowerCase().endsWith('.pdf') ||
                          msg.mediaUrl.toLowerCase().endsWith('.doc') ||
                          msg.mediaUrl.toLowerCase().endsWith('.docx') ||
                          msg.mediaUrl.toLowerCase().includes('pdf') ||
                          msg.mediaUrl.toLowerCase().includes('document')
                        );

                        return (
                          <React.Fragment key={msg.id}>
                            {showDateSep && (
                              <div className="date-separator-row">
                                <span className="date-separator-pill">{dateLabel}</span>
                              </div>
                            )}

                            <div
                              id={`msg-${msg.id}`}
                              className={`chat-bubble-row ${isOutbound ? 'outbound' : 'inbound'} ${targetMessageId === msg.id ? 'highlight-pulse' : ''}`}
                            >
                              <div className={`chat-bubble ${isOutbound ? 'outbound' : 'inbound'}`}>
                                {/* Sender name in bold indigo for inbound bubbles, strictly NO DP */}
                                {!isOutbound && (
                                  <div className="bubble-sender-name">{senderDisplay}</div>
                                )}

                                {/* Quoted message if present */}
                                {msg.quotedMessage && (
                                  <div className="bubble-quote-box">
                                    <span className="quote-text">{msg.quotedMessage}</span>
                                  </div>
                                )}

                                {/* Message text */}
                                {msg.text && (
                                  <div className="bubble-text">{msg.text}</div>
                                )}

                                {/* Document / File Attachment Card if present */}
                                {hasFileAttachment && (
                                  <div className="bubble-attachment-card">
                                    <div className="attachment-icon-box file">
                                      <FileText size={18} />
                                    </div>
                                    <div className="attachment-meta">
                                      <span className="attachment-name">
                                        {extractFileName(msg.mediaUrl, 'Document.pdf')}
                                      </span>
                                      <span className="attachment-sub">PDF Document</span>
                                    </div>
                                    <a
                                      href={msg.mediaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="attachment-download-btn"
                                      title="Download attachment"
                                    >
                                      <Download size={14} />
                                    </a>
                                  </div>
                                )}

                                {/* Image Attachment Preview if present */}
                                {msg.mediaUrl && !hasFileAttachment && (
                                  <div className="bubble-media-preview">
                                    <a
                                      href={msg.mediaUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bubble-media-link"
                                    >
                                      <img
                                        src={msg.mediaUrl}
                                        alt="Media attachment"
                                        className="bubble-media-img"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    </a>
                                  </div>
                                )}

                                {/* Footer with timestamp and checks */}
                                <div className="bubble-footer">
                                  <span className="bubble-time">{formattedTime}</span>
                                  {isOutbound && (
                                    <span className="bubble-checks">
                                      <CheckCheck size={14} className="check-double" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Modern Docked Composer Pill */}
                  <div className="composer-container">
                    {(hasPermission('WHATSAPP_MESSAGE_SEND') || hasRole('ADMIN')) ? (
                      <form className="modern-thread-composer" onSubmit={onSendMessage}>
                        <button
                          type="button"
                          className="composer-action-btn plus"
                          title="Add attachment"
                          onClick={() => {}}
                        >
                          <Plus size={16} />
                        </button>

                        <input
                          type="text"
                          className="composer-pill-input"
                          placeholder="Type a message..."
                          value={replyText}
                          onChange={(e) => onSetReplyText(e.target.value)}
                          disabled={sending}
                        />

                        <div className="composer-right-actions">
                          <button
                            type="button"
                            className="composer-icon-btn"
                            title="Insert emoji"
                            onClick={() => onSetReplyText(replyText ? `${replyText} 😊` : '😊')}
                          >
                            <Smile size={18} />
                          </button>
                          <button
                            type="button"
                            className="composer-icon-btn"
                            title="Attach file"
                            onClick={() => {}}
                          >
                            <Paperclip size={18} />
                          </button>
                          <button
                            type="submit"
                            className="composer-send-btn"
                            disabled={sending || !replyText.trim()}
                            title="Send message"
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="composer-locked-notice">
                        <Lock size={15} />
                        <span>Outbound messaging requires <strong>WHATSAPP_MESSAGE_SEND</strong> permission. Contact an Administrator.</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* View 2: Media Gallery */}
              {threadTab === 'media' && (
                <div className="thread-tab-content">
                  {mediaMessages.length === 0 ? (
                    <div className="empty-tab-state">
                      <ImageIcon size={32} className="empty-tab-icon" />
                      <p className="empty-tab-title">No Media Found</p>
                      <p className="empty-tab-sub">Photos and media shared in this group will appear here.</p>
                    </div>
                  ) : (
                    <div className="media-gallery-grid">
                      {mediaMessages.map((m) => (
                        <a
                          key={m.id}
                          href={m.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="media-gallery-item"
                        >
                          <img
                            src={m.mediaUrl}
                            alt="Media item"
                            className="media-gallery-thumb"
                          />
                          <div className="media-gallery-overlay">
                            <span className="media-sender">{m.senderName || 'Member'}</span>
                            <Download size={14} />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* View 3: Files & Documents */}
              {threadTab === 'files' && (
                <div className="thread-tab-content">
                  {fileMessages.length === 0 ? (
                    <div className="empty-tab-state">
                      <FileText size={32} className="empty-tab-icon" />
                      <p className="empty-tab-title">No Files Found</p>
                      <p className="empty-tab-sub">Documents, PDFs, and files shared in this group will appear here.</p>
                    </div>
                  ) : (
                    <div className="files-list">
                      {fileMessages.map((m) => (
                        <div key={m.id} className="file-item-card">
                          <div className="file-item-icon">
                            <FileText size={20} />
                          </div>
                          <div className="file-item-meta">
                            <span className="file-item-name">
                              {extractFileName(m.mediaUrl, 'Document.pdf')}
                            </span>
                            <span className="file-item-sub">
                              Shared by {m.senderName || 'Member'} • {formatChatTimestamp(m.timestamp)}
                            </span>
                          </div>
                          <a
                            href={m.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="file-item-download"
                            title="Download document"
                          >
                            <Download size={15} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* View 4: Links */}
              {threadTab === 'links' && (
                <div className="thread-tab-content">
                  {linkMessages.length === 0 ? (
                    <div className="empty-tab-state">
                      <Link2 size={32} className="empty-tab-icon" />
                      <p className="empty-tab-title">No Links Found</p>
                      <p className="empty-tab-sub">Web links shared in this conversation will be cataloged here.</p>
                    </div>
                  ) : (
                    <div className="links-list">
                      {linkMessages.map((m) => {
                        const urlMatch = m.text?.match(/https?:\/\/[^\s]+/i);
                        const url = urlMatch ? urlMatch[0] : '';
                        return (
                          <div key={m.id} className="link-item-card">
                            <div className="link-item-icon">
                              <Link2 size={18} />
                            </div>
                            <div className="link-item-meta">
                              <span className="link-item-url">{url}</span>
                              <span className="link-item-sub">
                                Shared by {m.senderName || 'Member'} • {formatChatTimestamp(m.timestamp)}
                              </span>
                            </div>
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link-item-action"
                                title="Open link in new tab"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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

        {/* Right Resizer: Drag to resize AI Summary (Desktop) */}
        {showSummaryPane && (
          <div
            className={`pane-resizer summary-resizer desktop-only ${isResizingSummary ? 'resizing' : ''}`}
            onMouseDown={handleSummaryResizeStart}
            onDoubleClick={() => setSummaryWidth(380)}
            title="Drag to resize AI Summary • Double-click to reset"
            role="separator"
            aria-orientation="vertical"
          >
            <div className="resizer-handle-line" />
          </div>
        )}

        {/* Right Column: AI Summary & Intelligence Pane (Flexible Resizable Width) */}
        <aside
          className={`livechat-summary-pane ${
            mobileChatView === 'summary' ? 'mobile-visible-pane' : 'mobile-hidden-pane'
          } ${!showSummaryPane ? 'desktop-hidden-pane' : ''}`}
          style={{ width: summaryWidth, minWidth: summaryWidth, maxWidth: summaryWidth, flexShrink: 0 }}
        >
          {/* Header Tabs: AI Summary & Intelligence Views */}
          <div className="summary-pane-header">
            <div className="summary-pane-tabs">
              <button type="button" className="summary-pane-tab active">
                <Sparkles size={13} />
                <span>AI Summary</span>
              </button>
              <button
                type="button"
                className="summary-pane-tab"
                onClick={onNavigateToDeveloper}
                title="Open deep intelligence views"
              >
                <span>Intelligence Views</span>
              </button>
            </div>

            <div className="summary-pane-controls">
              <div className="summary-lang-pill" title="Switch summary language">
                <button
                  type="button"
                  className={`lang-sub-btn ${summaryLanguage === 'hinglish' ? 'active' : ''}`}
                  onClick={() => setSummaryLanguage('hinglish')}
                >
                  Hindi
                </button>
                <button
                  type="button"
                  className={`lang-sub-btn ${summaryLanguage === 'english' ? 'active' : ''}`}
                  onClick={() => setSummaryLanguage('english')}
                >
                  English
                </button>
              </div>

              <button
                type="button"
                className="summary-refresh-icon-btn"
                title="Regenerate intelligence summary"
                disabled={summaryLoading}
                onClick={() => {
                  if (selectedChat) {
                    setSummaryLoading(true);
                    fetch('/api/groq/analyze', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        mode: 'group_intelligence',
                        groupName: selectedChat.name,
                        messages: currentChatMessages.length > 0 ? currentChatMessages : undefined,
                      }),
                    })
                      .then((res) => res.json())
                      .then((json) => {
                        if (json.success && json.data) setSummaryBriefing(json.data);
                      })
                      .finally(() => setSummaryLoading(false));
                  }
                }}
              >
                <RotateCw size={13} className={summaryLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Mobile Back Button */}
          <div className="summary-mobile-bar">
            <button
              type="button"
              className="mobile-back-to-chats-btn"
              onClick={() => setMobileChatView('thread')}
            >
              ← Back to Chat
            </button>
            <span className="summary-mobile-group-title">{selectedChat?.name}</span>
          </div>

          {/* Date & Coverage Sub-bar */}
          <div className="summary-date-subbar">
            <span className="summary-date-pill">
              Nov 5, 2026 - Nov 8, 2026
            </span>
            <span className="summary-coverage-text">
              Coverage: {currentChatMessages.length} Messages
            </span>
          </div>

          {/* Scrollable Summary Body */}
          <div className="summary-pane-scroll">
            {summaryLoading && !summaryBriefing ? (
              <div className="summary-loading-state">
                <RotateCw size={22} className="animate-spin text-purple-600 mb-2" />
                <p className="summary-loading-title">Generating AI Briefing...</p>
                <p className="summary-loading-sub">Analyzing group messages and decisions...</p>
              </div>
            ) : summaryBriefing ? (
              <>
                {/* THE BOTTOM LINE Card */}
                <div className="summary-bottom-line-card">
                  <div className="bottom-line-tag">
                    <Sparkles size={12} />
                    <span>THE BOTTOM LINE</span>
                  </div>
                  <p className="bottom-line-text">
                    {(summaryLanguage === 'hinglish' && summaryBriefing.executiveBriefing.currentSituationHinglish)
                      ? summaryBriefing.executiveBriefing.currentSituationHinglish
                      : summaryBriefing.executiveBriefing.currentSituation}
                  </p>
                </div>

                {/* Overall Conversation Summary */}
                <div className="summary-section-block">
                  <h4 className="summary-section-title">Overall Conversation Summary</h4>
                  <p className="summary-narrative-p">
                    {(summaryLanguage === 'hinglish' && summaryBriefing.executiveBriefing.overviewHinglish)
                      ? summaryBriefing.executiveBriefing.overviewHinglish
                      : summaryBriefing.executiveBriefing.overview}
                  </p>
                </div>

                {/* Current Situation & Alignment */}
                <div className="summary-status-card situation">
                  <div className="status-card-header">
                    <CheckCircle2 size={15} className="status-icon situation" />
                    <span className="status-card-title">Current Situation &amp; Alignment</span>
                  </div>
                  <p className="status-card-body">
                    {(summaryLanguage === 'hinglish' && summaryBriefing.executiveBriefing.currentSituationHinglish)
                      ? summaryBriefing.executiveBriefing.currentSituationHinglish
                      : summaryBriefing.executiveBriefing.currentSituation}
                  </p>
                </div>

                {/* Matters Requiring Attention */}
                <div className="summary-status-card attention">
                  <div className="status-card-header">
                    <AlertTriangle size={15} className="status-icon attention" />
                    <span className="status-card-title">Matters Requiring Attention</span>
                  </div>
                  <p className="status-card-body">
                    {(summaryLanguage === 'hinglish' && summaryBriefing.executiveBriefing.attentionRequiredHinglish)
                      ? summaryBriefing.executiveBriefing.attentionRequiredHinglish
                      : summaryBriefing.executiveBriefing.attentionRequired}
                  </p>
                </div>

                {/* Decisions Made */}
                {summaryBriefing.decisions && summaryBriefing.decisions.length > 0 && (
                  <div className="summary-section-block">
                    <div className="summary-section-title-row">
                      <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                      <h4 className="summary-section-title">Decisions Made</h4>
                    </div>
                    <ul className="summary-bullet-list">
                      {summaryBriefing.decisions.map((dec, i) => (
                        <li key={dec.id || i} className="summary-bullet-item">
                          <span className="bullet-point" />
                          <span><strong>{dec.title}</strong>{dec.context ? ` — ${dec.context}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {summaryBriefing.actionTracker && summaryBriefing.actionTracker.length > 0 && (
                  <div className="summary-section-block">
                    <div className="summary-section-title-row">
                      <ListTodo size={15} style={{ color: '#6366f1' }} />
                      <h4 className="summary-section-title">Action Items ({summaryBriefing.actionTracker.length})</h4>
                    </div>
                    <div className="summary-action-items-list">
                      {summaryBriefing.actionTracker.map((act, i) => (
                        <div key={act.id || i} className="summary-action-item-card">
                          <div className="action-item-left">
                            <input type="checkbox" className="action-item-cb" readOnly checked={act.status === 'COMPLETED'} />
                            <span className="action-item-text">{act.action}</span>
                          </div>
                          <div className="action-item-right">
                            <span className="action-item-owner">{act.owner}</span>
                            <span className={`action-item-status ${act.status.toLowerCase()}`}>{act.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Developments Accordion */}
                <div className="summary-accordion-block">
                  <button
                    type="button"
                    className="summary-accordion-header"
                    onClick={() => setRecentDevelopmentsOpen(!recentDevelopmentsOpen)}
                  >
                    <div className="accordion-title-left">
                      <Clock size={14} />
                      <span>Recent Developments</span>
                    </div>
                    {recentDevelopmentsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {recentDevelopmentsOpen && (
                    <div className="summary-accordion-body">
                      {summaryBriefing.storyline && summaryBriefing.storyline.length > 0 ? (
                        <ul className="accordion-milestones">
                          {summaryBriefing.storyline.map((s, idx) => (
                            <li key={s.id || idx} className="milestone-item">
                              <span className="milestone-time">{s.timestamp}</span>
                              <span className="milestone-title">{s.heading}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="milestone-empty">No milestone developments logged.</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="summary-empty-state">
                <Sparkles size={32} className="empty-icon" />
                <p className="summary-empty-title">Select a Group</p>
                <p className="summary-empty-sub">Choose any active conversation to load the live AI intelligence briefing.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
