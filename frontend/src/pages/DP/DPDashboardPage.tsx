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
import { useDashboardPermissions } from '../../hooks/useDashboardPermissions';
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
  const { isVisible } = useDashboardPermissions();
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
          className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 p-4 border rounded-xl shadow-xs text-left"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="text-center lg:text-left w-full lg:w-auto">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
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
              className="px-3 py-1 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 h-[30px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', minWidth: '135px' }}
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh Metrics'}
            </button>
            <Link
              to="/comparison/dp"
              className="px-3 py-1 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 h-[30px]"
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
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              {isVisible('dp.kpi.total_dp_accounts') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(6, 182, 212, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total DP Accounts</div>
                  <div className="text-3xl font-bold" style={{ color: '#06b6d4' }}>{stats.kpis.totalAccounts}</div>
                  <div className="text-xs mt-1 animate-pulse text-cyan-400">Total processed</div>
                  <TrendDelta current={stats.kpis.totalAccounts} previous={previousStats?.kpis?.totalAccounts} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}><IconAccount /></div>
              </div>
              )}

              {isVisible('dp.kpi.pending_modifications') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Pending Modifications</div>
                  <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{stats.kpis.pendingModifications}</div>
                  <div className="text-xs opacity-50 mt-1">Requires processing</div>
                  <TrendDelta current={stats.kpis.pendingModifications} previous={previousStats?.kpis?.pendingModifications} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><IconModification /></div>
              </div>
              )}

              {isVisible('dp.kpi.completed_demats') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Completed Demats</div>
                  <div className="text-3xl font-bold" style={{ color: '#10b981' }}>{stats.kpis.completedDemats}</div>
                  <div className="text-xs opacity-50 mt-1">Confirmed by RTA</div>
                  <TrendDelta current={stats.kpis.completedDemats} previous={previousStats?.kpis?.completedDemats} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><IconDemat /></div>
              </div>
              )}

              {isVisible('dp.kpi.active_queries') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Active Queries</div>
                  <div className="text-3xl font-bold" style={{ color: '#a855f7' }}>{stats.kpis.activeQueries}</div>
                  <div className="text-xs opacity-50 mt-1">Open support tickets</div>
                  <TrendDelta current={stats.kpis.activeQueries} previous={previousStats?.kpis?.activeQueries} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><IconQuery /></div>
              </div>
              )}

              {isVisible('dp.kpi.open_audits') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Open Audits</div>
                  <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>{stats.kpis.openAudits}</div>
                  <div className="text-xs opacity-50 mt-1">Action pending</div>
                  <TrendDelta current={stats.kpis.openAudits} previous={previousStats?.kpis?.openAudits} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><IconAudit /></div>
              </div>
              )}

            </section>

            {/* Graphs sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Line trend chart */}
              {isVisible('dp.chart.monthly_account_openings_trend') && (
              <div className="mis-card p-5 lg:col-span-2">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📈 Monthly Account Openings Trend
                </h3>
                <div className="h-64 relative">
                  <canvas ref={openingsCanvasRef}></canvas>
                </div>
              </div>
              )}

              {/* Donut chart */}
              {isVisible('dp.chart.dis_cdas_scan_upload_status') && (
              <div className="mis-card p-5">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🍩 DIS CDAS Scan Upload Status
                </h3>
                <div className="h-64 relative">
                  <canvas ref={disCanvasRef}></canvas>
                </div>
              </div>
              )}

              {/* Bar distribution chart */}
              {isVisible('dp.chart.client_support_queries_by_category') && (
              <div className="mis-card p-5 lg:col-span-3">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📊 Client Support Queries by Category
                </h3>
                <div className="h-64 relative">
                  <canvas ref={queriesCanvasRef}></canvas>
                </div>
              </div>
              )}

            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default DPDashboardPage;
