import React, { useState } from 'react';
import type { Branch, Department, Module, User } from '../../services/org.service';

interface Props {
  users: User[];
  branches: Branch[];
  departments: Department[];
  modules: Module[];
  loading: boolean;
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
  onToggleBlock: (user: User) => void;
}

const roleBadgeClass = (role: string) => {
  if (role === 'admin') return 'mis-badge' + ' ' + 'mis-badge-warning';
  if (role === 'ceo' || role === 'managing_director') return 'mis-badge mis-badge-success';
  if (role === 'hod' || role === 'regional_manager') return 'mis-badge mis-badge-warning';
  return 'mis-badge mis-badge-info';
};

const UserTable: React.FC<Props> = ({ users, branches, departments, modules, loading, onEditUser, onDeleteUser, onToggleBlock }) => {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedUserId(prev => (prev === id ? null : id));
  };

  const renderDetailsRow = (user: User) => {
    const userBranch = branches.find(b => b.id === user.branch_id);
    const userDept = departments.find(d => d.id === user.department_id);
    const userModules = modules.filter(m => user.allowed_modules?.includes(m.id));
    return (
      <tr key={`${user.id}-details`} className="bg-black/20">
        <td colSpan={3} className="px-4 sm:px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="mis-card p-4">
              <span className="mis-label">Branch</span>
              <span className="font-semibold text-base block mt-1" style={{ color: 'var(--text-primary)' }}>
                {userBranch?.name || '—'}
              </span>
            </div>
            <div className="mis-card p-4">
              <span className="mis-label">Department</span>
              <span className="font-semibold text-base block mt-1" style={{ color: 'var(--text-primary)' }}>
                {userDept?.name || '—'}
              </span>
            </div>
            <div className="mis-card p-4 md:col-span-2 lg:col-span-1">
              <span className="mis-label">Module Access</span>
              {userModules.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5 list-none p-0 m-0">
                  {userModules.map(m => (
                    <li key={m.id} className="mis-badge mis-badge-info">{m.name}</li>
                  ))}
                </ul>
              ) : (
                <span className="italic text-sm mt-1 block" style={{ color: 'var(--text-muted)' }}>No modules assigned</span>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="mis-table">
        <thead>
          <tr>
            <th className="mis-th-user">User</th>
            <th className="mis-th-role">Role</th>
            <th className="mis-th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <React.Fragment key={u.id}>
              <tr
                className="cursor-pointer"
                onClick={() => toggleExpand(u.id)}
              >
                <td className="mis-td-user">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {u.full_name || 'Unnamed User'}
                    </span>
                    {u.status === 'blocked' && (
                      <span className="mis-badge mis-badge-blocked" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}>
                        Blocked
                      </span>
                    )}
                  </div>
                  <span className="text-sm block mt-0.5" style={{ color: 'var(--text-secondary)' }}>{u.email}</span>
                </td>
                <td className="mis-td-role">
                  <span className={roleBadgeClass(u.role)}>{u.role.replace('_', ' ')}</span>
                </td>
                <td className="mis-td-actions">
                  <div className="mis-actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onEditUser(u)}
                      className="mis-icon-btn"
                      title="Edit User"
                      disabled={loading}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleBlock(u)}
                      className="mis-icon-btn"
                      title={u.status === 'blocked' ? 'Unblock User' : 'Block User'}
                      disabled={loading}
                    >
                      {u.status === 'blocked' ? '🔓' : '🚫'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteUser(u)}
                      className="mis-icon-btn danger"
                      title="Delete User"
                      disabled={loading}
                    >
                      🗑️
                    </button>
                    <span
                      className="mis-icon-btn ml-1"
                      style={{ transform: expandedUserId === u.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      aria-hidden
                    >
                      ⌄
                    </span>
                  </div>
                </td>
              </tr>
              {expandedUserId === u.id && renderDetailsRow(u)}
            </React.Fragment>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={3} className="mis-empty">No users found. Create one to get started.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
