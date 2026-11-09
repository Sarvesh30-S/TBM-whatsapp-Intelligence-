'use client';

import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Building2,
  Key,
  Check,
  X,
  Search,
  Lock,
  Radio,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  department: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  groupAccess: string;
  canSend: boolean;
}

const INITIAL_USERS: UserRow[] = [
  {
    id: 'u-1',
    fullName: 'System Administrator',
    email: 'admin@tbm.internal',
    department: 'EXECUTIVE',
    role: 'ROLE_ADMIN',
    status: 'ACTIVE',
    groupAccess: 'All Groups',
    canSend: false,
  },
  {
    id: 'u-2',
    fullName: 'Sarvesh Deshpande',
    email: 'sarvesh.manager@tbm.internal',
    department: 'OPERATIONS',
    role: 'ROLE_MANAGER',
    status: 'ACTIVE',
    groupAccess: 'Fleet Ops Pod',
    canSend: true,
  },
  {
    id: 'u-3',
    fullName: 'Executive Leadership',
    email: 'executive@tbm.internal',
    department: 'EXECUTIVE',
    role: 'ROLE_C_SUITE',
    status: 'ACTIVE',
    groupAccess: 'Company-Wide BI',
    canSend: false,
  },
  {
    id: 'u-4',
    fullName: 'DevOps Engineer',
    email: 'dev@tbm.internal',
    department: 'ENGINEERING',
    role: 'ROLE_DEVELOPER',
    status: 'ACTIVE',
    groupAccess: 'Technical Diagnostics',
    canSend: false,
  },
  {
    id: 'u-5',
    fullName: 'Operations Associate',
    email: 'employee@tbm.internal',
    department: 'OPERATIONS',
    role: 'ROLE_EMPLOYEE',
    status: 'ACTIVE',
    groupAccess: 'Fleet Ops Pod',
    canSend: false,
  },
];

export default function AdminManagementView() {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<UserRow[]>(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    department: 'OPERATIONS',
    role: 'ROLE_EMPLOYEE',
    canSend: false,
  });

  const toggleStatus = (id: string) => {
    setUsersList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : u))
    );
  };

  const toggleCanSend = (id: string) => {
    setUsersList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, canSend: !u.canSend } : u))
    );
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.fullName || !newUser.email) return;

    const created: UserRow = {
      id: `u-${Date.now()}`,
      fullName: newUser.fullName,
      email: newUser.email,
      department: newUser.department,
      role: newUser.role,
      status: 'ACTIVE',
      groupAccess: 'Fleet Ops Pod',
      canSend: newUser.canSend,
    };

    setUsersList((prev) => [...prev, created]);
    setShowAddModal(false);
    setNewUser({ fullName: '', email: '', department: 'OPERATIONS', role: 'ROLE_EMPLOYEE', canSend: false });
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-view">
      {/* Header */}
      <div className="admin-header-card">
        <div className="admin-header-left">
          <div className="header-badge-row">
            <span className="section-pill admin-pill">ADMINISTRATION</span>
            <span className="user-count-pill">{usersList.length} Active Accounts</span>
          </div>
          <h1 className="admin-title">User & Access Control Management</h1>
          <p className="admin-subtitle">
            Enterprise role-based provisioning, department structures, and strict group messaging scoping.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <UserPlus size={16} />
          Provision New User
        </button>
      </div>

      {/* Search and Table */}
      <div className="admin-table-card">
        <div className="table-search-row">
          <div className="search-input-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search users by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="table-search-input"
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>User / Colleague</th>
                <th>Department</th>
                <th>Assigned Role</th>
                <th>Group Access</th>
                <th>Send Rights</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-table-avatar">{u.fullName.charAt(0)}</div>
                      <div>
                        <div className="user-table-name">{u.fullName}</div>
                        <div className="user-table-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="dept-tag">{u.department}</span>
                  </td>
                  <td>
                    <span className={`role-badge role-${u.role.toLowerCase()}`}>
                      {u.role.replace('ROLE_', '')}
                    </span>
                  </td>
                  <td>
                    <span className="group-access-label">{u.groupAccess}</span>
                  </td>
                  <td>
                    <button
                      className={`toggle-send-btn ${u.canSend ? 'enabled' : 'disabled'}`}
                      onClick={() => toggleCanSend(u.id)}
                      title="Toggle WHATSAPP_MESSAGE_SEND permission"
                    >
                      {u.canSend ? (
                        <>
                          <Check size={12} /> Permitted
                        </>
                      ) : (
                        <>
                          <Lock size={12} /> Read Only
                        </>
                      )}
                    </button>
                  </td>
                  <td>
                    <span className={`status-pill ${u.status === 'ACTIVE' ? 'pill-active' : 'pill-inactive'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-action-small"
                      onClick={() => toggleStatus(u.id)}
                    >
                      {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Provision Enterprise User</h3>
              <button
                className="btn-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    placeholder="e.g. Vikram Malhotra"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Corporate Email Address</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="e.g. v.malhotra@tbm.internal"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label className="form-label">Department</label>
                    <select
                      className="form-input"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    >
                      <option value="OPERATIONS">Operations</option>
                      <option value="ENGINEERING">Engineering</option>
                      <option value="EXECUTIVE">Executive</option>
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label className="form-label">Assigned Role</label>
                    <select
                      className="form-input"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="ROLE_EMPLOYEE">Employee (Read-Only)</option>
                      <option value="ROLE_MANAGER">Manager (Dept Oversight)</option>
                      <option value="ROLE_C_SUITE">C-Suite (Executive BI)</option>
                      <option value="ROLE_DEVELOPER">Developer (Telemetry)</option>
                      <option value="ROLE_ADMIN">Admin (Full Control)</option>
                    </select>
                  </div>
                </div>

                <div className="form-checkbox-row">
                  <input
                    type="checkbox"
                    id="canSendCheckbox"
                    checked={newUser.canSend}
                    onChange={(e) => setNewUser({ ...newUser, canSend: e.target.checked })}
                  />
                  <label htmlFor="canSendCheckbox" className="checkbox-label">
                    Grant <strong>WHATSAPP_MESSAGE_SEND</strong> outbound messaging privileges
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
