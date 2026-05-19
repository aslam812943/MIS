import React, { useEffect, useState } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import DataEntrySidebar from '../../components/DataEntry/DataEntrySidebar';
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
        
        // Filter modules based on user's allowed_modules
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
    <div className="flex min-h-screen bg-slate-950 text-slate-200 font-sans">
      <Sidebar />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Secondary Sidebar for Sections (Modules) */}
        <DataEntrySidebar 
          modules={modules}
          selectedModuleId={selectedModuleId}
          onSelectModule={setSelectedModuleId}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <header className="bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-center sticky top-0 z-10">
            <div>
              <h1 className="text-2xl font-bold text-white">Data Entry</h1>
              <p className="text-sm text-slate-400 mt-1">Enter daily metrics for your branch</p>
            </div>
            <div className="flex items-center gap-4">
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </header>

          {/* Form Area */}
          <div className="flex-1 bg-slate-950">
            {isLoading ? (
              <div className="p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : selectedModule ? (
              <DataEntryForm 
                module={selectedModule} 
                selectedDate={selectedDate}
              />
            ) : (
              <div className="p-8 text-center text-slate-500 italic">
                Please select a section from the left sidebar to enter data.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DataEntryPage;
