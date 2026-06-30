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
  const [newModuleName, setNewModuleName] = useState('');
  const [loading, setLoading] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingFields, setEditingFields] = useState<{ name: string; type: 'text' | 'number' | 'date' }[]>([]);

  // Module fields state
  const [newModuleFields, setNewModuleFields] = useState<{ name: string; type: 'text' | 'number' | 'date' }[]>([]);

  // User Management state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userTab, setUserTab] = useState<'details' | 'modules'>('details');
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
      message: `Delete branch "${branch.name}"? This action cannot be undone.`,
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
      message: `Delete department "${dept.name}"? This action cannot be undone.`,
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

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim()) {
      toast.error('Module name cannot be empty.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Creating module...');
    try {
      await orgService.addModule(newModuleName, newModuleFields);
      toast.success(`Module "${newModuleName.trim()}" created successfully.`, { id: toastId });
      setNewModuleName('');
      setNewModuleFields([]);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to add module.';
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

  const handleUpdateModule = async (id: string) => {
    if (!editingName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Saving module configuration...');
    try {
      await orgService.updateModule(id, editingName, editingFields);
      toast.success(`Module "${editingName.trim()}" updated successfully.`, { id: toastId });
      setEditingId(null);
      setEditingFields([]);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update module.';
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

  const handleDeleteModule = (mod: Module) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Module',
      message: `Delete module "${mod.name}"? All field configurations will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const toastId = toast.loading('Deleting module...');
        setLoading(true);
        try {
          await orgService.deleteModule(mod.id);
          fetchData();
          toast.success(`Module "${mod.name}" deleted successfully.`, { id: toastId });
        } catch (error: unknown) {
          let message = 'Failed to delete module.';
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
    if (!userData.full_name || !userData.email || !userData.password || !userData.phone_number || !userData.branch_id || !userData.department_id || !userData.joining_date) {
      toast.error('All fields (Name, Email, Password, Phone, Branch, Department, Joining Date) are required.');
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
    if (!userData.full_name || !userData.email || !userData.phone_number || !userData.branch_id || !userData.department_id || !userData.joining_date) {
      toast.error('All fields except password are required.');
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

  const handleRemoveModuleField = (idx: number, fieldName: string) => {
    const label = fieldName.trim() || 'this field';
    setConfirmModal({
      isOpen: true,
      title: 'Remove Field',
      message: `Remove "${label}" from the module configuration? You must save the module for this change to take effect.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: () => {
        setEditingFields((prev) => prev.filter((_, i) => i !== idx));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        toast.success(`Field "${label}" removed. Save configuration to apply.`);
      },
    });
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

              <div className="mis-card p-5 sm:p-6">
                <h3 className="mis-label mb-4">Add Module</h3>
                <form onSubmit={handleAddModule}>
                  <input
                    type="text"
                    placeholder="Module name (e.g. Inventory)"
                    className="mis-input w-full"
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    disabled={loading}
                  />
                  <button type="submit" disabled={loading} className="mis-btn mis-btn-primary w-full justify-center">Create Module</button>
                </form>
              </div>
            </div>

            {/* Main Data Section */}
            <div className="mis-card overflow-hidden">
              <div className="flex flex-wrap gap-1 p-3 border-b overflow-x-auto mis-panel-inset-soft" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.25)' }}>
                {['users', 'branches', 'departments', 'modules'].map(tab => (
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

                {listTab === 'modules' && (
                  <ul className="list-none p-0 m-0">
                    {modules.map(m => (
                      <li key={m.id} className="mis-list-row flex-col items-stretch">
                        <div className="flex flex-wrap justify-between items-center gap-3 w-full">
                          <div>
                            <span className="font-semibold text-lg block" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                            <span className="mis-badge mis-badge-info mt-1">{m.fields?.length || 0} fields</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className={`mis-btn mis-btn-sm ${editingId === m.id ? 'mis-btn-primary' : 'mis-btn-ghost'}`}
                              onClick={() => {
                                if (editingId === m.id) {
                                  setEditingId(null);
                                } else {
                                  setEditingId(m.id);
                                  setEditingName(m.name);
                                  setEditingFields(m.fields || []);
                                }
                              }}
                            >
                              Configure
                            </button>
                            <button type="button" className="mis-icon-btn danger" onClick={() => handleDeleteModule(m)}>🗑️</button>
                          </div>
                        </div>

                        {editingId === m.id && (
                          <div className="mt-4 p-5 w-full rounded-[var(--radius-lg)] mis-panel-inset" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border)' }}>
                            <div className="mb-5 mis-field">
                              <label className="mis-label">Module Name</label>
                              <input 
                                className="mis-input w-full max-w-md"
                                value={editingName} 
                                onChange={(e) => setEditingName(e.target.value)}
                                placeholder="Module Name"
                              />
                            </div>

                            <div className="mb-5">
                              <label className="mis-label mb-3 block">Input Fields</label>
                              <div className="space-y-3">
                                {editingFields.map((field, idx) => (
                                  <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end p-4 rounded-[var(--radius-md)]" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                                    <div className="w-full sm:flex-[2] mis-field">
                                      <span className="mis-label" style={{ fontSize: '0.65rem' }}>Label</span>
                                      <input 
                                        className="mis-input w-full py-2"
                                        placeholder="e.g. Amount" 
                                        value={field.name}
                                        onChange={(e) => {
                                          const updated = [...editingFields];
                                          updated[idx].name = e.target.value;
                                          setEditingFields(updated);
                                        }}
                                      />
                                    </div>
                                    <div className="w-full sm:flex-1 mis-field">
                                      <span className="mis-label" style={{ fontSize: '0.65rem' }}>Type</span>
                                      <select 
                                        className="mis-input w-full py-2"
                                        value={field.type}
                                        onChange={(e) => {
                                          const updated = [...editingFields];
                                          updated[idx].type = e.target.value as any;
                                          setEditingFields(updated);
                                        }}
                                      >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="date">Date</option>
                                      </select>
                                    </div>
                                    <button
                                      type="button"
                                      className="mis-icon-btn danger shrink-0"
                                      onClick={() => handleRemoveModuleField(idx, field.name)}
                                      aria-label={`Remove field ${field.name || idx + 1}`}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="mis-btn mis-btn-ghost mis-btn-sm mt-3"
                                onClick={() => setEditingFields([...editingFields, { name: '', type: 'text' }])}
                              >
                                + Add Field
                              </button>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2 pt-4 divider" style={{ borderTop: '1px solid var(--border)' }}>
                              <button type="button" className="mis-btn mis-btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                              <button type="button" className="mis-btn mis-btn-primary" onClick={() => handleUpdateModule(m.id)}>Save Configuration</button>
                            </div>
                          </div>
                        )}
                        {!editingId && m.fields && m.fields.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3 w-full">
                            {m.fields.map((f, i) => (
                              <span key={i} className="mis-chip">{f.name}</span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                    {modules.length === 0 && <li className="mis-empty">No modules found.</li>}
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

            <div className="mis-modal-tabs">
              <button
                type="button"
                onClick={() => setUserTab('details')}
                className={`mis-modal-tab ${userTab === 'details' ? 'active' : ''}`}
              >
                User Details
              </button>
              <button
                type="button"
                onClick={() => setUserTab('modules')}
                className={`mis-modal-tab ${userTab === 'modules' ? 'active' : ''}`}
              >
                Module Access ({userData.allowed_modules.length}/{modules.length})
              </button>
            </div>

            <div className="mis-modal-body max-h-[60vh]">
              {userTab === 'details' ? (
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
                        placeholder={isEditingUser ? 'Leave blank to keep current' : 'Min. 6 characters'}
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
                        onChange={(e) => setUserData({ ...userData, role: e.target.value })}
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
                  <div className="mis-field">
                    <label className="mis-label">Department</label>
                    <select
                      className="mis-select"
                      value={userData.department_id}
                      onChange={(e) => setUserData({ ...userData, department_id: e.target.value })}
                    >
                      <option value="">— None —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="mis-alert mis-alert-info m-0">
                    Select which modules this user may access for data entry.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {modules.map(m => (
                      <label
                        key={m.id}
                        className={`flex items-center justify-between p-4 rounded-[var(--radius-md)] border cursor-pointer transition-all ${
                          userData.allowed_modules.includes(m.id)
                            ? 'mis-badge-info'
                            : ''
                        }`}
                        style={
                          userData.allowed_modules.includes(m.id)
                            ? { background: 'var(--accent-bg)', borderColor: 'var(--border-accent)' }
                            : { background: 'var(--bg-hover)', borderColor: 'var(--border)' }
                        }
                      >
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-[#06b6d4]"
                          checked={userData.allowed_modules.includes(m.id)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...userData.allowed_modules, m.id]
                              : userData.allowed_modules.filter(id => id !== m.id);
                            setUserData({ ...userData, allowed_modules: updated });
                          }}
                        />
                      </label>
                    ))}
                    {modules.length === 0 && <p className="mis-empty py-8">No modules available. Create modules first.</p>}
                  </div>
                </div>
              )}
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
