import React, { useState, useEffect } from 'react';
import { dataEntryService } from '../../services/dataEntry.service';
import { orgService } from '../../services/org.service';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface DepartmentEntry {
  id: string;
  entry_date: string;
  module_id: string;
  user_id: string;
  status: 'pending' | 'verified';
  data: Record<string, any>;
  profiles: {
    full_name: string;
    email: string;
    branches: {
      name: string;
    } | null;
  };
  modules: {
    name: string;
    fields: Array<{
      name: string;
      type: 'text' | 'number' | 'date';
    }>;
  };
}

const VerifyEntriesPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState<DepartmentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [editingEntry, setEditingEntry] = useState<DepartmentEntry | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const data = await dataEntryService.getDepartmentEntries(selectedDate);
      setEntries(data);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load department entries');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const branchList = await orgService.getBranches();
        setBranches(branchList || []);
      } catch (error) {
        console.error('Failed to load branches:', error);
      }
    };
    loadBranches();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [selectedDate]);

  const handleVerify = async (id: string) => {
    try {
      await dataEntryService.verifyEntry(id);
      toast.success('Entry verified successfully!');
      fetchEntries();
    } catch (error) {
      console.error('Verify error:', error);
      toast.error('Failed to verify entry');
    }
  };

  const handleOpenEdit = (entry: DepartmentEntry) => {
    setEditingEntry(entry);
    setEditFormData(entry.data || {});
  };

  const handleEditInputChange = (fieldName: string, value: any, type: string) => {
    let parsedValue = value;
    if (type === 'number') {
      parsedValue = value === '' ? '' : Number(value);
    }
    setEditFormData(prev => ({
      ...prev,
      [fieldName]: parsedValue
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    // Validate that all fields are filled
    const missingFields: string[] = [];
    editingEntry.modules?.fields?.forEach((field) => {
      const val = editFormData[field.name];
      if (val === undefined || val === null || val === '') {
        missingFields.push(field.name);
      }
    });

    if (missingFields.length > 0) {
      toast.error(`Please fill in all fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsSavingEdit(true);
    try {
      await dataEntryService.saveEntry({
        module_id: editingEntry.module_id,
        user_id: editingEntry.user_id,
        entry_date: editingEntry.entry_date,
        data: editFormData
      });
      toast.success('Entry updated and verified successfully!');
      setEditingEntry(null);
      fetchEntries();
    } catch (error) {
      console.error('Save edit error:', error);
      toast.error('Failed to update entry');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filter entries based on selected branch
  const filteredEntries = entries.filter((entry) => {
    if (selectedBranch === 'all') return true;
    return entry.profiles?.branches?.name === selectedBranch;
  });

  const pendingCount = filteredEntries.filter(e => e.status !== 'verified').length;
  const verifiedCount = filteredEntries.filter(e => e.status === 'verified').length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Department Approvals</h1>
          <p className="text-slate-400 mt-1">Review, edit, and verify daily metrics entered by your department's employees.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Branch Filter dropdown */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-slate-400 text-sm font-semibold px-2">Filter Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 min-w-[120px] cursor-pointer"
            >
              <option value="all">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.name}>
                  {branch.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
            <span className="text-slate-400 text-sm font-semibold px-2">Select Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="text-slate-400 text-sm font-semibold mb-1">Total Submissions</div>
          <div className="text-3xl font-extrabold text-white">{filteredEntries.length}</div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="text-amber-400 text-sm font-semibold mb-1">Pending Verification</div>
          <div className="text-3xl font-extrabold text-amber-300">{pendingCount}</div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="text-emerald-400 text-sm font-semibold mb-1">Verified Entries</div>
          <div className="text-3xl font-extrabold text-emerald-300">{verifiedCount}</div>
        </div>
      </div>

      {/* Entries List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-16 text-center text-slate-500 italic">
            No entries matching filter criteria for this date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-300 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Module Section</th>
                  <th className="px-6 py-4">Data Submitted</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/30 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{entry.profiles?.full_name || 'N/A'}</div>
                      <div className="text-xs text-slate-400">{entry.profiles?.email}</div>
                      {entry.profiles?.branches?.name && (
                        <div className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold uppercase mt-1 w-max flex items-center gap-1">
                          <span>📍</span> {entry.profiles.branches.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold">
                        {entry.modules?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 max-w-sm">
                        {Object.entries(entry.data || {}).map(([key, val]) => (
                          <div key={key} className="bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg text-xs">
                            <span className="text-slate-500 font-medium">{key}:</span>{' '}
                            <span className="text-slate-300 font-semibold">{val}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {entry.status === 'verified' ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold">
                          Verified
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleOpenEdit(entry)}
                          className="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition-all"
                        >
                          ✏️ Edit & Verify
                        </button>
                        {entry.status !== 'verified' && (
                          <button
                            onClick={() => handleVerify(entry.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md"
                          >
                            ✓ Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit & Verify Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xl shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-2">Edit & Verify Entry</h2>
            <p className="text-xs text-slate-400 mb-6">
              Modifying data entered by <strong>{editingEntry.profiles?.full_name}</strong> for module <strong>{editingEntry.modules?.name}</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {editingEntry.modules?.fields?.map((field, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">{field.name}</label>
                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={editFormData[field.name] || ''}
                      onChange={(e) => handleEditInputChange(field.name, e.target.value, field.type)}
                      className="bg-slate-950 border border-slate-800 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  )}
                  {field.type === 'number' && (
                    <input
                      type="number"
                      value={editFormData[field.name] !== undefined ? editFormData[field.name] : ''}
                      onChange={(e) => handleEditInputChange(field.name, e.target.value, field.type)}
                      className="bg-slate-950 border border-slate-800 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  )}
                  {field.type === 'date' && (
                    <input
                      type="date"
                      value={editFormData[field.name] || ''}
                      onChange={(e) => handleEditInputChange(field.name, e.target.value, field.type)}
                      className="bg-slate-950 border border-slate-800 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-5 py-2 rounded-xl text-slate-300 border border-slate-700 hover:bg-slate-800 text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-md"
              >
                {isSavingEdit ? 'Saving...' : '💾 Verify & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifyEntriesPage;
