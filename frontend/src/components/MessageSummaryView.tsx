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
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(false);

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
          {/* Group Identity - Clean Executive Title & Searchable Switcher */}
          <div className="group-identity-meta" ref={groupDropdownRef}>
            <div className="group-eyebrow-line">
              <span className="group-eyebrow-tag">
                <Compass size={11} />
                WHATSAPP CONVERSATION INTELLIGENCE
              </span>
              {selectedGroupData && (
                <span className="group-count-badge">
                  {selectedGroupData.count} {selectedGroupData.count === 1 ? 'message' : 'messages'}
                </span>
              )}
            </div>

            <div className="custom-group-dropdown-wrapper">
              <button
                type="button"
                className={`custom-group-dropdown-trigger executive-title-trigger ${isGroupDropdownOpen ? 'open' : ''}`}
                onClick={() => setIsGroupDropdownOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isGroupDropdownOpen}
                title="Click to switch WhatsApp group"
              >
                <span className="group-main-title">{selectedGroup}</span>
                <ChevronDown
                  size={18}
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

          {/* Action Controls: Date Range, Language Switcher, Copy, Regenerate */}
          <div className="header-actions-group">
            <div className="date-filter-group">
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

            <button
              type="button"
              className="btn-intelligence-copy"
              onClick={handleCopyAllMessages}
              title="Copy all available conversation messages for this group to clipboard"
            >
              <Copy size={13} />
              <span>Copy All Messages</span>
            </button>

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

        {/* Sub-navigation Horizontal Tab Bar */}
        <div className="horizontal-tabs-scroll">
          <nav className="intelligence-horizontal-subnav" aria-label="Intelligence Views">
            <button
              type="button"
              className={`intel-tab-btn ${activeSection === 'briefing' ? 'active' : ''}`}
              onClick={() => setActiveSection('briefing')}
            >
              <FileText size={14} />
              <span>Executive Briefing</span>
            </button>

            <button
              type="button"
              className={`intel-tab-btn ${activeSection === 'storyline' ? 'active' : ''}`}
              onClick={() => setActiveSection('storyline')}
            >
              <Clock size={14} />
              <span>Storyline</span>
              {briefing?.storyline && briefing.storyline.length > 0 && (
                <span className="intel-tab-badge">{briefing.storyline.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`intel-tab-btn ${activeSection === 'topics' ? 'active' : ''}`}
              onClick={() => setActiveSection('topics')}
            >
              <Layers size={14} />
              <span>Topic Explorer</span>
              {briefing?.topics && briefing.topics.length > 0 && (
                <span className="intel-tab-badge">{briefing.topics.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`intel-tab-btn ${activeSection === 'decisions' ? 'active' : ''}`}
              onClick={() => setActiveSection('decisions')}
            >
              <CheckCircle2 size={14} />
              <span>Decisions Log</span>
              {briefing?.decisions && briefing.decisions.length > 0 && (
                <span className="intel-tab-badge">{briefing.decisions.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`intel-tab-btn ${activeSection === 'actions' ? 'active' : ''}`}
              onClick={() => setActiveSection('actions')}
            >
              <ListTodo size={14} />
              <span>Action Tracker</span>
              {briefing?.actionTracker && briefing.actionTracker.length > 0 && (
                <span className="intel-tab-badge">{briefing.actionTracker.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`intel-tab-btn ${activeSection === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveSection('pending')}
            >
              <HelpCircle size={14} />
              <span>Pending Discussions</span>
              {briefing?.pendingDiscussions && briefing.pendingDiscussions.length > 0 && (
                <span className="intel-tab-badge alert">{briefing.pendingDiscussions.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`intel-tab-btn ${activeSection === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveSection('participants')}
            >
              <Users size={14} />
              <span>Contributors</span>
              {briefing?.participantContributions && briefing.participantContributions.length > 0 && (
                <span className="intel-tab-badge">{briefing.participantContributions.length}</span>
              )}
            </button>
          </nav>
        </div>

        {briefingError && (
          <div className="briefing-alert-banner">
            <AlertTriangle size={16} />
            <span>{briefingError}</span>
          </div>
        )}
      </header>

      {/* =========================================================================
          2. MAIN INTELLIGENCE CONTENT AREA
          ========================================================================= */}
      <div className="intelligence-main-layout">
        <main className="intelligence-content-pane">
        {/* SECTION 1: EXECUTIVE BRIEFING (DEFAULT VIEW) */}
        {activeSection === 'briefing' && (
          <div className="briefing-dashboard-grid">
            {/* Left: Main Editorial Memo Document */}
            <div className="briefing-main-column">
              <div className="document-memo-container">
                {/* Document Header & Metadata Information */}
                <div className="memo-metadata-bar">
                  <span className="memo-meta-date">
                    Date Range: {new Date(briefing?.dateRange.start || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} &mdash; {new Date(briefing?.dateRange.end || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="memo-meta-separator">|</span>
                  <span className="memo-meta-coverage">
                    Coverage: {briefing?.coverageNote || `${briefing?.messagesIncluded || 0} of ${briefing?.totalMessagesCount || 0} messages processed`}
                  </span>
                </div>

                {analyzing && (
                  <div className="summary-analyzing-banner">
                    <RotateCw size={13} className="animate-spin" style={{ color: '#D97706' }} />
                    <span>Synthesizing conversation intelligence for <strong>{selectedGroup}</strong>...</span>
                  </div>
                )}

                {/* =========================================================================
                    DOCUMENT-STYLE EDITORIAL SUMMARY MEMO
                    Exact Section Order:
                    01. GROUP CONTEXT
                    02. KEY TAKEAWAYS
                    03. CONVERSATION SUMMARY
                    04. AGREED & SETTLED
                    05. PENDING ACTIONS
                    06. TIMELINE & MILESTONES
                    ========================================================================= */}
                {(() => {
                  const eb = briefing?.executiveBriefing;
                  const isHinglish = summaryLanguage === 'hinglish';

                  // 01. GROUP CONTEXT (60-90 words, 1-2 short paragraphs in simple language)
                  const rawGroupContext = isHinglish
                    ? (eb?.groupContextHinglish || briefing?.groupContextHinglish || eb?.groupContext || briefing?.groupContext || '')
                    : (eb?.groupContext || briefing?.groupContext || '');

                  const groupContextParagraphs = rawGroupContext
                    ? rawGroupContext.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
                    : [
                        `This WhatsApp group serves as the active coordination hub for ${selectedGroup}. Discussions focus on active deliverables, client feedback, review milestones, and operational alignment.`,
                        `Key stakeholders and team members align on scope, deliverables, and timelines. Review the sections below for the executive breakdown, commercial metrics, confirmed decisions, and pending action items.`
                      ];

                  // 02. KEY TAKEAWAYS (Executive Summary)
                  const currentSituationText = isHinglish
                    ? (eb?.currentSituationHinglish || eb?.currentSituation || '')
                    : (eb?.currentSituation || '');
                  const overviewNarrative = isHinglish
                    ? (eb?.overviewHinglish || eb?.overview || '')
                    : (eb?.overview || '');

                  const tldrList: string[] = (isHinglish && eb?.tldrHinglish && eb.tldrHinglish.length > 0)
                    ? eb.tldrHinglish
                    : (eb?.tldr && eb.tldr.length > 0)
                    ? eb.tldr
                    : [overviewNarrative || currentSituationText].filter(Boolean);

                  // 03. CONVERSATION SUMMARY (Unified 3-6 concise bullets combining all participants)
                  const rawConvSummary = isHinglish
                    ? (eb?.conversationSummaryHinglish || briefing?.conversationSummaryHinglish || eb?.conversationSummary || briefing?.conversationSummary || [])
                    : (eb?.conversationSummary || briefing?.conversationSummary || []);

                  const conversationSummaryList: string[] = (() => {
                    if (rawConvSummary && rawConvSummary.length > 0) {
                      return rawConvSummary;
                    }
                    const points: string[] = [];
                    if (briefing?.storyline && briefing.storyline.length > 0) {
                      briefing.storyline.slice(0, 4).forEach((s) => {
                        points.push(`${s.heading}: ${s.description}`);
                      });
                    } else if (briefing?.topics && briefing.topics.length > 0) {
                      briefing.topics.slice(0, 4).forEach((t) => {
                        points.push(`${t.name}: ${t.summary}`);
                      });
                    }
                    return points.length > 0 ? points : [overviewNarrative || 'Active communication logged among project participants.'];
                  })();

                  // 04. AGREED & SETTLED (Confirmed decisions only, short bullets)
                  const confirmedDecisions = (briefing?.decisions || []).filter((d) => d.status === 'CONFIRMED');

                  // 05. PENDING ACTIONS
                  const pendingActions: Array<{
                    id: string;
                    title: string;
                    owner: string;
                    explanation: string;
                    status: string;
                  }> = [];

                  const seenTitles = new Set<string>();

                  (briefing?.actionTracker || [])
                    .filter((a) => a.status !== 'COMPLETED')
                    .forEach((a, idx) => {
                      const norm = a.action.toLowerCase().trim();
                      if (!seenTitles.has(norm)) {
                        seenTitles.add(norm);
                        pendingActions.push({
                          id: a.id || `act_${idx}`,
                          title: a.action,
                          owner: a.owner && a.owner !== 'Unassigned' ? a.owner : 'Owner not specified',
                          explanation: a.deadline && a.deadline !== 'Not specified'
                            ? `Target schedule: ${a.deadline}.`
                            : 'Action item pending execution and verification.',
                          status: a.status === 'IN_PROGRESS' ? 'In Progress' : a.status === 'BLOCKED' ? 'Blocked' : 'Pending',
                        });
                      }
                    });

                  const rawBlockers = isHinglish
                    ? (eb?.pendingBlockersHinglish || eb?.pendingBlockers || [])
                    : (eb?.pendingBlockers || []);

                  rawBlockers.forEach((blk, idx) => {
                    const norm = blk.item.toLowerCase().trim();
                    if (!seenTitles.has(norm)) {
                      seenTitles.add(norm);
                      pendingActions.push({
                        id: `blk_${idx}`,
                        title: blk.item,
                        owner: blk.waitingOn ? blk.waitingOn : 'Owner not specified',
                        explanation: blk.waitingOn ? `Awaiting action from ${blk.waitingOn}.` : 'Pending resolution.',
                        status: 'Pending',
                      });
                    }
                  });

                  // 06. TIMELINE & MILESTONES
                  const storylineSteps = briefing?.storyline || [];
                  const visibleTimelineSteps = isTimelineExpanded
                    ? storylineSteps
                    : storylineSteps.slice(0, 4);

                  return (
                    <div className="document-memo-body">
                      {/* 01. GROUP CONTEXT (Prominent highlighted onboarding card) */}
                      <section id="sec-group-context" className="memo-section group-context-card">
                        <div className="memo-section-header">
                          <div className="group-context-title-wrap">
                            <Sparkles size={16} className="context-sparkle-icon" />
                            <h2 className="memo-section-title">01. GROUP CONTEXT</h2>
                          </div>
                          <span className="memo-starter-badge">
                            ✨ New to this group? Start here.
                          </span>
                        </div>
                        <div className="memo-section-content">
                          {groupContextParagraphs.map((para, idx) => (
                            <p key={idx} className="memo-paragraph">
                              {renderFormattedText(para)}
                            </p>
                          ))}
                        </div>
                      </section>

                      <hr className="memo-divider" />

                      {/* 02. KEY TAKEAWAYS */}
                      <section id="sec-key-takeaways" className="memo-section">
                        <div className="memo-section-header">
                          <h2 className="memo-section-title">02. KEY TAKEAWAYS</h2>
                          <span className="memo-header-label-right">Executive Summary</span>
                        </div>
                        <div className="memo-section-content">
                          <ul className="memo-bullet-list">
                            {tldrList.map((bullet, idx) => (
                              <li key={idx} className="memo-bullet-row">
                                <span className="memo-bullet-dot">&bull;</span>
                                <span className="memo-bullet-text">{renderFormattedText(bullet)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </section>

                      <hr className="memo-divider" />

                      {/* 03. CONVERSATION SUMMARY */}
                      <section id="sec-conversation-summary" className="memo-section">
                        <div className="memo-section-header">
                          <h2 className="memo-section-title">03. CONVERSATION SUMMARY</h2>
                        </div>
                        <div className="memo-section-content">
                          <ul className="memo-bullet-list">
                            {conversationSummaryList.map((item, idx) => (
                              <li key={idx} className="memo-bullet-row">
                                <span className="memo-bullet-dot">&bull;</span>
                                <span className="memo-bullet-text">{renderFormattedText(item)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </section>

                      {/* 04. AGREED & SETTLED */}
                      {confirmedDecisions.length > 0 && (
                        <>
                          <hr className="memo-divider" />
                          <section id="sec-agreed-settled" className="memo-section">
                            <div className="memo-section-header">
                              <h2 className="memo-section-title">04. AGREED &amp; SETTLED</h2>
                              <span className="memo-badge-settled">{confirmedDecisions.length} Confirmed</span>
                            </div>
                            <div className="memo-section-content">
                              <ul className="memo-bullet-list">
                                {confirmedDecisions.map((dec) => (
                                  <li key={dec.id} className="memo-bullet-row">
                                    <span className="memo-bullet-dot confirmed">&bull;</span>
                                    <span className="memo-bullet-text">
                                      <strong>{dec.title}</strong>
                                      {dec.context && dec.context !== dec.title ? ` — ${dec.context}` : ''}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </section>
                        </>
                      )}

                      {/* 05. PENDING ACTIONS */}
                      {pendingActions.length > 0 && (
                        <>
                          <hr className="memo-divider" />
                          <section id="sec-pending-actions" className="memo-section">
                            <div className="memo-section-header">
                              <h2 className="memo-section-title">05. PENDING ACTIONS</h2>
                              <span className="memo-header-label-right">{pendingActions.length} Open</span>
                            </div>
                            <div className="memo-tasks-stack">
                              {pendingActions.map((task, idx) => {
                                const numStr = String(idx + 1).padStart(2, '0');
                                const statusClass = task.status.toLowerCase().replace(/\s+/g, '-');
                                return (
                                  <div key={task.id} className="memo-task-row">
                                    <div className="memo-task-top-line">
                                      <span className="memo-task-title-bold">
                                        {numStr}. {task.title}
                                      </span>
                                      <span className={`memo-task-status-pill status-${statusClass}`}>
                                        {task.status}
                                      </span>
                                    </div>
                                    <div className="memo-task-owner-line">
                                      Owner: <strong>{task.owner}</strong>
                                    </div>
                                    <div className="memo-task-explanation-line">
                                      {task.explanation}
                                    </div>
                                    {idx < pendingActions.length - 1 && (
                                      <hr className="memo-task-divider" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        </>
                      )}

                      {/* 06. TIMELINE & MILESTONES */}
                      <hr className="memo-divider" />
                      <section id="sec-timeline-milestones" className="memo-section">
                        <div className="memo-section-header">
                          <h2 className="memo-section-title">06. TIMELINE &amp; MILESTONES</h2>
                          {storylineSteps.length > 4 && (
                            <button
                              type="button"
                              className="memo-toggle-btn"
                              onClick={() => setIsTimelineExpanded((prev) => !prev)}
                            >
                              {isTimelineExpanded
                                ? 'Show less'
                                : `View full history (${storylineSteps.length} milestones)`}
                            </button>
                          )}
                        </div>
                        <div className="memo-section-content">
                          {storylineSteps.length > 0 ? (
                            <div className="memo-timeline-stack">
                              {visibleTimelineSteps.map((step, idx) => (
                                <div key={step.id || idx} className="memo-timeline-entry">
                                  <div className="memo-timeline-date">{step.timestamp}</div>
                                  <div className="memo-timeline-content">
                                    <span className="memo-timeline-heading">{step.heading}</span>
                                    {step.description && (
                                      <span className="memo-timeline-desc">
                                        {' '}
                                        &mdash; {renderFormattedText(step.description)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="memo-paragraph" style={{ color: '#64748B' }}>
                              Milestones will populate as conversation develops.
                            </p>
                          )}
                        </div>
                      </section>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right: Executive Intelligence Snapshot & Section Jump Sidebar */}
            <aside className="briefing-side-column">
              {/* Snapshot Card */}
              <div className="briefing-side-card">
                <div className="side-card-header">
                  <Sparkles size={14} className="side-card-icon" />
                  <span className="side-card-title">Intelligence Snapshot</span>
                </div>
                <div className="side-stats-list">
                  <div className="side-stat-row">
                    <span className="side-stat-label">Coverage</span>
                    <span className="side-stat-badge success">100% Chronological</span>
                  </div>
                  <div className="side-stat-row">
                    <span className="side-stat-label">Processed Messages</span>
                    <span className="side-stat-val">
                      {briefing?.messagesIncluded || currentGroupMessages.length} msgs
                    </span>
                  </div>
                  <div className="side-stat-row">
                    <span className="side-stat-label">Confirmed Decisions</span>
                    <span className="side-stat-val">
                      {(briefing?.decisions || []).filter((d) => d.status === 'CONFIRMED').length} confirmed
                    </span>
                  </div>
                  <div className="side-stat-row">
                    <span className="side-stat-label">Open Blockers/Actions</span>
                    <span className="side-stat-val">
                      {(briefing?.actionTracker || []).filter((a) => a.status !== 'COMPLETED').length} pending
                    </span>
                  </div>
                  <div className="side-stat-row">
                    <span className="side-stat-label">Briefing Mode</span>
                    <span className="side-stat-badge neutral">
                      {summaryLanguage === 'hinglish' ? '🇮🇳 Hinglish' : '🇬🇧 English'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Table of Contents / Quick Jump Anchors */}
              <div className="briefing-side-card">
                <div className="side-card-header">
                  <Compass size={14} className="side-card-icon" />
                  <span className="side-card-title">Quick Jump to Section</span>
                </div>
                <div className="side-jump-links">
                  <a href="#sec-group-context" className="side-jump-link">
                    <span className="jump-num">01</span>
                    <span className="jump-text">Group Context</span>
                  </a>
                  <a href="#sec-key-takeaways" className="side-jump-link">
                    <span className="jump-num">02</span>
                    <span className="jump-text">Key Takeaways</span>
                  </a>
                  <a href="#sec-conversation-summary" className="side-jump-link">
                    <span className="jump-num">03</span>
                    <span className="jump-text">Conversation Summary</span>
                  </a>
                  {((briefing?.decisions || []).filter((d) => d.status === 'CONFIRMED').length > 0) && (
                    <a href="#sec-agreed-settled" className="side-jump-link">
                      <span className="jump-num">04</span>
                      <span className="jump-text">Agreed &amp; Settled</span>
                    </a>
                  )}
                  {(((briefing?.actionTracker || []).filter((a) => a.status !== 'COMPLETED').length > 0) ||
                    (briefing?.executiveBriefing?.pendingBlockers && briefing.executiveBriefing.pendingBlockers.length > 0)) && (
                    <a href="#sec-pending-actions" className="side-jump-link">
                      <span className="jump-num">05</span>
                      <span className="jump-text">Pending Actions</span>
                    </a>
                  )}
                  <a href="#sec-timeline-milestones" className="side-jump-link">
                    <span className="jump-num">06</span>
                    <span className="jump-text">Timeline &amp; Milestones</span>
                  </a>
                </div>
              </div>

              {/* Key Participants in this Group */}
              {briefing?.participantContributions && briefing.participantContributions.length > 0 && (
                <div className="briefing-side-card">
                  <div className="side-card-header">
                    <Users size={14} className="side-card-icon" />
                    <span className="side-card-title">Key Participants</span>
                  </div>
                  <div className="side-participants-list">
                    {briefing.participantContributions.slice(0, 4).map((p, idx) => (
                      <div key={idx} className="side-participant-item">
                        <div className="side-participant-avatar">
                          {p.participantName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="side-participant-meta">
                          <span className="side-participant-name">{p.participantName}</span>
                          <span className="side-participant-role">{p.roleInDiscussion}</span>
                        </div>
                      </div>
                    ))}
                    {briefing.participantContributions.length > 4 && (
                      <button
                        type="button"
                        className="side-view-all-participants"
                        onClick={() => setActiveSection('participants')}
                      >
                        View all {briefing.participantContributions.length} contributors &rarr;
                      </button>
                    )}
                  </div>
                </div>
              )}
            </aside>
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