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
  Tag,
  DollarSign,
  Target,
  TrendingUp,
} from 'lucide-react';
import { TwoChatMessage, TwoChatConversation, isHiddenPrivateGroup } from '@/lib/types';
import {
  GroupIntelligenceBriefing,
  GroupContextData,
  KeyInformationMetric,
  StorylineStep,
  TopicDossier,
  DecisionItem,
  ActionTrackerItem,
  PendingDiscussion,
  ImportantDevelopment,
  ParticipantContribution,
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
        {/* SECTION 1: EXECUTIVE BRIEFING (RESTRUCTURED 7-SECTION AI SUMMARY) */}
        {activeSection === 'briefing' && (
          <div className="editorial-briefing-pane">
            {(() => {
              const eb = briefing?.executiveBriefing;
              const isHinglish = summaryLanguage === 'hinglish';

              // 1. Group Context (Phase 1)
              const gc = eb?.groupContext || briefing?.groupContext;
              const contextParagraphs: string[] = (isHinglish && gc?.paragraphsHinglish && gc.paragraphsHinglish.length > 0)
                ? gc.paragraphsHinglish
                : (gc?.paragraphs && gc.paragraphs.length > 0)
                ? gc.paragraphs
                : [
                    isHinglish && eb?.overviewHinglish ? eb.overviewHinglish : (eb?.overview || `Active coordination ongoing in ${selectedGroup}.`),
                    isHinglish && eb?.currentSituationHinglish ? eb.currentSituationHinglish : (eb?.currentSituation || 'Discussion ongoing regarding project deliverables and execution.')
                  ];
              const isLimitedHistory = gc?.isLimitedHistory || (briefing?.totalMessagesCount || 0) < 4;

              // 2. Executive Overview & TLDR
              const overviewText = isHinglish && eb?.overviewHinglish ? eb.overviewHinglish : (eb?.overview || '');
              const tldrList: string[] = (isHinglish && eb?.tldrHinglish && eb.tldrHinglish.length > 0)
                ? eb.tldrHinglish
                : (eb?.tldr && eb.tldr.length > 0)
                ? eb.tldr
                : [isHinglish && eb?.currentSituationHinglish ? eb.currentSituationHinglish : (eb?.currentSituation || '')].filter(Boolean);

              // 3. Key Information Metrics Cards
              const keyInfoList: KeyInformationMetric[] = (isHinglish && eb?.keyInformationHinglish && eb.keyInformationHinglish.length > 0)
                ? eb.keyInformationHinglish
                : (eb?.keyInformation && eb.keyInformation.length > 0)
                ? eb.keyInformation
                : [];

              // 4. Conversation Breakdown (Client vs Agency)
              const clientTrack = (isHinglish && eb?.clientSideHinglish)
                ? {
                    title: eb.clientSideHinglish.title || eb.clientSide?.title || 'Client Demands & Feedback',
                    status: eb.clientSideHinglish.status || eb.clientSide?.status || 'Active',
                    position: eb.clientSideHinglish.position || eb.clientSide?.position,
                    concerns: eb.clientSideHinglish.concerns || eb.clientSide?.concerns,
                    proposals: eb.clientSideHinglish.proposals || eb.clientSide?.proposals,
                    expectations: eb.clientSideHinglish.expectations || eb.clientSide?.expectations,
                    points: (eb.clientSideHinglish.points && eb.clientSideHinglish.points.length > 0)
                      ? eb.clientSideHinglish.points
                      : (eb.clientSide?.points || []),
                  }
                : (eb?.clientSide || {
                    title: 'Client Demands & Feedback',
                    status: 'Active',
                    points: [eb?.attentionRequired || 'No immediate client blockers noted.'],
                  });

              const teamTrack = (isHinglish && eb?.teamSideHinglish)
                ? {
                    title: eb.teamSideHinglish.title || eb.teamSide?.title || 'Internal Team Execution',
                    status: eb.teamSideHinglish.status || eb.teamSide?.status || 'In Progress',
                    position: eb.teamSideHinglish.position || eb.teamSide?.position,
                    concerns: eb.teamSideHinglish.concerns || eb.teamSide?.concerns,
                    proposals: eb.teamSideHinglish.proposals || eb.teamSide?.proposals,
                    expectations: eb.teamSideHinglish.expectations || eb.teamSide?.expectations,
                    points: (eb.teamSideHinglish.points && eb.teamSideHinglish.points.length > 0)
                      ? eb.teamSideHinglish.points
                      : (eb.teamSide?.points || []),
                  }
                : (eb?.teamSide || {
                    title: 'Internal Team Execution',
                    status: 'In Progress',
                    points: [eb?.currentSituation || 'Team deliverables underway.'],
                  });

              // 5. Decisions & Agreements
              const allDecisions = briefing?.decisions || [];

              // 6. Pending Actions & Blockers Unified
              const allBlockersAndActions: Array<{
                title: string;
                owner?: string;
                waitingOn?: string;
                status: string;
                isBlocker?: boolean;
                sourceMessageIds?: string[];
              }> = [];

              if (eb?.pendingBlockers && eb.pendingBlockers.length > 0) {
                const blockers = isHinglish && eb.pendingBlockersHinglish && eb.pendingBlockersHinglish.length > 0
                  ? eb.pendingBlockersHinglish
                  : eb.pendingBlockers;
                blockers.forEach(b => {
                  allBlockersAndActions.push({
                    title: b.item,
                    waitingOn: b.waitingOn,
                    status: 'BLOCKED',
                    isBlocker: true,
                    sourceMessageIds: (b as any).sourceMessageIds,
                  });
                });
              }

              if (briefing?.actionTracker && briefing.actionTracker.length > 0) {
                briefing.actionTracker.forEach(act => {
                  allBlockersAndActions.push({
                    title: act.action,
                    owner: act.owner !== 'Unassigned' ? act.owner : undefined,
                    status: act.status,
                    isBlocker: act.status === 'BLOCKED',
                    sourceMessageIds: act.sourceMessageIds,
                  });
                });
              }

              // 7. Timeline & Milestones
              const storylineList = briefing?.storyline || [];

              return (
                <div className="summary-dashboard-layout">
                  {/* =========================================================
                      1. GROUP CONTEXT (HIGHEST PRIORITY - TOP OF SUMMARY)
                      ========================================================= */}
                  <div className="summary-group-context-card">
                    <div className="context-badge-row">
                      <span className="context-start-badge">
                        <Sparkles size={13} style={{ color: '#D97706' }} />
                        <span>New to this group? Start here.</span>
                      </span>
                      <span className="context-coverage-tag">
                        {briefing?.totalMessagesCount || currentGroupMessages.length || 0} messages analyzed
                      </span>
                    </div>

                    <h2 className="context-section-heading">Group Context &amp; Background</h2>

                    <div className="context-paragraphs-list">
                      {contextParagraphs.map((para, idx) => (
                        <p key={idx} className="context-paragraph">
                          {renderFormattedText(para)}
                        </p>
                      ))}
                    </div>

                    {isLimitedHistory && (
                      <div className="context-limited-notice">
                        <AlertTriangle size={14} />
                        <span>Note: This context is based on limited available messages for this group.</span>
                      </div>
                    )}
                  </div>

                  {/* =========================================================
                      2. EXECUTIVE OVERVIEW
                      ========================================================= */}
                  <div className="summary-section-card">
                    <div className="summary-section-header">
                      <div className="summary-section-header-left">
                        <span className="summary-section-label">Executive Overview</span>
                        <h3 className="summary-section-title">Key Developments &amp; Bottom Line</h3>
                      </div>
                      <span className="summary-section-count">
                        {tldrList.length} Highlights
                      </span>
                    </div>

                    {overviewText && (
                      <div className="overview-narrative-box">
                        <p className="overview-narrative-text">
                          {renderFormattedText(overviewText)}
                        </p>
                      </div>
                    )}

                    {tldrList.length > 0 && (
                      <ul className="overview-tldr-list">
                        {tldrList.map((bullet, idx) => (
                          <li key={idx} className="overview-tldr-row">
                            <span className="overview-tldr-dot" />
                            <span className="formal-bullet-text">{renderFormattedText(bullet)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* =========================================================
                      3. KEY INFORMATION (BUDGETS, DATES, DEADLINES, DELIVERABLES)
                      ========================================================= */}
                  {keyInfoList.length > 0 && (
                    <div className="summary-section-card">
                      <div className="summary-section-header">
                        <div className="summary-section-header-left">
                          <span className="summary-section-label">Key Information</span>
                          <h3 className="summary-section-title">Budgets, Deadlines &amp; Deliverables</h3>
                        </div>
                        <span className="summary-section-count">
                          {keyInfoList.length} Key Metrics
                        </span>
                      </div>

                      <div className="key-info-grid">
                        {keyInfoList.map((item, idx) => {
                          const getIcon = () => {
                            if (item.category === 'budget') return <Tag size={16} />;
                            if (item.category === 'date' || item.category === 'deadline') return <Calendar size={16} />;
                            if (item.category === 'deliverable') return <Layers size={16} />;
                            return <Target size={16} />;
                          };
                          return (
                            <div key={idx} className="key-info-card">
                              <div className="key-info-top">
                                <span className="key-info-label">{item.label}</span>
                                <div className="key-info-icon-bubble">
                                  {getIcon()}
                                </div>
                              </div>
                              <div className="key-info-value">{renderFormattedText(item.value)}</div>
                              {item.subtext && (
                                <div className="key-info-subtext">{item.subtext}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      4. CONVERSATION BREAKDOWN (CLIENT vs AGENCY)
                      ========================================================= */}
                  <div className="summary-section-card">
                    <div className="summary-section-header">
                      <div className="summary-section-header-left">
                        <span className="summary-section-label">Conversation Breakdown</span>
                        <h3 className="summary-section-title">Client Perspective vs Agency Perspective</h3>
                      </div>
                      <span className="summary-section-count">Dual-Track View</span>
                    </div>

                    <div className="breakdown-columns-grid">
                      {/* Left: Client Track */}
                      <div className="breakdown-stream-card client">
                        <div className="breakdown-stream-header">
                          <div className="breakdown-stream-title-group">
                            <span className="breakdown-stream-badge">CLIENT PERSPECTIVE</span>
                            <span className="breakdown-stream-actor">{clientTrack.title}</span>
                          </div>
                          {clientTrack.status && (
                            <span className="breakdown-status-tag">{clientTrack.status}</span>
                          )}
                        </div>

                        {clientTrack.position && (
                          <div className="breakdown-position-box">
                            <span className="breakdown-sublabel">Their Position</span>
                            <p className="breakdown-position-text">{renderFormattedText(clientTrack.position)}</p>
                          </div>
                        )}

                        {clientTrack.concerns && clientTrack.concerns.length > 0 && (
                          <div>
                            <span className="breakdown-sublabel">Main Concerns &amp; Pushbacks</span>
                            <ul className="breakdown-sublist">
                              {clientTrack.concerns.map((c, i) => (
                                <li key={i} className="breakdown-subitem">
                                  <span className="breakdown-dot" style={{ backgroundColor: '#EF4444' }} />
                                  <span>{renderFormattedText(c)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {clientTrack.proposals && clientTrack.proposals.length > 0 && (
                          <div>
                            <span className="breakdown-sublabel">Proposals &amp; Requests</span>
                            <ul className="breakdown-sublist">
                              {clientTrack.proposals.map((p, i) => (
                                <li key={i} className="breakdown-subitem">
                                  <span className="breakdown-dot" style={{ backgroundColor: '#3B82F6' }} />
                                  <span>{renderFormattedText(p)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {clientTrack.expectations && clientTrack.expectations.length > 0 && (
                          <div>
                            <span className="breakdown-sublabel">Client Expectations</span>
                            <ul className="breakdown-sublist">
                              {clientTrack.expectations.map((exp, i) => (
                                <li key={i} className="breakdown-subitem">
                                  <span className="breakdown-dot" style={{ backgroundColor: '#F59E0B' }} />
                                  <span>{renderFormattedText(exp)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {clientTrack.points && clientTrack.points.length > 0 && (
                          <div>
                            <span className="breakdown-sublabel">Key Points &amp; Instructions</span>
                            <ul className="breakdown-sublist">
                              {clientTrack.points.map((pt, i) => (
                                <li key={i} className="breakdown-subitem">
                                  <span className="breakdown-dot" />
                                  <span>{renderFormattedText(pt)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Right: Agency Track */}
                      <div className="breakdown-stream-card agency">
                        <div className="breakdown-stream-header">
                          <div className="breakdown-stream-title-group">
                            <span className="breakdown-stream-badge">AGENCY PERSPECTIVE</span>
                            <span className="breakdown-stream-actor">{teamTrack.title}</span>
                          </div>
                          {teamTrack.status && (
                            <span className="breakdown-status-tag">{teamTrack.status}</span>
                          )}
                        </div>

                        {teamTrack.position && (
                          <div className="breakdown-position-box">
                            <span className="breakdown-sublabel">Execution Stance</span>
                            <p className="breakdown-position-text">{renderFormattedText(teamTrack.position)}</p>
                          </div>
                        )}

                        {teamTrack.concerns && teamTrack.concerns.length > 0 && (
                          <div>
                            <span className="breakdown-sublabel">Operational Constraints &amp; Risks</span>
                            <ul className="breakdown-sublist">
                              {teamTrack.concerns.map((c, i) => (
                                <li key={i} className="breakdown-subitem">
                                  <span className="breakdown-dot" style={{ backgroundColor: '#EF4444' }} />
                                  <span>{renderFormattedText(c)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {teamTrack.proposals && teamTrack.proposals.length > 0 && (
                          <div>
                            <span className="breakdown-sublabel">Proposals &amp; Deliverables</span>
                            <ul className="breakdown-sublist">
                              {teamTrack.proposals.map((p, i) => (
                                <li key={i} className="breakdown-subitem">
                                  <span className="breakdown-dot" style={{ backgroundColor: '#10B981' }} />
                                  <span>{renderFormattedText(p)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {teamTrack.expectations && teamTrack.expectations.length > 0 && (
                          <div>
                            <span className="breakdown-sublabel">Agency Expectations</span>
                            <ul className="breakdown-sublist">
                              {teamTrack.expectations.map((exp, i) => (
                                <li key={i} className="breakdown-subitem">
                                  <span className="breakdown-dot" style={{ backgroundColor: '#F59E0B' }} />
                                  <span>{renderFormattedText(exp)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {teamTrack.points && teamTrack.points.length > 0 && (
                          <div>
                            <span className="breakdown-sublabel">Deliverables &amp; Progress</span>
                            <ul className="breakdown-sublist">
                              {teamTrack.points.map((pt, i) => (
                                <li key={i} className="breakdown-subitem">
                                  <span className="breakdown-dot" />
                                  <span>{renderFormattedText(pt)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* =========================================================
                      5. DECISIONS & AGREEMENTS
                      ========================================================= */}
                  <div className="summary-section-card">
                    <div className="summary-section-header">
                      <div className="summary-section-header-left">
                        <span className="summary-section-label">Decisions &amp; Agreements</span>
                        <h3 className="summary-section-title">Confirmed Agreements vs Proposals</h3>
                      </div>
                      <span className="summary-section-count">
                        {allDecisions.filter(d => d.status === 'CONFIRMED').length} Confirmed
                      </span>
                    </div>

                    <div className="decisions-list-layout">
                      {allDecisions.map((dec, idx) => {
                        const isConfirmed = dec.status === 'CONFIRMED';
                        const isSuperseded = dec.status === 'SUPERSEDED';
                        return (
                          <div key={dec.id || idx} className="decision-entry-row">
                            <div className="decision-entry-left">
                              <span className={`decision-status-chip ${dec.status.toLowerCase()}`}>
                                {isConfirmed ? (
                                  <CheckCircle2 size={12} />
                                ) : isSuperseded ? (
                                  <Clock size={12} />
                                ) : (
                                  <Compass size={12} />
                                )}
                                <span>{dec.status}</span>
                              </span>
                              <div>
                                <div className="decision-title-text">{renderFormattedText(dec.title)}</div>
                                {dec.context && (
                                  <div className="decision-context-text">{renderFormattedText(dec.context)}</div>
                                )}
                              </div>
                            </div>
                            <div className="decision-meta-right">
                              <span className="decision-date-tag">{dec.date}</span>
                              {renderCitationBadge(dec.sourceMessageIds)}
                            </div>
                          </div>
                        );
                      })}

                      {allDecisions.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                          No formal decisions recorded yet in this conversation.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* =========================================================
                      6. PENDING ACTIONS & BLOCKERS
                      ========================================================= */}
                  <div className="summary-section-card">
                    <div className="summary-section-header">
                      <div className="summary-section-header-left">
                        <span className="summary-section-label">Pending Actions &amp; Blockers</span>
                        <h3 className="summary-section-title">Unresolved Tasks &amp; Active Dependencies</h3>
                      </div>
                      <span className="summary-section-count">
                        {allBlockersAndActions.length} Pending
                      </span>
                    </div>

                    <div className="actions-blockers-list">
                      {allBlockersAndActions.map((item, idx) => (
                        <div key={idx} className="action-blocker-row">
                          <div className="action-blocker-left">
                            <AlertTriangle size={15} style={{ color: item.isBlocker ? '#DC2626' : '#D97706', marginTop: 2, flexShrink: 0 }} />
                            <div className="action-blocker-content">
                              <span className="action-blocker-title">{renderFormattedText(item.title)}</span>
                              {item.waitingOn && (
                                <span className="action-blocker-waiting">
                                  Awaiting action from: <strong>{item.waitingOn}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="action-blocker-right">
                            {item.owner && (
                              <span className="owner-badge">{item.owner}</span>
                            )}
                            <span className={`status-badge ${item.status.toLowerCase()}`}>
                              {item.status}
                            </span>
                            {renderCitationBadge(item.sourceMessageIds)}
                          </div>
                        </div>
                      ))}

                      {allBlockersAndActions.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#059669', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <CheckCircle2 size={16} />
                          <span>All action items completed and no active blockers logged.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* =========================================================
                      7. TIMELINE & MILESTONES
                      ========================================================= */}
                  <div className="summary-section-card">
                    <div className="summary-section-header">
                      <div className="summary-section-header-left">
                        <span className="summary-section-label">Timeline &amp; Milestones</span>
                        <h3 className="summary-section-title">Chronological Event Progression</h3>
                      </div>
                      <span className="summary-section-count">
                        {storylineList.length} Milestones
                      </span>
                    </div>

                    <div className="clean-timeline-track">
                      {storylineList.map((step, idx) => (
                        <div key={step.id || idx} className="clean-timeline-node">
                          <div className="clean-timeline-dot" />
                          <div className="clean-timeline-card">
                            <div className="clean-timeline-meta">
                              <span className="clean-timeline-stage">
                                {step.stage.replace('_', ' ')}
                              </span>
                              <span className="clean-timeline-time">
                                <Clock size={11} />
                                <span>{step.timestamp}</span>
                              </span>
                            </div>
                            <h4 className="clean-timeline-heading">{step.heading}</h4>
                            <p className="clean-timeline-desc">{step.description}</p>
                            <div className="clean-timeline-footer">
                              <span>
                                <strong>Participants:</strong> {step.participants.join(', ') || 'Team'}
                              </span>
                              {renderCitationBadge(step.sourceMessageIds)}
                            </div>
                          </div>
                        </div>
                      ))}

                      {storylineList.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                          No milestone events logged for this timeframe.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })()}
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