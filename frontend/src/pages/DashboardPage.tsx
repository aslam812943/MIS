import React from 'react';
import Sidebar from '../components/layout/Sidebar';

/**
 * Main Dashboard landing page.
 * Uses the common dashboard layout with a Sidebar.
 */
const DashboardPage: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <Sidebar />
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">Welcome back, Admin</h1>
          <p className="text-slate-400">Here is an overview of the MIS system status.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8">
            <h2 className="text-xl font-bold mb-4">System Overview</h2>
            <p className="text-slate-400 mb-8">Use the sidebar to manage branches, departments, and user roles.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-3xl font-bold text-indigo-400">10</h3>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">Total Branches</p>
              </div>
              <div className="bg-white/5 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-3xl font-bold text-purple-400">42</h3>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">Departments</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
