import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PeriodFilter from '../../components/common/PeriodFilter';
import TrendDelta from '../../components/common/TrendDelta';
import { dpService } from '../../services/dp.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';
import type { DateRange } from '../../utils/periodRange';

Chart.register(...registerables);

// Icon components for KPI cards
const IconAccount = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconModification = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconDemat = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 16 7 12 11 16 17 10 21 14"/>
    <path d="M14 6h6v6"/>
  </svg>
);

const IconQuery = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="9" width="20" height="12" rx="2" ry="2"/>
    <path d="M12 2v7"/>
    <path d="M17 5H7"/>
  </svg>
);

const IconAudit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const DPDashboardPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const { theme } = useTheme();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');
  const userBranchId = currentUser?.branch_id || '';

  const [stats, setStats] = useState<any>(null);
  const [previousStats, setPreviousStats] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [period, setPeriod] = useState<{ current: DateRange; previous: DateRange } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chart refs
  const openingsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const disCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const queriesCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances
  const openingsChartInstance = useRef<Chart | null>(null);
  const disChartInstance = useRef<Chart | null>(null);
  const queriesChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (!period) return;
    fetchDashboardStats(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, period]);

  const fetchBranches = async () => {
    if (!hasMultiBranchAccess) return;
    try {
      const data = await orgService.getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error('Failed to load branches', err);
    }
  };

  const fetchDashboardStats = async (initial = false) => {
    if (!period) return;
    if (initial) setLoading(true);
    else setRefreshing(true);

    const branchIdParam = hasMultiBranchAccess ? (branchFilter || undefined) : userBranchId;
    // Fired together, but only the current-period call blocks the loading
    // state — the dashboard renders as soon as it's back instead of
    // waiting on the previous-period comparison too.
    const currentPromise = dpService.getDashboardData(branchIdParam, period.current.start, period.current.end);
    const previousPromise = dpService.getDashboardData(branchIdParam, period.previous.start, period.previous.end);

    try {
      setStats(await currentPromise);
      if (!initial) {
        toast.success('Dashboard metrics updated.');
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
      toast.error('Failed to load DP dashboard analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    previousPromise.then(setPreviousStats).catch(() => {});
  };

  // Render Chart.js instances
  useEffect(() => {
    if (!stats) return;

    // Chart tick/legend/grid colors were previously hardcoded for the dark
    // theme, which made axis numbers invisible against a light-mode white
    // background. Derive them from the active theme instead.
    const isDark = theme === 'dark';
    const tickColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.08)';
    const legendColor = isDark ? '#cbd5e1' : '#334155';

    // 1. Line Chart: Account Openings
    if (openingsCanvasRef.current) {
      if (openingsChartInstance.current) openingsChartInstance.current.destroy();
      const ctx = openingsCanvasRef.current.getContext('2d');
      if (ctx) {
        openingsChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
              label: 'New Demat Accounts',
              data: stats.charts.accountOpenings,
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              borderWidth: 2,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: '#06b6d4'
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

    // 2. Donut Chart: DIS Scan Upload Status
    if (disCanvasRef.current) {
      if (disChartInstance.current) disChartInstance.current.destroy();
      const ctx = disCanvasRef.current.getContext('2d');
      if (ctx) {
        disChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Uploaded', 'Pending', 'Failed'],
            datasets: [{
              data: stats.charts.disUploadStatus,
              backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
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
                labels: { color: legendColor, font: { size: 11 }, boxWidth: 12 }
              }
            },
            cutout: '65%'
          }
        });
      }
    }

    // 3. Bar Chart: Query Types Distribution
    if (queriesCanvasRef.current) {
      if (queriesChartInstance.current) queriesChartInstance.current.destroy();
      const ctx = queriesCanvasRef.current.getContext('2d');
      if (ctx) {
        queriesChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: stats.charts.queryLabels,
            datasets: [{
              data: stats.charts.queryTypes,
              backgroundColor: '#a855f7',
              borderRadius: 4
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
        
        {/* Dynamic header panel card */}
        <header 
          className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 p-6 border rounded-xl shadow-xs text-left"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="text-center lg:text-left w-full lg:w-auto">
            <h1 className="text-2.5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              📊 DP Department Analytics
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Real-time monitoring of client accounts, modifications requests, demat conversions, and DIS scan updates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 sm:self-auto">
            <PeriodFilter onChange={p => setPeriod({ current: p.current, previous: p.previous })} />
            {hasMultiBranchAccess && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="mis-select text-xs cursor-pointer"
                style={{ width: '150px', minWidth: '150px', padding: '6px 12px' }}
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => fetchDashboardStats(false)}
              disabled={refreshing}
              className="px-3.5 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 h-[34px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', minWidth: '135px' }}
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh Metrics'}
            </button>
            <Link
              to="/comparison/dp"
              className="px-3.5 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 h-[34px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              🔀 Compare Periods
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="py-24 text-xs font-semibold text-slate-500 animate-pulse text-center">
            Fetching DP Department dashboard stats...
          </div>
        ) : !stats ? (
          <div className="py-24 text-xs text-slate-400 text-center">
            Failed to retrieve dashboard aggregation data.
          </div>
        ) : (
          <>
            {/* KPI statistics cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              
              <div className="mis-stat-card border-l-4 border-cyan-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Total DP Accounts</span>
                  <span className="text-cyan-500 opacity-85"><IconAccount /></span>
                </div>
                <div className="mis-stat-value text-3xl font-bold text-left">{stats.kpis.totalAccounts}</div>
                <p className="text-[10px] mt-1 text-left animate-pulse text-cyan-400">Total processed</p>
                <TrendDelta current={stats.kpis.totalAccounts} previous={previousStats?.kpis?.totalAccounts} />
              </div>

              <div className="mis-stat-card border-l-4 border-amber-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Pending Modifications</span>
                  <span className="text-amber-500 opacity-85"><IconModification /></span>
                </div>
                <div className="mis-stat-value text-3xl font-bold text-left">{stats.kpis.pendingModifications}</div>
                <p className="text-[10px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Requires processing</p>
                <TrendDelta current={stats.kpis.pendingModifications} previous={previousStats?.kpis?.pendingModifications} />
              </div>

              <div className="mis-stat-card border-l-4 border-emerald-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Completed Demats</span>
                  <span className="text-emerald-500 opacity-85"><IconDemat /></span>
                </div>
                <div className="mis-stat-value text-3xl font-bold text-left">{stats.kpis.completedDemats}</div>
                <p className="text-[10px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Confirmed by RTA</p>
                <TrendDelta current={stats.kpis.completedDemats} previous={previousStats?.kpis?.completedDemats} />
              </div>

              <div className="mis-stat-card border-l-4 border-purple-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Active Queries</span>
                  <span className="text-purple-500 opacity-85"><IconQuery /></span>
                </div>
                <div className="mis-stat-value text-3xl font-bold text-left">{stats.kpis.activeQueries}</div>
                <p className="text-[10px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Open support tickets</p>
                <TrendDelta current={stats.kpis.activeQueries} previous={previousStats?.kpis?.activeQueries} />
              </div>

              <div className="mis-stat-card border-l-4 border-red-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Open Audits</span>
                  <span className="text-red-500 opacity-85"><IconAudit /></span>
                </div>
                <div className="mis-stat-value text-3xl font-bold text-left">{stats.kpis.openAudits}</div>
                <p className="text-[10px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Action pending</p>
                <TrendDelta current={stats.kpis.openAudits} previous={previousStats?.kpis?.openAudits} />
              </div>

            </section>

            {/* Graphs sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Line trend chart */}
              <div className="mis-card p-5 lg:col-span-2">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📈 Monthly Account Openings Trend
                </h3>
                <div className="h-64 relative">
                  <canvas ref={openingsCanvasRef}></canvas>
                </div>
              </div>

              {/* Donut chart */}
              <div className="mis-card p-5">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🍩 DIS CDAS Scan Upload Status
                </h3>
                <div className="h-64 relative">
                  <canvas ref={disCanvasRef}></canvas>
                </div>
              </div>

              {/* Bar distribution chart */}
              <div className="mis-card p-5 lg:col-span-3">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📊 Client Support Queries by Category
                </h3>
                <div className="h-64 relative">
                  <canvas ref={queriesCanvasRef}></canvas>
                </div>
              </div>

            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default DPDashboardPage;
