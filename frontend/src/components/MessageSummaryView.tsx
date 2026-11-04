'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Briefcase,
  TrendingUp,
  Filter,
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  FileQuestion,
  RotateCw,
  CreditCard,
  CalendarClock,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Tag,
  Check,
} from 'lucide-react';
import { TwoChatMessage, TwoChatConversation } from '@/lib/types';
import { JevActionableItem, JevGroupSummary, JevAnalysisResult } from '@/lib/jev-client';

interface MessageSummaryViewProps {
  totalMessagesCount: number;
  conversations: TwoChatConversation[];
  allMessages: TwoChatMessage[];
  onNavigateToTestMessages: (chatId?: string) => void;
  onNavigateToDeveloper: () => void;
}

export default function MessageSummaryView({
  totalMessagesCount,
  conversations,
  allMessages,
  onNavigateToTestMessages,
  onNavigateToDeveloper,
}: MessageSummaryViewProps) {
  // Active Tab: 'actionable' (default) vs 'summaries'
  const [activeTab, setActiveTab] = useState<'actionable' | 'summaries'>('actionable');

  // Analysis State
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<JevAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string>('');

  // Actionable Filter State
  const [actionableCategoryFilter, setActionableCategoryFilter] = useState<'all' | 'payment' | 'time_change' | 'urgent_attention' | 'recruitment'>('all');

  // Filter States for Group Summaries
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');

  // Run analysis function
  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const res = await fetch('/api/jev/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAnalysisResult(data.data);
      } else {
        setAnalysisError(data.error || 'Failed to complete analysis');
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Error running Jev AI analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Run initial analysis automatically on mount or when messages arrive
  useEffect(() => {
    if (allMessages.length > 0 && !analysisResult) {
      runAnalysis();
    }
  }, [allMessages.length]);

  const availableGroups = conversations.filter((c) => c.isGroup);

  // Filtered actionable messages
  const filteredActionables = (analysisResult?.actionableItems || []).filter((item) => {
    if (actionableCategoryFilter === 'payment') return item.category === 'payment';
    if (actionableCategoryFilter === 'time_change') return item.category === 'time_change';
    if (actionableCategoryFilter === 'urgent_attention') return item.category === 'urgent_attention';
    if (actionableCategoryFilter === 'recruitment') return item.category === 'recruitment';
    return true;
  });

  // Filtered group summaries
  const filteredSummaries = (analysisResult?.groupSummaries || []).filter((grp) => {
    if (selectedGroup !== 'all' && grp.groupName !== selectedGroup) return false;
    if (selectedUrgency !== 'all') {
      if (selectedUrgency === 'high' && grp.highPriorityCount === 0) return false;
    }
    return true;
  });

  const totalAnalyzed = analysisResult?.totalAnalyzed ?? (allMessages.length > 0 ? allMessages.length : 0);
  const urgentPayments = analysisResult?.urgentPaymentsCount ?? 0;
  const timeChanges = analysisResult?.timeChangesCount ?? 0;
  const highPriority = analysisResult?.highPriorityCount ?? 0;
  const recruitment = analysisResult?.recruitmentCount ?? 0;

  return (
    <div className="message-summary-container">
      {/* Page Title & Subtitle */}
      <div className="section-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="section-title">Message Summary &amp; Intelligence</h2>
            <span className="ai-badge">
              <Sparkles size={12} /> Jev AI Engine
            </span>
          </div>
          <p className="section-subtitle">
            Automated intelligence overview, executive conversation summaries, and real-time actionable triage.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={runAnalysis}
            disabled={analyzing}
          >
            <RotateCw size={14} className={analyzing ? 'animate-spin' : ''} />
            <span>{analyzing ? 'Analyzing with Jev...' : '⚡ Run Jev AI Analysis'}</span>
          </button>
        </div>
      </div>

      {analysisError && (
        <div className="error-banner" style={{ marginBottom: 18 }}>
          <AlertTriangle size={18} className="error-icon" />
          <div>{analysisError}</div>
        </div>
      )}

      {/* 5 Overview KPI Cards */}
      <div className="summary-kpi-grid">
        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Messages</span>
            <div className="kpi-icon-wrap">
              <MessageSquare size={16} />
            </div>
          </div>
          <div className="kpi-value">{totalMessagesCount}</div>
          <div className="kpi-subtext">Received &amp; stored in database</div>
        </div>

        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Messages Analyzed</span>
            <div className="kpi-icon-wrap kpi-blue">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="kpi-value">{totalAnalyzed}</div>
          <div className="kpi-subtext">Processed by Jev decision model</div>
        </div>

        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">High Priority Messages</span>
            <div className="kpi-icon-wrap kpi-red">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="kpi-value">{highPriority}</div>
          <div className="kpi-subtext">Immediate attention required</div>
        </div>

        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Urgent Payments</span>
            <div className="kpi-icon-wrap kpi-purple">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="kpi-value">{urgentPayments}</div>
          <div className="kpi-subtext">Invoices, fees &amp; settlements</div>
        </div>

        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Time &amp; Schedule Changes</span>
            <div className="kpi-icon-wrap kpi-green">
              <CalendarClock size={16} />
            </div>
          </div>
          <div className="kpi-value">{timeChanges}</div>
          <div className="kpi-subtext">Late arrivals &amp; postponements</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="intelligence-tabs-row">
        <button
          type="button"
          className={`sub-tab-btn ${activeTab === 'actionable' ? 'active' : ''}`}
          onClick={() => setActiveTab('actionable')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldAlert size={16} />
            <span>Actionable Messages Hub</span>
          </div>
          {(analysisResult?.actionableItems.length ?? 0) > 0 && (
            <span className="tab-badge-count">{analysisResult?.actionableItems.length}</span>
          )}
        </button>

        <button
          type="button"
          className={`sub-tab-btn ${activeTab === 'summaries' ? 'active' : ''}`}
          onClick={() => setActiveTab('summaries')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={16} />
            <span>Group Conversation Summaries</span>
          </div>
          {(analysisResult?.groupSummaries.length ?? 0) > 0 && (
            <span className="tab-badge-count-neutral">{analysisResult?.groupSummaries.length}</span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: ACTIONABLE MESSAGES HUB (Urgent payments, time changes, attention)
          ========================================================================= */}
      {activeTab === 'actionable' && (
        <div className="actionable-hub-section">
          {/* Actionable Sub-Filters */}
          <div className="actionable-filter-bar">
            <button
              type="button"
              className={`filter-pill-btn ${actionableCategoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActionableCategoryFilter('all')}
            >
              All Actionable ({analysisResult?.actionableItems.length || 0})
            </button>
            <button
              type="button"
              className={`filter-pill-btn pill-payment ${actionableCategoryFilter === 'payment' ? 'active' : ''}`}
              onClick={() => setActionableCategoryFilter('payment')}
            >
              <CreditCard size={13} />
              <span>Urgent Payments ({urgentPayments})</span>
            </button>
            <button
              type="button"
              className={`filter-pill-btn pill-time ${actionableCategoryFilter === 'time_change' ? 'active' : ''}`}
              onClick={() => setActionableCategoryFilter('time_change')}
            >
              <Clock size={13} />
              <span>Time &amp; Schedule Changes ({timeChanges})</span>
            </button>
            <button
              type="button"
              className={`filter-pill-btn pill-attention ${actionableCategoryFilter === 'urgent_attention' ? 'active' : ''}`}
              onClick={() => setActionableCategoryFilter('urgent_attention')}
            >
              <AlertTriangle size={13} />
              <span>Requires Attention</span>
            </button>
            <button
              type="button"
              className={`filter-pill-btn pill-recruitment ${actionableCategoryFilter === 'recruitment' ? 'active' : ''}`}
              onClick={() => setActionableCategoryFilter('recruitment')}
            >
              <Briefcase size={13} />
              <span>Recruitment ({recruitment})</span>
            </button>
          </div>

          {/* Actionable Messages List */}
          {filteredActionables.length === 0 ? (
            <div className="empty-intelligence-card">
              <div className="empty-icon-circle">
                <CheckCircle2 size={36} className="text-green" />
              </div>
              <h3 className="empty-title">
                {allMessages.length === 0
                  ? 'No message intelligence available yet. Connect your message source to get started.'
                  : 'No pending actionable items found in current messages.'}
              </h3>
              <p className="empty-description">
                {allMessages.length === 0
                  ? 'Once connected to WhatsApp via 2Chat, all incoming messages will be continuously analyzed by Jev AI for urgent payments, schedule updates, and action items.'
                  : 'Jev AI evaluated your WhatsApp discussions. Messages containing urgent payments, changes in office arrival times, or critical tasks will appear here automatically.'}
              </p>
              <div className="empty-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onNavigateToTestMessages()}
                >
                  <MessageSquare size={16} />
                  <span>Go to Test Messages</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onNavigateToDeveloper}
                >
                  <span>Configure Jev AI Key</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="actionable-cards-grid">
              {filteredActionables.map((item) => {
                let formattedTime = '';
                try {
                  formattedTime = new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                } catch {
                  formattedTime = '';
                }

                const isPayment = item.category === 'payment';
                const isTimeChange = item.category === 'time_change';

                return (
                  <div key={item.id} className={`actionable-card ${isPayment ? 'card-payment' : isTimeChange ? 'card-time' : 'card-attention'}`}>
                    {/* Header */}
                    <div className="actionable-card-header">
                      <div className="category-and-urgency">
                        {isPayment && (
                          <span className="action-tag tag-payment">
                            <CreditCard size={12} />
                            <span>URGENT PAYMENT</span>
                          </span>
                        )}
                        {isTimeChange && (
                          <span className="action-tag tag-time">
                            <Clock size={12} />
                            <span>TIME / SCHEDULE CHANGE</span>
                          </span>
                        )}
                        {!isPayment && !isTimeChange && (
                          <span className="action-tag tag-attention">
                            <AlertTriangle size={12} />
                            <span>ATTENTION REQUIRED</span>
                          </span>
                        )}
                        <span className={`urgency-pill ${item.urgency}`}>
                          {item.urgency.toUpperCase()}
                        </span>
                      </div>
                      <span className="actionable-time">{formattedTime}</span>
                    </div>

                    {/* Action Required Callout Box */}
                    <div className="action-required-box">
                      <div className="action-required-title">
                        <span>ACTION ITEM:</span> {item.actionRequired}
                      </div>
                      {item.deadline && (
                        <div className="action-deadline-badge">
                          <CalendarClock size={12} />
                          <span>Reported Time: {item.deadline}</span>
                        </div>
                      )}
                    </div>

                    {/* Sender & Group Context */}
                    <div className="actionable-context-row">
                      <span className="context-sender">{item.senderName}</span>
                      {item.senderNumber && <span className="context-phone">({item.senderNumber})</span>}
                      <span className="context-separator">•</span>
                      <span className="context-group">{item.groupName}</span>
                    </div>

                    {/* Exact Message Snippet */}
                    <div className="actionable-quote-box">
                      <span className="quote-icon">“</span>
                      <p className="quote-text">{item.text}</p>
                    </div>

                    {/* Card Footer */}
                    <div className="actionable-card-footer">
                      <button
                        type="button"
                        className="btn-jump-chat"
                        onClick={() => onNavigateToTestMessages(item.chatId)}
                      >
                        <span>View &amp; Reply in Chat</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: GROUP CONVERSATION SUMMARIES
          ========================================================================= */}
      {activeTab === 'summaries' && (
        <div className="summaries-tab-section">
          {/* Summary Filters Bar */}
          <div className="summary-filters-card">
            <div className="filters-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                <Filter size={15} />
                <span>SUMMARY FILTERS</span>
              </div>
            </div>

            <div className="filters-grid">
              <div className="filter-item">
                <label className="filter-label">WhatsApp Group</label>
                <select
                  className="filter-select"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                >
                  <option value="all">All WhatsApp Groups</option>
                  {availableGroups.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-item">
                <label className="filter-label">Priority Filter</label>
                <select
                  className="filter-select"
                  value={selectedUrgency}
                  onChange={(e) => setSelectedUrgency(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High &amp; Critical Priority Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Group Summaries Cards */}
          {filteredSummaries.length === 0 ? (
            <div className="empty-intelligence-card">
              <div className="empty-icon-circle">
                <FileQuestion size={36} />
              </div>
              <h3 className="empty-title">
                No group summaries available yet. Click "Run Jev AI Analysis" to summarize.
              </h3>
              <p className="empty-description">
                Jev AI analyzes conversation threads, identifies topic themes, and generates an executive overview for each WhatsApp group.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={runAnalysis}
                disabled={analyzing}
              >
                <span>{analyzing ? 'Analyzing...' : '⚡ Run Jev AI Analysis'}</span>
              </button>
            </div>
          ) : (
            <div className="summaries-cards-stack">
              {filteredSummaries.map((grp, idx) => (
                <div key={idx} className="group-summary-card">
                  <div className="group-summary-header">
                    <div>
                      <h4 className="group-summary-title">{grp.groupName}</h4>
                      <p className="group-summary-subtitle">
                        {grp.totalMessagesCount} messages analyzed • Last active {new Date(grp.lastActive).toLocaleDateString()}
                      </p>
                    </div>
                    {grp.highPriorityCount > 0 && (
                      <span className="urgency-pill high">
                        {grp.highPriorityCount} HIGH PRIORITY
                      </span>
                    )}
                  </div>

                  <div className="group-summary-body">
                    {/* Executive Summary */}
                    <div className="summary-text-block">
                      <strong>Executive Summary:</strong> {grp.summaryText}
                    </div>

                    {/* Topics */}
                    <div className="summary-topics-row">
                      <span className="topics-label">Important Topics:</span>
                      <div className="topics-chips-list">
                        {grp.importantTopics.map((topic, i) => (
                          <span key={i} className="topic-chip">
                            <Tag size={11} /> {topic}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Items List */}
                    {grp.actionItems.length > 0 && (
                      <div className="action-items-list-block">
                        <span className="action-items-title">Key Action Items:</span>
                        <ul className="action-items-ul">
                          {grp.actionItems.map((action, i) => (
                            <li key={i}>
                              <CheckCircle2 size={13} className="text-green" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="group-summary-footer">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onNavigateToTestMessages(grp.chatId)}
                    >
                      <span>Open Group Chat</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
