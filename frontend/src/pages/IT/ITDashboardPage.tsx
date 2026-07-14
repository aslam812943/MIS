import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { itService } from '../../services/it.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';

Chart.register(...registerables);

// Icon components for KPI cards
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconDevice = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const IconTicket = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5v2"/>
    <path d="M15 11v2"/>
    <path d="M15 17v2"/>
    <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/>
  </svg>
);

const IconIncident = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconAvailability = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconCompliance = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconProject = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const ITDashboardPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const { theme } = useTheme();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');

  const [stats, setStats] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chart Canvas Refs
  const ageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const categoryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const warrantyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart Instances Refs
  const ageChartInstance = useRef<Chart | null>(null);
  const categoryChartInstance = useRef<Chart | null>(null);
  const warrantyChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchDashboardStats(true);
  }, [branchFilter, startDate, endDate]);

  const fetchBranches = async () => {
    if (!hasMultiBranchAccess) return;
    try {
      const data = await orgService.getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error('Failed to load branches', err);
    }
  };

  const fetchDashboardStats = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await itService.getDashboardData(
        branchFilter || undefined,
        startDate || undefined,
        endDate || undefined
      );
      setStats(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load IT dashboard analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Render Charts whenever stats state updates
  useEffect(() => {
    if (!stats) return;

    const isDark = theme === 'dark';
    const tickColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.08)';
    const legendColor = isDark ? '#cbd5e1' : '#334155';

    // 1. Bar Chart: Asset Age Analysis (0-1 yr, 1-3 yr, 3-5 yr, 5+ yr)
    if (ageCanvasRef.current) {
      if (ageChartInstance.current) ageChartInstance.current.destroy();
      const ctx = ageCanvasRef.current.getContext('2d');
      if (ctx) {
        ageChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ['0-1 Year', '1-3 Years', '3-5 Years', '5+ Years'],
            datasets: [{
              label: 'Asset Count',
              data: stats.charts.ageAnalysis,
              backgroundColor: '#a855f7',
              borderRadius: 6,
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 } },
              x: { grid: { display: false }, ticks: { color: tickColor } }
            }
          }
        });
      }
    }

    // 2. Donut Chart: Asset Category Shares
    if (categoryCanvasRef.current) {
      if (categoryChartInstance.current) categoryChartInstance.current.destroy();
      const ctx = categoryCanvasRef.current.getContext('2d');
      if (ctx) {
        categoryChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: stats.charts.categoryLabels,
            datasets: [{
              data: stats.charts.categories,
              backgroundColor: ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#64748b'],
              borderWidth: 0,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: legendColor, font: { size: 10 }, boxWidth: 10 }
              }
            },
            cutout: '60%'
          }
        });
      }
    }

    // 3. Line Chart: Warranty Expiry Timeline (Next 12 Months)
    if (warrantyCanvasRef.current) {
      if (warrantyChartInstance.current) warrantyChartInstance.current.destroy();
      const ctx = warrantyCanvasRef.current.getContext('2d');
      if (ctx) {
        warrantyChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: stats.charts.warrantyLabels,
            datasets: [{
              label: 'Warranties Expiring',
              data: stats.charts.warrantyExpiries,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointBackgroundColor: '#10b981'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 } },
              x: { grid: { display: false }, ticks: { color: tickColor } }
            }
          }
        });
      }
    }

  }, [stats, theme]);

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">

        {/* Header Section */}
        <header
          className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 p-6 border rounded-xl shadow-xs text-left"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div>
            <h1 className="text-2.5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              📊 IT Compliance & Asset Analytics
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Real-time monitoring of SEBI CSCRF audits, hardware warranties, system availability, and book value depreciation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {hasMultiBranchAccess && (
              <select
                className="mis-select-dropdown"
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded px-2">
              <span className="text-xs text-gray-400">From</span>
              <input
                type="date"
                className="bg-transparent border-0 text-white text-xs p-1.5 focus:ring-0 outline-none"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="text-xs text-gray-400">To</span>
              <input
                type="date"
                className="bg-transparent border-0 text-white text-xs p-1.5 focus:ring-0 outline-none"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            <button 
              className="mis-btn btn-secondary text-xs flex items-center gap-1.5 py-2"
              onClick={() => fetchDashboardStats(false)}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Sync Data'}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Compiling IT stats metrics...</div>
        ) : !stats ? (
          <div className="text-center py-20 text-red-400">Failed to aggregate IT dashboard data.</div>
        ) : (
          <>
            {/* KPI statistics cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
              
              <div className="mis-stat-card border-l-4 border-cyan-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Total Users</span>
                  <span className="text-cyan-500 opacity-80"><IconUsers /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.totalUsers}</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Active personnel</p>
              </div>

              <div className="mis-stat-card border-l-4 border-emerald-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Active Devices</span>
                  <span className="text-emerald-500 opacity-80"><IconDevice /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.activeDevices}</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Monitored assets</p>
              </div>

              <div className="mis-stat-card border-l-4 border-amber-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Open Tickets</span>
                  <span className="text-amber-500 opacity-80"><IconTicket /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.openTickets}</div>
                <p className="text-[9px] mt-1 text-left text-amber-400 animate-pulse">Action pending</p>
              </div>

              <div className="mis-stat-card border-l-4 border-red-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Critical Incidents</span>
                  <span className="text-red-500 opacity-80"><IconIncident /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.criticalIncidents}</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Unresolved CSCRF</p>
              </div>

              <div className="mis-stat-card border-l-4 border-blue-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">System Uptime</span>
                  <span className="text-blue-500 opacity-80"><IconAvailability /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.systemAvailability}%</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Calculated average</p>
              </div>

              <div className="mis-stat-card border-l-4 border-indigo-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">SLA Met</span>
                  <span className="text-indigo-500 opacity-80"><IconCompliance /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.slaCompliance}%</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Compliance target</p>
              </div>

              <div className="mis-stat-card border-l-4 border-purple-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Ongoing Projects</span>
                  <span className="text-purple-500 opacity-80"><IconProject /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.ongoingProjects}</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Delivery cycle</p>
              </div>

            </section>

            {/* Graphs sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Bar distribution chart: Asset useful age */}
              <div className="mis-card p-5 lg:col-span-2">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📊 Useful Asset Life Age brackets
                </h3>
                <div className="h-64 relative">
                  <canvas ref={ageCanvasRef}></canvas>
                </div>
              </div>

              {/* Donut chart: Categories */}
              <div className="mis-card p-5">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🍩 Device Category Distribution
                </h3>
                <div className="h-64 relative">
                  <canvas ref={categoryCanvasRef}></canvas>
                </div>
              </div>

              {/* Line trend chart: Expiries */}
              <div className="mis-card p-5 lg:col-span-3">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📈 Upcoming Hardware & Software Warranty Expiries (Next 12 Months)
                </h3>
                <div className="h-64 relative">
                  <canvas ref={warrantyCanvasRef}></canvas>
                </div>
              </div>

            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default ITDashboardPage;
