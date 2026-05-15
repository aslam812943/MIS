import React from 'react';
import { UserRole } from '../../types/user.types';

interface RoleOption {
  role: UserRole;
  label: string;
  description: string;
  icon: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: UserRole.ADMIN,
    label: 'Administrator',
    description: 'System-wide management and configuration',
    icon: '🛡️',
  },
  {
    role: UserRole.CEO,
    label: 'CEO',
    description: 'Executive oversight and strategic reports',
    icon: '👔',
  },
  {
    role: UserRole.MANAGING_DIRECTOR,
    label: 'Managing Director',
    description: 'Operational management and decision making',
    icon: '💼',
  },
  {
    role: UserRole.DIRECTOR,
    label: 'Director',
    description: 'Departmental oversight and planning',
    icon: '📊',
  },
  {
    role: UserRole.REGIONAL_MANAGER,
    label: 'Regional Manager',
    description: 'Regional branch coordination',
    icon: '🌐',
  },
  {
    role: UserRole.HOD,
    label: 'HOD',
    description: 'Head of Department management',
    icon: '🏫',
  },
  {
    role: UserRole.EXECUTIVE,
    label: 'Executive',
    description: 'Core operations and data analysis',
    icon: '⚡',
  },
  {
    role: UserRole.EMPLOYEE,
    label: 'Employee',
    description: 'Standard data entry and daily tasks',
    icon: '👤',
  },
];

interface RoleSelectorProps {
  selectedRole: UserRole;
  onSelect: (role: UserRole) => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ selectedRole, onSelect }) => {
  return (
    <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Select Your Role</h2>
        <p className="text-slate-400">Choose your access level to continue to the portal</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.role}
            onClick={() => onSelect(option.role)}
            className={`
              glass group relative p-6 rounded-2xl text-left transition-all duration-300 hover:scale-[1.02]
              ${selectedRole === option.role 
                ? 'ring-2 ring-brand-primary border-brand-primary/50 bg-brand-primary/5' 
                : 'hover:border-white/20'}
            `}
          >
            <div className="flex flex-col h-full">
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {option.icon}
              </div>
              <h3 className={`font-semibold text-lg mb-1 transition-colors ${selectedRole === option.role ? 'text-brand-primary' : 'text-white'}`}>
                {option.label}
              </h3>
              <p className="text-sm text-slate-400 line-clamp-2">
                {option.description}
              </p>
            </div>
            
            {selectedRole === option.role && (
              <div className="absolute top-4 right-4">
                <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RoleSelector;
