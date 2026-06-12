import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DataEntryForm from '../../components/DataEntry/DataEntryForm';
import { orgService, type Module } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { format } from 'date-fns';

const DataEntryPage: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModules = async () => {
      setIsLoading(true);
      try {
        const allModules = await orgService.getModules();

        const user = authService.getCurrentUser();
        let allowed = allModules;
        if (user && user.role !== 'admin') {
          const allowedIds = user.allowed_modules || [];
          allowed = allModules.filter(m => allowedIds.includes(m.id));
        }

        setModules(allowed);
        if (allowed.length > 0) {
          setSelectedModuleId(prev => prev || allowed[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch modules', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModules();
  }, []);

  const selectedModule = modules.find(m => m.id === selectedModuleId);

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in">
        <div className="mis-data-entry-layout">
          {/* Toolbar: title + date in one aligned bar */}
          <div className="mis-data-entry-toolbar">
            <div className="mis-data-entry-toolbar-title">
              <h1>Data Entry</h1>
              <p>Record daily metrics for your assigned modules.</p>
            </div>
            <div className="mis-data-entry-date-field mis-field" style={{ margin: 0 }}>
              <label className="mis-label">Entry date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mis-input"
              />
            </div>
          </div>

          {/* Module selector */}
          <div className="mis-data-entry-modules" role="tablist" aria-label="Data modules">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                role="tab"
                aria-selected={selectedModuleId === module.id}
                onClick={() => setSelectedModuleId(module.id)}
                className={`mis-module-tab ${selectedModuleId === module.id ? 'active' : ''}`}
              >
                {module.name}
              </button>
            ))}
            {modules.length === 0 && !isLoading && (
              <span className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                No modules assigned to your account.
              </span>
            )}
          </div>

          {/* Form panel */}
          {isLoading ? (
            <div className="mis-loading-center py-20">
              <div className="mis-spinner" />
            </div>
          ) : selectedModule ? (
            <DataEntryForm module={selectedModule} selectedDate={selectedDate} />
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DataEntryPage;
