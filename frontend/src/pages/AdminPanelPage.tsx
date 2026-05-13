import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { orgService } from '../services/org.service';
import type { Branch, Department, Module } from '../services/org.service';
import Sidebar from '../components/layout/Sidebar';

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

  const handleDeleteBranch = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this branch?')) return;
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

  const handleDeleteDept = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;
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
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim()) {
      toast.error('Module name cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      await orgService.addModule(newModuleName);
      toast.success('Module added successfully!');
      setNewModuleName('');
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
      await orgService.updateModule(id, editingName);
      toast.success('Module updated successfully!');
      setEditingId(null);
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

  const handleDeleteModule = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this module?')) return;
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
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-content">
        <Toaster position="top-right" />
        <header className="content-header">
          <h1>Admin Panel</h1>
          <p>Configure organizational branches, departments, and modules.</p>
        </header>

        <div className="admin-actions">
          {/* Branches Section */}
          <section className="admin-card">
            <div className="card-header">
              <h2>🏢 Branches</h2>
            </div>
            <form onSubmit={handleAddBranch} className="inline-form">
              <input
                type="text"
                placeholder="Enter branch name (e.g. London)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading}>Add Branch</button>
            </form>
            <ul className="org-list">
              {branches.map(b => (
                <li key={b.id} className="org-list-item">
                  {editingId === b.id ? (
                    <div className="edit-mode">
                      <input 
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                      <button className="save-btn" onClick={() => handleUpdateBranch(b.id)}>✅</button>
                      <button className="cancel-btn" onClick={() => setEditingId(null)}>❌</button>
                    </div>
                  ) : (
                    <>
                      <span>{b.name}</span>
                      <div className="item-actions">
                        <button onClick={() => { setEditingId(b.id); setEditingName(b.name); }}>✏️</button>
                        <button onClick={() => handleDeleteBranch(b.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Departments Section */}
          <section className="admin-card">
            <div className="card-header">
              <h2>🏢 Departments</h2>
            </div>
            <form onSubmit={handleAddDept} className="inline-form">
              <input
                type="text"
                placeholder="Enter department (e.g. IT)"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading}>Add Dept</button>
            </form>
            <ul className="org-list">
              {departments.map(d => (
                <li key={d.id} className="org-list-item">
                  {editingId === d.id ? (
                    <div className="edit-mode">
                      <input 
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                      <button className="save-btn" onClick={() => handleUpdateDept(d.id)}>✅</button>
                      <button className="cancel-btn" onClick={() => setEditingId(null)}>❌</button>
                    </div>
                  ) : (
                    <>
                      <span>{d.name}</span>
                      <div className="item-actions">
                        <button onClick={() => { setEditingId(d.id); setEditingName(d.name); }}>✏️</button>
                        <button onClick={() => handleDeleteDept(d.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Modules Section */}
          <section className="admin-card">
            <div className="card-header">
              <h2>📦 Modules</h2>
            </div>
            <form onSubmit={handleAddModule} className="inline-form">
              <input
                type="text"
                placeholder="Enter module name (e.g. Inventory)"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading}>Add Module</button>
            </form>
            <ul className="org-list">
              {modules.map(m => (
                <li key={m.id} className="org-list-item">
                  {editingId === m.id ? (
                    <div className="edit-mode">
                      <input 
                        value={editingName} 
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                      <button className="save-btn" onClick={() => handleUpdateModule(m.id)}>✅</button>
                      <button className="cancel-btn" onClick={() => setEditingId(null)}>❌</button>
                    </div>
                  ) : (
                    <>
                      <span>{m.name}</span>
                      <div className="item-actions">
                        <button onClick={() => { setEditingId(m.id); setEditingName(m.name); }}>✏️</button>
                        <button onClick={() => handleDeleteModule(m.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};

export default AdminPanelPage;
