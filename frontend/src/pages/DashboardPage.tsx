import React from 'react';
import Sidebar from '../components/layout/Sidebar';

/**
 * Main Dashboard landing page.
 * Uses the common dashboard layout with a Sidebar.
 */
const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-content">
        <header className="content-header">
          <h1 className="text-gradient">Welcome back, Admin</h1>
          <p>Here is an overview of the MIS system status.</p>
        </header>

        <div className="admin-actions">
          <div className="admin-card">
            <h2>System Overview</h2>
            <p>Use the sidebar to manage branches, departments, and user roles.</p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <div className="glass" style={{ padding: '1.5rem', borderRadius: '1rem', flex: 1 }}>
                <h3>10</h3>
                <p style={{ opacity: 0.7 }}>Total Branches</p>
              </div>
              <div className="glass" style={{ padding: '1.5rem', borderRadius: '1rem', flex: 1 }}>
                <h3>42</h3>
                <p style={{ opacity: 0.7 }}>Departments</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
