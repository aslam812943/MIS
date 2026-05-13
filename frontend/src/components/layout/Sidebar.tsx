import React from 'react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

/**
 * Premium Sidebar component for dashboard navigation.
 * Supports dark and light modes through CSS variables.
 */
const Sidebar: React.FC = () => {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <h2>MIS Portal</h2>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink 
          to={ROUTES.DASHBOARD} 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="icon">📊</span>
          Dashboard
        </NavLink>

        <NavLink 
          to={ROUTES.ADMIN_PANEL} 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="icon">🛡️</span>
          Admin Panel
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button 
          className="logout-btn"
          onClick={() => { localStorage.clear(); window.location.href = ROUTES.LOGIN; }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
