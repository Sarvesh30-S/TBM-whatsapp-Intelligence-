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
  Building2,
  Briefcase,
  Split,
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

  // Responsive desktop detection so resizable widths only apply on desktop
  const [isDesktop, setIsDesktop] = useState<boolean>(true);
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(typeof window !== 'undefined' ? window.innerWidth > 900 : true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Render markdown bold text cleanly
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const getTrackStatusClass = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('approved') || s.includes('locked') || s.includes('delivered') || s.includes('settled') || s.includes('ready')) {
      return 'status-success';
    }
    if (s.includes('pushback') || s.includes('cap') || s.includes('blocked') || s.includes('urgent')) {
      return 'status-danger';
    }
    if (s.includes('review') || s.includes('awaiting') || s.includes('negotiating') || s.includes('pending')) {
      return 'status-warning';
    }
    return 'status-info';
  };

  // Switch to thread view on mobile if a chat is selected or targeted
  const prevSelectedChatIdRef = useRef<string | null>(selectedChat?.id || null);
  useEffect(() => {
    if (selectedChat?.id && selectedChat.id !== prevSelectedChatIdRef.current) {
      prevSelectedChatIdRef.current = selectedChat.id;
      setMobileChatView('thread');
    }
  }, [selectedChat?.id]);

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
                <span className="desktop-only">Clear Cache</span>
              </button>
            )}
            <button
              type="button"
              className="btn-chat-action primary"
              onClick={() => onLoadData(apiKey)}
              disabled={loading}
              title="Sync WhatsApp messages"
            >
              <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Segment Control (< 900px) */}
      <div className="mobile-chat-nav-bar mobile-only">
        <button
          type="button"
          className={`mobile-chat-nav-btn ${mobileChatView === 'list' ? 'active' : ''}`}
          onClick={() => setMobileChatView('list')}
        >
          <Users size={13} />
          <span>Groups ({conversations.length})</span>
        </button>
        <button
          type="button"
          className={`mobile-chat-nav-btn ${mobileChatView === 'thread' ? 'active' : ''}`}
          onClick={() => {
            if (selectedChat) setMobileChatView('thread');
          }}
          disabled={!selectedChat}
        >
          <MessageSquare size={13} />
          <span>Chat</span>
        </button>
        <button
          type="button"
          className={`mobile-chat-nav-btn ${mobileChatView === 'summary' ? 'active' : ''}`}
          onClick={() => {
            if (selectedChat) setMobileChatView('summary');
          }}
          disabled={!selectedChat}
        >
          <Sparkles size={13} />
          <span>AI Summary</span>
        </button>
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
        {/* Left Sidebar: Active Groups List Pane (Flexible Resizable Width on Desktop) */}
        <aside
          className={`livechat-sidebar ${mobileChatView === 'thread' || mobileChatView === 'summary' ? 'mobile-hidden-pane' : ''}`}
          style={isDesktop ? { width: groupsWidth, minWidth: groupsWidth, maxWidth: groupsWidth, flexShrink: 0 } : undefined}
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
          style={isDesktop ? { flex: 1, minWidth: 280 } : undefined}
        >
          {selectedChat ? (
            <>
              {/* Thread Header (Clean, professional, strictly NO DPs) */}
              <div className="thread-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <button
                    type="button"
                    className="mobile-back-to-chats-btn"
                    onClick={() => setMobileChatView('list')}
                    aria-label="Back to conversations list"
                  >
                    ← Groups
                  </button>
                  <div className="thread-header-info" style={{ minWidth: 0, flex: 1 }}>
                    <div className="thread-header-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedChat.name}
                    </div>
                    <div className="thread-header-subtitle">
                      {selectedChat.isGroup
                        ? `${currentChatMessages.length} msgs • Active`
                        : `${formatPhone(selectedChat.phoneOrId) || selectedChat.phoneOrId}`}
                    </div>
                  </div>
                </div>

                <div className="thread-header-actions" style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn-chat-action primary"
                    onClick={() => setMobileChatView('summary')}
                    title="Open AI Summary"
                  >
                    <Sparkles size={12} />
                    <span className="desktop-only">AI Summary</span>
                  </button>
                  <button
                    type="button"
                    className="btn-chat-action secondary"
                    onClick={() => onLoadData(apiKey, selectedChat.id, selectedChat.isGroup, selectedChat.groupUuid)}
                    disabled={loading}
                    title="Sync messages"
                  >
                    <RotateCw size={12} className={loading ? 'animate-spin' : ''} />
                    <span className="desktop-only">Sync</span>
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
                                {/* Sender name in bold amber for inbound bubbles, strictly NO DP */}
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

        {/* Right Column: AI Summary & Intelligence Pane (Flexible Resizable Width on Desktop) */}
        <aside
          className={`livechat-summary-pane ${
            mobileChatView === 'summary' ? 'mobile-visible-pane' : 'mobile-hidden-pane'
          } ${!showSummaryPane ? 'desktop-hidden-pane' : ''}`}
          style={isDesktop ? { width: summaryWidth, minWidth: summaryWidth, maxWidth: summaryWidth, flexShrink: 0 } : undefined}
        >
          {/* Header Tab: AI Summary */}
          <div className="summary-pane-header">
            <div className="summary-pane-tabs">
              <div className="summary-pane-tab active" style={{ cursor: 'default' }}>
                <Sparkles size={13} />
                <span>AI Summary</span>
              </div>
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
                <RotateCw size={22} className="animate-spin text-amber-500 mb-2" />
                <p className="summary-loading-title">Generating AI Briefing...</p>
                <p className="summary-loading-sub">Analyzing group messages and decisions...</p>
              </div>
            ) : summaryBriefing ? (() => {
              const eb = summaryBriefing.executiveBriefing;
              const isHinglish = summaryLanguage === 'hinglish';

              // 1. TL;DR list
              const tldrList: string[] = (isHinglish && eb.tldrHinglish && eb.tldrHinglish.length > 0)
                ? eb.tldrHinglish
                : (eb.tldr && eb.tldr.length > 0)
                ? eb.tldr
                : [isHinglish && eb.currentSituationHinglish ? eb.currentSituationHinglish : eb.currentSituation];

              // 2. Client Side Track
              const clientTrack = (isHinglish && eb.clientSideHinglish)
                ? {
                    title: eb.clientSideHinglish.title || eb.clientSide?.title || 'Client Demands & Feedback',
                    status: eb.clientSideHinglish.status || eb.clientSide?.status || 'Active',
                    points: (eb.clientSideHinglish.points && eb.clientSideHinglish.points.length > 0)
                      ? eb.clientSideHinglish.points
                      : (eb.clientSide?.points || []),
                  }
                : (eb.clientSide || {
                    title: 'Client Demands & Feedback',
                    status: 'Active',
                    points: [eb.attentionRequired || 'No immediate client blockers noted.'],
                  });

              // 3. Team Side Track
              const teamTrack = (isHinglish && eb.teamSideHinglish)
                ? {
                    title: eb.teamSideHinglish.title || eb.teamSide?.title || 'Internal Team Execution',
                    status: eb.teamSideHinglish.status || eb.teamSide?.status || 'In Progress',
                    points: (eb.teamSideHinglish.points && eb.teamSideHinglish.points.length > 0)
                      ? eb.teamSideHinglish.points
                      : (eb.teamSide?.points || []),
                  }
                : (eb.teamSide || {
                    title: 'Internal Team Execution',
                    status: 'In Progress',
                    points: [eb.currentSituation || 'Team deliverables underway.'],
                  });

              // 4. Decided Items
              const decidedList: string[] = (isHinglish && eb.decidedItemsHinglish && eb.decidedItemsHinglish.length > 0)
                ? eb.decidedItemsHinglish
                : (eb.decidedItems && eb.decidedItems.length > 0)
                ? eb.decidedItems
                : (summaryBriefing.decisions || []).filter(d => d.status === 'CONFIRMED').map(d => `${d.title}${d.context ? ` — ${d.context}` : ''}`).slice(0, 3);

              // 5. Blockers
              const blockersList = (isHinglish && eb.pendingBlockersHinglish && eb.pendingBlockersHinglish.length > 0)
                ? eb.pendingBlockersHinglish
                : (eb.pendingBlockers && eb.pendingBlockers.length > 0)
                ? eb.pendingBlockers
                : (summaryBriefing.pendingDiscussions || []).map(p => ({
                    item: p.unresolvedQuestion || p.topic,
                    waitingOn: (p.participantsInvolved || [])[0] || 'Team',
                  }));

              return (
                <div className="side-brief-doc">
                  {/* 1. KEY TAKEAWAYS */}
                  <section className="side-brief-section">
                    <div className="side-brief-header">
                      <span className="side-brief-num">01</span>
                      <h4 className="side-brief-heading">Key Takeaways</h4>
                    </div>
                    {tldrList.length > 0 ? (
                      <ul className="side-brief-list">
                        {tldrList.map((bullet, idx) => (
                          <li key={idx} className="side-brief-bullet">
                            <span className="side-brief-dot gold" />
                            <span className="side-brief-text">{renderFormattedText(bullet)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="side-brief-text-single">
                        {isHinglish && eb.currentSituationHinglish ? eb.currentSituationHinglish : eb.currentSituation}
                      </p>
                    )}
                  </section>

                  {/* 2. DISCUSSION HIGHLIGHTS (Clean stacked tracks) */}
                  <section className="side-brief-section">
                    <div className="side-brief-header">
                      <span className="side-brief-num">02</span>
                      <h4 className="side-brief-heading">Discussion Highlights</h4>
                    </div>

                    <div className="side-discussion-flow">
                      {/* Client Track */}
                      <div className="side-track-card">
                        <div className="side-track-title-row">
                          <span className="side-track-role">CLIENT</span>
                          <span className="side-track-name">{clientTrack.title}</span>
                        </div>
                        <ul className="side-brief-list">
                          {clientTrack.points.map((pt, idx) => (
                            <li key={idx} className="side-brief-bullet">
                              <span className="side-brief-dot" />
                              <span className="side-brief-text">{renderFormattedText(pt)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Agency Track */}
                      <div className="side-track-card">
                        <div className="side-track-title-row">
                          <span className="side-track-role">AGENCY</span>
                          <span className="side-track-name">{teamTrack.title}</span>
                        </div>
                        <ul className="side-brief-list">
                          {teamTrack.points.map((pt, idx) => (
                            <li key={idx} className="side-brief-bullet">
                              <span className="side-brief-dot" />
                              <span className="side-brief-text">{renderFormattedText(pt)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>

                  {/* 3. AGREED DECISIONS & SETTLED ITEMS */}
                  {decidedList.length > 0 && (
                    <section className="side-brief-section">
                      <div className="side-brief-header">
                        <span className="side-brief-num">03</span>
                        <h4 className="side-brief-heading">Agreed &amp; Settled</h4>
                      </div>
                      <div className="side-agreed-card">
                        <ul className="side-brief-list">
                          {decidedList.map((dec, idx) => (
                            <li key={idx} className="side-brief-bullet agreed">
                              <CheckCircle2 size={13} className="side-agreed-icon" />
                              <span className="side-brief-text">{renderFormattedText(dec)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  )}

                  {/* 4. ACTIVE BLOCKERS & DEPENDENCIES */}
                  {blockersList.length > 0 && (
                    <section className="side-brief-section">
                      <div className="side-brief-header">
                        <span className="side-brief-num">04</span>
                        <h4 className="side-brief-heading">Active Blockers &amp; Dependencies</h4>
                      </div>
                      <div className="side-blockers-stack">
                        {blockersList.map((blk, idx) => (
                          <div key={idx} className="side-blocker-card">
                            <div className="side-blocker-top">
                              <AlertTriangle size={13} className="side-blocker-icon" />
                              <span className="side-blocker-title">{renderFormattedText(blk.item)}</span>
                            </div>
                            {blk.waitingOn && (
                              <div className="side-blocker-action">
                                <span>Awaiting:</span>
                                <strong>{blk.waitingOn}</strong>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 5. ACTION LEDGER */}
                  {summaryBriefing.actionTracker && summaryBriefing.actionTracker.length > 0 && (
                    <section className="side-brief-section">
                      <div className="side-brief-header">
                        <span className="side-brief-num">05</span>
                        <h4 className="side-brief-heading">Action Ledger</h4>
                      </div>
                      <div className="side-ledger-stack">
                        {summaryBriefing.actionTracker.map((act, i) => (
                          <div key={act.id || i} className="side-ledger-item">
                            <div className="side-ledger-left">
                              <span className={`side-ledger-checkbox ${act.status === 'COMPLETED' ? 'checked' : ''}`} />
                              <span className="side-ledger-text">{act.action}</span>
                            </div>
                            <div className="side-ledger-right">
                              <span className="side-ledger-owner">{act.owner}</span>
                              <span className={`side-status-pill ${act.status.toLowerCase()}`}>{act.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 6. TIMELINE & MILESTONES */}
                  {summaryBriefing.storyline && summaryBriefing.storyline.length > 0 && (
                    <section className="side-brief-section">
                      <button
                        type="button"
                        className="side-accordion-btn"
                        onClick={() => setRecentDevelopmentsOpen(!recentDevelopmentsOpen)}
                      >
                        <div className="side-brief-header" style={{ marginBottom: 0 }}>
                          <span className="side-brief-num">06</span>
                          <h4 className="side-brief-heading">Timeline &amp; Milestones ({summaryBriefing.storyline.length})</h4>
                        </div>
                        {recentDevelopmentsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {recentDevelopmentsOpen && (
                        <div className="side-timeline-stack">
                          {summaryBriefing.storyline.map((s, idx) => (
                            <div key={s.id || idx} className="side-timeline-item">
                              <span className="side-timeline-time">{s.timestamp}</span>
                              <span className="side-timeline-heading">{s.heading}</span>
                              {s.description && (
                                <span className="side-timeline-desc">{s.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              );
          })() : (
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
