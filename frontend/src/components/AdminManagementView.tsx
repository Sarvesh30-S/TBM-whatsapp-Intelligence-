'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ShieldCheck,
  Check,
  X,
  Search,
  Lock,
  AlertCircle,
  Settings,
  MessageSquare,
  Send,
  Eye,
  RefreshCw,
  Sparkles,
  Bell,
  Clock,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ApiUsageCalculator from './ApiUsageCalculator';

interface GroupPermission {
  group_identifier: string;
  group_name: string;
  can_view: boolean;
  can_send: boolean;
}

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  department: string;
  departmentName: string;
  roles: string[];
  status: 'ACTIVE' | 'INACTIVE';
  isAdmin: boolean;
  groupPermissions: GroupPermission[];
  assignedGroupCount: number | 'All';
  createdAt?: string;
}

interface DiscoverableGroup {
  id: string;
  name: string;
  channelNumber?: string;
}

interface AccessRequestRow {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  requested_groups: string[];
  message?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export default function AdminManagementView() {
  const { user, token } = useAuth();
  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [availableGroups, setAvailableGroups] = useState<DiscoverableGroup[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([]);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal state for assigning groups
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [selectedGroupPerms, setSelectedGroupPerms] = useState<
    Record<string, { canView: boolean; canSend: boolean; name: string }>
  >({});
  const [savingPermissions, setSavingPermissions] = useState<boolean>(false);

  const fetchUsersAndGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [usersRes, reqRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/access-requests', { headers }).catch(() => null),
      ]);

      if (!usersRes.ok) {
        throw new Error(`Failed to fetch users: ${usersRes.statusText}`);
      }

      const data = await usersRes.json();
      setUsersList(data.users || []);

      // Deduplicate available groups by canonical name to avoid repeating names
      const uniqueGroupsMap = new Map<string, DiscoverableGroup>();
      for (const g of (data.availableGroups || [])) {
        const key = (g.name || '').toLowerCase().trim();
        if (key && !uniqueGroupsMap.has(key)) {
          uniqueGroupsMap.set(key, {
            ...g,
            id: g.name,
          });
        }
      }
      setAvailableGroups(Array.from(uniqueGroupsMap.values()));

      if (reqRes && reqRes.ok) {
        const reqData = await reqRes.json();
        setAccessRequests(reqData.requests || []);
      }
    } catch (err: any) {
      console.warn('Could not load live admin users, loading fallback:', err.message);
      setError('Could not connect to live user management API. Using cached preview view.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleResolveRequest = async (request: AccessRequestRow, action: 'APPROVE' | 'REJECT') => {
    setResolvingRequestId(request.id);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/access-requests', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          requestId: request.id,
          action,
          targetUserEmail: request.user_email,
          targetUserId: request.user_id,
          groups: request.requested_groups,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to resolve access request');
      }

      setSuccessMessage(
        action === 'APPROVE'
          ? `Access granted! ${request.user_name} now has access to: ${request.requested_groups.join(', ')}.`
          : `Access request for ${request.user_name} was dismissed.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      await fetchUsersAndGroups();
    } catch (err: any) {
      alert(err.message || 'Error resolving request');
    } finally {
      setResolvingRequestId(null);
    }
  };

  useEffect(() => {
    fetchUsersAndGroups();
  }, [fetchUsersAndGroups]);

  const toggleStatus = async (targetUser: UserRow) => {
    const newStatus = targetUser.status === 'ACTIVE' ? false : true;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          targetUserId: targetUser.id,
          isActive: newStatus,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update user status');
      }

      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, status: newStatus ? 'ACTIVE' : 'INACTIVE' } : u))
      );
      setSuccessMessage(
        `${targetUser.fullName} has been ${newStatus ? 'activated' : 'deactivated and locked out'}.`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  };

  const openGroupModal = (targetUser: UserRow) => {
    setEditingUser(targetUser);

    // Initialize mapping with existing permissions keyed by canonical group name
    const map: Record<string, { canView: boolean; canSend: boolean; name: string }> = {};

    for (const g of availableGroups) {
      const gNameLower = g.name.toLowerCase().trim();
      const existing = targetUser.groupPermissions.find(
        (p) =>
          p.group_name.toLowerCase().trim() === gNameLower ||
          p.group_identifier.toLowerCase().trim() === gNameLower ||
          p.group_identifier.toLowerCase().trim() === (g.id || '').toLowerCase().trim()
      );
      map[g.name] = {
        name: g.name,
        canView: Boolean(existing?.can_view),
        canSend: Boolean(existing?.can_send),
      };
    }

    setSelectedGroupPerms(map);
  };

  const handleToggleGroup = (groupName: string, field: 'canView' | 'canSend') => {
    setSelectedGroupPerms((prev) => {
      const current = prev[groupName] || { canView: false, canSend: false, name: groupName };
      const nextVal = !current[field];
      const updated = {
        ...current,
        [field]: nextVal,
      };

      // If user turns on canSend, they automatically need canView
      if (field === 'canSend' && nextVal) {
        updated.canView = true;
      }
      // If user turns off canView, canSend must also turn off
      if (field === 'canView' && !nextVal) {
        updated.canSend = false;
      }

      return {
        ...prev,
        [groupName]: updated,
      };
    });
  };

  const handleSelectAll = (select: boolean) => {
    setSelectedGroupPerms((prev) => {
      const updated: Record<string, { canView: boolean; canSend: boolean; name: string }> = {};
      for (const [key, val] of Object.entries(prev)) {
        updated[key] = {
          ...val,
          canView: select,
          canSend: select ? val.canSend : false,
        };
      }
      return updated;
    });
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setSavingPermissions(true);

    try {
      const payloadGroups = Object.entries(selectedGroupPerms).map(([groupName, val]) => ({
        groupIdentifier: val.name || groupName,
        groupName: val.name || groupName,
        canView: val.canView,
        canSend: val.canSend,
      }));

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetUserId: editingUser.id,
          groups: payloadGroups,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update group permissions');
      }

      setSuccessMessage(`Permissions saved! ${editingUser.fullName}'s dashboard is now updated.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setEditingUser(null);
      await fetchUsersAndGroups();
    } catch (err: any) {
      alert(err.message || 'Error saving group permissions');
    } finally {
      setSavingPermissions(false);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-view" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 14,
          padding: '24px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#D97706',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '4px 10px',
                borderRadius: 20,
                letterSpacing: '0.5px',
              }}
            >
              ADMINISTRATION & ACCESS
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              {usersList.length} Authorized Members
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            Member Access & Group Permissions
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Every authorized colleague who signs in with @theboredmonkey.com appears here. Assign specific WhatsApp
            groups to control their view.
          </p>
        </div>

        <button
          onClick={fetchUsersAndGroups}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 8,
            backgroundColor: 'var(--bg-surface-subtle)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Member List</span>
        </button>
      </div>

      {/* 2Chat API Credit & System Usage Calculator */}
      <ApiUsageCalculator token={token} />

      {/* Success Notification */}
      {successMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            backgroundColor: 'rgba(217, 119, 6, 0.1)',
            border: '1px solid rgba(217, 119, 6, 0.3)',
            color: '#B45309',
            fontSize: 13,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Check size={16} color="#D97706" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Pending Group Access Requests Alert Card */}
      {accessRequests.filter((r) => r.status === 'PENDING').length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 14,
            padding: '22px 24px',
            border: '1px solid rgba(217, 119, 6, 0.35)',
            boxShadow: '0 2px 10px rgba(217, 119, 6, 0.08)',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: 'rgba(217, 119, 6, 0.12)',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Pending WhatsApp Group Access Requests ({accessRequests.filter((r) => r.status === 'PENDING').length})
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Team members waiting for your authorization to access campaign chat intelligence
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#D97706',
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                padding: '4px 10px',
                borderRadius: 20,
              }}
            >
              Action Required
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {accessRequests
              .filter((r) => r.status === 'PENDING')
              .map((req) => (
                <div
                  key={req.id}
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle)',
                    borderRadius: 10,
                    padding: '16px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{req.user_name}</strong>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({req.user_email})</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        • {new Date(req.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>

                    <div style={{ marginTop: 6 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-surface)',
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid var(--border-subtle)',
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#D97706', marginRight: 6 }}>Request:</span>
                        "{req.message}"
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {usersList.find((u) => u.email.toLowerCase() === req.user_email.toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = usersList.find((u) => u.email.toLowerCase() === req.user_email.toLowerCase());
                          if (target) openGroupModal(target);
                        }}
                        style={{
                          padding: '9px 16px',
                          borderRadius: 8,
                          backgroundColor: '#D97706',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 1px 4px rgba(217, 119, 6, 0.25)',
                        }}
                      >
                        <Settings size={14} />
                        <span>Assign Groups</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={resolvingRequestId === req.id}
                      onClick={() => handleResolveRequest(req, 'APPROVE')}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 8,
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: resolvingRequestId === req.id ? 'not-allowed' : 'pointer',
                        opacity: resolvingRequestId === req.id ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Check size={14} color="#D97706" />
                      <span>{resolvingRequestId === req.id ? 'Resolving...' : 'Mark Approved'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={resolvingRequestId === req.id}
                      onClick={() => handleResolveRequest(req, 'REJECT')}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 8,
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: resolvingRequestId === req.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 12,
          padding: 16,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          marginBottom: 20,
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search colleagues by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Users Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Colleague</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Assigned Groups</th>
              <th style={{ padding: '14px 18px', fontWeight: 600 }}>Account Status</th>
              <th style={{ padding: '14px 18px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading authorized members...' : 'No colleagues found matching your search.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    opacity: u.status === 'INACTIVE' ? 0.6 : 1,
                  }}
                >
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: u.isAdmin ? '#FDC727' : '#3B82F6',
                          color: u.isAdmin ? '#172033' : '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: u.isAdmin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: u.isAdmin ? '#D97706' : '#2563EB',
                      }}
                    >
                      {u.isAdmin ? 'SUPER ADMIN' : 'MEMBER'}
                    </span>
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    {u.isAdmin ? (
                      <span style={{ color: '#10B981', fontWeight: 600 }}>Wildcard (All Groups)</span>
                    ) : (
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: u.assignedGroupCount === 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: u.assignedGroupCount === 0 ? '#EF4444' : '#10B981',
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        {u.assignedGroupCount === 0 ? '0 Groups (Zero-Data UI)' : `${u.assignedGroupCount} Groups Granted`}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: u.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: u.status === 'ACTIVE' ? '#10B981' : '#EF4444',
                      }}
                    >
                      {u.status}
                    </span>
                  </td>

                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {!u.isAdmin && (
                        <button
                          onClick={() => openGroupModal(u)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            backgroundColor: '#3B82F6',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Settings size={13} />
                          <span>Assign Groups</span>
                        </button>
                      )}

                      {!u.isAdmin && (
                        <button
                          onClick={() => toggleStatus(u)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            backgroundColor: u.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: u.status === 'ACTIVE' ? '#EF4444' : '#10B981',
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {u.status === 'ACTIVE' ? 'Lock Out' : 'Unlock'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Group Assignment */}
      {editingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 620,
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                  Assign WhatsApp Groups to {editingUser.fullName}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Select which group chats {editingUser.email} can monitor or participate in.
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Actions */}
            <div
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {Object.values(selectedGroupPerms).filter((v) => v.canView).length} of {availableGroups.length} groups selected
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Select All
                </button>
                <span style={{ color: 'var(--text-muted)' }}>|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Groups Checklist */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-surface)' }}>
              {availableGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: 13 }}>
                  No WhatsApp groups discovered in the database yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {availableGroups.map((g) => {
                    const perm = selectedGroupPerms[g.name] || { canView: false, canSend: false, name: g.name };
                    return (
                      <div
                        key={g.name}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 8,
                          backgroundColor: perm.canView ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-surface-subtle)',
                          border: perm.canView
                            ? '1px solid rgba(217, 119, 6, 0.35)'
                            : '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <input
                            type="checkbox"
                            checked={perm.canView}
                            onChange={() => handleToggleGroup(g.name, 'canView')}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#D97706' }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                              {g.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {g.channelNumber ? `Channel: ${g.channelNumber}` : 'Verified WhatsApp Group'}
                            </div>
                          </div>
                        </div>

                        {/* Send Rights toggle */}
                        {perm.canView && (
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 12,
                              color: perm.canSend ? '#D97706' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              backgroundColor: 'rgba(217, 119, 6, 0.08)',
                              padding: '4px 8px',
                              borderRadius: 6,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={perm.canSend}
                              onChange={() => handleToggleGroup(g.name, 'canSend')}
                              style={{ accentColor: '#D97706', cursor: 'pointer' }}
                            />
                            <span>Can Send Messages</span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingPermissions}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  backgroundColor: '#3B82F6',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: savingPermissions ? 'not-allowed' : 'pointer',
                  opacity: savingPermissions ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {savingPermissions ? 'Saving...' : 'Save Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
