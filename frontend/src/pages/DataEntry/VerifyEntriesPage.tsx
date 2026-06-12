import React, { useState, useEffect } from 'react';
import { dataEntryService } from '../../services/dataEntry.service';
import { orgService } from '../../services/org.service';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ConfirmModal from '../../components/common/ConfirmModal';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';

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
  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

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

  const entryLabel = (entry: DepartmentEntry) => {
    const employee = entry.profiles?.full_name?.trim() || entry.profiles?.email || 'this employee';
    const moduleName = entry.modules?.name || 'entry';
    return `${employee} — ${moduleName}`;
  };

  const handleVerify = (entry: DepartmentEntry) => {
    setConfirmModal({
      isOpen: true,
      title: 'Approve Entry',
      message: `Approve and verify the ${entry.modules?.name || 'data'} entry submitted by ${entry.profiles?.full_name || entry.profiles?.email}? This marks the record as verified.`,
      confirmLabel: 'Approve',
      cancelLabel: 'Cancel',
      isDanger: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const toastId = toast.loading('Verifying entry...');
        try {
          await dataEntryService.verifyEntry(entry.id);
          toast.success(`Entry for ${entryLabel(entry)} verified successfully.`, { id: toastId });
          fetchEntries();
        } catch (error) {
          console.error('Verify error:', error);
          toast.error('Failed to verify entry', { id: toastId });
        }
      },
    });
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

  const validateEditForm = (): boolean => {
    if (!editingEntry) return false;

    const missingFields: string[] = [];
    editingEntry.modules?.fields?.forEach((field) => {
      const val = editFormData[field.name];
      if (val === undefined || val === null || val === '') {
        missingFields.push(field.name);
      }
    });

    if (missingFields.length > 0) {
      toast.error(`Please fill in all fields: ${missingFields.join(', ')}`);
      return false;
    }
    return true;
  };

  const performSaveEdit = async () => {
    if (!editingEntry) return;

    setIsSavingEdit(true);
    const toastId = toast.loading('Saving and verifying entry...');
    try {
      await dataEntryService.saveEntry({
        module_id: editingEntry.module_id,
        user_id: editingEntry.user_id,
        entry_date: editingEntry.entry_date,
        data: editFormData
      });
      toast.success(`Entry for ${entryLabel(editingEntry)} updated and verified successfully.`, { id: toastId });
      setEditingEntry(null);
      fetchEntries();
    } catch (error) {
      console.error('Save edit error:', error);
      toast.error('Failed to update entry', { id: toastId });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editingEntry || !validateEditForm()) return;

    setConfirmModal({
      isOpen: true,
      title: 'Verify & Save',
      message: `Save changes and verify the entry for ${entryLabel(editingEntry)}? The employee's submitted data will be updated.`,
      confirmLabel: 'Verify & Save',
      cancelLabel: 'Cancel',
      isDanger: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await performSaveEdit();
      },
    });
  };

  const filteredEntries = entries.filter((entry) => {
    if (selectedBranch === 'all') return true;
    return entry.profiles?.branches?.name === selectedBranch;
  });

  const pendingCount = filteredEntries.filter(e => e.status !== 'verified').length;
  const verifiedCount = filteredEntries.filter(e => e.status === 'verified').length;

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto">
        <header className="mis-page-header-row mb-6">
          <div className="mis-page-header" style={{ marginBottom: 0 }}>
            <h1 className="mis-page-title">Department Approvals</h1>
            <p className="mis-page-desc">
              Review, edit, and verify daily metrics entered by your department employees.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="mis-filter-bar flex-1 sm:flex-initial">
              <span className="mis-filter-label">Branch</span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="mis-select py-2 text-sm min-w-[8rem] flex-1"
              >
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.name}>
                    {branch.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="mis-filter-bar flex-1 sm:flex-initial">
              <span className="mis-filter-label">Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mis-input py-2 text-sm flex-1"
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="mis-stat-card">
            <div className="mis-stat-label">Total Submissions</div>
            <div className="mis-stat-value">{filteredEntries.length}</div>
          </div>
          <div className="mis-stat-card mis-stat-pending" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <div className="mis-stat-label" style={{ color: '#fbbf24' }}>Pending Verification</div>
            <div className="mis-stat-value" style={{ color: '#fbbf24' }}>{pendingCount}</div>
          </div>
          <div className="mis-stat-card mis-stat-verified" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <div className="mis-stat-label" style={{ color: '#34d399' }}>Verified Entries</div>
            <div className="mis-stat-value" style={{ color: '#34d399' }}>{verifiedCount}</div>
          </div>
        </div>

        <div className="mis-table-wrap">
          {isLoading ? (
            <div className="mis-loading-center py-16">
              <div className="mis-spinner" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="mis-empty">No entries matching filter criteria for this date.</div>
          ) : (
            <table className="mis-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Module</th>
                  <th>Data Submitted</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {entry.profiles?.full_name || 'N/A'}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{entry.profiles?.email}</div>
                      {entry.profiles?.branches?.name && (
                        <span className="mis-badge mis-badge-info mt-1.5">{entry.profiles.branches.name}</span>
                      )}
                    </td>
                    <td>
                      <span className="mis-badge mis-badge-info">{entry.modules?.name}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {Object.entries(entry.data || {}).map(([key, val]) => (
                          <span key={key} className="mis-chip">
                            {key}: <strong>{String(val)}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {entry.status === 'verified' ? (
                        <span className="mis-badge mis-badge-success">Verified</span>
                      ) : (
                        <span className="mis-badge mis-badge-warning">Pending</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(entry)}
                          className="mis-btn mis-btn-ghost mis-btn-sm"
                        >
                          Edit & Verify
                        </button>
                        {entry.status !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => handleVerify(entry)}
                            className="mis-btn mis-btn-sm mis-btn-success-soft"
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              color: '#34d399',
                            }}
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {editingEntry && (
          <div className="mis-modal-backdrop">
            <div className="mis-modal max-w-xl">
              <div className="mis-modal-header">
                <div>
                  <h2 className="text-lg font-bold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>Edit & Verify Entry</h2>
                  <p className="text-xs m-0" style={{ color: 'var(--text-secondary)' }}>
                    {editingEntry.profiles?.full_name} — {editingEntry.modules?.name}
                  </p>
                </div>
                <button type="button" className="mis-icon-btn" onClick={() => setEditingEntry(null)} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="mis-modal-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {editingEntry.modules?.fields?.map((field, idx) => (
                    <div key={idx} className="mis-field">
                      <label className="mis-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {field.name}
                      </label>
                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={editFormData[field.name] || ''}
                          onChange={(e) => handleEditInputChange(field.name, e.target.value, field.type)}
                          className="mis-input"
                        />
                      )}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={editFormData[field.name] !== undefined ? editFormData[field.name] : ''}
                          onChange={(e) => handleEditInputChange(field.name, e.target.value, field.type)}
                          className="mis-input"
                        />
                      )}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          value={editFormData[field.name] || ''}
                          onChange={(e) => handleEditInputChange(field.name, e.target.value, field.type)}
                          className="mis-input"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mis-modal-footer">
                <button type="button" onClick={() => setEditingEntry(null)} className="mis-btn mis-btn-ghost flex-1 justify-center">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="mis-btn flex-1 justify-center mis-btn-success-soft"
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#34d399',
                  }}
                >
                  {isSavingEdit ? 'Saving...' : 'Verify & Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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

export default VerifyEntriesPage;
