'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  AlertTriangle,
  RotateCw,
  CreditCard,
  CalendarClock,
  ShieldAlert,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  ExternalLink,
  Users,
  Search,
} from 'lucide-react';
import { TwoChatMessage, TwoChatConversation } from '@/lib/types';
import { GroqActionableItem, GroqGroupSummary, GroqAnalysisResult } from '@/lib/groq-client';

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
  // Master 3-Tab Architecture: 'chats' | 'summary' | 'insights'
  const [activeTab, setActiveTab] = useState<'chats' | 'summary' | 'insights'>('summary');

  // Selected Group Filter for Chats tab
  const [selectedChatId, setSelectedChatId] = useState<string>(
    conversations[0]?.id || 'Fleet Ops Pod'
  );

  // Analysis State
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<GroqAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string>('');

  // Actionable Filter State
  const [insightCategoryFilter, setInsightCategoryFilter] = useState<
    'all' | 'payment' | 'time_change' | 'urgent_attention' | 'recruitment'
  >('all');

  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');

  // Run analysis function
  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const res = await fetch('/api/groq/analyze', {
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
      setAnalysisError(err.message || 'Error running Groq AI analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (allMessages.length > 0 && !analysisResult) {
      runAnalysis();
    }
  }, [allMessages.length]);

  const filteredActionables = (analysisResult?.actionableItems || []).filter((item) => {
    if (insightCategoryFilter === 'payment') return item.category === 'payment';
    if (insightCategoryFilter === 'time_change') return item.category === 'time_change';
    if (insightCategoryFilter === 'urgent_attention') return item.category === 'urgent_attention';
    if (insightCategoryFilter === 'recruitment') return item.category === 'recruitment';
    return true;
  });

  const filteredSummaries = (analysisResult?.groupSummaries || []).filter((grp) => {
    if (selectedUrgency === 'high' && grp.highPriorityCount === 0) return false;
    return true;
  });

  const totalAnalyzed = analysisResult?.totalAnalyzed ?? (allMessages.length > 0 ? allMessages.length : 0);
  const urgentPayments = analysisResult?.urgentPaymentsCount ?? 0;
  const timeChanges = analysisResult?.timeChangesCount ?? 0;
  const highPriority = analysisResult?.highPriorityCount ?? 0;

  // Selected chat messages for the CHATS tab
  const activeConversation = conversations.find((c) => c.id === selectedChatId) || conversations[0];
  const chatMessages = allMessages.filter((m) => {
    if (activeConversation?.isGroup) {
      return m.groupUuid === activeConversation.groupUuid || m.groupName === activeConversation.name;
    }
    const otherNumber = m.sentBy === 'user' || m.sentBy === 'agent' || m.sentBy === 'api'
      ? m.toNumber || m.remoteNumber || m.receiverNumber
      : m.fromNumber || m.remoteNumber || m.senderNumber;
    return otherNumber === activeConversation?.phoneOrId || otherNumber === activeConversation?.id;
  });

  return (
    <div className="message-summary-container">
      {/* Page Title & Actions */}
      <div className="overview-header-card">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="overview-greeting">Group Communication Intelligence</h1>
            <span className="ai-badge groq">
              <Sparkles size={12} /> Groq LPU (openai/gpt-oss-120b)
            </span>
          </div>
          <p className="overview-subtitle">
            Synthesized operational workspace with real-time feeds, verifiable citations, and actionable risk extraction.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={runAnalysis}
            disabled={analyzing}
          >
            <RotateCw size={14} className={analyzing ? 'animate-spin' : ''} />
            <span>{analyzing ? 'Synthesizing...' : 'Re-Analyze with Groq'}</span>
          </button>
        </div>
      </div>

      {analysisError && (
        <div className="error-banner" style={{ marginBottom: 18 }}>
          <AlertTriangle size={18} className="error-icon" />
          <div>{analysisError}</div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-title">Messages Collected</span>
            <div className="kpi-icon-bubble" style={{ backgroundColor: '#eef2ff', color: '#4f46e5' }}>
              <MessageSquare size={16} />
            </div>
          </div>
          <div className="kpi-value">{totalMessagesCount}</div>
          <div className="kpi-footer-row">100% persisted in Supabase</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-title">Messages Synthesized</span>
            <div className="kpi-icon-bubble" style={{ backgroundColor: '#ecfeff', color: '#0891b2' }}>
              <Sparkles size={16} />
            </div>
          </div>
          <div className="kpi-value">{totalAnalyzed}</div>
          <div className="kpi-footer-row">Evidence verified with IDs</div>
        </div>

        <div className="kpi-card kpi-card-alert">
          <div className="kpi-card-top">
            <span className="kpi-title">High Priority Alerts</span>
            <div className="kpi-icon-bubble" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="kpi-value">{highPriority}</div>
          <div className="kpi-footer-row">Critical operational flags</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-top">
            <span className="kpi-title">Payment Requests</span>
            <div className="kpi-icon-bubble" style={{ backgroundColor: '#faf5ff', color: '#7c3aed' }}>
              <CreditCard size={16} />
            </div>
          </div>
          <div className="kpi-value">{urgentPayments}</div>
          <div className="kpi-footer-row">Advances &amp; fuel settlements</div>
        </div>
      </div>

      {/* 3 Dedicated Sub-Tabs */}
      <div className="intelligence-tabs-row" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn ${activeTab === 'chats' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('chats')}
        >
          <MessageSquare size={16} />
          <span>CHATS (Live Conversations)</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'summary' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('summary')}
        >
          <Sparkles size={16} />
          <span>SUMMARY (Evidence-Backed AI Synthesis)</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'insights' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('insights')}
        >
          <ShieldAlert size={16} />
          <span>INSIGHTS (Action Items &amp; Risks)</span>
          {(analysisResult?.actionableItems.length ?? 0) > 0 && (
            <span className="status-badge badge-danger">
              {analysisResult?.actionableItems.length}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: CHATS (Group Conversations Feed)
          ========================================================================= */}
      {activeTab === 'chats' && (
        <div className="overview-split-layout">
          {/* Conversation List */}
          <div className="overview-card" style={{ padding: 16 }}>
            <h3 className="card-title" style={{ marginBottom: 12 }}>Active Groups &amp; Pods</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`inbox-card ${selectedChatId === c.id ? 'selected' : ''}`}
                  onClick={() => setSelectedChatId(c.id)}
                  style={{ cursor: 'pointer', padding: 12 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{c.name}</strong>
                    <span className="status-badge badge-info">{c.isGroup ? 'GROUP' : 'DIRECT'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {c.lastMessage?.slice(0, 50)}...
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversation Message Stream */}
          <div className="overview-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="card-title">{activeConversation?.name || 'Conversation Stream'}</h3>
              <span className="status-badge badge-info">{chatMessages.length} Messages</span>
            </div>

            <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>
                  No messages recorded in this conversation yet.
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isSent = msg.sentBy === 'user' || msg.sentBy === 'agent' || msg.sentBy === 'api';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isSent ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        backgroundColor: isSent ? '#eef2ff' : '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '10px 14px',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: isSent ? '#4f46e5' : '#0f172a', marginBottom: 2 }}>
                        {msg.senderName} ({msg.fromNumber || msg.senderNumber})
                      </div>
                      <div style={{ fontSize: 13, color: '#1e293b' }}>{msg.text}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; ID: {msg.id.slice(0, 8)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SUMMARY (Verifiable AI Summaries Citing Message IDs)
          ========================================================================= */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredSummaries.length === 0 ? (
            <div className="overview-card" style={{ padding: 32, textAlign: 'center' }}>
              <Sparkles size={32} style={{ color: '#6366f1', margin: '0 auto 12px' }} />
              <h3>No Summaries Available Yet</h3>
              <p style={{ color: '#64748b' }}>Click "Re-Analyze with Groq" above to synthesize active conversations.</p>
            </div>
          ) : (
            filteredSummaries.map((summary, idx) => (
              <div key={idx} className="overview-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span className="status-badge badge-info" style={{ marginRight: 8 }}>WHATSAPP POD</span>
                    <h3 style={{ display: 'inline', fontSize: 18, fontWeight: 700 }}>{summary.groupName}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="status-badge badge-warning">
                      Messages: {summary.totalMessagesCount}
                    </span>
                    <span className="status-badge badge-danger">
                      High Priority: {summary.highPriorityCount}
                    </span>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    Executive AI Synthesis
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: '#1e293b' }}>
                    {summary.summaryText}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#334155' }}>
                      Key Topics Discussed
                    </h4>
                    <ul style={{ paddingLeft: 18, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {summary.importantTopics?.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#334155' }}>
                      Identified Action Items
                    </h4>
                    <ul style={{ paddingLeft: 18, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {summary.actionItems?.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {summary.actionableMessages && summary.actionableMessages.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>VERIFIED CITATIONS:</span>
                    {summary.actionableMessages.map((item, i) => (
                      <span key={i} className="status-badge badge-info" style={{ fontFamily: 'monospace' }}>
                        ID #{item.messageId?.slice(0, 8) || item.id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: INSIGHTS (Actionable Matters, Payments & Risks)
          ========================================================================= */}
      {activeTab === 'insights' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['all', 'payment', 'time_change', 'urgent_attention', 'recruitment'].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`filter-pill-btn ${insightCategoryFilter === cat ? 'active' : ''}`}
                onClick={() => setInsightCategoryFilter(cat as any)}
              >
                {cat.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {filteredActionables.length === 0 ? (
              <div className="overview-card" style={{ padding: 24, textAlign: 'center', gridColumn: '1 / -1' }}>
                <CheckCircle2 size={28} style={{ color: '#059669', margin: '0 auto 8px' }} />
                <h4>No Actionable Risks in Selected Category</h4>
              </div>
            ) : (
              filteredActionables.map((item, idx) => (
                <div key={idx} className="inbox-card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="status-badge badge-danger">
                      {item.category.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="status-badge badge-warning">
                      Urgency: {item.urgency.toUpperCase()}
                    </span>
                  </div>

                  <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{item.actionRequired}</h4>
                  <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>{item.text}</p>

                  <div style={{ fontSize: 11, color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Source: {item.senderName} ({item.senderNumber})</span>
                    <span style={{ fontFamily: 'monospace' }}>ID: {item.messageId?.slice(0, 8) || item.id}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
