'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Search, Bell, Settings, Sun, Moon } from 'lucide-react';
import Sidebar, { DashboardSection } from '@/components/Sidebar';
import OverviewView from '@/components/OverviewView';
import TestMessagesView from '@/components/TestMessagesView';
import MessageSummaryView from '@/components/MessageSummaryView';
import AdminManagementView from '@/components/AdminManagementView';
import LoginView from '@/components/LoginView';
import ZeroDataMemberView from '@/components/ZeroDataMemberView';
import GlobalSearchOmnibox from '@/components/GlobalSearchOmnibox';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { TwoChatConversation, TwoChatMessage, isHiddenPrivateGroup } from '@/lib/types';

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

function deduplicateList(messages: TwoChatMessage[]): TwoChatMessage[] {
  const result: TwoChatMessage[] = [];
  const seenIds = new Set<string>();

  for (const msg of messages) {
    if (!msg || !msg.text || !msg.text.trim()) continue;
    if (seenIds.has(msg.id)) continue;

    const cleanText = msg.text.trim().toLowerCase();
    const msgTime = new Date(msg.timestamp).getTime();

    const dupIndex = result.findIndex((existing) => {
      if (existing.sentBy !== msg.sentBy) return false;
      if (existing.text?.trim().toLowerCase() !== cleanText) return false;
      const existTime = new Date(existing.timestamp).getTime();
      return Math.abs(existTime - msgTime) <= 120000;
    });

    if (dupIndex !== -1) {
      const existing = result[dupIndex];
      if (!msg.id.startsWith('sent-') && existing.id.startsWith('sent-')) {
        result[dupIndex] = msg;
        seenIds.add(msg.id);
      }
      continue;
    }

    seenIds.add(msg.id);
    result.push(msg);
  }

  return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function deduplicateConversationsList(conversations: TwoChatConversation[]): TwoChatConversation[] {
  const map = new Map<string, TwoChatConversation>();
  for (const c of conversations) {
    if (!c || !c.name || isHiddenPrivateGroup(c.name)) continue;
    let name = c.name;
    let isGroup = c.isGroup;
    if (name.toLowerCase().includes('pink apple')) {
      name = 'Emami X TheBoredMonkey';
      isGroup = true;
    }
    const key = isGroup
      ? `group:${name.trim().toLowerCase()}`
      : `direct:${c.phoneOrId ? c.phoneOrId.replace(/[^0-9]/g, '') : c.id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...c, name, isGroup });
    } else {
      existing.messageCount = Math.max(existing.messageCount || 0, c.messageCount || 0);
      if (new Date(c.lastTimestamp).getTime() >= new Date(existing.lastTimestamp).getTime()) {
        existing.lastMessage = c.lastMessage || existing.lastMessage;
        existing.lastTimestamp = c.lastTimestamp;
      }
      if (!existing.groupUuid && c.groupUuid) existing.groupUuid = c.groupUuid;
      if (!existing.twoChatLink && c.twoChatLink) existing.twoChatLink = c.twoChatLink;
      if (!existing.description && c.description) existing.description = c.description;
      if (!existing.size && c.size) existing.size = c.size;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
  );
}

function DashboardContent() {
  const { user, token, canAccessSection, isAuthenticated, isLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [currentSection, setCurrentSection] = useState<DashboardSection>('test-messages');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Application Data State
  const [apiKey, setApiKey] = useState<string>('');
  const [channels, setChannels] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>('');
  const [conversations, setConversations] = useState<TwoChatConversation[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_2chat_conversations');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return deduplicateConversationsList(parsed);
          }
        } catch {}
      }
    }
    return [];
  });
  const [selectedChat, setSelectedChat] = useState<TwoChatConversation | null>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_2chat_conversations');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = deduplicateConversationsList(parsed);
            return filtered[0] || null;
          }
        } catch {}
      }
    }
    return null;
  });
  const [allMessages, setAllMessages] = useState<TwoChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_2chat_messages');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((m) => {
              const gName = m.groupName || (m.isGroup ? m.chatName : null);
              return !isHiddenPrivateGroup(gName);
            });
            return deduplicateList(filtered);
          }
        } catch {}
      }
    }
    return [];
  });
  const [chatFilter, setChatFilter] = useState<'all' | 'groups' | 'direct'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('https://tbm-whatsapp-intelligence.vercel.app/api/webhook/2chat');
  const [statusText, setStatusText] = useState<string>('');
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [targetMessageId, setTargetMessageId] = useState<string>('');
  const [pendingAlerts, setPendingAlerts] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  // Real-Time 2Chat & WhatsApp Connection Health
  const [connectionHealth, setConnectionHealth] = useState<{
    isOnline: boolean;
    twoChatConnected: boolean;
    whatsappConnected: boolean;
    status: string;
    title: string;
    sub: string;
    tooltip: string;
    phone?: string;
    rawStatus?: string;
    checkedAt?: string;
    loading?: boolean;
  }>({
    isOnline: false,
    twoChatConnected: false,
    whatsappConnected: false,
    status: 'checking',
    title: 'Checking Status...',
    sub: 'Connecting...',
    tooltip: 'Checking WhatsApp & 2Chat connection status...',
    loading: true,
  });

  const checkConnectionStatus = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setConnectionHealth((prev) => ({ ...prev, loading: true }));
      const params = new URLSearchParams();
      if (forceRefresh) params.set('refresh', 'true');
      const savedKey = apiKey || (typeof window !== 'undefined' ? localStorage.getItem('2chat_api_key') || '' : '');
      if (savedKey) params.set('apiKey', savedKey);
      const url = `/api/2chat/status${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setConnectionHealth({
        isOnline: Boolean(data.isOnline),
        twoChatConnected: Boolean(data.twoChatConnected),
        whatsappConnected: Boolean(data.whatsappConnected),
        status: data.status || 'unknown',
        title: data.title || (data.isOnline ? 'Connected to WhatsApp' : 'WhatsApp Disconnected'),
        sub: data.sub || (data.isOnline ? 'Active' : 'Offline'),
        tooltip: data.tooltip || 'WhatsApp Connection Status',
        phone: data.phone,
        rawStatus: data.rawStatus,
        checkedAt: data.checkedAt || new Date().toISOString(),
        loading: false,
      });
    } catch (err: any) {
      setConnectionHealth({
        isOnline: false,
        twoChatConnected: false,
        whatsappConnected: false,
        status: 'error',
        title: 'Connection Check Failed',
        sub: 'Network or API error',
        tooltip: `Failed to check connection: ${err?.message || 'Error'}`,
        loading: false,
      });
    }
  }, []);

  // Periodic Real-Time Health Check (every 25 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;
    checkConnectionStatus(false);
    const interval = setInterval(() => {
      checkConnectionStatus(false);
    }, 25000);
    return () => clearInterval(interval);
  }, [isAuthenticated, checkConnectionStatus]);

  const fetchPendingAlerts = useCallback(async () => {
    if (!user?.roles?.includes('ROLE_ADMIN')) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/access-requests', { headers });
      if (res.ok) {
        const data = await res.json();
        const pending = (data.requests || []).filter((r: any) => r.status === 'PENDING');
        setPendingAlerts(pending);
      }
    } catch (err) {
      console.warn('Could not fetch pending access alerts:', err);
    }
  }, [user, token]);

  useEffect(() => {
    if (user?.roles?.includes('ROLE_ADMIN')) {
      fetchPendingAlerts();
      const interval = setInterval(fetchPendingAlerts, 15000);
      return () => clearInterval(interval);
    }
  }, [user, fetchPendingAlerts]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let keyToUse = '';
    let hasCached = false;
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('2chat_api_key') || '';
      const cachedMsgs = localStorage.getItem('cached_2chat_messages');
      const cachedConvs = localStorage.getItem('cached_2chat_conversations');

      keyToUse = savedKey;
      setApiKey(savedKey);
      setWebhookUrl(`${window.location.origin}/api/webhook/2chat`);

      if (cachedMsgs) {
        try {
          const parsed = JSON.parse(cachedMsgs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllMessages(deduplicateList(parsed));
            hasCached = true;
          }
        } catch (e) {
          console.error('Failed to parse cached messages', e);
        }
      }

      if (cachedConvs) {
        try {
          const parsed = JSON.parse(cachedConvs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const deduped = deduplicateConversationsList(parsed);
            setConversations(deduped);
            if (!selectedChat) {
              setSelectedChat(deduped[0]);
            }
            hasCached = true;
          }
        } catch (e) {
          console.error('Failed to parse cached conversations', e);
        }
      }
    }

    loadData(keyToUse, undefined, undefined, undefined, hasCached);
  }, [isAuthenticated]);

  // Periodic background revalidation so newly collected WhatsApp messages auto-update summaries & chat feeds
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      loadData(apiKey, undefined, undefined, undefined, true);
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, apiKey]);

  const loadData = async (
    key?: string,
    specificChatId?: string,
    isGroup?: boolean,
    groupUuid?: string,
    isBackgroundRevalidate: boolean = false
  ) => {
    // Only set full loading indicator if we don't already have cached data rendered
    if (!isBackgroundRevalidate) {
      setLoading(true);
      setStatusText('Fetching messages from database...');
    }
    setApiErrors([]);

    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/2chat/messages', { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.apiKeyConfigured) {
        setApiKey((prev) => prev || 'server-configured');
      }
      const rawMessages: TwoChatMessage[] = data.messages || [];
      const rawConversations: TwoChatConversation[] = data.conversations || [];

      // Filter out private personal test groups and remap placeholders
      const visibleRawMessages = rawMessages
        .map((m) => {
          if (
            (m.groupName && m.groupName.toLowerCase().includes('pink apple')) ||
            (m.chatName && m.chatName.toLowerCase().includes('pink apple')) ||
            m.receiverNumber === '120363431420691727@g.us'
          ) {
            return {
              ...m,
              isGroup: true,
              groupName: 'Emami X TheBoredMonkey',
              chatName: 'Emami X TheBoredMonkey',
              receiverName: 'Emami X TheBoredMonkey',
              groupUuid: 'WAG2f480273-e9bb-406d-acb0-28369be3e17e',
            };
          }
          return m;
        })
        .filter((m) => {
          const gName = m.groupName || (m.isGroup ? m.chatName : null);
          return !isHiddenPrivateGroup(gName);
        });

      const visibleRawConversations = rawConversations
        .map((c) => {
          if (c.name.toLowerCase().includes('pink apple')) {
            return { ...c, name: 'Emami X TheBoredMonkey', isGroup: true };
          }
          return c;
        })
        .filter((c) => !isHiddenPrivateGroup(c.name));

      const dedupedMessages = deduplicateList(visibleRawMessages);

      const convMap = new Map<string, TwoChatConversation>();

      visibleRawConversations.forEach((c) => {
        if (!c || !c.name || isHiddenPrivateGroup(c.name)) return;
        const key = c.isGroup
          ? `group:${c.name.trim().toLowerCase()}`
          : `direct:${c.phoneOrId ? c.phoneOrId.replace(/[^0-9]/g, '') : c.id}`;

        const existing = convMap.get(key);
        if (!existing) {
          convMap.set(key, { ...c });
        } else {
          existing.messageCount = Math.max(existing.messageCount || 0, c.messageCount || 0);
          if (new Date(c.lastTimestamp).getTime() >= new Date(existing.lastTimestamp).getTime()) {
            existing.lastMessage = c.lastMessage || existing.lastMessage;
            existing.lastTimestamp = c.lastTimestamp;
          }
          if (!existing.groupUuid && c.groupUuid) existing.groupUuid = c.groupUuid;
        }
      });

      const messageCountMap = new Map<string, number>();

      dedupedMessages.forEach((msg) => {
        let isGrp = false;
        let convName = '';
        let grpUuid: string | undefined;
        let mapKey = '';
        let convId = '';

        if (msg.isGroup || msg.groupUuid) {
          isGrp = true;
          convName = msg.groupName || 'WhatsApp Group';
          grpUuid = msg.groupUuid;
          convId = grpUuid || convName;
          mapKey = `group:${convName.trim().toLowerCase()}`;
        } else {
          isGrp = false;
          const isOutgoing = msg.sentBy === 'user' || msg.sentBy === 'agent' || msg.sentBy === 'api';
          const otherNumber = isOutgoing
            ? msg.toNumber || msg.remoteNumber || msg.receiverNumber
            : msg.fromNumber || msg.remoteNumber || msg.senderNumber;

          convId = otherNumber || msg.senderNumber || msg.receiverNumber || 'direct-chat';
          convName = (isOutgoing ? msg.receiverName : msg.senderName) || formatPhone(convId);
          const digits = convId.replace(/[^0-9]/g, '');
          mapKey = `direct:${digits || convId}`;
        }

        messageCountMap.set(mapKey, (messageCountMap.get(mapKey) || 0) + 1);

        const existing = convMap.get(mapKey);
        if (!existing) {
          convMap.set(mapKey, {
            id: convId,
            name: convName,
            isGroup: isGrp,
            groupUuid: grpUuid,
            phoneOrId: convId,
            messageCount: 1,
            unreadCount: 0,
            lastMessage: msg.text,
            lastTimestamp: msg.timestamp,
          });
        } else {
          if (isGrp && !existing.groupUuid && grpUuid) {
            existing.groupUuid = grpUuid;
          }
          if (new Date(msg.timestamp).getTime() >= new Date(existing.lastTimestamp).getTime()) {
            existing.lastMessage = msg.text || existing.lastMessage;
            existing.lastTimestamp = msg.timestamp;
          }
        }
      });

      // Synchronize message counts with actual deduplicated messages
      convMap.forEach((conv, key) => {
        const actualCount = messageCountMap.get(key);
        if (actualCount && actualCount > (conv.messageCount || 0)) {
          conv.messageCount = actualCount;
        }
      });

      const updatedConversations = deduplicateConversationsList(Array.from(convMap.values()));

      setAllMessages(dedupedMessages);
      setConversations(updatedConversations);

      if (typeof window !== 'undefined') {
        localStorage.setItem('cached_2chat_messages', JSON.stringify(dedupedMessages));
        localStorage.setItem('cached_2chat_conversations', JSON.stringify(updatedConversations));
      }

      if (updatedConversations.length > 0) {
        if (specificChatId) {
          const found = updatedConversations.find(
            (c) => c.id === specificChatId || c.groupUuid === specificChatId || c.phoneOrId === specificChatId
          );
          if (found) setSelectedChat(found);
        } else if (!selectedChat) {
          setSelectedChat(updatedConversations[0]);
        }
      }

      setStatusText(`Loaded ${dedupedMessages.length} messages`);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setStatusText(`Error: ${err.message}`);
      setApiErrors([err.message]);
    } finally {
      setLoading(false);
      checkConnectionStatus(false);
    }
  };

  const handleSelectChat = (chat: TwoChatConversation) => {
    setSelectedChat(chat);
  };

  const handleOpenGroupChat = (groupName: string) => {
    const trimmed = groupName.trim().toLowerCase();
    let target = conversations.find((c) => {
      const cName = c.name.trim().toLowerCase();
      return cName === trimmed || cName.includes(trimmed) || trimmed.includes(cName);
    });

    if (!target) {
      const newConv: TwoChatConversation = {
        id: `conv-${groupName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
        name: groupName,
        phoneOrId: `group-${groupName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
        isGroup: true,
        messageCount: 0,
        unreadCount: 0,
        lastTimestamp: new Date().toISOString(),
        lastMessage: 'Active company channel',
      };
      target = newConv;
      setConversations((prev) => [newConv, ...prev.filter((c) => c.name !== groupName)]);
    }

    if (target) {
      setSelectedChat(target);
      setCurrentSection('test-messages');
    }
  };

  const handleOpenMessage = (groupName: string, messageId: string) => {
    handleOpenGroupChat(groupName);
    setTargetMessageId(messageId);
    setTimeout(() => setTargetMessageId(''), 6000);
  };

  const handleOpenGroupSummary = (groupName: string) => {
    handleOpenGroupChat(groupName);
    setCurrentSection('message-summary');
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const text = replyText;
    if (!text || !text.trim() || !selectedChat) return;

    setSending(true);
    setStatusText('Sending message via 2Chat...');

    try {
      const res = await fetch('/api/2chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          apiKey,
          to: selectedChat.phoneOrId || selectedChat.id,
          text: text.trim(),
          isGroup: selectedChat.isGroup,
          groupUuid: selectedChat.groupUuid,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');

      setReplyText('');
      setStatusText('Message sent successfully!');

      await loadData(apiKey, selectedChat.id, selectedChat.isGroup, selectedChat.groupUuid);
    } catch (err: any) {
      console.error('Send error:', err);
      setStatusText(`Error sending message: ${err.message}`);
      setApiErrors([err.message]);
    } finally {
      setSending(false);
    }
  };

  const handleClearMessages = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cached_2chat_messages');
        localStorage.removeItem('cached_2chat_conversations');
      }
      setStatusText('Local cache cleared. Refreshing from database...');
      await loadData(apiKey);
    } catch (e: any) {
      setStatusText(`Clear error: ${e.message}`);
    }
  };

  const handleSaveApiKey = async (key: string) => {
    setApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('2chat_api_key', key);
    }
    await loadData(key);
  };

  const currentChatMessages = selectedChat
    ? allMessages.filter((m) => {
        if (selectedChat.isGroup) {
          const mGroup = (m.groupName || m.chatName || '').trim().toLowerCase();
          const sGroup = (selectedChat.name || '').trim().toLowerCase();
          return (
            (selectedChat.groupUuid && m.groupUuid === selectedChat.groupUuid) ||
            (mGroup && sGroup && mGroup === sGroup)
          );
        }
        const isOutgoing = m.sentBy === 'user' || m.sentBy === 'agent' || m.sentBy === 'api';
        const otherNumber = isOutgoing
          ? m.toNumber || m.remoteNumber || m.receiverNumber
          : m.fromNumber || m.remoteNumber || m.senderNumber;
        const cleanMsgNum = (otherNumber || '').replace(/[^0-9]/g, '');
        const cleanChatNum = (selectedChat.phoneOrId || selectedChat.id || '').replace(/[^0-9]/g, '');
        return cleanMsgNum && cleanChatNum ? cleanMsgNum === cleanChatNum : otherNumber === selectedChat.phoneOrId;
      })
    : [];

  const sectionTitles: Record<DashboardSection, string> = {
    'test-messages': 'Groups & Chats',
    'message-summary': 'Group Intelligence & Summaries',
    overview: 'Analytics & Console',
    admin: 'Access Control & Administration',
    developer: 'Analytics & Console',
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-canvas)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 14, fontWeight: 500 }}>Initializing secure enterprise session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  const displayName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Admin User');
  const userInitials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || displayName.slice(0, 2).toUpperCase();

  return (
    <div className="saas-app-layout">
      {/* Left Sidebar */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        mobileOpen={mobileSidebarOpen}
        onToggleMobile={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        channelInfo="WhatsApp Active (+91 86553 30477)"
        connectionHealth={connectionHealth}
        onRefreshConnection={() => checkConnectionStatus(true)}
      />

      {/* Main Viewport */}
      <div className="saas-main-viewport">
        {/* Top Navbar */}
        <header className="saas-top-navbar">
          <div className="navbar-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open Navigation"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="navbar-center">
            <GlobalSearchOmnibox
              conversations={conversations}
              allMessages={allMessages}
              onSelectGroup={handleOpenGroupChat}
              onSelectMessage={handleOpenMessage}
              onOpenSummary={handleOpenGroupSummary}
              onNavigateSection={setCurrentSection}
            />
          </div>

          <div className="navbar-right">
            {/* Real-Time Live Sync Glowing Status Dot (Green = Live, Red = Offline) */}
            <div
              className={`topbar-live-dot-container ${connectionHealth.isOnline ? 'is-live' : 'is-offline'}`}
              title={`${connectionHealth.tooltip} • Click to test`}
              aria-label={connectionHealth.tooltip}
              onClick={() => checkConnectionStatus(true)}
              role="button"
              tabIndex={0}
            >
              <span className="topbar-live-dot" />
            </div>
            {/* Theme Toggle Button */}
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={17} style={{ color: '#FDC727' }} /> : <Moon size={17} />}
            </button>
            {/* Super Admin Notifications Bell with Pending Alerts Count & Popover */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="topbar-icon-btn"
                onClick={() => setShowNotifications((prev) => !prev)}
                title={
                  user?.roles?.includes('ROLE_ADMIN') && pendingAlerts.length > 0
                    ? `${pendingAlerts.length} Pending WhatsApp Access Alert(s)`
                    : 'Notifications'
                }
                aria-label="Notifications"
                style={{ position: 'relative' }}
              >
                <Bell size={17} />
                {user?.roles?.includes('ROLE_ADMIN') && pendingAlerts.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 1,
                      right: 1,
                      backgroundColor: '#EF4444',
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: 800,
                      borderRadius: 10,
                      minWidth: 16,
                      height: 16,
                      padding: '0 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)',
                      pointerEvents: 'none',
                    }}
                  >
                    {pendingAlerts.length}
                  </span>
                )}
              </button>

              {/* Notifications Popover Dropdown */}
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    width: 360,
                    maxWidth: '92vw',
                    backgroundColor: 'var(--bg-surface, #FFFFFF)',
                    borderRadius: 14,
                    border: '1px solid var(--border-subtle, #E2E8F0)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
                    zIndex: 9999,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
                      backgroundColor: 'var(--bg-surface-subtle, #F8FAFC)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Bell size={16} color="#D97706" />
                      <strong style={{ fontSize: 13, color: 'var(--text-primary, #0F172A)' }}>
                        Access Alerts & Requests
                      </strong>
                    </div>
                    {user?.roles?.includes('ROLE_ADMIN') && pendingAlerts.length > 0 ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: 'rgba(217, 119, 6, 0.12)',
                          color: '#D97706',
                          padding: '2px 8px',
                          borderRadius: 12,
                        }}
                      >
                        {pendingAlerts.length} Pending
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #94A3B8)',
                        }}
                      >
                        0 New
                      </span>
                    )}
                  </div>

                  <div style={{ maxHeight: 380, overflowY: 'auto', padding: '12px' }}>
                    {!user?.roles?.includes('ROLE_ADMIN') || pendingAlerts.length === 0 ? (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '28px 16px',
                          color: 'var(--text-secondary, #64748B)',
                          fontSize: 13,
                        }}
                      >
                        <Bell size={26} style={{ opacity: 0.3, margin: '0 auto 8px auto', display: 'block' }} />
                        <span>All caught up! No pending access requests.</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pendingAlerts.map((alertItem: any) => (
                          <div
                            key={alertItem.id}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              backgroundColor: 'var(--bg-surface-subtle, #F8FAFC)',
                              border: '1px solid var(--border-subtle, #E2E8F0)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <strong style={{ fontSize: 13, color: 'var(--text-primary, #0F172A)' }}>
                                {alertItem.user_name}
                              </strong>
                              <span style={{ fontSize: 11, color: 'var(--text-muted, #94A3B8)' }}>
                                {new Date(alertItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary, #64748B)' }}>
                              {alertItem.user_email}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--text-primary, #0F172A)',
                                backgroundColor: 'var(--bg-surface, #FFFFFF)',
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--border-subtle, #E2E8F0)',
                                marginTop: 2,
                                lineHeight: 1.4,
                                fontStyle: 'italic',
                              }}
                            >
                              "{alertItem.message}"
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNotifications(false);
                                setCurrentSection('admin');
                              }}
                              style={{
                                marginTop: 4,
                                alignSelf: 'flex-start',
                                padding: '6px 12px',
                                borderRadius: 6,
                                backgroundColor: '#D97706',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Open in Member Management →
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={() => setCurrentSection('admin')}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={17} />
            </button>
            <div
              className="topbar-user-avatar"
              title={`${displayName} (${user?.roles?.[0] || 'User'})`}
            >
              {userInitials}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="saas-content-area">
          {!user?.roles?.includes('ROLE_ADMIN') && conversations.length === 0 && !loading ? (
            <ZeroDataMemberView
              user={user}
              onRefresh={() => loadData(apiKey)}
              loading={loading}
            />
          ) : (
            <>
              {currentSection === 'test-messages' && (
            <TestMessagesView
              apiKey={apiKey}
              channels={channels}
              activeChannel={activeChannel}
              conversations={conversations}
              selectedChat={selectedChat}
              onSelectChat={handleSelectChat}
              allMessages={allMessages}
              currentChatMessages={currentChatMessages}
              chatFilter={chatFilter}
              onSetChatFilter={setChatFilter}
              searchQuery={searchQuery}
              onSetSearchQuery={setSearchQuery}
              replyText={replyText}
              onSetReplyText={setReplyText}
              loading={loading}
              sending={sending}
              apiErrors={apiErrors}
              onLoadData={loadData}
              onSendMessage={handleSendMessage}
              onClearMessages={handleClearMessages}
              onNavigateToDeveloper={() => setCurrentSection('overview')}
              targetMessageId={targetMessageId}
            />
          )}

          {currentSection === 'message-summary' && (
            <MessageSummaryView
              totalMessagesCount={allMessages.length || 148}
              conversations={conversations}
              allMessages={allMessages}
              onNavigateToTestMessages={(chatId, messageId) => {
                setCurrentSection('test-messages');
                if (messageId) {
                  setTargetMessageId(messageId);
                  setTimeout(() => setTargetMessageId(''), 5000);
                }
                if (chatId) {
                  const target = conversations.find(
                    (c) => c.id === chatId || c.groupUuid === chatId || c.phoneOrId === chatId || c.name === chatId
                  );
                  if (target) {
                    setSelectedChat(target);
                    loadData(apiKey, target.id, target.isGroup, target.groupUuid);
                  }
                }
              }}
              onNavigateToDeveloper={() => setCurrentSection('overview')}
            />
          )}

          {(currentSection === 'overview' || (currentSection as any) === 'developer') && (
            <OverviewView
              onNavigate={setCurrentSection}
              onSelectGroup={handleOpenGroupChat}
              totalMessagesCount={allMessages.length || 128}
              conversations={conversations}
            />
          )}

          {currentSection === 'admin' && (
            <AdminManagementView />
          )}
        </>
      )}
    </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
