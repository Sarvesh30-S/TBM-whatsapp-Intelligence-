'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Filter,
  Check,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PriorityItem {
  id: string;
  title: string;
  category: 'CRITICAL' | 'FINANCIAL' | 'DEADLINE' | 'OPERATIONAL';
  urgencyScore: number;
  groupName: string;
  senderName: string;
  senderNumber: string;
  excerpt: string;
  sourceMessageId: string;
  status: 'NEW' | 'VIEWED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED';
  timestamp: string;
  dueDate?: string;
}

const INITIAL_ITEMS: PriorityItem[] = [
  {
    id: 'pi-001',
    title: 'Urgent driver payment clearance required for Fleet Pod #4',
    category: 'CRITICAL',
    urgencyScore: 0.95,
    groupName: 'Fleet Ops Pod',
    senderName: 'Sarvesh',
    senderNumber: '+91 77386 74950',
    excerpt: 'Driver fuel and toll advance of INR 4,500 pending approval before departure.',
    sourceMessageId: 'msg-019a-9410',
    status: 'NEW',
    timestamp: 'Today, 02:42 PM',
    dueDate: 'Today, 04:00 PM',
  },
  {
    id: 'pi-002',
    title: 'Diesel reimbursement claim submitted with receipt attachment',
    category: 'FINANCIAL',
    urgencyScore: 0.82,
    groupName: 'Fleet Ops Pod',
    senderName: 'Sarvesh',
    senderNumber: '+91 86553 30477',
    excerpt: 'Attached invoice for Bharat Petroleum refueling: Rs 8,240. Please verify receipt.',
    sourceMessageId: 'msg-019a-9411',
    status: 'ACKNOWLEDGED',
    timestamp: 'Today, 01:43 PM',
    dueDate: 'Today, 05:00 PM',
  },
  {
    id: 'pi-003',
    title: 'Vehicle schedule change requested for tomorrow 08:00 AM dispatch',
    category: 'OPERATIONAL',
    urgencyScore: 0.74,
    groupName: 'Fleet Ops Pod',
    senderName: 'Sarvesh',
    senderNumber: '+91 77386 74950',
    excerpt: 'Client requested postponement from 06:00 AM to 08:00 AM. Route assignment needs reshuffle.',
    sourceMessageId: 'msg-019a-9412',
    status: 'VIEWED',
    timestamp: 'Today, 11:15 AM',
  },
];

export default function PriorityInboxView() {
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState<PriorityItem[]>(INITIAL_ITEMS);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('UNRESOLVED');
  const [selectedItem, setSelectedItem] = useState<PriorityItem | null>(INITIAL_ITEMS[0]);

  const canTriage = hasPermission('PRIORITY_INBOX_TRIAGE');

  const updateStatus = (id: string, newStatus: PriorityItem['status']) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
    if (selectedItem?.id === id) {
      setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;
    if (filterStatus === 'UNRESOLVED' && (item.status === 'RESOLVED')) return false;
    if (filterStatus === 'RESOLVED' && item.status !== 'RESOLVED') return false;
    return true;
  });

  const getCategoryBadge = (cat: PriorityItem['category']) => {
    switch (cat) {
      case 'CRITICAL':
        return <span className="status-badge badge-danger">CRITICAL</span>;
      case 'FINANCIAL':
        return <span className="status-badge badge-warning">FINANCIAL</span>;
      case 'DEADLINE':
        return <span className="status-badge badge-alert">DEADLINE</span>;
      case 'OPERATIONAL':
        return <span className="status-badge badge-info">OPERATIONS</span>;
    }
  };

  const getStatusBadge = (status: PriorityItem['status']) => {
    switch (status) {
      case 'NEW':
        return <span className="lifecycle-badge badge-new">NEW</span>;
      case 'VIEWED':
        return <span className="lifecycle-badge badge-viewed">VIEWED</span>;
      case 'ACKNOWLEDGED':
        return <span className="lifecycle-badge badge-ack">ACKNOWLEDGED</span>;
      case 'RESOLVED':
        return <span className="lifecycle-badge badge-resolved">RESOLVED</span>;
      case 'ESCALATED':
        return <span className="lifecycle-badge badge-escalated">ESCALATED</span>;
    }
  };

  return (
    <div className="priority-inbox-view">
      {/* Header */}
      <div className="inbox-header-card">
        <div className="inbox-header-left">
          <div className="header-badge-row">
            <span className="section-pill alert-pill">PRIORITY TRIAGE</span>
            <span className="unresolved-count">{items.filter((i) => i.status !== 'RESOLVED').length} Unresolved</span>
          </div>
          <h1 className="inbox-title">Priority Inbox</h1>
          <p className="inbox-subtitle">
            Algorithmic high-urgency detection triaging payment bottlenecks, operational blockers, and strict deadlines.
          </p>
        </div>

        {/* Filter controls */}
        <div className="inbox-filters-row">
          <div className="filter-pill-group">
            {['ALL', 'CRITICAL', 'FINANCIAL', 'OPERATIONAL'].map((cat) => (
              <button
                key={cat}
                className={`filter-pill-btn ${filterCategory === cat ? 'active' : ''}`}
                onClick={() => setFilterCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="filter-pill-group">
            {['UNRESOLVED', 'RESOLVED', 'ALL'].map((st) => (
              <button
                key={st}
                className={`filter-pill-btn ${filterStatus === st ? 'active' : ''}`}
                onClick={() => setFilterStatus(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Split Pane: List & Detail Drawer */}
      <div className="inbox-split-layout">
        {/* List Column */}
        <div className="inbox-list-column">
          {filteredItems.length === 0 ? (
            <div className="inbox-empty-state">
              <CheckCircle2 size={32} className="text-emerald" />
              <div className="empty-title">All priority items resolved</div>
              <div className="empty-subtitle">No alerts matching your active filter criteria.</div>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`inbox-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedItem(item);
                    if (item.status === 'NEW') updateStatus(item.id, 'VIEWED');
                  }}
                >
                  <div className="inbox-card-top">
                    <div className="category-and-group">
                      {getCategoryBadge(item.category)}
                      <span className="card-group-name">{item.groupName}</span>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="inbox-card-title">{item.title}</div>
                  <div className="inbox-card-excerpt">{item.excerpt}</div>

                  <div className="inbox-card-footer">
                    <span className="inbox-sender">{item.senderName} ({item.senderNumber})</span>
                    <span className="inbox-time">{item.timestamp}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail & Action Inspector */}
        {selectedItem && (
          <div className="inbox-detail-column">
            <div className="detail-card">
              <div className="detail-header">
                <div>
                  <div className="detail-category-row">
                    {getCategoryBadge(selectedItem.category)}
                    {getStatusBadge(selectedItem.status)}
                  </div>
                  <h2 className="detail-title">{selectedItem.title}</h2>
                </div>
              </div>

              <div className="detail-body">
                <div className="detail-meta-box">
                  <div className="meta-row">
                    <span className="meta-label">WhatsApp Group:</span>
                    <span className="meta-val font-semibold">{selectedItem.groupName}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Origin Sender:</span>
                    <span className="meta-val">{selectedItem.senderName} ({selectedItem.senderNumber})</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Urgency Score:</span>
                    <span className="meta-val font-semibold text-rose">
                      {(selectedItem.urgencyScore * 100).toFixed(0)}% (Critical Tier)
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Source Message ID:</span>
                    <span className="meta-val font-mono">{selectedItem.sourceMessageId}</span>
                  </div>
                  {selectedItem.dueDate && (
                    <div className="meta-row">
                      <span className="meta-label">Resolution Due:</span>
                      <span className="meta-val font-semibold text-amber">{selectedItem.dueDate}</span>
                    </div>
                  )}
                </div>

                <div className="detail-message-context">
                  <div className="context-label">Original Extracted Context</div>
                  <p className="context-text">{selectedItem.excerpt}</p>
                </div>

                {/* Triage Action Lifecycle Buttons */}
                <div className="triage-actions-box">
                  <div className="actions-title">Lifecycle State Actions</div>
                  {canTriage ? (
                    <div className="action-buttons-grid">
                      <button
                        className="btn btn-outline"
                        disabled={selectedItem.status === 'ACKNOWLEDGED' || selectedItem.status === 'RESOLVED'}
                        onClick={() => updateStatus(selectedItem.id, 'ACKNOWLEDGED')}
                      >
                        <Clock size={16} />
                        Acknowledge
                      </button>

                      <button
                        className="btn btn-success"
                        disabled={selectedItem.status === 'RESOLVED'}
                        onClick={() => updateStatus(selectedItem.id, 'RESOLVED')}
                      >
                        <CheckCircle2 size={16} />
                        Mark Resolved
                      </button>

                      <button
                        className="btn btn-danger"
                        disabled={selectedItem.status === 'ESCALATED'}
                        onClick={() => updateStatus(selectedItem.id, 'ESCALATED')}
                      >
                        <ShieldAlert size={16} />
                        Escalate
                      </button>
                    </div>
                  ) : (
                    <div className="permission-notice">
                      Your current role (<strong>{user?.roles?.[0]}</strong>) has read-only access to this priority queue.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
