import React, { useState, useEffect } from 'react';
import type { Module } from '../../services/org.service';
import { dataEntryService } from '../../services/dataEntry.service';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { authService } from '../../services/auth.service';

interface DataEntryFormProps {
  module: Module;
  selectedDate: string;
}

const DataEntryForm: React.FC<DataEntryFormProps> = ({ module, selectedDate }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [entryStatus, setEntryStatus] = useState<'pending' | 'verified' | null>(null);

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
          // Initialize empty
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
  }, [module.id, selectedDate]);

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
    const initialData: Record<string, any> = {};
    module.fields?.forEach(f => {
      initialData[f.name] = f.type === 'number' ? 0 : '';
    });
    setFormData(initialData);
  };

  const handleSave = async () => {
    if (!branchId) {
      toast.error('You must be assigned to a branch to save entries.');
      return;
    }

    // Validate that all fields are filled
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
    try {
      await dataEntryService.saveEntry({
        module_id: module.id,
        entry_date: selectedDate,
        data: formData
      });
      toast.success('Entry saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  if (!branchId) {
    return (
      <div className="p-8 text-center text-slate-400">
        You need to be assigned to a branch to use Data Entry.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">{module.name}</h2>
            <p className="text-slate-400 text-sm mt-1">
              Branch: {branchName} • {format(new Date(selectedDate), 'dd MMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {entryStatus === 'verified' && (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                <span>✓</span> Verified
              </span>
            )}
            {entryStatus === 'pending' && (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <span>🕒</span> Pending Approval
              </span>
            )}
            <div className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
              <span>{module.fields?.length || 0} fields</span>
            </div>
          </div>
        </div>

        {isLocked && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3.5 rounded-xl text-sm flex items-center gap-3">
            <span className="text-lg">🔒</span>
            <div>
              <strong>Locked by Department Head:</strong> This submission has been verified and cannot be edited.
            </div>
          </div>
        )}

        {!isLocked && entryStatus === 'verified' && isHOD && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3.5 rounded-xl text-sm flex items-center gap-3">
            <span className="text-lg">⚙️</span>
            <div>
              <strong>Verified Status:</strong> You are entering as the HOD. You may still edit and override this entry.
            </div>
          </div>
        )}

        {(!module.fields || module.fields.length === 0) ? (
          <p className="text-slate-500 italic py-4">No fields configured for this module.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {module.fields.map((field, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">
                  {field.name}
                </label>
                {field.type === 'text' && (
                  <input
                    type="text"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value, field.type)}
                    disabled={isLocked}
                    className="bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
                {field.type === 'number' && (
                  <input
                    type="number"
                    value={formData[field.name] !== undefined ? formData[field.name] : ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value, field.type)}
                    disabled={isLocked}
                    className="bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
                {field.type === 'date' && (
                  <input
                    type="date"
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value, field.type)}
                    disabled={isLocked}
                    className="bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-800">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4 sm:mb-0">
            <span className="text-indigo-400">🕒</span>
            Entering as <strong className="text-white ml-1">{userName}</strong>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClear}
              disabled={isLocked}
              className="px-6 py-2 rounded-xl text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLocked || !module.fields || module.fields.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl transition-all font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <span>💾 Save Entry</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataEntryForm;
