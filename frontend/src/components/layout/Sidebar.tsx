import React from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

/**
 * Premium Sidebar component for dashboard navigation.
 */
const Sidebar: React.FC = () => {
  return (
    <aside className="w-[280px] bg-slate-900 border-r border-slate-800 flex flex-col p-6 sticky top-0 h-screen">
      <div className="mb-10">
        <h2 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">MIS Portal</h2>
      </div>
      
      <nav className="flex-1 flex flex-col gap-2">
        <NavLink 
          to={ROUTES.DASHBOARD} 
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              isActive ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`
          }
        >
          <span className="text-xl">📊</span>
          Dashboard
        </NavLink>

        <NavLink 
          to={ROUTES.ADMIN_PANEL} 
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              isActive ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`
          }
        >
          <span className="text-xl">🛡️</span>
          Admin Panel
        </NavLink>
      </nav>

      <div className="pt-6 border-t border-slate-800">
        <button 
          className="w-full p-3 rounded-xl border border-slate-800 text-red-400 font-semibold hover:bg-red-400/10 transition-all cursor-pointer"
          onClick={() => { localStorage.clear(); window.location.href = ROUTES.LOGIN; }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
