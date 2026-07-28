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
  {
    role: UserRole.HR,
    label: 'HR',
    description: 'Workforce data entry and recruitment',
    icon: '🧑‍💼',
  },
];

interface RoleSelectorProps {
  selectedRole: UserRole;
  onSelect: (role: UserRole) => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ selectedRole, onSelect }) => {
  return (
    <div className="w-full mis-animate-in">
      <div className="text-center mb-2 sm:mb-4">
        <h2 className="text-lg sm:text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Select Your Role
        </h2>
        <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
          Choose your access level to continue to the portal
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.role}
            type="button"
            onClick={() => onSelect(option.role)}
            className={`mis-role-card ${selectedRole === option.role ? 'selected' : ''}`}
          >
            <div className="mis-role-card-icon" aria-hidden="true">
              {option.icon}
            </div>
            <h3
              className="font-semibold text-base mb-1"
              style={{ color: selectedRole === option.role ? 'var(--accent)' : 'var(--text-primary)' }}
            >
              {option.label}
            </h3>
            <p className="text-sm line-clamp-2 m-0" style={{ color: 'var(--text-secondary)' }}>
              {option.description}
            </p>
            {selectedRole === option.role && (
              <span
                className="absolute top-3 right-3 w-2 h-2 rounded-full"
                style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RoleSelector;
