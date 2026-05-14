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
      const [bData, dData, mData] = await Promise.all([
        orgService.getBranches(),
        orgService.getDepartments(),
        orgService.getModules()
      ]);
      setBranches(bData);
      setDepartments(dData);
      setModules(mData);
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

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <Sidebar />
      <main className="flex-1 p-10 overflow-y-auto">
        <Toaster position="top-right" />
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">Admin Panel</h1>
          <p className="text-slate-400">Configure organizational branches, departments, and modules.</p>
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
        </div>
      </main>

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
