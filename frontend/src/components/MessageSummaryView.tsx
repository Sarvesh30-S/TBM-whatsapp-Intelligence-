'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  RotateCw,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  HelpCircle,
  Users,
  Compass,
  ListTodo,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Search,
  Filter,
  Cpu,
  Copy,
  Check,
  Building2,
  Briefcase,
  Split,
} from 'lucide-react';
import { TwoChatMessage, TwoChatConversation, isHiddenPrivateGroup } from '@/lib/types';
import {
  GroupIntelligenceBriefing,
  StorylineStep,
  TopicDossier,
  DecisionItem,
  ActionTrackerItem,
  PendingDiscussion,
  ImportantDevelopment,
  ParticipantContribution,
  KeyInformationItem,
} from '@/lib/groq-client';
import { useAuth } from '@/context/AuthContext';

interface MessageSummaryViewProps {
  totalMessagesCount: number;
  conversations: TwoChatConversation[];
  allMessages: TwoChatMessage[];
  onNavigateToTestMessages: (chatId?: string, messageId?: string) => void;
  onNavigateToDeveloper: () => void;
}

type SubSection =
  | 'briefing'
  | 'storyline'
  | 'topics'
  | 'decisions'
  | 'actions'
  | 'pending'
  | 'participants';

export default function MessageSummaryView({
  totalMessagesCount,
  conversations,
  allMessages,
  onNavigateToTestMessages,
  onNavigateToDeveloper,
}: MessageSummaryViewProps) {
  const { hasRole, hasPermission } = useAuth();
  const canGenerate = hasRole('ADMIN') || hasRole('MANAGER') || hasPermission('SUMMARY_GENERATE');

  // Discover group names with real messages (filtering out private personal test groups and direct chats)
  const availableGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const msg of allMessages) {
      // Must be an actual group message, not a direct chat
      if (!msg.isGroup && !msg.groupUuid) continue;
      const gName = msg.groupName || msg.chatName;
      if (gName && !isHiddenPrivateGroup(gName)) {
        map.set(gName, (map.get(gName) || 0) + 1);
      }
    }
    // Also include conversation objects that are strictly groups
    for (const c of conversations) {
      if (c.isGroup && c.name && !isHiddenPrivateGroup(c.name) && !map.has(c.name)) {
        map.set(c.name, 0);
      }
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [allMessages, conversations]);

  // Selected Group state (default to first company group with messages)
  const [selectedGroup, setSelectedGroup] = useState<string>(() => {
    if (availableGroups.length > 0) {
      const best = availableGroups.find((g) => g.count > 0 && !isHiddenPrivateGroup(g.name)) || availableGroups[0];
      return best.name;
    }
    return 'Client || Blue Tyga x TBM || Celeb execution';
  });

  // Date range filter: 'all' | '7d' | '24h'
  const [dateRange, setDateRange] = useState<'all' | '7d' | '24h'>('all');

  // Navigation tab inside Group Intelligence
  const [activeSection, setActiveSection] = useState<SubSection>('briefing');

  // Selected topic for Topic Explorer
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  // Briefing generation & language state (Default to Hinglish as requested!)
  const [summaryLanguage, setSummaryLanguage] = useState<'hinglish' | 'english'>('hinglish');
  const [groupBriefingsCache, setGroupBriefingsCache] = useState<Record<string, GroupIntelligenceBriefing>>({});
  const [copiedToast, setCopiedToast] = useState<string>('');

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [briefing, setBriefing] = useState<GroupIntelligenceBriefing | null>(null);
  const [briefingError, setBriefingError] = useState<string>('');

  // Custom modern group dropdown state
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState<boolean>(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>('');
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setIsGroupDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGroupDropdownOpen(false);
      }
    };
    if (isGroupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGroupDropdownOpen]);

  const filteredDropdownGroups = useMemo(() => {
    if (!groupSearchQuery.trim()) return availableGroups;
    const q = groupSearchQuery.toLowerCase();
    return availableGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [availableGroups, groupSearchQuery]);

  // Filter messages for current group and date range
  const currentGroupMessages = useMemo(() => {
    const now = Date.now();
    return allMessages
      .filter((m) => {
        const mGroup = m.groupName || (m.isGroup ? m.chatName : '');
        return mGroup && mGroup.toLowerCase() === selectedGroup.toLowerCase();
      })
      .filter((m) => {
        if (dateRange === 'all') return true;
        const msgTime = new Date(m.timestamp).getTime();
        if (dateRange === '24h') return now - msgTime <= 24 * 3600 * 1000;
        if (dateRange === '7d') return now - msgTime <= 7 * 24 * 3600 * 1000;
        return true;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [allMessages, selectedGroup, dateRange]);

  const selectedGroupData = useMemo(() => {
    return (
      availableGroups.find((g) => g.name.toLowerCase() === selectedGroup.toLowerCase()) || {
        name: selectedGroup,
        count: currentGroupMessages.length,
      }
    );
  }, [availableGroups, selectedGroup, currentGroupMessages.length]);

  // Request new briefing from API for a specific group
  const generateGroupBriefing = async (targetGroup: string = selectedGroup) => {
    setAnalyzing(true);
    setBriefingError('');
    try {
      const now = Date.now();
      const targetGroupMessages = allMessages
        .filter((m) => {
          const mGroup = m.groupName || (m.isGroup ? m.chatName : '');
          return mGroup && mGroup.toLowerCase() === targetGroup.toLowerCase();
        })
        .filter((m) => {
          if (dateRange === 'all') return true;
          const msgTime = new Date(m.timestamp).getTime();
          if (dateRange === '24h') return now - msgTime <= 24 * 3600 * 1000;
          if (dateRange === '7d') return now - msgTime <= 7 * 24 * 3600 * 1000;
          return true;
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const res = await fetch('/api/groq/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'group_intelligence',
          groupName: targetGroup,
          dateRange,
          messages: targetGroupMessages.length > 0 ? targetGroupMessages : undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setBriefing(json.data);
        setGroupBriefingsCache((prev) => ({ ...prev, [targetGroup]: json.data }));
        if (json.data.topics && json.data.topics.length > 0) {
          setSelectedTopicId(json.data.topics[0].id);
        }
      } else {
        setBriefingError(json.error || 'Failed to generate briefing');
      }
    } catch (err: any) {
      setBriefingError(err.message || 'Network error communicating with Groq intelligence service.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Switch active group and immediately present cached summary or fetch from Groq
  const handleSelectGroup = (gName: string) => {
    setSelectedGroup(gName);
    if (groupBriefingsCache[gName]) {
      setBriefing(groupBriefingsCache[gName]);
      if (groupBriefingsCache[gName].topics && groupBriefingsCache[gName].topics.length > 0) {
        setSelectedTopicId(groupBriefingsCache[gName].topics[0].id);
      }
    } else {
      generateGroupBriefing(gName);
    }
  };

  // Copy all raw chronological messages of the active group to clipboard
  const handleCopyAllMessages = () => {
    if (!currentGroupMessages || currentGroupMessages.length === 0) {
      setCopiedToast('No messages found for this group.');
      setTimeout(() => setCopiedToast(''), 3000);
      return;
    }

    const payload = currentGroupMessages
      .map((m) => {
        const time = new Date(m.timestamp).toLocaleString();
        const sender = m.senderName || m.senderNumber || 'Team Member';
        const reply = m.quotedMessage ? ` [In reply to: "${m.quotedMessage}"]` : '';
        return `[${time}] ${sender}${reply}: ${m.text || '[Media/Attachment]'}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(payload).then(() => {
      setCopiedToast(`Copied ${currentGroupMessages.length} messages from "${selectedGroup}" to clipboard!`);
      setTimeout(() => setCopiedToast(''), 3500);
    });
  };

  // Auto-generate on first load or when group/dateRange changes
  useEffect(() => {
    if (selectedGroup) {
      if (groupBriefingsCache[selectedGroup]) {
        setBriefing(groupBriefingsCache[selectedGroup]);
      } else {
        generateGroupBriefing(selectedGroup);
      }
    }
  }, [selectedGroup, dateRange]);

  // Render markdown bold text cleanly
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ color: '#0f172a', fontWeight: 700 }}>
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

  // Helper for source citation button
  const renderCitationBadge = (sourceMessageIds?: string[]) => {
    if (!sourceMessageIds || sourceMessageIds.length === 0) return null;
    const firstId = sourceMessageIds[0];
    const displayId = firstId.length > 12 ? firstId.slice(0, 8) + '...' : firstId;

    return (
      <button
        type="button"
        className="citation-badge-btn"
        onClick={(e) => {
          e.stopPropagation();
          onNavigateToTestMessages(selectedGroup, firstId);
        }}
        title={`Jump to original WhatsApp message (${firstId})`}
      >
        <MessageSquare size={11} />
        <span>Source #{displayId}</span>
        <ArrowRight size={10} />
      </button>
    );
  };

  const activeTopic =
    briefing?.topics.find((t) => t.id === selectedTopicId) || briefing?.topics[0];

  return (
    <div className="intelligence-view-container">
      {/* =========================================================================
          1. GROUP SELECTION & METADATA HEADER
          ========================================================================= */}
      <header className="group-intelligence-header">
        <div className="header-top-row">
          {/* Group Identity - Clean Professional Title */}
          <div className="group-identity-meta">
            <h1 className="group-main-title">{selectedGroup}</h1>
          </div>

          {/* Action Buttons: Copy Messages, Language Switcher, Regenerate */}
          <div className="header-actions-group">
            <button
              type="button"
              className="btn-intelligence-copy"
              onClick={handleCopyAllMessages}
              title="Copy all available conversation messages for this group to clipboard"
            >
              <Copy size={13} />
              <span>Copy All Messages</span>
            </button>

            <div className="language-switch-toggle" title="Switch summary language">
              <button
                type="button"
                className={`lang-btn ${summaryLanguage === 'hinglish' ? 'active' : ''}`}
                onClick={() => setSummaryLanguage('hinglish')}
              >
                🇮🇳 Hinglish
              </button>
              <button
                type="button"
                className={`lang-btn ${summaryLanguage === 'english' ? 'active' : ''}`}
                onClick={() => setSummaryLanguage('english')}
              >
                🇬🇧 English
              </button>
            </div>

            {canGenerate && (
              <button
                type="button"
                className="btn-intelligence-generate"
                onClick={() => generateGroupBriefing(selectedGroup)}
                disabled={analyzing}
              >
                <RotateCw size={14} className={analyzing ? 'animate-spin' : ''} />
                <span>{analyzing ? 'Analyzing Context...' : 'Regenerate Briefing'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Group Selector & Date Filter Controls */}
        <div className="header-controls-row">
          <div className="controls-left" ref={groupDropdownRef}>
            <label className="selector-label">
              <Compass size={13} />
              <span>ACTIVE WHATSAPP GROUP:</span>
            </label>

            <div className="custom-group-dropdown-wrapper">
              <button
                type="button"
                className={`custom-group-dropdown-trigger ${isGroupDropdownOpen ? 'open' : ''}`}
                onClick={() => setIsGroupDropdownOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isGroupDropdownOpen}
                title="Select active WhatsApp group"
              >
                <div className="trigger-group-info">
                  <span className="trigger-group-name">{selectedGroup}</span>
                  {selectedGroupData && (
                    <span className="trigger-group-count">
                      {selectedGroupData.count} {selectedGroupData.count === 1 ? 'msg' : 'msgs'}
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={15}
                  className={`trigger-chevron ${isGroupDropdownOpen ? 'rotated' : ''}`}
                />
              </button>

              {isGroupDropdownOpen && (
                <div className="custom-group-dropdown-menu" role="listbox">
                  {availableGroups.length > 4 && (
                    <div className="dropdown-search-box">
                      <Search size={13} className="dropdown-search-icon" />
                      <input
                        type="text"
                        className="dropdown-search-input"
                        placeholder="Search groups..."
                        value={groupSearchQuery}
                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="dropdown-options-scroll">
                    {filteredDropdownGroups.length === 0 ? (
                      <div className="dropdown-no-results">
                        No groups matching &quot;{groupSearchQuery}&quot;
                      </div>
                    ) : (
                      filteredDropdownGroups.map((g) => {
                        const isSelected = g.name.toLowerCase() === selectedGroup.toLowerCase();
                        return (
                          <div
                            key={g.name}
                            className={`dropdown-option-row ${isSelected ? 'selected' : ''}`}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              handleSelectGroup(g.name);
                              setIsGroupDropdownOpen(false);
                              setGroupSearchQuery('');
                            }}
                          >
                            <span className="option-group-name">{g.name}</span>
                            <div className="option-right-meta">
                              <span className="option-msg-count">
                                {g.count} {g.count === 1 ? 'msg' : 'msgs'}
                              </span>
                              {isSelected && <Check size={14} className="option-check-icon" />}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="controls-right">
            <div className="date-filter-group">
              <span className="filter-label">
                <Calendar size={12} /> Date Range:
              </span>
              <button
                type="button"
                className={`filter-range-btn ${dateRange === 'all' ? 'active' : ''}`}
                onClick={() => setDateRange('all')}
              >
                All Messages
              </button>
              <button
                type="button"
                className={`filter-range-btn ${dateRange === '7d' ? 'active' : ''}`}
                onClick={() => setDateRange('7d')}
              >
                Past 7 Days
              </button>
              <button
                type="button"
                className={`filter-range-btn ${dateRange === '24h' ? 'active' : ''}`}
                onClick={() => setDateRange('24h')}
              >
                Past 24 Hours
              </button>
            </div>
          </div>
        </div>

        {briefingError && (
          <div className="briefing-alert-banner">
            <AlertTriangle size={16} />
            <span>{briefingError}</span>
          </div>
        )}
      </header>

      {/* =========================================================================
          2. MAIN 2-COLUMN INTELLIGENCE LAYOUT (Left Sub-Nav + Right Content Pane)
          ========================================================================= */}
      <div className="intelligence-main-layout">
        {/* Left Sub-Navigation Sidebar */}
        <aside className="intelligence-subnav-sidebar">
          <div className="subnav-sidebar-header">
            <span className="subnav-sidebar-tag">INTELLIGENCE VIEWS</span>
          </div>

          <nav className="subnav-vertical-menu">
            <button
              type="button"
              className={`subnav-vertical-item ${activeSection === 'briefing' ? 'active' : ''}`}
              onClick={() => setActiveSection('briefing')}
            >
              <div className="subnav-item-icon-wrap">
                <FileText size={15} />
              </div>
              <span className="subnav-vertical-label">Executive Briefing</span>
            </button>

            <button
              type="button"
              className={`subnav-vertical-item ${activeSection === 'storyline' ? 'active' : ''}`}
              onClick={() => setActiveSection('storyline')}
            >
              <div className="subnav-item-icon-wrap">
                <Clock size={15} />
              </div>
              <span className="subnav-vertical-label">Storyline</span>
              {briefing?.storyline && briefing.storyline.length > 0 && (
                <span className="subnav-count-badge">{briefing.storyline.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`subnav-vertical-item ${activeSection === 'topics' ? 'active' : ''}`}
              onClick={() => setActiveSection('topics')}
            >
              <div className="subnav-item-icon-wrap">
                <Layers size={15} />
              </div>
              <span className="subnav-vertical-label">Topic Explorer</span>
              {briefing?.topics && briefing.topics.length > 0 && (
                <span className="subnav-count-badge">{briefing.topics.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`subnav-vertical-item ${activeSection === 'decisions' ? 'active' : ''}`}
              onClick={() => setActiveSection('decisions')}
            >
              <div className="subnav-item-icon-wrap">
                <CheckCircle2 size={15} />
              </div>
              <span className="subnav-vertical-label">Decisions Log</span>
              {briefing?.decisions && briefing.decisions.length > 0 && (
                <span className="subnav-count-badge">{briefing.decisions.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`subnav-vertical-item ${activeSection === 'actions' ? 'active' : ''}`}
              onClick={() => setActiveSection('actions')}
            >
              <div className="subnav-item-icon-wrap">
                <ListTodo size={15} />
              </div>
              <span className="subnav-vertical-label">Action Tracker</span>
              {briefing?.actionTracker && briefing.actionTracker.length > 0 && (
                <span className="subnav-count-badge">{briefing.actionTracker.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`subnav-vertical-item ${activeSection === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveSection('pending')}
            >
              <div className="subnav-item-icon-wrap">
                <HelpCircle size={15} />
              </div>
              <span className="subnav-vertical-label">Pending Discussions</span>
              {briefing?.pendingDiscussions && briefing.pendingDiscussions.length > 0 && (
                <span className="subnav-count-badge alert">
                  {briefing.pendingDiscussions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`subnav-vertical-item ${activeSection === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveSection('participants')}
            >
              <div className="subnav-item-icon-wrap">
                <Users size={15} />
              </div>
              <span className="subnav-vertical-label">Contributors</span>
              {briefing?.participantContributions && briefing.participantContributions.length > 0 && (
                <span className="subnav-count-badge">{briefing.participantContributions.length}</span>
              )}
            </button>
          </nav>
        </aside>

        {/* Right Main Content Pane */}
        <main className="intelligence-content-pane">
        {/* SECTION 1: EXECUTIVE BRIEFING (DEFAULT VIEW) */}
        {activeSection === 'briefing' && (
          <div className="editorial-briefing-pane">
            <div className="briefing-paper-card">
              <div className="briefing-title-meta">
                <span className="document-tag">OVERALL CONVERSATION SUMMARY</span>
                <span className="document-timestamp">
                  Coverage: {new Date(briefing?.dateRange.start || Date.now()).toLocaleDateString()} &mdash;{' '}
                  {new Date(briefing?.dateRange.end || Date.now()).toLocaleDateString()}
                </span>
              </div>

              {analyzing && (
                <div className="summary-analyzing-banner">
                  <RotateCw size={13} className="animate-spin" style={{ color: '#7667e8' }} />
                  <span>Synthesizing conversation intelligence for <strong>{selectedGroup}</strong>...</span>
                </div>
              )}

              {/* =========================================================================
                  RESTRUCTURED AI SUMMARY DASHBOARD (7 PHASES IN EXACT REQUIRED ORDER)
                  1. Group Context (Highest Priority - Prominent Top Section)
                  2. Executive Overview
                  3. Key Information
                  4. Conversation Breakdown
                  5. Decisions & Agreements
                  6. Pending Actions & Blockers
                  7. Timeline & Milestones
                  ========================================================================= */}
              {(() => {
                const eb = briefing?.executiveBriefing;
                const isHinglish = summaryLanguage === 'hinglish';

                // 1. Group Context Text & Paragraphs (Phase 1)
                const rawGroupContext = isHinglish
                  ? (eb?.groupContextHinglish || briefing?.groupContextHinglish || eb?.groupContext || briefing?.groupContext || '')
                  : (eb?.groupContext || briefing?.groupContext || '');

                const groupContextParagraphs = rawGroupContext
                  ? rawGroupContext.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
                  : [
                      `This WhatsApp group serves as the active coordination hub for ${selectedGroup}. Discussions focus on active deliverables, client feedback, review milestones, and operational alignment.`,
                      `Key stakeholders and team members align on scope, deliverables, and timelines. Review the sections below for the executive breakdown, commercial metrics, confirmed decisions, and pending action items.`
                    ];

                const isLimitedHistory = currentGroupMessages.length > 0 && currentGroupMessages.length <= 5;

                // 2. Executive Overview Content (Phase 2)
                const overviewNarrative = isHinglish
                  ? (eb?.overviewHinglish || eb?.overview || '')
                  : (eb?.overview || '');

                const currentSituationText = isHinglish
                  ? (eb?.currentSituationHinglish || eb?.currentSituation || '')
                  : (eb?.currentSituation || '');

                const tldrList: string[] = (isHinglish && eb?.tldrHinglish && eb.tldrHinglish.length > 0)
                  ? eb.tldrHinglish
                  : (eb?.tldr && eb.tldr.length > 0)
                  ? eb.tldr
                  : [currentSituationText || overviewNarrative].filter(Boolean);

                // 3. Key Information (Budgets, pricing, dates, deliverables, metrics) (Phase 3)
                const rawKeyInfo = isHinglish
                  ? (eb?.keyInformationHinglish || briefing?.keyInformationHinglish || eb?.keyInformation || briefing?.keyInformation || [])
                  : (eb?.keyInformation || briefing?.keyInformation || []);

                const keyInfoItems: KeyInformationItem[] = (() => {
                  if (rawKeyInfo && rawKeyInfo.length > 0) return rawKeyInfo;
                  const derived: KeyInformationItem[] = [];
                  (briefing?.decisions || []).forEach((d) => {
                    const text = `${d.title} ${d.context}`;
                    const budgetMatch = text.match(/(₹\s?[\d,]+|\$\s?[\d,]+|\b\d+k\b|\b\d+\s?lakhs?\b|retainer|commercials?)/i);
                    if (budgetMatch && derived.filter((x) => x.category === 'budget').length < 2) {
                      derived.push({
                        id: `derived-b-${d.id}`,
                        category: 'budget',
                        label: d.title,
                        value: budgetMatch[0],
                        detail: d.context,
                        sourceMessageIds: d.sourceMessageIds,
                      });
                    }
                  });
                  (briefing?.actionTracker || []).forEach((a) => {
                    if (a.deadline && a.deadline !== 'Not specified' && derived.filter((x) => x.category === 'date').length < 2) {
                      derived.push({
                        id: `derived-d-${a.id}`,
                        category: 'date',
                        label: a.action,
                        value: a.deadline,
                        detail: `Owner: ${a.owner}`,
                        sourceMessageIds: a.sourceMessageIds,
                      });
                    }
                  });
                  (briefing?.decisions || []).forEach((d) => {
                    const text = `${d.title} ${d.context}`;
                    if (/(reel|post|video|draft|script|agreement|cut|shoot|creative)/i.test(text) && derived.filter((x) => x.category === 'deliverable').length < 2) {
                      derived.push({
                        id: `derived-del-${d.id}`,
                        category: 'deliverable',
                        label: 'Deliverable Target',
                        value: d.title,
                        detail: d.context,
                        sourceMessageIds: d.sourceMessageIds,
                      });
                    }
                  });
                  return derived;
                })();

                // 4. Conversation Breakdown (Client Perspective vs Agency Perspective) (Phase 4)
                const clientSideData = isHinglish ? (eb?.clientSideHinglish || eb?.clientSide) : eb?.clientSide;
                const teamSideData = isHinglish ? (eb?.teamSideHinglish || eb?.teamSide) : eb?.teamSide;

                const clientTrack = {
                  title: clientSideData?.title || 'Client Perspective',
                  status: clientSideData?.status || 'Active',
                  position: clientSideData?.position || (clientSideData?.points && clientSideData.points[0]) || 'Reviewing submitted deliverables and providing campaign direction.',
                  concerns: (isHinglish && clientSideData?.concernsHinglish && clientSideData.concernsHinglish.length > 0)
                    ? clientSideData.concernsHinglish
                    : (clientSideData?.concerns && clientSideData.concerns.length > 0)
                    ? clientSideData.concerns
                    : (clientSideData?.points ? clientSideData.points.slice(0, 2) : []),
                  proposals: (isHinglish && clientSideData?.proposalsHinglish && clientSideData.proposalsHinglish.length > 0)
                    ? clientSideData.proposalsHinglish
                    : (clientSideData?.proposals && clientSideData.proposals.length > 0)
                    ? clientSideData.proposals
                    : (clientSideData?.points ? clientSideData.points.slice(1, 3) : []),
                  expectations: (isHinglish && clientSideData?.expectationsHinglish && clientSideData.expectationsHinglish.length > 0)
                    ? clientSideData.expectationsHinglish
                    : (clientSideData?.expectations || []),
                  sourceMessageIds: clientSideData?.sourceMessageIds,
                };

                const teamTrack = {
                  title: teamSideData?.title || 'Agency Execution (TheBoredMonkey)',
                  status: teamSideData?.status || 'In Progress',
                  position: teamSideData?.position || (teamSideData?.points && teamSideData.points[0]) || 'Executing production deliverables and coordinating cross-functional milestones.',
                  concerns: (isHinglish && teamSideData?.concernsHinglish && teamSideData.concernsHinglish.length > 0)
                    ? teamSideData.concernsHinglish
                    : (teamSideData?.concerns && teamSideData.concerns.length > 0)
                    ? teamSideData.concerns
                    : (teamSideData?.points ? teamSideData.points.slice(0, 2) : []),
                  proposals: (isHinglish && teamSideData?.proposalsHinglish && teamSideData.proposalsHinglish.length > 0)
                    ? teamSideData.proposalsHinglish
                    : (teamSideData?.proposals && teamSideData.proposals.length > 0)
                    ? teamSideData.proposals
                    : (teamSideData?.points ? teamSideData.points.slice(1, 3) : []),
                  expectations: (isHinglish && teamSideData?.expectationsHinglish && teamSideData.expectationsHinglish.length > 0)
                    ? teamSideData.expectationsHinglish
                    : (teamSideData?.expectations || []),
                  sourceMessageIds: teamSideData?.sourceMessageIds,
                };

                // 5. Decisions & Agreements (Confirmed vs Proposals) (Phase 5)
                const confirmedDecisions = (briefing?.decisions || []).filter((d) => d.status === 'CONFIRMED');
                const otherDecisions = (briefing?.decisions || []).filter((d) => d.status !== 'CONFIRMED');

                // 6. Pending Actions & Blockers (Phase 6)
                const unresolvedActions = (briefing?.actionTracker || []).filter((a) => a.status !== 'COMPLETED');
                const activeBlockers = (isHinglish && eb?.pendingBlockersHinglish && eb.pendingBlockersHinglish.length > 0)
                  ? eb.pendingBlockersHinglish
                  : (eb?.pendingBlockers && eb.pendingBlockers.length > 0)
                  ? eb.pendingBlockers
                  : (briefing?.pendingDiscussions || []).map((p) => ({
                      item: p.unresolvedQuestion || p.topic,
                      waitingOn: (p.participantsInvolved || [])[0] || 'Team',
                      sourceMessageIds: p.sourceMessageIds,
                    }));

                // 7. Timeline & Milestones (Phase 7)
                const storylineSteps = briefing?.storyline || [];

                return (
                  <div className="modern-saas-summary-stack">
                    {/* -------------------------------------------------------------
                        1. GROUP CONTEXT (Highest Priority - Prominent Top Section)
                        ------------------------------------------------------------- */}
                    <section className="summary-group-context-card">
                      <div className="group-context-top-bar">
                        <div className="group-context-start-badge">
                          <Sparkles size={13} className="context-badge-icon" />
                          <span>New to this group? Start here.</span>
                        </div>
                        <span className="group-context-section-label">GROUP CONTEXT</span>
                      </div>

                      <div className="group-context-body">
                        {groupContextParagraphs.map((para, idx) => (
                          <p key={idx} className="group-context-paragraph">
                            {renderFormattedText(para)}
                          </p>
                        ))}
                      </div>

                      {isLimitedHistory && (
                        <div className="group-context-limited-bar">
                          <AlertTriangle size={12} />
                          <span>Context is based on limited available messages ({currentGroupMessages.length} total messages in this group).</span>
                        </div>
                      )}
                    </section>

                    {/* -------------------------------------------------------------
                        2. EXECUTIVE OVERVIEW
                        ------------------------------------------------------------- */}
                    <section className="summary-dashboard-card">
                      <div className="summary-card-header">
                        <div className="card-header-left">
                          <h2 className="summary-card-title">Executive Overview</h2>
                          <span className="summary-card-subtitle">Key developments &amp; current situation</span>
                        </div>
                      </div>

                      <div className="executive-overview-content">
                        {overviewNarrative && (
                          <p className="overview-narrative-text">
                            {renderFormattedText(overviewNarrative)}
                          </p>
                        )}

                        {tldrList.length > 0 && (
                          <div className="overview-takeaways-group">
                            <span className="overview-takeaways-title">Key Highlights</span>
                            <ul className="overview-highlights-list">
                              {tldrList.map((bullet, idx) => (
                                <li key={idx} className="overview-highlight-row">
                                  <span className="overview-bullet-dot" />
                                  <span className="overview-bullet-text">{renderFormattedText(bullet)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {currentSituationText && currentSituationText !== overviewNarrative && (
                          <div className="overview-situation-callout">
                            <span className="situation-badge">CURRENT STATUS</span>
                            <p className="situation-text">{renderFormattedText(currentSituationText)}</p>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* -------------------------------------------------------------
                        3. KEY INFORMATION (Compact Information Cards)
                        ------------------------------------------------------------- */}
                    <section className="summary-dashboard-card">
                      <div className="summary-card-header">
                        <div className="card-header-left">
                          <h2 className="summary-card-title">Key Information</h2>
                          <span className="summary-card-subtitle">Budgets, pricing, delivery dates, deliverables &amp; critical metrics</span>
                        </div>
                      </div>

                      {keyInfoItems.length > 0 ? (
                        <div className="key-info-grid">
                          {keyInfoItems.map((item) => {
                            const cat = item.category || 'metric';
                            return (
                              <div key={item.id} className={`key-info-card cat-${cat}`}>
                                <div className="key-info-card-header">
                                  <span className={`key-info-cat-pill pill-${cat}`}>
                                    {cat === 'budget' && '💰 BUDGET / PRICING'}
                                    {cat === 'date' && '📅 DELIVERY DATE / DEADLINE'}
                                    {cat === 'deliverable' && '📦 DELIVERABLE'}
                                    {cat === 'metric' && '📊 METRIC / NUMBER'}
                                  </span>
                                  {renderCitationBadge(item.sourceMessageIds)}
                                </div>
                                <div className="key-info-card-value" title={item.value}>
                                  {item.value}
                                </div>
                                <div className="key-info-card-label">{item.label}</div>
                                {item.detail && (
                                  <div className="key-info-card-detail">{item.detail}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="summary-empty-state">
                          <FileText size={15} />
                          <span>No explicit commercial pricing, delivery deadlines, or fixed deliverables mentioned in conversation.</span>
                        </div>
                      )}
                    </section>

                    {/* -------------------------------------------------------------
                        4. CONVERSATION BREAKDOWN (Client vs Agency Separate)
                        ------------------------------------------------------------- */}
                    <section className="summary-dashboard-card">
                      <div className="summary-card-header">
                        <div className="card-header-left">
                          <h2 className="summary-card-title">Conversation Breakdown</h2>
                          <span className="summary-card-subtitle">Client Perspective &amp; Agency Perspective &mdash; side-by-side comparison</span>
                        </div>
                      </div>

                      <div className="breakdown-streams-grid">
                        {/* Client Perspective Column */}
                        <div className="stream-perspective-col client-perspective">
                          <div className="perspective-stream-header">
                            <div className="perspective-title-wrap">
                              <div className="perspective-icon-wrap client">
                                <Building2 size={15} />
                              </div>
                              <div>
                                <span className="perspective-stream-kicker">CLIENT PERSPECTIVE</span>
                                <h3 className="perspective-actor-heading">{clientTrack.title}</h3>
                              </div>
                            </div>
                            {clientTrack.status && (
                              <span className="perspective-status-pill client">{clientTrack.status}</span>
                            )}
                          </div>

                          <div className="perspective-stream-body">
                            {/* Position */}
                            <div className="perspective-facet-block">
                              <span className="facet-label">Current Position</span>
                              <p className="facet-content-text">{renderFormattedText(clientTrack.position)}</p>
                            </div>

                            {/* Main Concerns */}
                            {clientTrack.concerns.length > 0 && (
                              <div className="perspective-facet-block">
                                <span className="facet-label">Main Concerns &amp; Constraints</span>
                                <ul className="facet-bullets-list">
                                  {clientTrack.concerns.map((c, i) => (
                                    <li key={i} className="facet-bullet-row">
                                      <span className="facet-bullet-dot client" />
                                      <span className="facet-bullet-text">{renderFormattedText(c)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Proposals */}
                            {clientTrack.proposals.length > 0 && (
                              <div className="perspective-facet-block">
                                <span className="facet-label">Proposals &amp; Feedback</span>
                                <ul className="facet-bullets-list">
                                  {clientTrack.proposals.map((p, i) => (
                                    <li key={i} className="facet-bullet-row">
                                      <span className="facet-bullet-dot client" />
                                      <span className="facet-bullet-text">{renderFormattedText(p)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Expectations */}
                            {clientTrack.expectations.length > 0 && (
                              <div className="perspective-facet-block">
                                <span className="facet-label">Next Expectations</span>
                                <ul className="facet-bullets-list">
                                  {clientTrack.expectations.map((exp, i) => (
                                    <li key={i} className="facet-bullet-row">
                                      <span className="facet-bullet-dot client" />
                                      <span className="facet-bullet-text">{renderFormattedText(exp)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Agency Perspective Column */}
                        <div className="stream-perspective-col agency-perspective">
                          <div className="perspective-stream-header">
                            <div className="perspective-title-wrap">
                              <div className="perspective-icon-wrap agency">
                                <Briefcase size={15} />
                              </div>
                              <div>
                                <span className="perspective-stream-kicker">AGENCY PERSPECTIVE</span>
                                <h3 className="perspective-actor-heading">{teamTrack.title}</h3>
                              </div>
                            </div>
                            {teamTrack.status && (
                              <span className="perspective-status-pill agency">{teamTrack.status}</span>
                            )}
                          </div>

                          <div className="perspective-stream-body">
                            {/* Position */}
                            <div className="perspective-facet-block">
                              <span className="facet-label">Operational Posture</span>
                              <p className="facet-content-text">{renderFormattedText(teamTrack.position)}</p>
                            </div>

                            {/* Main Concerns / Constraints */}
                            {teamTrack.concerns.length > 0 && (
                              <div className="perspective-facet-block">
                                <span className="facet-label">Constraints &amp; Scope Boundaries</span>
                                <ul className="facet-bullets-list">
                                  {teamTrack.concerns.map((c, i) => (
                                    <li key={i} className="facet-bullet-row">
                                      <span className="facet-bullet-dot agency" />
                                      <span className="facet-bullet-text">{renderFormattedText(c)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Proposals */}
                            {teamTrack.proposals.length > 0 && (
                              <div className="perspective-facet-block">
                                <span className="facet-label">Solutions &amp; Deliverables</span>
                                <ul className="facet-bullets-list">
                                  {teamTrack.proposals.map((p, i) => (
                                    <li key={i} className="facet-bullet-row">
                                      <span className="facet-bullet-dot agency" />
                                      <span className="facet-bullet-text">{renderFormattedText(p)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Expectations */}
                            {teamTrack.expectations.length > 0 && (
                              <div className="perspective-facet-block">
                                <span className="facet-label">Next Expectations From Client</span>
                                <ul className="facet-bullets-list">
                                  {teamTrack.expectations.map((exp, i) => (
                                    <li key={i} className="facet-bullet-row">
                                      <span className="facet-bullet-dot agency" />
                                      <span className="facet-bullet-text">{renderFormattedText(exp)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* -------------------------------------------------------------
                        5. DECISIONS & AGREEMENTS (Only Confirmed Decisions)
                        ------------------------------------------------------------- */}
                    <section className="summary-dashboard-card">
                      <div className="summary-card-header">
                        <div className="card-header-left">
                          <h2 className="summary-card-title">Decisions &amp; Agreements</h2>
                          <span className="summary-card-subtitle">
                            Confirmed agreements ({confirmedDecisions.length} Confirmed)
                          </span>
                        </div>
                        <button
                          type="button"
                          className="summary-card-action-btn"
                          onClick={() => setActiveSection('decisions')}
                        >
                          View Decisions Log &rarr;
                        </button>
                      </div>

                      {confirmedDecisions.length > 0 ? (
                        <div className="confirmed-decisions-stack">
                          {confirmedDecisions.map((dec) => (
                            <div key={dec.id} className="confirmed-decision-row">
                              <div className="decision-status-col">
                                <CheckCircle2 size={16} className="decision-confirmed-check" />
                              </div>
                              <div className="decision-content-col">
                                <div className="decision-top-meta-line">
                                  <span className="decision-status-tag-confirmed">CONFIRMED</span>
                                  <h4 className="decision-heading-text">{dec.title}</h4>
                                </div>
                                {dec.context && (
                                  <p className="decision-context-paragraph">{renderFormattedText(dec.context)}</p>
                                )}
                                <div className="decision-bottom-meta-line">
                                  <span className="decision-date-tag">
                                    <Calendar size={11} /> {dec.date}
                                  </span>
                                  {dec.participants && dec.participants.length > 0 && (
                                    <span className="decision-participants-tag">
                                      <Users size={11} /> {dec.participants.join(', ')}
                                    </span>
                                  )}
                                  {renderCitationBadge(dec.sourceMessageIds)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="summary-empty-state">
                          <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                          <span>No binding decisions have been formally confirmed yet in this group.</span>
                        </div>
                      )}

                      {/* Distinct secondary section for non-confirmed suggestions */}
                      {otherDecisions.length > 0 && (
                        <div className="unconfirmed-proposals-container">
                          <div className="unconfirmed-header">
                            <span className="unconfirmed-title">
                              Pending Proposals &amp; Superseded Items ({otherDecisions.length})
                            </span>
                            <span className="unconfirmed-disclaimer">
                              *Unconfirmed proposals and superseded suggestions (not binding agreements)
                            </span>
                          </div>
                          <div className="unconfirmed-proposals-grid">
                            {otherDecisions.map((p) => (
                              <div key={p.id} className={`unconfirmed-item-card ${p.status.toLowerCase()}`}>
                                <div className="unconfirmed-card-top">
                                  <span className={`unconfirmed-badge ${p.status.toLowerCase()}`}>
                                    {p.status}
                                  </span>
                                  <span className="unconfirmed-date">{p.date}</span>
                                </div>
                                <div className="unconfirmed-card-title">{p.title}</div>
                                {p.context && <p className="unconfirmed-card-context">{p.context}</p>}
                                <div className="unconfirmed-card-footer">
                                  {renderCitationBadge(p.sourceMessageIds)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* -------------------------------------------------------------
                        6. PENDING ACTIONS & BLOCKERS
                        ------------------------------------------------------------- */}
                    <section className="summary-dashboard-card">
                      <div className="summary-card-header">
                        <div className="card-header-left">
                          <h2 className="summary-card-title">Pending Actions &amp; Blockers</h2>
                          <span className="summary-card-subtitle">
                            Unresolved tasks, assigned owners, and operational blockers
                          </span>
                        </div>
                        <button
                          type="button"
                          className="summary-card-action-btn"
                          onClick={() => setActiveSection('actions')}
                        >
                          View Action Tracker &rarr;
                        </button>
                      </div>

                      {/* Active Blockers Callout */}
                      {activeBlockers.length > 0 && (
                        <div className="summary-blockers-callout">
                          <div className="blockers-callout-header">
                            <AlertTriangle size={15} className="blocker-warning-icon" />
                            <span className="blockers-callout-heading">Active Blockers &amp; Dependencies</span>
                          </div>
                          <div className="blockers-callout-list">
                            {activeBlockers.map((blk, idx) => (
                              <div key={idx} className="blocker-callout-row">
                                <span className="blocker-title-text">{renderFormattedText(blk.item)}</span>
                                {blk.waitingOn && (
                                  <span className="blocker-dependency-badge">
                                    Awaiting action from: <strong>{blk.waitingOn}</strong>
                                  </span>
                                )}
                                {renderCitationBadge(blk.sourceMessageIds)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Unresolved Tasks Table */}
                      {unresolvedActions.length > 0 ? (
                        <div className="summary-actions-table-box">
                          <table className="modern-actions-table">
                            <thead>
                              <tr>
                                <th style={{ width: '42%' }}>Task Description</th>
                                <th style={{ width: '18%' }}>Responsible Owner</th>
                                <th style={{ width: '16%' }}>Current Status</th>
                                <th style={{ width: '14%' }}>Deadline</th>
                                <th style={{ width: '10%' }}>Source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unresolvedActions.map((task) => {
                                const s = (task.status || 'PENDING').toUpperCase();
                                const statusClass =
                                  s === 'IN_PROGRESS' ? 'status-in-progress' :
                                  s === 'BLOCKED' ? 'status-blocked' : 'status-pending';

                                return (
                                  <tr key={task.id} className="action-table-row">
                                    <td className="action-task-col">
                                      <span className="action-task-text">{task.action}</span>
                                      {task.status === 'BLOCKED' && (
                                        <span className="action-blocked-hint">Blocked: awaiting inputs</span>
                                      )}
                                    </td>
                                    <td className="action-owner-col">
                                      <span className={`action-owner-tag ${task.owner === 'Unassigned' ? 'unassigned' : ''}`}>
                                        {task.owner || 'Unassigned'}
                                      </span>
                                    </td>
                                    <td className="action-status-col">
                                      <span className={`action-status-pill ${statusClass}`}>
                                        {s.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="action-deadline-col">
                                      <span className="action-deadline-label">{task.deadline || 'Not specified'}</span>
                                    </td>
                                    <td className="action-citation-col">
                                      {renderCitationBadge(task.sourceMessageIds)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="summary-empty-state">
                          <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                          <span>No pending tasks or unresolved action items recorded for this group.</span>
                        </div>
                      )}
                    </section>

                    {/* -------------------------------------------------------------
                        7. TIMELINE & MILESTONES (Clean Vertical Timeline)
                        ------------------------------------------------------------- */}
                    <section className="summary-dashboard-card">
                      <div className="summary-card-header">
                        <div className="card-header-left">
                          <h2 className="summary-card-title">Timeline &amp; Milestones</h2>
                          <span className="summary-card-subtitle">
                            Important events and deadlines in a clean vertical timeline
                          </span>
                        </div>
                        <button
                          type="button"
                          className="summary-card-action-btn"
                          onClick={() => setActiveSection('storyline')}
                        >
                          View Full Storyline &rarr;
                        </button>
                      </div>

                      {storylineSteps.length > 0 ? (
                        <div className="vertical-milestones-timeline">
                          {storylineSteps.map((step, idx) => {
                            const isLast = idx === storylineSteps.length - 1;
                            const stageName = (step.stage || 'DISCUSSION').replace(/_/g, ' ');

                            return (
                              <div key={step.id || idx} className={`vertical-timeline-item ${isLast ? 'last-node' : ''}`}>
                                <div className="vertical-timeline-track">
                                  <div className="vertical-timeline-dot" />
                                  {!isLast && <div className="vertical-timeline-stem" />}
                                </div>

                                <div className="vertical-timeline-card">
                                  <div className="vertical-timeline-card-header">
                                    <span className="timeline-stage-tag">{stageName}</span>
                                    <span className="timeline-date-label">
                                      <Clock size={11} />
                                      {step.timestamp}
                                    </span>
                                  </div>

                                  <h4 className="timeline-event-title">{step.heading}</h4>
                                  <p className="timeline-event-desc">{renderFormattedText(step.description)}</p>

                                  <div className="timeline-event-footer">
                                    {step.participants && step.participants.length > 0 && (
                                      <span className="timeline-participants-meta">
                                        <Users size={11} /> {step.participants.join(', ')}
                                      </span>
                                    )}
                                    {renderCitationBadge(step.sourceMessageIds)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="summary-empty-state">
                          <Clock size={15} />
                          <span>Timeline milestones will populate as the conversation develops.</span>
                        </div>
                      )}
                    </section>
                  </div>
                );
              })()}

            </div>
          </div>
        )}

        {/* SECTION 2: CONVERSATION STORYLINE */}
        {activeSection === 'storyline' && (
          <div className="storyline-view-pane">
            <div className="storyline-intro-bar">
              <h2 className="section-narrative-heading">Chronological Conversation Storyline</h2>
              <p className="section-narrative-desc">
                How discussion developed across stages: requests, operational constraints, alternative proposals, and consensus.
              </p>
            </div>

            <div className="storyline-timeline-track">
              {briefing?.storyline.map((step, idx) => {
                const stageClass = step.stage.toLowerCase().replace('_', '-');
                return (
                  <div key={step.id || idx} className={`storyline-event-node node-${stageClass}`}>
                    <div className="timeline-marker" />
                    <div className="storyline-card">
                      <div className="storyline-card-header">
                        <div className="event-stage-pill">
                          {step.stage.replace('_', ' ')}
                        </div>
                        <div className="event-time-stamp">
                          <Clock size={12} />
                          <span>{step.timestamp}</span>
                        </div>
                      </div>

                      <h3 className="storyline-event-title">{step.heading}</h3>
                      <p className="storyline-event-desc">{step.description}</p>

                      <div className="storyline-card-footer">
                        <div className="event-participants-row">
                          <Users size={12} />
                          <span>Participants: {step.participants.join(', ') || 'Team'}</span>
                        </div>
                        {renderCitationBadge(step.sourceMessageIds)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: TOPIC EXPLORER */}
        {activeSection === 'topics' && (
          <div className="topic-explorer-layout">
            {/* Left: Topic Index */}
            <div className="topic-index-sidebar">
              <h3 className="sidebar-section-title">Discussion Topics</h3>
              <div className="topic-nav-list">
                {briefing?.topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className={`topic-index-item ${selectedTopicId === topic.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTopicId(topic.id)}
                  >
                    <div className="topic-item-header">
                      <span className="topic-item-name">{topic.name}</span>
                      <ChevronRight size={14} className="chevron" />
                    </div>
                    <p className="topic-item-blurb">{topic.summary.slice(0, 75)}...</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Topic Dossier */}
            <div className="topic-dossier-main">
              {activeTopic ? (
                <div className="topic-dossier-card">
                  <div className="dossier-header">
                    <div>
                      <span className="document-tag">TOPIC DOSSIER</span>
                      <h2 className="dossier-title">{activeTopic.name}</h2>
                    </div>
                    {renderCitationBadge(activeTopic.sourceMessageIds)}
                  </div>

                  <div className="dossier-section">
                    <h4 className="dossier-subheading">Topic Summary &amp; Context</h4>
                    <p className="dossier-body">{activeTopic.summary}</p>
                  </div>

                  <div className="dossier-grid-two">
                    <div className="dossier-section">
                      <h4 className="dossier-subheading">How Discussion Started</h4>
                      <p className="dossier-body">{activeTopic.howStarted}</p>
                    </div>

                    <div className="dossier-section">
                      <h4 className="dossier-subheading">Key Contributions</h4>
                      <p className="dossier-body">{activeTopic.keyContributions}</p>
                    </div>
                  </div>

                  <div className="dossier-section">
                    <h4 className="dossier-subheading">Decisions &amp; Agreements</h4>
                    <p className="dossier-body">{activeTopic.decisions || 'No explicit formal decisions logged under this topic.'}</p>
                  </div>

                  <div className="dossier-section">
                    <h4 className="dossier-subheading">Pending Matters &amp; Recent Developments</h4>
                    <p className="dossier-body">
                      {activeTopic.pendingMatters || activeTopic.recentDevelopments || 'Discussions are currently up to date.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="empty-topic-dossier">Select a topic from the left to view details.</div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: DECISIONS & AGREEMENTS */}
        {activeSection === 'decisions' && (
          <div className="decisions-view-pane">
            <div className="storyline-intro-bar">
              <h2 className="section-narrative-heading">Decisions &amp; Agreements Log</h2>
              <p className="section-narrative-desc">
                Verifiable record of confirmed agreements, proposed suggestions, and superseded terms.
              </p>
            </div>

            <div className="decisions-cards-grid">
              {briefing?.decisions.map((dec, idx) => {
                const statusClass = dec.status.toLowerCase();
                return (
                  <div key={dec.id || idx} className={`decision-card card-${statusClass}`}>
                    <div className="decision-top-meta">
                      <span className={`decision-status-pill pill-${statusClass}`}>
                        {dec.status.replace('_', ' ')}
                      </span>
                      <span className="decision-date">{dec.date}</span>
                    </div>

                    <h3 className="decision-title">{dec.title}</h3>
                    <p className="decision-context">{dec.context}</p>

                    <div className="decision-footer">
                      <span className="decision-participants">
                        <strong>Participants:</strong> {dec.participants.join(', ') || 'Team'}
                      </span>
                      {renderCitationBadge(dec.sourceMessageIds)}
                    </div>
                  </div>
                );
              })}

              {(!briefing?.decisions || briefing.decisions.length === 0) && (
                <div className="empty-editorial-card">
                  <CheckCircle2 size={24} style={{ color: '#059669', marginBottom: 8 }} />
                  <p>No formal binding decisions recorded in this conversation.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 5: ACTION TRACKER */}
        {activeSection === 'actions' && (
          <div className="actions-view-pane">
            <div className="storyline-intro-bar">
              <h2 className="section-narrative-heading">Action Item Tracker</h2>
              <p className="section-narrative-desc">
                Concrete tasks extracted from conversation context. Explicit owners and deadlines only.
              </p>
            </div>

            <div className="actions-table-container">
              <table className="enterprise-action-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Action / Task</th>
                    <th style={{ width: '18%' }}>Owner</th>
                    <th style={{ width: '16%' }}>Deadline</th>
                    <th style={{ width: '12%' }}>Status</th>
                    <th style={{ width: '14%' }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {briefing?.actionTracker.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="cell-action-title">
                        <strong>{item.action}</strong>
                      </td>
                      <td className="cell-owner">
                        <span className={item.owner === 'Unassigned' ? 'unassigned-pill' : 'owner-pill'}>
                          {item.owner}
                        </span>
                      </td>
                      <td className="cell-deadline">
                        <span className="deadline-text">{item.deadline}</span>
                      </td>
                      <td>
                        <span className={`status-tag tag-${item.status.toLowerCase()}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{renderCitationBadge(item.sourceMessageIds)}</td>
                    </tr>
                  ))}

                  {(!briefing?.actionTracker || briefing.actionTracker.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                        No pending actionable tasks recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 6: PENDING DISCUSSIONS & RISKS */}
        {activeSection === 'pending' && (
          <div className="pending-view-pane">
            <div className="storyline-intro-bar">
              <h2 className="section-narrative-heading">Pending Discussions &amp; Unresolved Matters</h2>
              <p className="section-narrative-desc">
                Unanswered questions, pending client replies, and approvals awaiting confirmation.
              </p>
            </div>

            <div className="pending-cards-grid">
              {briefing?.pendingDiscussions.map((item, idx) => (
                <div key={item.id || idx} className="pending-item-card">
                  <div className="pending-card-top">
                    <span className="pending-tag">OPEN DISCUSSION LOOP</span>
                    {renderCitationBadge(item.sourceMessageIds)}
                  </div>

                  <h3 className="pending-title">{item.topic}</h3>
                  <div className="pending-question-quote">
                    “{item.unresolvedQuestion}”
                  </div>
                  <p className="pending-reason">
                    <strong>Why pending:</strong> {item.reason}
                  </p>

                  <div className="pending-participants">
                    <span>Involved: {item.participantsInvolved.join(', ') || 'Team members'}</span>
                  </div>
                </div>
              ))}

              {(!briefing?.pendingDiscussions || briefing.pendingDiscussions.length === 0) && (
                <div className="empty-editorial-card">
                  <CheckCircle2 size={24} style={{ color: '#059669', marginBottom: 8 }} />
                  <p>All questions and discussions have been answered or resolved.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 7: PARTICIPANT CONTRIBUTIONS */}
        {activeSection === 'participants' && (
          <div className="participants-view-pane">
            <div className="storyline-intro-bar">
              <h2 className="section-narrative-heading">Participant Contributions &amp; Roles</h2>
              <p className="section-narrative-desc">
                Qualitative overview of meaningful inputs, constraints flagged, and responsibilities taken.
              </p>
            </div>

            <div className="participants-cards-grid">
              {briefing?.participantContributions.map((p, idx) => (
                <div key={idx} className="participant-dossier-card">
                  <div className="participant-card-header">
                    <div className="participant-avatar-initial">
                      {p.participantName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="participant-name">{p.participantName}</h3>
                      <span className="participant-role-tag">{p.roleInDiscussion}</span>
                    </div>
                  </div>

                  <div className="contributions-list-section">
                    <span className="list-section-label">KEY CONTRIBUTIONS</span>
                    <ul className="contributions-bullets">
                      {p.keyContributions.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  {p.raisedConcerns && p.raisedConcerns.length > 0 && (
                    <div className="concerns-list-section">
                      <span className="list-section-label alert">CONSTRAINTS / NOTES RAISED</span>
                      <ul className="concerns-bullets">
                        {p.raisedConcerns.map((note, i) => (
                          <li key={i}>"{note}"</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </main>
      </div>

      {/* Floating Toast Notification */}
      {copiedToast && (
        <div className="toast-floating-banner">
          <Check size={16} />
          <span>{copiedToast}</span>
        </div>
      )}
    </div>
  );
}