'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Search, Bell, Settings } from 'lucide-react';
import Sidebar, { DashboardSection } from '@/components/Sidebar';
import OverviewView from '@/components/OverviewView';
import TestMessagesView from '@/components/TestMessagesView';
import MessageSummaryView from '@/components/MessageSummaryView';
import AdminManagementView from '@/components/AdminManagementView';
import LoginView from '@/components/LoginView';
import GlobalSearchOmnibox from '@/components/GlobalSearchOmnibox';
import { AuthProvider, useAuth } from '@/context/AuthContext';
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

function DashboardContent() {
  const { user, token, canAccessSection, isAuthenticated, isLoading } = useAuth();
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
            return parsed.filter((c) => !isHiddenPrivateGroup(c.name));
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
            const filtered = parsed.filter((c) => !isHiddenPrivateGroup(c.name));
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
            setConversations(parsed);
            if (!selectedChat) {
              setSelectedChat(parsed[0]);
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

      // Filter out private personal test groups so they never appear on the frontend
      const visibleRawMessages = rawMessages.filter((m) => {
        const gName = m.groupName || (m.isGroup ? m.chatName : null);
        return !isHiddenPrivateGroup(gName);
      });
      const visibleRawConversations = rawConversations.filter((c) => !isHiddenPrivateGroup(c.name));

      const dedupedMessages = deduplicateList(visibleRawMessages);

      const convMap = new Map<string, TwoChatConversation>();

      visibleRawConversations.forEach((c) => {
        const id = c.id || c.groupUuid || c.phoneOrId || c.name;
        if (id && !isHiddenPrivateGroup(c.name)) convMap.set(id, c);
      });

      dedupedMessages.forEach((msg) => {
        let convId = '';
        let convName = '';
        let isGrp = false;
        let grpUuid: string | undefined;

        if (msg.isGroup || msg.groupUuid) {
          isGrp = true;
          convId = msg.groupUuid || msg.groupName || 'unknown-group';
          convName = msg.groupName || 'WhatsApp Group';
          grpUuid = msg.groupUuid;
        } else {
          isGrp = false;
          const isOutgoing = msg.sentBy === 'user' || msg.sentBy === 'agent' || msg.sentBy === 'api';
          const otherNumber = isOutgoing
            ? msg.toNumber || msg.remoteNumber || msg.receiverNumber
            : msg.fromNumber || msg.remoteNumber || msg.senderNumber;

          convId = otherNumber || msg.senderNumber || msg.receiverNumber || 'direct-chat';
          convName = (isOutgoing ? msg.receiverName : msg.senderName) || formatPhone(convId);
        }

        if (!convMap.has(convId)) {
          convMap.set(convId, {
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
          const existing = convMap.get(convId)!;
          existing.messageCount = (existing.messageCount || 0) + 1;
          if (new Date(msg.timestamp).getTime() >= new Date(existing.lastTimestamp).getTime()) {
            existing.lastMessage = msg.text;
            existing.lastTimestamp = msg.timestamp;
          }
        }
      });

      const updatedConversations = Array.from(convMap.values())
        .filter((c) => !isHiddenPrivateGroup(c.name))
        .sort(
          (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
        );

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
    if (!confirm('Are you sure you want to clear the messages store?')) return;
    try {
      await fetch('/api/2chat/clear', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setAllMessages([]);
      setConversations([]);
      setSelectedChat(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cached_2chat_messages');
        localStorage.removeItem('cached_2chat_conversations');
      }
      setStatusText('All messages cleared.');
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
          return m.groupUuid === selectedChat.groupUuid || m.groupName === selectedChat.name;
        }
        const isOutgoing = m.sentBy === 'user' || m.sentBy === 'agent' || m.sentBy === 'api';
        const otherNumber = isOutgoing
          ? m.toNumber || m.remoteNumber || m.receiverNumber
          : m.fromNumber || m.remoteNumber || m.senderNumber;
        return otherNumber === selectedChat.phoneOrId || otherNumber === selectedChat.id;
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
            <div className="topbar-live-sync-badge">
              <span className="live-sync-pulse-dot" />
              <span className="live-sync-text">Live Sync</span>
            </div>
            <button
              type="button"
              className="topbar-icon-btn"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>
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
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
