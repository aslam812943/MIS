import React, { useState } from 'react';
import { LayoutContext } from './LayoutContext';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared layout wrapper for all authenticated pages.
 * Manages the sidebar open/close state for mobile responsiveness.
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div className="mis-layout">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="mis-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="mis-main-wrapper">
          {/* Mobile top bar */}
          <header className="mis-topbar">
            <button
              className="mis-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <span />
              <span />
              <span />
            </button>
            <span className="mis-topbar-brand">MIS Portal</span>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
};

export default DashboardLayout;
