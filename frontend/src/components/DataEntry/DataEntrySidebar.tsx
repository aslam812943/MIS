import React from 'react';
import type { Module } from '../../services/org.service';

interface DataEntrySidebarProps {
  modules: Module[];
  selectedModuleId: string | null;
  onSelectModule: (moduleId: string) => void;
}

const DataEntrySidebar: React.FC<DataEntrySidebarProps> = ({ modules, selectedModuleId, onSelectModule }) => {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Sections</h3>
      {modules.map((module) => (
        <button
          key={module.id}
          onClick={() => onSelectModule(module.id)}
          className={`w-full text-left px-4 py-2.5 rounded-xl transition-all font-medium ${
            selectedModuleId === module.id 
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
              : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
          }`}
        >
          {module.name}
        </button>
      ))}
      
      {modules.length === 0 && (
        <p className="text-sm text-slate-500 italic">No modules assigned to you.</p>
      )}
    </div>
  );
};

export default DataEntrySidebar;
