import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { orgService } from '../services/org.service';
import type { Branch, Department, Module } from '../services/org.service';
import Sidebar from '../components/layout/Sidebar';
import ConfirmModal from '../components/common/ConfirmModal';

/**
 * Admin Panel Page for managing organizational entities.
 */
const AdminPanelPage: React.FC = () => {
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
  const [userData, setUserData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'employee',
    branch_id: '',
    department_id: '',
    allowed_modules: [] as string[]
  });

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

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
    try {
      await orgService.addBranch(newBranchName);
      toast.success('Branch added successfully!');
      setNewBranchName('');
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to add branch.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
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
    try {
      await orgService.updateBranch(id, editingName);
      toast.success('Branch updated successfully!');
      setEditingId(null);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update branch.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Branch',
      message: 'Are you sure you want to delete this branch? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        try {
          await orgService.deleteBranch(id);
          toast.success('Branch deleted successfully!');
          fetchData();
        } catch (error: unknown) {
          let message = 'Failed to delete branch.';
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          toast.error(message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      toast.error('Department name cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      await orgService.addDepartment(newDeptName);
      toast.success('Department added successfully!');
      setNewDeptName('');
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to add department.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
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
    try {
      await orgService.updateDepartment(id, editingName);
      toast.success('Department updated successfully!');
      setEditingId(null);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update department.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDept = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Department',
      message: 'Are you sure you want to delete this department? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        try {
          await orgService.deleteDepartment(id);
          fetchData();
          toast.success('Department deleted successfully!');
        } catch (error: unknown) {
          let message = 'Failed to delete department.';
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          toast.error(message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim()) {
      toast.error('Module name cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      await orgService.addModule(newModuleName, newModuleFields);
      toast.success('Module added successfully!');
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
      toast.error(message);
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
    try {
      await orgService.updateModule(id, editingName, editingFields);
      toast.success('Module updated successfully!');
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
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Module',
      message: 'Are you sure you want to delete this module? All associated configurations will be removed.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        try {
          await orgService.deleteModule(id);
          fetchData();
          toast.success('Module deleted successfully!');
        } catch (error: unknown) {
          let message = 'Failed to delete module.';
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          toast.error(message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData.full_name || !userData.email || !userData.password) {
      toast.error('Name, Email, and Password are required.');
      return;
    }
    setLoading(true);
    try {
      await orgService.createUser(userData as any);
      toast.success('User created and email sent successfully!');
      setIsUserModalOpen(false);
      setUserData({
        full_name: '',
        email: '',
        password: '',
        role: 'employee',
        branch_id: '',
        department_id: '',
        allowed_modules: []
      });
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to create user.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This will remove their access and profile permanently.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setLoading(true);
        try {
          await orgService.deleteUser(id);
          toast.success('User deleted successfully!');
          fetchData();
        } catch (error: unknown) {
          let message = 'Failed to delete user.';
          if (axios.isAxiosError(error) && error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error instanceof Error) {
            message = error.message;
          }
          toast.error(message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleUpdateUserStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    setLoading(true);
    try {
      await orgService.updateUserStatus(id, newStatus);
      toast.success(`User ${newStatus === 'blocked' ? 'blocked' : 'unblocked'} successfully!`);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update user status.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditUser = (u: any) => {
    setUserData({
      full_name: u.full_name || '',
      email: u.email || '',
      password: '', // Password not editable here
      role: u.role || 'employee',
      branch_id: u.branch_id || '',
      department_id: u.department_id || '',
      allowed_modules: u.allowed_modules || []
    });
    setEditingId(u.id);
    setIsEditingUser(true);
    setIsUserModalOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setLoading(true);
    try {
      // Don't send password if empty
      const updatePayload = { ...userData };
      if (!updatePayload.password) delete (updatePayload as any).password;
      
      await orgService.updateUser(editingId, updatePayload as any);
      toast.success('User updated successfully!');
      setIsUserModalOpen(false);
      setIsEditingUser(false);
      setEditingId(null);
      fetchData();
    } catch (error: unknown) {
      let message = 'Failed to update user.';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <Sidebar />
      <main className="flex-1 p-10 overflow-y-auto">
        <Toaster position="top-right" />
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">Admin Panel</h1>
            <p className="text-slate-400">Configure organizational branches, departments, modules, and user access.</p>
          </div>
          <button 
            onClick={() => {
              setUserData({
                full_name: '',
                email: '',
                password: '',
                role: 'employee',
                branch_id: '',
                department_id: '',
                allowed_modules: []
              });
              setEditingId(null);
              setIsEditingUser(false);
              setIsUserModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-3 font-bold flex items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-600/20"
          >
            <span>+</span> Add User
          </button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Branches Section */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold">🏢 Branches</h2>
            </div>
            <form onSubmit={handleAddBranch} className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="Enter branch name (e.g. London)"
                className="flex-1 bg-black/20 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                disabled={loading}
              />
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-3 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                disabled={loading}
              >
                Add Branch
              </button>
            </form>
            <ul className="space-y-3">
              {branches.map(b => (
                <li key={b.id} className="flex justify-between items-center p-4 bg-white/5 border border-slate-800 rounded-xl font-medium">
                  {editingId === b.id ? (
                    <div className="flex gap-2 w-full">
                      <input 
                        className="flex-1 bg-black/30 border border-indigo-500 rounded-lg px-3 py-1 text-white focus:outline-none"
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" onClick={() => handleUpdateBranch(b.id)}>✅</button>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" onClick={() => setEditingId(null)}>❌</button>
                    </div>
                  ) : (
                    <>
                      <span>{b.name}</span>
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-lg" onClick={() => { setEditingId(b.id); setEditingName(b.name); }}>✏️</button>
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-lg" onClick={() => handleDeleteBranch(b.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Departments Section */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold">🏢 Departments</h2>
            </div>
            <form onSubmit={handleAddDept} className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="Enter department (e.g. IT)"
                className="flex-1 bg-black/20 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                disabled={loading}
              />
              <button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-3 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                disabled={loading}
              >
                Add Dept
              </button>
            </form>
            <ul className="space-y-3">
              {departments.map(d => (
                <li key={d.id} className="flex justify-between items-center p-4 bg-white/5 border border-slate-800 rounded-xl font-medium">
                  {editingId === d.id ? (
                    <div className="flex gap-2 w-full">
                      <input 
                        className="flex-1 bg-black/30 border border-indigo-500 rounded-lg px-3 py-1 text-white focus:outline-none"
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" onClick={() => handleUpdateDept(d.id)}>✅</button>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" onClick={() => setEditingId(null)}>❌</button>
                    </div>
                  ) : (
                    <>
                      <span>{d.name}</span>
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-lg" onClick={() => { setEditingId(d.id); setEditingName(d.name); }}>✏️</button>
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-lg" onClick={() => handleDeleteDept(d.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Modules Section */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 xl:col-span-2">
            <div className="mb-6">
              <h2 className="text-xl font-bold">📦 Modules</h2>
            </div>
            <form onSubmit={handleAddModule} className="flex flex-col gap-6 mb-10">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter module name (e.g. Inventory)"
                  className="flex-1 bg-black/20 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  disabled={loading}
                />
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-6 py-3 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  disabled={loading}
                >
                  Add Module
                </button>
              </div>
              
              <div className="bg-black/20 p-6 rounded-3xl border border-slate-800 border-dashed transition-all hover:bg-black/30">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  Define Initial Fields
                </h4>
                <div className="space-y-3">
                  {newModuleFields.map((field, idx) => (
                    <div key={idx} className="flex gap-3 animate-in slide-in-from-left-2 duration-200">
                      <input 
                        placeholder="Field Label (e.g. Amount)" 
                        className="flex-[2] bg-black/30 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
                        value={field.name}
                        onChange={(e) => {
                          const updated = [...newModuleFields];
                          updated[idx].name = e.target.value;
                          setNewModuleFields(updated);
                        }}
                      />
                      <select 
                        className="flex-1 bg-black/30 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                        value={field.type}
                        onChange={(e) => {
                          const updated = [...newModuleFields];
                          updated[idx].type = e.target.value as any;
                          setNewModuleFields(updated);
                        }}
                      >
                        <option value="text">Text Input</option>
                        <option value="number">Numeric</option>
                        <option value="date">Date Picker</option>
                      </select>
                      <button 
                        type="button" 
                        className="p-2.5 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                        onClick={() => setNewModuleFields(newModuleFields.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  type="button" 
                  className="mt-4 text-sm font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors group"
                  onClick={() => setNewModuleFields([...newModuleFields, { name: '', type: 'text' }])}
                >
                  <span className="text-lg group-hover:scale-125 transition-transform">+</span> Add Field
                </button>
              </div>
            </form>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modules.map(m => (
                <li key={m.id} className="flex flex-col bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden transition-all hover:border-slate-700">
                  <div className="flex justify-between items-center p-5 bg-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📦</span>
                      <span className="font-bold text-lg">{m.name}</span>
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        {m.fields?.length || 0} fields
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${editingId === m.id ? 'bg-indigo-600 text-white' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white'}`}
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
                        ⚙️ Manage
                      </button>
                      <button 
                        className="p-1.5 hover:bg-red-400/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                        onClick={() => handleDeleteModule(m.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {editingId === m.id && (
                    <div className="p-6 bg-black/30 border-t border-slate-800 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Module Name</label>
                        <input 
                          className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          value={editingName} 
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Module Name"
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Input Fields</label>
                        </div>
                        
                        <div className="space-y-3">
                          {editingFields.map((field, idx) => (
                            <div key={idx} className="grid grid-cols-[2fr_1.5fr_auto] gap-3 items-center bg-white/5 p-4 rounded-xl border border-slate-800">
                              <div className="space-y-1.5">
                                <span className="text-[10px] text-slate-500 font-semibold">Label</span>
                                <input 
                                  className="w-full bg-black/40 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                  placeholder="e.g. Amount" 
                                  value={field.name}
                                  onChange={(e) => {
                                    const updated = [...editingFields];
                                    updated[idx].name = e.target.value;
                                    setEditingFields(updated);
                                  }}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-[10px] text-slate-500 font-semibold">Type</span>
                                <select 
                                  className="w-full bg-black/40 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                                className="mt-5 p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                onClick={() => setEditingFields(editingFields.filter((_, i) => i !== idx))}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <button 
                            type="button" 
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                            onClick={() => setEditingFields([...editingFields, { name: '', type: 'text' }])}
                          >
                            <span className="text-lg">+</span> Add New Field
                          </button>
                          <div className="flex items-center gap-4">
                            <button className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors" onClick={() => setEditingId(null)}>Cancel</button>
                            <button 
                              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                              onClick={() => handleUpdateModule(m.id)}
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!editingId && m.fields && m.fields.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-5 pt-0">
                      {m.fields.map((f, i) => (
                        <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-medium border border-slate-700">
                          {f.name}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Users Section */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 xl:col-span-2">
            <div className="mb-6">
              <h2 className="text-xl font-bold">👤 System Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-widest font-bold">
                    <th className="px-4 py-4">User</th>
                    <th className="px-4 py-4">Role</th>
                    <th className="px-4 py-4">Branch</th>
                    <th className="px-4 py-4">Department</th>
                    <th className="px-4 py-4">Access</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {users.map(u => (
                    <tr key={u.id} className="group hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{u.full_name || 'Unnamed User'}</span>
                            {u.status === 'blocked' && (
                              <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">
                                Blocked
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-[10px] px-2 py-1 rounded-full border uppercase font-bold tracking-tighter ${
                          u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          u.role === 'ceo' || u.role === 'managing_director' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          u.role === 'director' || u.role === 'executive' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          u.role === 'hod' || u.role === 'regional_manager' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-400">
                        {branches.find(b => b.id === u.branch_id)?.name || '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-400">
                        {departments.find(d => d.id === u.department_id)?.name || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {u.allowed_modules?.length ? u.allowed_modules.map((mid: string) => (
                            <span key={mid} className="text-[8px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-medium">
                              {modules.find(m => m.id === mid)?.name || 'Unknown'}
                            </span>
                          )) : <span className="text-[10px] text-slate-600 italic">No access</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2 transition-opacity">
                          <button 
                            onClick={() => handleOpenEditUser(u)}
                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                            title="Edit User"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => handleUpdateUserStatus(u.id, u.status || 'active')}
                            className={`p-2 rounded-lg transition-all ${u.status === 'blocked' ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-amber-400 hover:bg-amber-400/10'}`}
                            title={u.status === 'blocked' ? 'Unblock User' : 'Block User'}
                          >
                            {u.status === 'blocked' ? '🔓' : '🚫'}
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500 italic">No users found. Create one to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Add New User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <header className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{isEditingUser ? 'Edit User Profile' : 'Add New User'}</h2>
                <p className="text-xs text-slate-500">{isEditingUser ? 'Update account details and permissions.' : 'Create an account and assign module permissions.'}</p>
              </div>
              <button onClick={() => { setIsUserModalOpen(false); setIsEditingUser(false); }} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </header>

            <div className="flex border-b border-slate-800">
              <button 
                onClick={() => setUserTab('details')}
                className={`flex-1 py-4 text-sm font-bold transition-all ${userTab === 'details' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'}`}
              >
                👤 User Details
              </button>
              <button 
                onClick={() => setUserTab('modules')}
                className={`flex-1 py-4 text-sm font-bold transition-all ${userTab === 'modules' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'}`}
              >
                🔐 Module Access <span className="ml-1 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full">{userData.allowed_modules.length}/{modules.length}</span>
              </button>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto">
              {userTab === 'details' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name *</label>
                    <input 
                      placeholder="e.g. John Doe"
                      className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      value={userData.full_name}
                      onChange={(e) => setUserData({ ...userData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address *</label>
                    <input 
                      type="email"
                      placeholder="user@example.com"
                      className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      value={userData.email}
                      onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {isEditingUser ? 'New Password (Optional)' : 'Initial Password *'}
                    </label>
                    <input 
                      type="password"
                      placeholder={isEditingUser ? "Leave blank to keep current" : "Min. 6 characters"}
                      className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      value={userData.password}
                      onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                      <select 
                        className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        value={userData.role}
                        onChange={(e) => setUserData({ ...userData, role: e.target.value })}
                      >
                        <option value="admin">Administrator</option>
                        <option value="ceo">CEO</option>
                        <option value="managing_director">Managing Director</option>
                        <option value="director">Director</option>
                        <option value="executive">Executive</option>
                        <option value="hod">Dept. Head (HOD)</option>
                        <option value="regional_manager">Regional Manager</option>
                        <option value="employee">Branch Employee</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</label>
                      <select 
                        className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        value={userData.branch_id}
                        onChange={(e) => setUserData({ ...userData, branch_id: e.target.value })}
                      >
                        <option value="">— None —</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
                    <select 
                      className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
                  <p className="text-xs text-slate-500 mb-4 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl">
                    Select which modules this user is allowed to access and enter data for.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {modules.map(m => (
                      <label 
                        key={m.id} 
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                          userData.allowed_modules.includes(m.id) 
                            ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-200' 
                            : 'bg-black/20 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📦</span>
                          <span className="font-bold">{m.name}</span>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 transition-all cursor-pointer"
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
                    {modules.length === 0 && <p className="text-center py-10 text-slate-500 italic">No modules available. Create modules first.</p>}
                  </div>
                </div>
              )}
            </div>

            <footer className="p-6 border-t border-slate-800 bg-black/20 flex gap-3">
              <button 
                onClick={() => setIsUserModalOpen(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={isEditingUser ? handleEditUser : handleAddUser}
                disabled={loading}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (isEditingUser ? 'Updating...' : 'Creating...') : (isEditingUser ? 'Save Changes' : 'Create User Account')}
              </button>
            </footer>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default AdminPanelPage;
