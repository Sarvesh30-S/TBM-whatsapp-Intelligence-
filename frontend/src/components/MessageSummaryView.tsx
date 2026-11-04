'use client';

import React, { useState } from 'react';
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
  ShieldAlert,
  Clock,
  CheckCircle,
  FileQuestion,
  Users,
} from 'lucide-react';
import { TwoChatMessage, TwoChatConversation } from '@/lib/types';

interface MessageSummaryViewProps {
  totalMessagesCount: number;
  conversations: TwoChatConversation[];
  onNavigateToTestMessages: () => void;
  onNavigateToDeveloper: () => void;
}

export default function MessageSummaryView({
  totalMessagesCount,
  conversations,
  onNavigateToTestMessages,
  onNavigateToDeveloper,
}: MessageSummaryViewProps) {
  // Filter States
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('last-7-days');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');

  // Currently, the Spring Boot backend endpoint for AI message summaries is not yet connected.
  // Rule: Do not invent a fake API endpoint or fake successful data.
  // Display a clear empty state as requested: "No message intelligence available yet. Connect your message source to get started."
  const summaries: any[] = [];

  const availableGroups = conversations.filter((c) => c.isGroup);

  return (
    <div className="message-summary-container">
      {/* Page Title & Subtitle */}
      <div className="section-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="section-title">Message Summary &amp; Intelligence</h2>
            <span className="ai-badge">
              <Sparkles size={12} /> AI Powered
            </span>
          </div>
          <p className="section-subtitle">
            Automated intelligence overview, executive summaries, topic modeling, and priority tracking.
          </p>
        </div>
      </div>

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
          <div className="kpi-subtext">Collected from connected channels</div>
        </div>

        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Messages Analyzed</span>
            <div className="kpi-icon-wrap kpi-blue">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="kpi-value">0</div>
          <div className="kpi-subtext">Pending AI decision engine</div>
        </div>

        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">High Priority Messages</span>
            <div className="kpi-icon-wrap kpi-red">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="kpi-value">0</div>
          <div className="kpi-subtext">Urgent action required</div>
        </div>

        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Recruitment Messages</span>
            <div className="kpi-icon-wrap kpi-purple">
              <Briefcase size={16} />
            </div>
          </div>
          <div className="kpi-value">0</div>
          <div className="kpi-subtext">Job openings &amp; candidates</div>
        </div>

        <div className="summary-kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Business Opportunities</span>
            <div className="kpi-icon-wrap kpi-green">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="kpi-value">0</div>
          <div className="kpi-subtext">Leads &amp; client prospects</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="summary-filters-card">
        <div className="filters-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
            <Filter size={15} />
            <span>INTELLIGENCE FILTERS</span>
          </div>
          <div className="intelligence-label-chips">
            <span className="label-chip chip-recruitment">Recruitment</span>
            <span className="label-chip chip-sales">Sales</span>
            <span className="label-chip chip-operations">Operations</span>
            <span className="label-chip chip-general">General</span>
            <span className="label-chip chip-low">Low Priority</span>
            <span className="label-chip chip-medium">Medium Priority</span>
            <span className="label-chip chip-high">High Priority</span>
            <span className="label-chip chip-critical">Critical</span>
          </div>
        </div>

        <div className="filters-grid">
          {/* WhatsApp Group Filter */}
          <div className="filter-item">
            <label className="filter-label">WhatsApp Group</label>
            <select
              className="filter-select"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="all">All WhatsApp Groups</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="filter-item">
            <label className="filter-label">Date Range</label>
            <select
              className="filter-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="last-7-days">Last 7 Days</option>
              <option value="last-30-days">Last 30 Days</option>
              <option value="all-time">All Time</option>
            </select>
          </div>

          {/* Message Category Filter */}
          <div className="filter-item">
            <label className="filter-label">Message Category</label>
            <select
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="recruitment">Recruitment</option>
              <option value="sales">Sales</option>
              <option value="operations">Operations</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Urgency Filter */}
          <div className="filter-item">
            <label className="filter-label">Urgency</label>
            <select
              className="filter-select"
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
            >
              <option value="all">All Urgencies</option>
              <option value="critical">Critical</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          {/* Sentiment Filter */}
          <div className="filter-item">
            <label className="filter-label">Sentiment</label>
            <select
              className="filter-select"
              value={selectedSentiment}
              onChange={(e) => setSelectedSentiment(e.target.value)}
            >
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="urgent">Urgent / Negative</option>
            </select>
          </div>
        </div>
      </div>

      {/* Message Summary Area */}
      <div className="summary-content-area">
        {summaries.length === 0 ? (
          /* Empty State (Per prompt requirement) */
          <div className="empty-intelligence-card">
            <div className="empty-icon-circle">
              <FileQuestion size={36} />
            </div>
            <h3 className="empty-title">
              No message intelligence available yet. Connect your message source to get started.
            </h3>
            <p className="empty-description">
              Once connected to the Spring Boot intelligence service and decision API (Jev AI), incoming WhatsApp group discussions will be automatically summarized, categorized, and scored by urgency.
            </p>
            <div className="empty-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={onNavigateToTestMessages}
              >
                <MessageSquare size={16} />
                <span>Go to Test Messages</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={onNavigateToDeveloper}
              >
                <span>Configure Integrations in Developer</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          /* Structured summary cards (when connected) */
          <div className="summaries-list">
            {/* Template ready for Spring Boot backend */}
          </div>
        )}
      </div>
    </div>
  );
}
