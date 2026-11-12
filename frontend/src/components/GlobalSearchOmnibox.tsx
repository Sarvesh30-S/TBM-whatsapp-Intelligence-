'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  MessageSquare,
  Sparkles,
  Users,
  LayoutGrid,
  BarChart3,
  Settings,
  ArrowRight,
  Clock,
  CornerDownLeft,
} from 'lucide-react';
import { TwoChatMessage, TwoChatConversation, isHiddenPrivateGroup } from '@/lib/types';
import { DashboardSection } from './Sidebar';

interface GlobalSearchOmniboxProps {
  conversations: TwoChatConversation[];
  allMessages: TwoChatMessage[];
  onSelectGroup: (groupName: string) => void;
  onSelectMessage: (groupName: string, messageId: string) => void;
  onOpenSummary: (groupName: string) => void;
  onNavigateSection: (section: DashboardSection) => void;
}

export default function GlobalSearchOmnibox({
  conversations,
  allMessages,
  onSelectGroup,
  onSelectMessage,
  onOpenSummary,
  onNavigateSection,
}: GlobalSearchOmniboxProps) {
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K / '/' and Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Matching Groups
  const matchingGroups = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => c.name && !isHiddenPrivateGroup(c.name))
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 4);
  }, [conversations, query]);

  // Filter Matching Messages
  const matchingMessages = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return allMessages
      .filter((m) => {
        if (!m.text) return false;
        const gName = m.groupName || m.chatName || '';
        if (gName && isHiddenPrivateGroup(gName)) return false;
        return (
          m.text.toLowerCase().includes(q) ||
          (m.senderName && m.senderName.toLowerCase().includes(q))
        );
      })
      .slice(0, 5);
  }, [allMessages, query]);

  // Filter Matching Summaries & Intelligence
  const matchingSummaries = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => c.isGroup && !isHiddenPrivateGroup(c.name))
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          'ai intelligence briefing summary groq analysis'.includes(q)
      )
      .slice(0, 3);
  }, [conversations, query]);

  // Filter Platform Sections
  const matchingSections = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    const sections: {
      id: DashboardSection;
      label: string;
      desc: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
    }[] = [
      { id: 'overview', label: 'Workspace', desc: 'Operational overview & KPI metrics', icon: LayoutGrid },
      { id: 'test-messages', label: 'Groups & Chats', desc: 'Active conversation threads & live messaging', icon: MessageSquare },
      { id: 'message-summary', label: 'Intelligence Views', desc: 'AI briefings, decisions & action items', icon: Sparkles },
      { id: 'developer', label: 'Analytics & Console', desc: 'Telemetry, Groq latency & actuator health', icon: BarChart3 },
      { id: 'admin', label: 'Administration', desc: 'User management & role assignments', icon: Settings },
    ];
    return sections.filter(
      (s) => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
    );
  }, [query]);

  // Popular/Default Quick Jump Groups when input is empty
  const defaultQuickGroups = useMemo(() => {
    return conversations
      .filter((c) => c.isGroup && !isHiddenPrivateGroup(c.name))
      .slice(0, 4);
  }, [conversations]);

  const totalResultsCount =
    matchingGroups.length +
    matchingMessages.length +
    matchingSummaries.length +
    matchingSections.length;

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  // Helper to format timestamps nicely
  const formatTime = (ts?: string | number) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Highlight matching keyword
  const highlightMatch = (text: string, q: string) => {
    if (!q.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="omnibox-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="topbar-search-wrapper" ref={containerRef}>
      <Search size={15} className="topbar-search-icon" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search groups, messages, summaries..."
        className={`topbar-search-input ${isOpen ? 'active-search' : ''}`}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />

      {query ? (
        <button
          type="button"
          className="search-clear-btn"
          onClick={handleClear}
          title="Clear search"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      ) : (
        <span className="search-keyboard-hint desktop-only" title="Keyboard shortcut">
          ⌘K
        </span>
      )}

      {/* Floating Results Panel */}
      {isOpen && (
        <div className="omnibox-results-card">
          {query.trim().length === 0 ? (
            /* Empty Query: Suggested Quick Links */
            <div className="omnibox-empty-state">
              <div className="omnibox-section-header">
                <span>ACTIVE COMPANY CHANNELS</span>
                <span className="omnibox-section-tag">Quick Jump</span>
              </div>
              <div className="omnibox-group-list">
                {defaultQuickGroups.map((grp) => (
                  <div
                    key={grp.id}
                    className="omnibox-item-row"
                    onClick={() => {
                      onSelectGroup(grp.name);
                      setIsOpen(false);
                      setQuery('');
                    }}
                  >
                    <div className="omnibox-icon-box amber">
                      <Users size={14} />
                    </div>
                    <div className="omnibox-item-text">
                      <span className="omnibox-item-title">{grp.name}</span>
                      <span className="omnibox-item-sub">
                        {grp.messageCount || 0} messages • Active channel
                      </span>
                    </div>
                    <ArrowRight size={13} className="omnibox-row-arrow" />
                  </div>
                ))}
              </div>

              <div className="omnibox-section-header" style={{ marginTop: 12 }}>
                <span>QUICK WORKSPACES</span>
              </div>
              <div className="omnibox-quick-pills">
                <button
                  type="button"
                  className="omnibox-quick-pill"
                  onClick={() => {
                    onNavigateSection('test-messages');
                    setIsOpen(false);
                  }}
                >
                  <MessageSquare size={12} />
                  <span>Groups &amp; Chats</span>
                </button>
                <button
                  type="button"
                  className="omnibox-quick-pill"
                  onClick={() => {
                    onNavigateSection('message-summary');
                    setIsOpen(false);
                  }}
                >
                  <Sparkles size={12} />
                  <span>Group Intelligence</span>
                </button>
                <button
                  type="button"
                  className="omnibox-quick-pill"
                  onClick={() => {
                    onNavigateSection('developer');
                    setIsOpen(false);
                  }}
                >
                  <BarChart3 size={12} />
                  <span>Analytics &amp; Console</span>
                </button>
              </div>
            </div>
          ) : totalResultsCount === 0 ? (
            /* No Results Found */
            <div className="omnibox-no-results">
              <div className="no-results-icon-bubble">
                <Search size={22} />
              </div>
              <p className="no-results-title">No matches found for &quot;{query}&quot;</p>
              <p className="no-results-sub">
                Try searching by group name (e.g. Cent, Blue Tyga), message content, or keywords.
              </p>
            </div>
          ) : (
            /* Categorized Search Results */
            <div className="omnibox-scroll-results">
              {/* Category 1: Groups */}
              {matchingGroups.length > 0 && (
                <div className="omnibox-category-block">
                  <div className="omnibox-section-header">
                    <span>GROUPS ({matchingGroups.length})</span>
                  </div>
                  {matchingGroups.map((grp) => (
                    <div
                      key={grp.id}
                      className="omnibox-item-row"
                      onClick={() => {
                        onSelectGroup(grp.name);
                        setIsOpen(false);
                        setQuery('');
                      }}
                    >
                      <div className="omnibox-icon-box amber">
                        <Users size={14} />
                      </div>
                      <div className="omnibox-item-text">
                        <span className="omnibox-item-title">
                          {highlightMatch(grp.name, query)}
                        </span>
                        <span className="omnibox-item-sub">
                          {grp.messageCount || 0} messages synced • Click to open chat
                        </span>
                      </div>
                      <span className="omnibox-action-pill">Open Chat</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Category 2: Messages */}
              {matchingMessages.length > 0 && (
                <div className="omnibox-category-block">
                  <div className="omnibox-section-header">
                    <span>MESSAGES ({matchingMessages.length})</span>
                  </div>
                  {matchingMessages.map((msg) => {
                    const groupTitle = msg.groupName || msg.chatName || 'WhatsApp Group';
                    return (
                      <div
                        key={msg.id}
                        className="omnibox-item-row message-row"
                        onClick={() => {
                          onSelectMessage(groupTitle, msg.id);
                          setIsOpen(false);
                          setQuery('');
                        }}
                      >
                        <div className="omnibox-icon-box emerald">
                          <MessageSquare size={14} />
                        </div>
                        <div className="omnibox-item-text">
                          <div className="omnibox-message-meta">
                            <span className="omnibox-sender-name">
                              {msg.senderName || 'Member'}
                            </span>
                            <span className="omnibox-group-tag">• {groupTitle}</span>
                            <span className="omnibox-msg-time">
                              <Clock size={10} style={{ display: 'inline', marginRight: 2 }} />
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                          <p className="omnibox-message-snippet">
                            {highlightMatch(msg.text || '', query)}
                          </p>
                        </div>
                        <span className="omnibox-action-pill jump">Jump to message</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category 3: AI Summaries */}
              {matchingSummaries.length > 0 && (
                <div className="omnibox-category-block">
                  <div className="omnibox-section-header">
                    <span>AI SUMMARIES &amp; INTELLIGENCE</span>
                  </div>
                  {matchingSummaries.map((grp) => (
                    <div
                      key={`summary-${grp.id}`}
                      className="omnibox-item-row"
                      onClick={() => {
                        onOpenSummary(grp.name);
                        setIsOpen(false);
                        setQuery('');
                      }}
                    >
                      <div className="omnibox-icon-box amber">
                        <Sparkles size={14} />
                      </div>
                      <div className="omnibox-item-text">
                        <span className="omnibox-item-title">
                          View AI Briefing for {grp.name}
                        </span>
                        <span className="omnibox-item-sub">
                          Hinglish / English executive summary, decisions &amp; action items
                        </span>
                      </div>
                      <span className="omnibox-action-pill summary">View AI Summary</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Category 4: Workspaces */}
              {matchingSections.length > 0 && (
                <div className="omnibox-category-block">
                  <div className="omnibox-section-header">
                    <span>SECTIONS &amp; WORKSPACES</span>
                  </div>
                  {matchingSections.map((sec) => {
                    const Icon = sec.icon;
                    return (
                      <div
                        key={sec.id}
                        className="omnibox-item-row"
                        onClick={() => {
                          onNavigateSection(sec.id);
                          setIsOpen(false);
                          setQuery('');
                        }}
                      >
                        <div className="omnibox-icon-box blue">
                          <Icon size={14} />
                        </div>
                        <div className="omnibox-item-text">
                          <span className="omnibox-item-title">{sec.label}</span>
                          <span className="omnibox-item-sub">{sec.desc}</span>
                        </div>
                        <CornerDownLeft size={13} className="omnibox-row-arrow" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Omnibox Footer */}
          <div className="omnibox-footer">
            <div className="omnibox-footer-hints">
              <span>
                <kbd>Esc</kbd> to close
              </span>
              <span>•</span>
              <span>Click any result to jump directly</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
