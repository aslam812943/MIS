import React, { useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import RoleSelector from '../components/auth/RoleSelector';
import { UserRole } from '../types/user.types';

const LoginPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.ADMIN);

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-secondary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      
      <div className="w-full max-w-6xl z-10 flex flex-col items-center gap-12">
        <div className="text-center">
          <h1 className="text-5xl font-black mb-4 tracking-tight">
            <span className="text-white">MIS</span>
            <span className="text-gradient"> Portal</span>
          </h1>
          <p className="text-slate-400 max-w-md mx-auto">
            Management Information System - Secure access for organizational efficiency and data-driven decisions.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-start justify-center w-full">
          {/* Left Side: Role Selection */}
          <div className="flex-1 w-full lg:max-w-2xl">
            <RoleSelector selectedRole={selectedRole} onSelect={setSelectedRole} />
          </div>

          {/* Right Side: Login Form */}
          <div className="w-full max-w-md flex flex-col items-center">
            <LoginForm selectedRole={selectedRole} />
          </div>
        </div>
        
        <footer className="mt-12 text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Management Information System. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default LoginPage;
