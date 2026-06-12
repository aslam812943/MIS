import React from 'react';
import type { Module } from '../../services/org.service';

interface DataEntrySidebarProps {
  modules: Module[];
  selectedModuleId: string | null;
  onSelectModule: (moduleId: string) => void;
}

const DataEntrySidebar: React.FC<DataEntrySidebarProps> = ({ modules, selectedModuleId, onSelectModule }) => {
  return (
    <div className="p-6 flex flex-col gap-2">
      <h3 className="mis-label mb-2">Sections</h3>
      {modules.map((module) => (
        <button
          key={module.id}
          onClick={() => onSelectModule(module.id)}
          className={`w-full text-left px-4 py-3 rounded-[var(--radius-md)] transition-all font-semibold text-sm flex items-center justify-between group border ${
            selectedModuleId === module.id
              ? 'mis-module-tab active'
              : 'mis-btn-ghost border-transparent'
          }`}
          style={selectedModuleId === module.id ? {} : { color: 'var(--text-secondary)', background: 'transparent' }}
        >
          {module.name}
          <span className={`text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ${selectedModuleId === module.id ? 'opacity-100' : ''}`}>→</span>
        </button>
      ))}
      
      {modules.length === 0 && (
        <p className="text-sm text-slate-500 italic p-4 bg-white/5 rounded-xl border border-white/5">No modules assigned to you.</p>
      )}
    </div>
  );
};

export default DataEntrySidebar;
