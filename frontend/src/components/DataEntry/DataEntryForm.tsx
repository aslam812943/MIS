import React, { useState, useEffect } from 'react';
import type { Module } from '../../services/org.service';
import { dataEntryService } from '../../services/dataEntry.service';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { authService } from '../../services/auth.service';
import ConfirmModal from '../common/ConfirmModal';
import { INITIAL_CONFIRM_STATE, type ConfirmDialogState } from '../../types/confirm.types';

interface DataEntryFormProps {
  module: Module;
  selectedDate: string;
}

const DataEntryForm: React.FC<DataEntryFormProps> = ({ module, selectedDate }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [entryStatus, setEntryStatus] = useState<'pending' | 'verified' | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const currentUser = authService.getCurrentUser();
  const branchId = currentUser?.branch_id;
  const branchName = currentUser?.branch_name || branchId;
  const userName = currentUser?.full_name || currentUser?.email;
  const isHOD = currentUser?.role === 'hod';
  const isLocked = entryStatus === 'verified' && !isHOD;

  useEffect(() => {
    const fetchEntry = async () => {
      if (!branchId) return;

      setIsLoading(true);
      try {
        const entry = await dataEntryService.getEntry(selectedDate, module.id);
        if (entry) {
          setEntryStatus(entry.status || 'pending');
          if (entry.data) {
            setFormData(entry.data);
          }
        } else {
          setEntryStatus(null);
          const initialData: Record<string, any> = {};
          module.fields?.forEach(f => {
            initialData[f.name] = f.type === 'number' ? 0 : '';
          });
          setFormData(initialData);
        }
      } catch (error) {
        console.error('Error fetching entry:', error);
        toast.error('Failed to load existing entry');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntry();
  }, [module.id, selectedDate, branchId]);

  const handleInputChange = (fieldName: string, value: any, type: string) => {
    let parsedValue = value;
    if (type === 'number') {
      parsedValue = value === '' ? '' : Number(value);
    }

    setFormData(prev => ({
      ...prev,
      [fieldName]: parsedValue
    }));
  };

  const handleClear = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Form',
      message: `Clear all entered values for ${module.name}? This cannot be undone until you save again.`,
      confirmLabel: 'Clear',
      cancelLabel: 'Cancel',
      isDanger: true,
      onConfirm: () => {
        const initialData: Record<string, any> = {};
        module.fields?.forEach(f => {
          initialData[f.name] = f.type === 'number' ? 0 : '';
        });
        setFormData(initialData);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        toast.success('Form cleared.');
      },
    });
  };

  const handleSave = async () => {
    if (!branchId) {
      toast.error('You must be assigned to a branch to save entries.');
      return;
    }

    const missingFields: string[] = [];
    module.fields?.forEach((field) => {
      const val = formData[field.name];
      if (val === undefined || val === null || val === '') {
        missingFields.push(field.name);
      }
    });

    if (missingFields.length > 0) {
      toast.error(`Please fill in all fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Saving entry...');
    try {
      await dataEntryService.saveEntry({
        module_id: module.id,
        entry_date: selectedDate,
        data: formData
      });
      toast.success(`${module.name} entry saved successfully.`, { id: toastId });
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save entry', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  if (!branchId) {
    return (
      <div className="mis-data-entry-panel">
        <div className="mis-empty">You need to be assigned to a branch to use Data Entry.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mis-data-entry-panel">
        <div className="mis-loading-center py-16">
          <div className="mis-spinner" />
        </div>
      </div>
    );
  }

  const formattedDate = format(new Date(selectedDate + 'T12:00:00'), 'dd MMM yyyy');

  return (
    <div className="mis-data-entry-panel">
      <div className="mis-data-entry-panel-head">
        <div>
          <h2>{module.name}</h2>
          <p className="mis-data-entry-meta-line">
            Branch: {branchName} · {formattedDate}
          </p>
        </div>
        <div className="mis-data-entry-badges">
          {entryStatus === 'verified' && (
            <span className="mis-badge mis-badge-success">Verified</span>
          )}
          {entryStatus === 'pending' && (
            <span className="mis-badge mis-badge-warning">Pending</span>
          )}
          <span className="mis-badge mis-badge-neutral">
            {module.fields?.length || 0} fields
          </span>
        </div>
      </div>

      <div className="mis-data-entry-panel-body">
        {isLocked && (
          <div className="mis-alert mis-alert-warning mb-4">
            <span>This entry is verified and locked. Contact your HOD if changes are required.</span>
          </div>
        )}

        {!isLocked && entryStatus === 'verified' && isHOD && (
          <div className="mis-alert mis-alert-success mb-4">
            <span>HOD mode: you can edit and override this verified entry.</span>
          </div>
        )}

        {(!module.fields || module.fields.length === 0) ? (
          <p className="mis-empty py-6">No fields configured for this module.</p>
        ) : (
          <div className="mis-data-entry-fields">
            {module.fields.map((field, idx) => (
              <div key={idx} className="mis-data-entry-field-card">
                <label htmlFor={`field-${idx}`}>{field.name}</label>
                {field.type === 'text' && (
                  <input
                    id={`field-${idx}`}
                    type="text"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value, field.type)}
                    disabled={isLocked}
                    className="mis-input disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
                {field.type === 'number' && (
                  <input
                    id={`field-${idx}`}
                    type="number"
                    value={formData[field.name] !== undefined ? formData[field.name] : ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value, field.type)}
                    disabled={isLocked}
                    className="mis-input disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
                {field.type === 'date' && (
                  <input
                    id={`field-${idx}`}
                    type="date"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value, field.type)}
                    disabled={isLocked}
                    className="mis-input disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mis-data-entry-footer">
        <p className="mis-data-entry-user">
          Entering as <strong>{userName}</strong>
        </p>
        <div className="mis-data-entry-actions">
          <button
            type="button"
            onClick={handleClear}
            disabled={isLocked}
            className="mis-btn mis-btn-ghost"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLocked || !module.fields || module.fields.length === 0}
            className="mis-btn mis-btn-primary"
          >
            {isSaving ? (
              <span className="mis-spinner" style={{ width: '1.1rem', height: '1.1rem', borderWidth: '2px' }} />
            ) : (
              'Save Entry'
            )}
          </button>
        </div>
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
    </div>
  );
};

export default DataEntryForm;
