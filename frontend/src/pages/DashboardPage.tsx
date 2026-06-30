import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import DashboardLayout from '../components/layout/DashboardLayout';
import { orgService } from '../services/org.service';
import { authService } from '../services/auth.service';

Chart.register(...registerables);

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

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconUserPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const IconUserMinus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

/**
 * Main Dashboard landing page.
 */
const DashboardPage: React.FC = () => {
  const user = authService.getCurrentUser();
  const showHRDashboard = user?.role === 'admin' || user?.role === 'hr';

  const [stats, setStats] = useState({ branches: 0, departments: 0, users: 0, modules: 0 });
  const [hrData, setHRData] = useState<any>(null);
  const [dashboardTab, setDashboardTab] = useState<'system' | 'hr'>(showHRDashboard ? 'hr' : 'system');
  const [loading, setLoading] = useState(true);
  const [hrLoading, setHRLoading] = useState(false);

  // Filter states
  const [filterRange, setFilterRange] = useState<string>('6m');
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });

  // Chart refs
  const growthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const branchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const deptCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const growthChartInstance = useRef<Chart | null>(null);
  const branchChartInstance = useRef<Chart | null>(null);
  const deptChartInstance = useRef<Chart | null>(null);

  const fetchHRData = async (rangeVal: string, dates = customDates) => {
    if (!showHRDashboard) return;
    setHRLoading(true);
    try {
      const params: any = { range: rangeVal };
      if (rangeVal === 'custom') {
        params.startDate = dates.startDate;
        params.endDate = dates.endDate;
      }
      const data = await orgService.getHRDashboardData(params);
      setHRData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHRLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      orgService.getBranches(),
      orgService.getDepartments(),
      orgService.getUsers(),
      orgService.getModules()
    ])
      .then(([b, d, u, m]) => {
        setStats({
          branches: b.length,
          departments: d.length,
          users: u.length,
          modules: m.length
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    if (showHRDashboard) {
      fetchHRData('6m');
    }
  }, [showHRDashboard]);

  // Chart renderer useEffect
  useEffect(() => {
    if (!hrData || dashboardTab !== 'hr') return;

    // ── 1. GROWTH CHART (LINE) ───────────────────
    if (growthCanvasRef.current) {
      if (growthChartInstance.current) {
        growthChartInstance.current.destroy();
      }
      const ctx = growthCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrData.charts.growth.map((d: any) => d.month);
        const dataValues = hrData.charts.growth.map((d: any) => d.count);
        
        // Generate a smooth theme-aligned gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        growthChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Active Employees',
              data: dataValues,
              borderColor: '#06b6d4',
              backgroundColor: gradient,
              tension: 0.3,
              fill: true,
              borderWidth: 3,
              pointBackgroundColor: '#06b6d4',
              pointBorderColor: '#090d16',
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(9, 13, 22, 0.95)',
                titleColor: '#fff',
                bodyColor: '#22d3ee',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                padding: 10
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { family: 'inherit' } } },
              y: { 
                grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
                ticks: { color: 'rgba(255, 255, 255, 0.6)', stepSize: 1, font: { family: 'inherit' } },
                beginAtZero: true
              }
            }
          }
        });
      }
    }

    // ── 2. BRANCH CHART (DOUGHNUT) ───────────
    if (branchCanvasRef.current) {
      if (branchChartInstance.current) {
        branchChartInstance.current.destroy();
      }
      const ctx = branchCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrData.charts.branchDistribution.map((d: any) => d.name);
        const dataValues = hrData.charts.branchDistribution.map((d: any) => d.value);
        branchChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: dataValues,
              backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'],
              borderWidth: 2,
              borderColor: '#090d16'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { 
                position: 'bottom',
                labels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 11, family: 'inherit' }, padding: 15 }
              },
              tooltip: {
                backgroundColor: 'rgba(9, 13, 22, 0.95)',
                titleColor: '#fff',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                padding: 10
              }
            }
          }
        });
      }
    }

    // ── 3. DEPARTMENT CHART (BAR) ───────────────
    if (deptCanvasRef.current) {
      if (deptChartInstance.current) {
        deptChartInstance.current.destroy();
      }
      const ctx = deptCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrData.charts.departmentDistribution.map((d: any) => d.name);
        const dataValues = hrData.charts.departmentDistribution.map((d: any) => d.value);
        deptChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Headcount',
              data: dataValues,
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
              borderColor: '#10b981',
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(9, 13, 22, 0.95)',
                titleColor: '#fff',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                padding: 10
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { family: 'inherit' } } },
              y: { 
                grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
                ticks: { color: 'rgba(255, 255, 255, 0.6)', stepSize: 1, font: { family: 'inherit' } },
                beginAtZero: true
              }
            }
          }
        });
      }
    }

    return () => {
      if (growthChartInstance.current) growthChartInstance.current.destroy();
      if (branchChartInstance.current) branchChartInstance.current.destroy();
      if (deptChartInstance.current) deptChartInstance.current.destroy();
    };
  }, [hrData, dashboardTab]);

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl">
        <header className="mis-page-header">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="mis-page-title mis-page-title-accent">Welcome back</h1>
              <p className="mis-page-desc">
                {showHRDashboard 
                  ? 'Overview of your HR metrics and MIS environment settings.' 
                  : 'Overview of your MIS environment. Use the sidebar to open assigned modules and tools.'}
              </p>
            </div>
            
            {showHRDashboard && (
              <div className="mis-tabs border-0 p-0 m-0 shrink-0 self-start md:self-center" style={{ background: 'rgba(0,0,0,0.15)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <button 
                  type="button" 
                  onClick={() => setDashboardTab('hr')}
                  className={`mis-tab py-1.5 px-4 text-xs font-semibold rounded-[var(--radius-sm)] ${dashboardTab === 'hr' ? 'active' : ''}`}
                  style={{ marginBottom: 0 }}
                >
                  HR Dashboard
                </button>
                <button 
                  type="button" 
                  onClick={() => setDashboardTab('system')}
                  className={`mis-tab py-1.5 px-4 text-xs font-semibold rounded-[var(--radius-sm)] ${dashboardTab === 'system' ? 'active' : ''}`}
                  style={{ marginBottom: 0 }}
                >
                  System Overview
                </button>
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <div className="mis-empty py-20">Loading dashboard metrics...</div>
        ) : dashboardTab === 'hr' && hrData ? (
          /* ── HR Dashboard Tab ──────────────────────────────────── */
          <div className="space-y-8">
            {/* Filter Bar */}
            <div className="mis-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 mr-2" style={{ color: 'var(--text-secondary)' }}>Filter Period:</span>
                {[
                  { id: 'this_month', label: 'This Month' },
                  { id: '6m', label: 'Last 6 Months' },
                  { id: '1y', label: 'Last 1 Year' },
                  { id: 'custom', label: 'Custom Range' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setFilterRange(opt.id);
                      if (opt.id !== 'custom') {
                        fetchHRData(opt.id);
                      }
                    }}
                    className={`mis-btn mis-btn-sm py-1.5 px-4 font-semibold text-xs transition-all ${
                      filterRange === opt.id
                        ? 'mis-btn-primary'
                        : 'mis-btn-ghost'
                    }`}
                    style={
                      filterRange === opt.id
                        ? { background: 'var(--accent)', color: 'black', border: 'none' }
                        : {}
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {filterRange === 'custom' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchHRData('custom');
                  }}
                  className="flex flex-wrap items-center gap-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      required
                      className="mis-input text-xs py-1.5 px-3"
                      value={customDates.startDate}
                      onChange={(e) => setCustomDates({ ...customDates, startDate: e.target.value })}
                      style={{ width: '135px' }}
                    />
                    <span className="text-xs opacity-60">to</span>
                    <input
                      type="date"
                      required
                      className="mis-input text-xs py-1.5 px-3"
                      value={customDates.endDate}
                      onChange={(e) => setCustomDates({ ...customDates, endDate: e.target.value })}
                      style={{ width: '135px' }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="mis-btn mis-btn-primary mis-btn-sm py-1.5 px-4 font-semibold text-xs"
                    style={{ background: 'var(--accent)', color: 'black', border: 'none' }}
                  >
                    Apply
                  </button>
                </form>
              )}
            </div>

            {hrLoading ? (
              <div className="mis-empty py-20">Refreshing HR metrics...</div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(6, 182, 212, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total Employees</div>
                      <div className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>{hrData.kpis.totalEmployees}</div>
                      <div className="text-xs opacity-50 mt-1">Currently working (Active)</div>
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent)' }}>
                      <IconUsers />
                    </div>
                  </div>

                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>New Joiners</div>
                      <div className="text-3xl font-bold" style={{ color: '#10b981' }}>{hrData.kpis.newJoiners}</div>
                      <div className="text-xs opacity-50 mt-1">Joined in selected period</div>
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                      <IconUserPlus />
                    </div>
                  </div>

                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Resignations</div>
                      <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>{hrData.kpis.resignations}</div>
                      <div className="text-xs opacity-50 mt-1">Resigned in selected period</div>
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                      <IconUserMinus />
                    </div>
                  </div>
                </div>

                {/* Growth & Distribution charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="mis-card p-6 lg:col-span-2 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Employee Growth</h3>
                      <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>Trend of active employees headcount over the selected period.</p>
                    </div>
                    <div className="h-[300px] w-full relative">
                      <canvas ref={growthCanvasRef} />
                    </div>
                  </div>

                  <div className="mis-card p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Branch Distribution</h3>
                      <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>Total headcount divided across all regional branches.</p>
                    </div>
                    <div className="h-[300px] w-full relative">
                      <canvas ref={branchCanvasRef} />
                    </div>
                  </div>
                </div>

                {/* Department-wise employees */}
                <div className="mis-card p-6">
                  <div>
                    <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Department Distribution</h3>
                    <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>Total headcount divided across organizational departments.</p>
                  </div>
                  <div className="h-[300px] w-full relative">
                    <canvas ref={deptCanvasRef} />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ── System Overview Tab ───────────────────────────────── */
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
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
