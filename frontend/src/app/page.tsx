'use client';

import React, { useState, useEffect } from 'react';
import { Menu, ShieldCheck } from 'lucide-react';
import Sidebar, { DashboardSection } from '@/components/Sidebar';
import TestMessagesView from '@/components/TestMessagesView';
import MessageSummaryView from '@/components/MessageSummaryView';
import DeveloperView from '@/components/DeveloperView';
import { TwoChatConversation, TwoChatMessage } from '@/lib/types';

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

export default function DashboardPage() {
  // Navigation State: 'test-messages' | 'message-summary' | 'developer'
  const [currentSection, setCurrentSection] = useState<DashboardSection>('test-messages');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Application Data State
  const [apiKey, setApiKey] = useState<string>('');
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
  const [webhookUrl, setWebhookUrl] = useState<string>('https://tbm-whatsapp-intelligence.vercel.app/api/webhook/2chat');
  const [statusText, setStatusText] = useState<string>('');
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  // Load saved state from browser localStorage on startup & fetch from DB/API
  useEffect(() => {
    let keyToUse = '';
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
    // Always trigger initial fetch on mount
    loadData(keyToUse);
  }, []);

  // Fetch data function
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

        // Update messages cumulative store with deduplication
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          setAllMessages((prev) => {
            const merged = deduplicateList([...prev, ...data.messages]);
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
          setSelectedChat((curr) => {
            if (!curr) return data.conversations[0];
            const updated = data.conversations.find((c: TwoChatConversation) => c.id === curr.id);
            return updated || curr;
          });
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

  // Initial load when API key is set
  useEffect(() => {
    if (apiKey) {
      loadData(apiKey);
    }
  }, [apiKey]);

  // Handle saving API key from Developer settings
  const handleSaveApiKey = async (newKey: string) => {
    const trimmed = newKey.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('2chat_api_key', trimmed);
    }
    setStatusText('Saving & Subscribing...');

    try {
      const res = await fetch('/api/2chat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed, webhookUrl }),
      });
      const result = await res.json();
      if (result.subscribedChannels && result.subscribedChannels.length > 0) {
        setStatusText(`Subscribed ${result.subscribedChannels.length} channel(s)!`);
      } else {
        setStatusText('Key saved!');
      }
    } catch {
      setStatusText('Key saved!');
    }

    setTimeout(() => setStatusText(''), 3000);
    await loadData(trimmed);
  };

  // Handle clearing messages
  const handleClearMessages = async () => {
    if (confirm('Clear all stored messages?')) {
      await fetch('/api/2chat/clear', { method: 'POST' });
      setAllMessages([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cached_2chat_messages');
        localStorage.removeItem('cached_2chat_conversations');
      }
      loadData(apiKey);
    }
  };

  // Click on a chat
  const handleSelectChat = (chat: TwoChatConversation) => {
    setSelectedChat(chat);
    loadData(apiKey, chat.id, chat.isGroup, chat.groupUuid);
  };

  // Messages in active conversation thread
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
      alert('Please enter and save your 2Chat API Key first in the Developer section.');
      setCurrentSection('developer');
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

  const channelInfoDisplay = activeChannel
    ? formatPhone(activeChannel)
    : channels.length > 0
    ? `${channels[0].name || ''} (${formatPhone(channels[0].phone_number)})`.trim()
    : 'WhatsApp Channel Active';

  return (
    <div className="saas-app-layout">
      {/* Persistent Left Sidebar Navigation */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={(sec) => setCurrentSection(sec)}
        mobileOpen={mobileSidebarOpen}
        onToggleMobile={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        channelInfo={channelInfoDisplay}
      />

      {/* Main Content Area */}
      <div className="app-main-viewport">
        {/* Mobile Header Bar */}
        <header className="mobile-top-bar">
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="mobile-top-title">
            <span>WhatsApp Intelligence</span>
            <span className="mobile-section-badge">
              {currentSection === 'test-messages'
                ? 'Test Messages'
                : currentSection === 'message-summary'
                ? 'Message Summary'
                : 'Developer'}
            </span>
          </div>
        </header>

        {/* View Switching */}
        <main className="content-scroll-area">
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
              onNavigateToDeveloper={() => setCurrentSection('developer')}
            />
          )}

          {currentSection === 'message-summary' && (
            <MessageSummaryView
              totalMessagesCount={allMessages.length}
              conversations={conversations}
              allMessages={allMessages}
              onNavigateToTestMessages={(chatId) => {
                setCurrentSection('test-messages');
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
              onNavigateToDeveloper={() => setCurrentSection('developer')}
            />
          )}

          {currentSection === 'developer' && (
            <DeveloperView
              apiKey={apiKey}
              onSaveApiKey={handleSaveApiKey}
              webhookUrl={webhookUrl}
              statusText={statusText}
            />
          )}
        </main>
      </div>
    </div>
  );
}
