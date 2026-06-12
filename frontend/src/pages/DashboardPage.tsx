import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { orgService } from '../services/org.service';

const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-15.5z" />
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

/**
 * Main Dashboard landing page.
 */
const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState({ branches: 0, departments: 0, users: 0, modules: 0 });

  useEffect(() => {
    Promise.all([
      orgService.getBranches(),
      orgService.getDepartments(),
      orgService.getUsers(),
      orgService.getModules()
    ]).then(([b, d, u, m]) => {
      setStats({
        branches: b.length,
        departments: d.length,
        users: u.length,
        modules: m.length
      });
    }).catch(console.error);
  }, []);

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-6xl">
        <header className="mis-page-header">
          <h1 className="mis-page-title mis-page-title-accent">Welcome back</h1>
          <p className="mis-page-desc">
            Overview of your MIS environment. Use the sidebar to open assigned modules and tools.
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          <div className="mis-card p-6 sm:p-8">
            <h2 className="mis-section-title">System Overview</h2>
            <p className="mis-section-desc">Real-time metrics for organization hierarchy and users.</p>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="mis-stat-card">
                <div className="mis-stat-value accent">{stats.branches}</div>
                <div className="mis-stat-label">Total Branches</div>
              </div>
              <div className="mis-stat-card">
                <div className="mis-stat-value">{stats.departments}</div>
                <div className="mis-stat-label">Departments</div>
              </div>
              <div className="mis-stat-card">
                <div className="mis-stat-value">{stats.users}</div>
                <div className="mis-stat-label">Active Users</div>
              </div>
              <div className="mis-stat-card">
                <div className="mis-stat-value">{stats.modules}</div>
                <div className="mis-stat-label">Data Modules</div>
              </div>
            </div>
          </div>

          <div className="mis-card p-6 sm:p-8">
            <h2 className="mis-section-title">Quick Actions</h2>
            <p className="mis-section-desc">Common tasks available from the navigation menu.</p>

            <div className="flex flex-col gap-2">
              <button type="button" className="mis-btn mis-btn-ghost mis-action-row">
                <span className="mis-action-icon"><IconEdit /></span>
                <span>Enter new data</span>
              </button>
              <button type="button" className="mis-btn mis-btn-ghost mis-action-row">
                <span className="mis-action-icon"><IconCheck /></span>
                <span>Verify pending entries</span>
              </button>
              <button type="button" className="mis-btn mis-btn-ghost mis-action-row">
                <span className="mis-action-icon"><IconUser /></span>
                <span>Update my profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
