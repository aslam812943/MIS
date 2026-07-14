import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { orgService } from '../services/org.service';
import type { Branch, Department, Module, User } from '../services/org.service';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../types/confirm.types';
import DashboardLayout from '../components/layout/DashboardLayout';
import UserTable from '../components/admin/UserTable';
import ConfirmModal from '../components/common/ConfirmModal';
import AuditLogsTab from '../components/admin/AuditLogsTab';

// Roles that operate org-wide rather than belonging to one business
// department (matches the isAdminOrMgmt check every department backend uses
// to grant these roles multi-branch/multi-department access). A Department
// selection isn't meaningful for them, so the field is hidden and not
// required for these roles.
const DEPARTMENT_OPTIONAL_ROLES = ['admin', 'hr', 'ceo', 'managing_director', 'director', 'executive'];
const isOrgWideRole = (role: string) => DEPARTMENT_OPTIONAL_ROLES.includes(role);

// Mirrors the backend's UserService validation so obviously-invalid input
// is caught immediately instead of round-tripping to the server first.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;
const MIN_PASSWORD_LENGTH = 4;

/**
 * Admin Panel Page for managing organizational entities.
 */
const AdminPanelPage: React.FC = () => {
  const [mainTab, setMainTab] = useState<'management' | 'audit'>('management');
  const [listTab, setListTab] = useState<'users' | 'branches' | 'departments' | 'modules'>('users');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [loading, setLoading] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // User Management state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [filterDeptId, setFilterDeptId] = useState('');

  // Resignation state
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);
  const [resigningUser, setResigningUser] = useState<User | null>(null);
  const [resignationData, setResignationData] = useState({
    resignation_date: '',
    resignation_reason: '',
    last_working_date: ''
  });

  const [userData, setUserData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'employee',
    branch_id: '',
    department_id: '',
    allowed_modules: [] as string[],
    employee_id: '',
    joining_date: '',
    phone_number: '',
    status: 'active' as 'active' | 'blocked' | 'resigned'
  });

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bData, dData, mData, uData] = await Promise.all([
        orgService.getBranches(),
        orgService.getDepartments(),
        orgService.getModules(),
        orgService.getUsers()
      ]);
      setBranches(bData);
      setDepartments(dData);
      setModules(mData);
      setUsers(uData);
    } catch (error: unknown) {
      let message = 'Failed to load data.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      toast.error('Branch name cannot be empty.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Creating branch...');
    try {
      await orgService.addBranch(newBranchName);
      toast.success(`Branch "${newBranchName.trim()}" created successfully.`, { id: toastId });
      setNewBranchName('');
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to add branch.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBranch = async (id: string) => {
    if (!editingName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Updating branch...');
    try {
      await orgService.updateBranch(id, editingName);
      toast.success(`Branch updated to "${editingName.trim()}".`, { id: toastId });
      setEditingId(null);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update branch.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = (branch: Branch) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Branch',
      message: `Delete branch "${branch.name}"? This action cannot be undone. It will be blocked if the branch still has any assigned users or department records.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const toastId = toast.loading('Deleting branch...');
        setLoading(true);
        try {
          await orgService.deleteBranch(branch.id);
          toast.success(`Branch "${branch.name}" deleted successfully.`, { id: toastId });
          fetchData();
        } catch (error: unknown) {
          let message = 'Failed to delete branch.';
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          toast.error(message, { id: toastId });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      toast.error('Department name cannot be empty.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Creating department...');
    try {
      await orgService.addDepartment(newDeptName);
      toast.success(`Department "${newDeptName.trim()}" created successfully.`, { id: toastId });
      setNewDeptName('');
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to add department.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDept = async (id: string) => {
    if (!editingName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Updating department...');
    try {
      await orgService.updateDepartment(id, editingName);
      toast.success(`Department updated to "${editingName.trim()}".`, { id: toastId });
      setEditingId(null);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update department.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDept = (dept: Department) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Department',
      message: `Delete department "${dept.name}"? This action cannot be undone. It will be blocked if the department still has any assigned users.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const toastId = toast.loading('Deleting department...');
        setLoading(true);
        try {
          await orgService.deleteDepartment(dept.id);
          fetchData();
          toast.success(`Department "${dept.name}" deleted successfully.`, { id: toastId });
        } catch (error: unknown) {
          let message = 'Failed to delete department.';
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          toast.error(message, { id: toastId });
        } finally {
          setLoading(false);
        }
      },
    });
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
      setUserData({
        full_name: '',
        email: '',
        password: '',
        role: 'employee',
        branch_id: '',
        department_id: '',
        allowed_modules: [],
        employee_id: '',
        joining_date: '',
        phone_number: '',
        status: 'active'
      });
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to create user.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    const displayName = user.full_name?.trim() || user.email;
    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: `Permanently delete "${displayName}"? They will lose all portal access and data tied to this account.`,
      confirmLabel: 'Delete User',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const toastId = toast.loading('Deleting user...');
        setLoading(true);
        try {
          await orgService.deleteUser(user.id);
          toast.success(`User "${displayName}" deleted successfully.`, { id: toastId });
          fetchData();
        } catch (error: unknown) {
          let message = 'Failed to delete user.';
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          toast.error(message, { id: toastId });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleToggleBlockUser = (user: User) => {
    const displayName = user.full_name?.trim() || user.email;
    const isBlocked = user.status === 'blocked';
    setConfirmModal({
      isOpen: true,
      title: isBlocked ? 'Unblock User' : 'Block User',
      message: isBlocked
        ? `Allow "${displayName}" to sign in and use the portal again?`
        : `Block "${displayName}"? They will not be able to sign in until you unblock them.`,
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
            isBlocked
              ? `"${displayName}" has been unblocked successfully.`
              : `"${displayName}" has been blocked successfully.`,
            { id: toastId }
          );
          fetchData();
        } catch (error: unknown) {
          let message = 'Failed to update user status.';
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          toast.error(message, { id: toastId });
        } finally {
          setLoading(false);
        }
      },
    });
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
      const updatePayload = { ...userData };
      if (!updatePayload.password) delete (updatePayload as any).password;

      await orgService.updateUser(editingId, updatePayload as any);
      toast.success(`User "${userData.full_name}" updated successfully.`, { id: toastId });
      setIsUserModalOpen(false);
      setIsEditingUser(false);
      setEditingId(null);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update user.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
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
        last_working_date: resignationData.last_working_date
      });
      
      toast.success(`Employee "${resigningUser.full_name}" marked as resigned.`, { id: toastId });
      setIsResignModalOpen(false);
      setResigningUser(null);
      setResignationData({
        resignation_date: '',
        resignation_reason: '',
        last_working_date: ''
      });
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to record resignation.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (u.full_name || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.employee_id || '').toLowerCase().includes(query);
      
    const matchesBranch = !filterBranchId || u.branch_id === filterBranchId;
    const matchesDept = !filterDeptId || u.department_id === filterDeptId;
    
    return matchesSearch && matchesBranch && matchesDept;
  });

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in mis-admin-page">


        {/* ── Page Header ───────────────────────────────── */}
        <header className="mis-page-header">
          <div className="mis-page-header-row mb-5">
            <div className="mis-page-header" style={{ marginBottom: 0 }}>
              <h1 className="mis-page-title">Admin Panel</h1>
              <p className="mis-page-desc">Manage organisation structure, users, and review system activity.</p>
            </div>
            {mainTab === 'management' && (
              <button
                type="button"
                onClick={() => {
                  setUserData({ full_name: '', email: '', password: '', role: 'employee', branch_id: '', department_id: '', allowed_modules: [], employee_id: '', joining_date: '', phone_number: '', status: 'active' });
                  setEditingId(null);
                  setIsEditingUser(false);
                  setIsUserModalOpen(true);
                }}
                className="mis-btn mis-btn-primary w-full sm:w-auto justify-center"
              >
                <span>+</span> Add User
              </button>
            )}
          </div>

          <div className="mis-tabs flex-wrap">
            <button
              id="tab-management"
              type="button"
              onClick={() => setMainTab('management')}
              className={`mis-tab ${mainTab === 'management' ? 'active' : ''}`}
            >
              Management
            </button>
            <button
              id="tab-audit"
              type="button"
              onClick={() => setMainTab('audit')}
              className={`mis-tab ${mainTab === 'audit' ? 'active' : ''}`}
            >
              Audit Logs
            </button>
          </div>
        </header>

        {/* ── Audit Logs Tab ─────────────────────────────── */}
        {mainTab === 'audit' && <AuditLogsTab />}

        {/* ── Management Tab ─────────────────────────────── */}
        {mainTab === 'management' && (
          <div className="flex flex-col gap-8 mb-10">
            {/* Quick Add Forms Row */}
            <div className="mis-admin-quick-add">
              <div className="mis-card p-5 sm:p-6">
                <h3 className="mis-label mb-4">Add Branch</h3>
                <form onSubmit={handleAddBranch}>
                  <input
                    type="text"
                    placeholder="Branch name (e.g. London)"
                    className="mis-input w-full"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading} className="mis-btn mis-btn-primary w-full justify-center">Create Branch</button>
                </form>
              </div>

              <div className="mis-card p-5 sm:p-6">
                <h3 className="mis-label mb-4">Add Department</h3>
                <form onSubmit={handleAddDept}>
                  <input
                    type="text"
                    placeholder="Dept name (e.g. IT)"
                    className="mis-input w-full"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading} className="mis-btn mis-btn-primary w-full justify-center">Create Dept</button>
                </form>
              </div>
            </div>

            {/* Main Data Section */}
            <div className="mis-card overflow-hidden">
              <div className="flex flex-wrap gap-1 p-3 border-b overflow-x-auto mis-panel-inset-soft" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.25)' }}>
                {['users', 'branches', 'departments'].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setListTab(tab as any)}
                    className={`mis-module-tab capitalize ${listTab === tab ? 'active' : ''}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              <div className="p-0">
                {listTab === 'users' && (
                  <div className="flex flex-col gap-4">
                    <div className="px-4 pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
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
                      
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          className="mis-select text-xs py-1.5 px-3"
                          value={filterBranchId}
                          onChange={(e) => setFilterBranchId(e.target.value)}
                          style={{ minWidth: '150px' }}
                        >
                          <option value="">All Branches</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>

                        <select
                          className="mis-select text-xs py-1.5 px-3"
                          value={filterDeptId}
                          onChange={(e) => setFilterDeptId(e.target.value)}
                          style={{ minWidth: '150px' }}
                        >
                          <option value="">All Departments</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <UserTable 
                      users={filteredUsers} branches={branches} departments={departments} modules={modules} 
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
                          status: u.status || 'active'
                        });
                        setEditingId(u.id);
                        setIsEditingUser(true);
                        setIsUserModalOpen(true);
                      }}
                      onDeleteUser={handleDeleteUser}
                      onToggleBlock={handleToggleBlockUser}
                      onMarkResigned={(u) => {
                        setResigningUser(u);
                        setIsResignModalOpen(true);
                      }}
                    />
                  </div>
                )}

                {listTab === 'branches' && (
                  <ul className="list-none p-0 m-0">
                    {branches.map(b => (
                      <li key={b.id} className="mis-list-row">
                        {editingId === b.id ? (
                          <div className="flex flex-wrap gap-2 w-full max-w-lg">
                            <input
                              className="mis-input flex-1 min-w-[10rem]"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              autoFocus
                            />
                            <button type="button" className="mis-btn mis-btn-primary mis-btn-sm" onClick={() => handleUpdateBranch(b.id)}>Save</button>
                            <button type="button" className="mis-btn mis-btn-ghost mis-btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{b.name}</span>
                            <div className="flex gap-1">
                              <button type="button" className="mis-icon-btn" onClick={() => { setEditingId(b.id); setEditingName(b.name); }}>✏️</button>
                              <button type="button" className="mis-icon-btn danger" onClick={() => handleDeleteBranch(b)}>🗑️</button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                    {branches.length === 0 && <li className="mis-empty">No branches found.</li>}
                  </ul>
                )}

                {listTab === 'departments' && (
                  <ul className="list-none p-0 m-0">
                    {departments.map(d => (
                      <li key={d.id} className="mis-list-row">
                        {editingId === d.id ? (
                          <div className="flex flex-wrap gap-2 w-full max-w-lg">
                            <input
                              className="mis-input flex-1 min-w-[10rem]"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              autoFocus
                            />
                            <button type="button" className="mis-btn mis-btn-primary mis-btn-sm" onClick={() => handleUpdateDept(d.id)}>Save</button>
                            <button type="button" className="mis-btn mis-btn-ghost mis-btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                            <div className="flex gap-1">
                              <button type="button" className="mis-icon-btn" onClick={() => { setEditingId(d.id); setEditingName(d.name); }}>✏️</button>
                              <button type="button" className="mis-icon-btn danger" onClick={() => handleDeleteDept(d)}>🗑️</button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                    {departments.length === 0 && <li className="mis-empty">No departments found.</li>}
                  </ul>
                )}

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add New User Modal */}
      {isUserModalOpen && (
        <div className="mis-modal-backdrop">
          <div className="mis-modal max-w-xl">
            <div className="mis-modal-header">
              <div>
                <h2 className="text-lg font-bold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
                  {isEditingUser ? 'Edit User Profile' : 'Add New User'}
                </h2>
                <p className="text-xs m-0" style={{ color: 'var(--text-secondary)' }}>
                  {isEditingUser ? 'Update account details and permissions.' : 'Create an account and assign module permissions.'}
                </p>
              </div>
              <button type="button" className="mis-icon-btn" onClick={() => { setIsUserModalOpen(false); setIsEditingUser(false); }} aria-label="Close">✕</button>
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
                        placeholder="e.g. +91 98765 43210"
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
                          const nextRole = e.target.value;
                          setUserData({
                            ...userData,
                            role: nextRole,
                            // Org-wide roles (CEO, admin, etc.) don't belong to one
                            // department — clear a stale selection made before the
                            // role was switched, so it can't be silently submitted.
                            department_id: isOrgWideRole(nextRole) ? '' : userData.department_id,
                          });
                        }}
                      >
                        <option value="admin">Administrator</option>
                        <option value="hr">HR Manager</option>
                        <option value="ceo">CEO</option>
                        <option value="managing_director">Managing Director</option>
                        <option value="director">Director</option>
                        <option value="executive">Executive</option>
                        <option value="hod">Dept. Head (HOD)</option>
                        <option value="regional_manager">Regional Manager</option>
                        <option value="employee">Branch Employee</option>
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
              <button type="button" onClick={() => setIsUserModalOpen(false)} className="mis-btn mis-btn-ghost flex-1 justify-center">
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

      {/* Resignation Modal */}
      {isResignModalOpen && resigningUser && (
        <div className="mis-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="mis-modal max-w-md">
            <div className="mis-modal-header">
              <div>
                <h2 className="text-lg font-bold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
                  Mark as Resigned
                </h2>
                <p className="text-xs m-0" style={{ color: 'var(--text-secondary)' }}>
                  Enter resignation details for {resigningUser.full_name || resigningUser.email}.
                </p>
              </div>
              <button type="button" className="mis-icon-btn" onClick={() => { setIsResignModalOpen(false); setResigningUser(null); }}>✕</button>
            </div>
            
            <form onSubmit={handleSaveResignation}>
              <div className="mis-modal-body space-y-4">
                <div className="mis-field">
                  <label className="mis-label">Resignation Date *</label>
                  <input
                    type="date"
                    className="mis-input"
                    required
                    value={resignationData.resignation_date}
                    onChange={(e) => setResignationData({ ...resignationData, resignation_date: e.target.value })}
                  />
                </div>

                <div className="mis-field">
                  <label className="mis-label">Last Working Date *</label>
                  <input
                    type="date"
                    className="mis-input"
                    required
                    value={resignationData.last_working_date}
                    onChange={(e) => setResignationData({ ...resignationData, last_working_date: e.target.value })}
                  />
                </div>

                <div className="mis-field">
                  <label className="mis-label">Reason for Resignation *</label>
                  <textarea
                    className="mis-input w-full min-h-[80px] py-2"
                    placeholder="Provide details about resignation..."
                    required
                    value={resignationData.resignation_reason}
                    onChange={(e) => setResignationData({ ...resignationData, resignation_reason: e.target.value })}
                  />
                </div>
              </div>

              <div className="mis-modal-footer">
                <button type="button" onClick={() => { setIsResignModalOpen(false); setResigningUser(null); }} className="mis-btn mis-btn-ghost flex-1 justify-center">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="mis-btn mis-btn-primary flex-[2] justify-center"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                >
                  {loading ? 'Saving...' : 'Confirm Resignation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminPanelPage;
