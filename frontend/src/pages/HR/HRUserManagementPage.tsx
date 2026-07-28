import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { orgService } from '../../services/org.service';
import type { Branch, Department, User } from '../../services/org.service';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';
import DashboardLayout from '../../components/layout/DashboardLayout';
import UserTable from '../../components/admin/UserTable';
import ConfirmModal from '../../components/common/ConfirmModal';

// HR may create/manage day-to-day workforce accounts, but never the
// leadership tier (admin/CEO/MD/director/executive) — mirrors the backend's
// LEADERSHIP_ROLES check in UserService.createUser/updateUser, which throws
// "Access denied" if a non-admin caller submits one of these. Keeping the
// dropdown scoped to what HR can actually save avoids a round-trip just to
// find out the role choice was rejected.
const HR_ASSIGNABLE_ROLES: { value: User['role']; label: string }[] = [
  { value: 'employee', label: 'Branch Employee' },
  { value: 'hod', label: 'Dept. Head (HOD)' },
  { value: 'regional_manager', label: 'Regional Manager' },
  { value: 'hr', label: 'HR Manager' },
];

const DEPARTMENT_OPTIONAL_ROLES = ['hr'];
const isOrgWideRole = (role: string) => DEPARTMENT_OPTIONAL_ROLES.includes(role);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const MIN_PASSWORD_LENGTH = 4;

const INITIAL_USER_FORM = {
  full_name: '',
  email: '',
  password: '',
  role: 'employee' as User['role'],
  branch_id: '',
  department_id: '',
  allowed_modules: [] as string[],
  employee_id: '',
  joining_date: '',
  phone_number: '',
  status: 'active' as 'active' | 'blocked' | 'resigned',
};

/**
 * HR-scoped user management — lets HR create and maintain day-to-day
 * employee accounts without the full Admin Panel (org structure, audit
 * logs, dashboard permissions, leadership accounts). Account deletion and
 * leadership-tier roles remain admin-only, enforced server-side.
 */
const HRUserManagementPage: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isResignModalOpen, setIsResignModalOpen] = useState(false);
  const [resigningUser, setResigningUser] = useState<User | null>(null);
  const [resignationData, setResignationData] = useState({
    resignation_date: '',
    resignation_reason: '',
    last_working_date: '',
  });

  const [userData, setUserData] = useState(INITIAL_USER_FORM);
  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  useEffect(() => {
    fetchData();
  }, []);

  const errorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error) && error.response?.data?.message) return error.response.data.message;
    if (error instanceof Error) return error.message;
    return fallback;
  };

  const fetchData = async () => {
    try {
      const [bData, dData, uData] = await Promise.all([
        orgService.getBranches(),
        orgService.getDepartments(),
        orgService.getUsers(),
      ]);
      setBranches(bData);
      setDepartments(dData);
      // HR manages the day-to-day workforce, not leadership accounts —
      // those stay in the Admin Panel's user list instead of appearing
      // here (and out of scope for the create-user form's own role options).
      setUsers((uData as User[]).filter(u => !['admin', 'ceo', 'managing_director', 'director', 'executive'].includes(u.role)));
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to load data.'));
    }
  };

  const resetUserForm = () => {
    setUserData(INITIAL_USER_FORM);
    setEditingId(null);
    setIsEditingUser(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const deptRequired = !isOrgWideRole(userData.role);
    if (!userData.full_name || !userData.email || !userData.password || !userData.phone_number || !userData.branch_id || (deptRequired && !userData.department_id) || !userData.joining_date) {
      toast.error(
        deptRequired
          ? 'All fields (Name, Email, Password, Phone, Branch, Department, Joining Date) are required.'
          : 'All fields (Name, Email, Password, Phone, Branch, Joining Date) are required.'
      );
      return;
    }
    if (!EMAIL_REGEX.test(userData.email.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (userData.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    if (!PHONE_REGEX.test(userData.phone_number.trim())) {
      toast.error('Phone number must be exactly 10 digits.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Creating user account...');
    try {
      await orgService.createUser(userData as any);
      toast.success(`User "${userData.full_name}" created successfully.`, { id: toastId });
      setIsUserModalOpen(false);
      resetUserForm();
      fetchData();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to create user.'), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const deptRequired = !isOrgWideRole(userData.role);
    if (!userData.full_name || !userData.email || !userData.phone_number || !userData.branch_id || (deptRequired && !userData.department_id) || !userData.joining_date) {
      toast.error('All fields except password are required.');
      return;
    }
    if (!EMAIL_REGEX.test(userData.email.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!PHONE_REGEX.test(userData.phone_number.trim())) {
      toast.error('Phone number must be exactly 10 digits.');
      return;
    }
    if (userData.password && userData.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Updating user...');
    try {
      const updatePayload: any = { ...userData };
      if (!updatePayload.password) delete updatePayload.password;

      await orgService.updateUser(editingId, updatePayload);
      toast.success(`User "${userData.full_name}" updated successfully.`, { id: toastId });
      setIsUserModalOpen(false);
      resetUserForm();
      fetchData();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to update user.'), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlockUser = (user: User) => {
    const displayName = user.full_name?.trim() || user.email;
    const isBlocked = user.status === 'blocked';
    setConfirmModal({
      isOpen: true,
      title: isBlocked ? 'Unblock User' : 'Block User',
      message: isBlocked
        ? `Allow "${displayName}" to sign in and use the portal again?`
        : `Block "${displayName}"? They will not be able to sign in until unblocked.`,
      confirmLabel: isBlocked ? 'Unblock' : 'Block User',
      cancelLabel: 'Cancel',
      isDanger: !isBlocked,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const newStatus = isBlocked ? 'active' : 'blocked';
        const toastId = toast.loading(isBlocked ? 'Unblocking user...' : 'Blocking user...');
        setLoading(true);
        try {
          await orgService.updateUserStatus(user.id, newStatus);
          toast.success(
            isBlocked ? `"${displayName}" has been unblocked.` : `"${displayName}" has been blocked.`,
            { id: toastId }
          );
          fetchData();
        } catch (error: unknown) {
          toast.error(errorMessage(error, 'Failed to update user status.'), { id: toastId });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleSaveResignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resigningUser) return;
    if (!resignationData.resignation_date || !resignationData.resignation_reason || !resignationData.last_working_date) {
      toast.error('All resignation fields are required.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Marking employee as resigned...');
    try {
      await orgService.updateUser(resigningUser.id, {
        status: 'resigned',
        resignation_date: resignationData.resignation_date,
        resignation_reason: resignationData.resignation_reason,
        last_working_date: resignationData.last_working_date,
      });
      toast.success(`Employee "${resigningUser.full_name}" marked as resigned.`, { id: toastId });
      setIsResignModalOpen(false);
      setResigningUser(null);
      setResignationData({ resignation_date: '', resignation_reason: '', last_working_date: '' });
      fetchData();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to record resignation.'), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase().trim();
    return !query ||
      (u.full_name || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.employee_id || '').toLowerCase().includes(query);
  });

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in mis-admin-page">
        <header className="mis-page-header">
          <div className="mis-page-header-row mb-5">
            <div className="mis-page-header" style={{ marginBottom: 0 }}>
              <h1 className="mis-page-title">Create User</h1>
              <p className="mis-page-desc">Create and manage employee, HOD, regional manager, and HR accounts.</p>
            </div>
            <button
              type="button"
              className="mis-btn mis-btn-primary"
              onClick={() => { resetUserForm(); setIsUserModalOpen(true); }}
            >
              + Add New User
            </button>
          </div>
        </header>

        <div className="mis-card overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Search employee by name, email, or ID..."
                className="mis-input w-full pl-9 pr-4 py-2"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-50">🔍</span>
            </div>
          </div>
          <UserTable
            users={filteredUsers}
            branches={branches}
            departments={departments}
            loading={loading}
            onEditUser={(u) => {
              setUserData({
                full_name: u.full_name || '',
                email: u.email,
                password: '',
                role: u.role,
                branch_id: u.branch_id || '',
                department_id: u.department_id || '',
                allowed_modules: u.allowed_modules || [],
                employee_id: u.employee_id || '',
                joining_date: u.joining_date || '',
                phone_number: u.phone_number || '',
                status: u.status || 'active',
              });
              setEditingId(u.id);
              setIsEditingUser(true);
              setIsUserModalOpen(true);
            }}
            onToggleBlock={handleToggleBlockUser}
            onMarkResigned={(u) => {
              setResigningUser(u);
              setIsResignModalOpen(true);
            }}
          />
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {isUserModalOpen && (
        <div className="mis-modal-backdrop">
          <div className="mis-modal max-w-xl">
            <div className="mis-modal-header">
              <div>
                <h2 className="text-lg font-bold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
                  {isEditingUser ? 'Edit User Profile' : 'Add New User'}
                </h2>
                <p className="text-xs m-0" style={{ color: 'var(--text-secondary)' }}>
                  {isEditingUser ? 'Update account details.' : 'Create an employee, HOD, regional manager, or HR account.'}
                </p>
              </div>
              <button type="button" className="mis-icon-btn" onClick={() => { setIsUserModalOpen(false); resetUserForm(); }} aria-label="Close">✕</button>
            </div>

            <div className="mis-modal-body max-h-[60vh]">
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">Employee ID (Auto-generated)</label>
                    <input
                      placeholder="(Auto-generated)"
                      className="mis-input"
                      value={isEditingUser ? userData.employee_id : '(Auto-generated)'}
                      disabled
                    />
                  </div>
                  <div className="mis-field">
                    <label className="mis-label">Full Name *</label>
                    <input
                      placeholder="e.g. John Doe"
                      className="mis-input"
                      value={userData.full_name}
                      onChange={(e) => setUserData({ ...userData, full_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">Email Address *</label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      className="mis-input"
                      value={userData.email}
                      onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                    />
                  </div>
                  <div className="mis-field">
                    <label className="mis-label">Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      className="mis-input"
                      value={userData.phone_number}
                      onChange={(e) => setUserData({ ...userData, phone_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">
                      {isEditingUser ? 'New Password (Optional)' : 'Initial Password *'}
                    </label>
                    <input
                      type="password"
                      placeholder={isEditingUser ? 'Leave blank to keep current' : `Min. ${MIN_PASSWORD_LENGTH} characters`}
                      className="mis-input"
                      value={userData.password}
                      onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                    />
                  </div>
                  <div className="mis-field">
                    <label className="mis-label">Joining Date *</label>
                    <input
                      type="date"
                      className="mis-input"
                      value={userData.joining_date}
                      onChange={(e) => setUserData({ ...userData, joining_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="mis-field">
                    <label className="mis-label">Role</label>
                    <select
                      className="mis-select"
                      value={userData.role}
                      onChange={(e) => {
                        const nextRole = e.target.value as User['role'];
                        setUserData({
                          ...userData,
                          role: nextRole,
                          department_id: isOrgWideRole(nextRole) ? '' : userData.department_id,
                        });
                      }}
                    >
                      {HR_ASSIGNABLE_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mis-field">
                    <label className="mis-label">Branch</label>
                    <select
                      className="mis-select"
                      value={userData.branch_id}
                      onChange={(e) => setUserData({ ...userData, branch_id: e.target.value })}
                    >
                      <option value="">— None —</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                {isOrgWideRole(userData.role) ? (
                  <p className="mis-alert mis-alert-info m-0 text-xs">
                    Department isn't required for this role — it operates across the whole organisation rather than one department.
                  </p>
                ) : (
                  <div className="mis-field">
                    <label className="mis-label">Department *</label>
                    <select
                      className="mis-select"
                      value={userData.department_id}
                      onChange={(e) => setUserData({ ...userData, department_id: e.target.value })}
                    >
                      <option value="">— None —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="mis-modal-footer">
              <button type="button" onClick={() => { setIsUserModalOpen(false); resetUserForm(); }} className="mis-btn mis-btn-ghost flex-1 justify-center">
                Cancel
              </button>
              <button
                type="button"
                onClick={isEditingUser ? handleEditUser : handleAddUser}
                disabled={loading}
                className="mis-btn mis-btn-primary flex-[2] justify-center"
              >
                {loading ? (isEditingUser ? 'Updating...' : 'Creating...') : (isEditingUser ? 'Save Changes' : 'Create User Account')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resignation Modal */}
      {isResignModalOpen && resigningUser && (
        <div className="mis-modal-backdrop">
          <div className="mis-modal max-w-md">
            <div className="mis-modal-header">
              <h2 className="text-lg font-bold m-0" style={{ color: 'var(--text-primary)' }}>Mark as Resigned</h2>
              <button type="button" className="mis-icon-btn" onClick={() => { setIsResignModalOpen(false); setResigningUser(null); }}>✕</button>
            </div>
            <div className="mis-modal-body">
              <form id="resign-form" onSubmit={handleSaveResignation} className="space-y-4">
                <div className="mis-field">
                  <label className="mis-label">Resignation Date *</label>
                  <input
                    type="date"
                    className="mis-input"
                    value={resignationData.resignation_date}
                    onChange={(e) => setResignationData({ ...resignationData, resignation_date: e.target.value })}
                  />
                </div>
                <div className="mis-field">
                  <label className="mis-label">Last Working Date *</label>
                  <input
                    type="date"
                    className="mis-input"
                    value={resignationData.last_working_date}
                    onChange={(e) => setResignationData({ ...resignationData, last_working_date: e.target.value })}
                  />
                </div>
                <div className="mis-field">
                  <label className="mis-label">Reason *</label>
                  <textarea
                    className="mis-input"
                    rows={3}
                    value={resignationData.resignation_reason}
                    onChange={(e) => setResignationData({ ...resignationData, resignation_reason: e.target.value })}
                  />
                </div>
              </form>
            </div>
            <div className="mis-modal-footer">
              <button type="button" onClick={() => { setIsResignModalOpen(false); setResigningUser(null); }} className="mis-btn mis-btn-ghost flex-1 justify-center">
                Cancel
              </button>
              <button type="submit" form="resign-form" disabled={loading} className="mis-btn mis-btn-primary flex-[2] justify-center">
                {loading ? 'Saving...' : 'Confirm Resignation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </DashboardLayout>
  );
};

export default HRUserManagementPage;
