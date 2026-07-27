import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import CountdownBadge from '../../components/common/CountdownBadge';
import PeriodFilter from '../../components/common/PeriodFilter';
import TrendDelta from '../../components/common/TrendDelta';
import { itService } from '../../services/it.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';
import { useDashboardPermissions } from '../../hooks/useDashboardPermissions';
import type { DateRange } from '../../utils/periodRange';

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

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 7 12 12 15.5 14"/>
  </svg>
);

const IconReceipt = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 2z"/>
    <line x1="8" y1="7" x2="16" y2="7"/>
    <line x1="8" y1="11" x2="16" y2="11"/>
    <line x1="8" y1="15" x2="12" y2="15"/>
  </svg>
);

const ITDashboardPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const { theme } = useTheme();
  const { isVisible } = useDashboardPermissions();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');

  const [stats, setStats] = useState<any>(null);
  const [previousStats, setPreviousStats] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [period, setPeriod] = useState<{ current: DateRange; previous: DateRange } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chart Canvas Refs
  const ageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const categoryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const warrantyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inventoryTypeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart Instances Refs
  const ageChartInstance = useRef<Chart | null>(null);
  const categoryChartInstance = useRef<Chart | null>(null);
  const warrantyChartInstance = useRef<Chart | null>(null);
  const inventoryTypeChartInstance = useRef<Chart | null>(null);

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

  const fetchDashboardStats = async (showLoading = false) => {
    if (!period) return;
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    // Fired together, but only the current-period call blocks the loading
    // state — the dashboard renders as soon as it's back instead of
    // waiting on the previous-period comparison too. Trend badges just
    // pop in a moment later once that resolves.
    const currentPromise = itService.getDashboardData(branchFilter || undefined, period.current.start, period.current.end);
    const previousPromise = itService.getDashboardData(branchFilter || undefined, period.previous.start, period.previous.end);

    try {
      setStats(await currentPromise);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load IT dashboard analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    previousPromise.then(setPreviousStats).catch(() => {});
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

    // 4. Donut Chart: Asset Inventory by Type
    if (inventoryTypeCanvasRef.current) {
      if (inventoryTypeChartInstance.current) inventoryTypeChartInstance.current.destroy();
      const ctx = inventoryTypeCanvasRef.current.getContext('2d');
      if (ctx && stats.charts.inventoryByType) {
        inventoryTypeChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: stats.charts.inventoryByTypeLabels,
            datasets: [{
              data: stats.charts.inventoryByType,
              backgroundColor: ['#6366f1', '#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6', '#f43f5e', '#64748b', '#ef4444'],
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

  }, [stats, theme]);

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">

        {/* Header Section */}
        <header
          className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 p-6 border rounded-xl shadow-xs text-left"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="text-center lg:text-left w-full lg:w-auto">
            <h1 className="text-2.5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              📊 IT Compliance & Asset Analytics
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Real-time monitoring of SEBI CSCRF audits, hardware warranties, system availability, and book value depreciation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end lg:self-auto">
            <PeriodFilter onChange={p => setPeriod({ current: p.current, previous: p.previous })} />
            {hasMultiBranchAccess && (
              <select
                className="mis-select w-44 text-xs cursor-pointer"
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => fetchDashboardStats(false)}
              disabled={refreshing}
              className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              {refreshing ? 'Refreshing...' : '🔄 Sync Data'}
            </button>
            <Link
              to="/comparison/it"
              className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              🔀 Compare Periods
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Compiling IT stats metrics...</div>
        ) : !stats ? (
          <div className="text-center py-20 text-red-400">Failed to aggregate IT dashboard data.</div>
        ) : (
          <>
            {/* KPI statistics cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              {isVisible('it.kpi.total_users') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(6, 182, 212, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total Users</div>
                  <div className="text-3xl font-bold" style={{ color: '#06b6d4' }}>{stats.kpis.totalUsers}</div>
                  <div className="text-xs opacity-50 mt-1">Active personnel</div>
                  <TrendDelta current={stats.kpis.totalUsers} previous={previousStats?.kpis?.totalUsers} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}><IconUsers /></div>
              </div>
              )}

              {isVisible('it.kpi.active_devices') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Active Devices</div>
                  <div className="text-3xl font-bold" style={{ color: '#10b981' }}>{stats.kpis.activeDevices}</div>
                  <div className="text-xs opacity-50 mt-1">Monitored assets</div>
                  <TrendDelta current={stats.kpis.activeDevices} previous={previousStats?.kpis?.activeDevices} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><IconDevice /></div>
              </div>
              )}

              {isVisible('it.kpi.open_tickets') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Open Tickets</div>
                  <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{stats.kpis.openTickets}</div>
                  <div className="text-xs mt-1 text-amber-400 animate-pulse">Action pending</div>
                  <TrendDelta current={stats.kpis.openTickets} previous={previousStats?.kpis?.openTickets} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><IconTicket /></div>
              </div>
              )}

              {isVisible('it.kpi.critical_incidents') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Critical Incidents</div>
                  <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>{stats.kpis.criticalIncidents}</div>
                  <div className="text-xs opacity-50 mt-1">Unresolved CSCRF</div>
                  <TrendDelta current={stats.kpis.criticalIncidents} previous={previousStats?.kpis?.criticalIncidents} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><IconIncident /></div>
              </div>
              )}

              {isVisible('it.kpi.system_uptime') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(59, 130, 246, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>System Uptime</div>
                  <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>{stats.kpis.systemAvailability}%</div>
                  <div className="text-xs opacity-50 mt-1">Calculated average</div>
                  <TrendDelta current={stats.kpis.systemAvailability} previous={previousStats?.kpis?.systemAvailability} isPercentagePoint />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><IconAvailability /></div>
              </div>
              )}

              {isVisible('it.kpi.sla_met') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>SLA Met</div>
                  <div className="text-3xl font-bold" style={{ color: '#6366f1' }}>{stats.kpis.slaCompliance}%</div>
                  <div className="text-xs opacity-50 mt-1">Compliance target</div>
                  <TrendDelta current={stats.kpis.slaCompliance} previous={previousStats?.kpis?.slaCompliance} isPercentagePoint />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}><IconCompliance /></div>
              </div>
              )}

              {isVisible('it.kpi.ongoing_projects') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Ongoing Projects</div>
                  <div className="text-3xl font-bold" style={{ color: '#a855f7' }}>{stats.kpis.ongoingProjects}</div>
                  <div className="text-xs opacity-50 mt-1">Delivery cycle</div>
                  <TrendDelta current={stats.kpis.ongoingProjects} previous={previousStats?.kpis?.ongoingProjects} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><IconProject /></div>
              </div>
              )}

              {isVisible('it.kpi.audits_overdue') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Audits Overdue</div>
                  <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>{stats.kpis.auditsOverdue}</div>
                  <div className="text-xs mt-1 text-red-400 animate-pulse">Past next due date</div>
                  <TrendDelta current={stats.kpis.auditsOverdue} previous={previousStats?.kpis?.auditsOverdue} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><IconClock /></div>
              </div>
              )}

              {isVisible('it.kpi.amc_due_30d') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>AMC Due (30d)</div>
                  <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{stats.kpis.amcDueSoon}</div>
                  <div className="text-xs opacity-50 mt-1">Renewals approaching</div>
                  <TrendDelta current={stats.kpis.amcDueSoon} previous={previousStats?.kpis?.amcDueSoon} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><IconClock /></div>
              </div>
              )}

              {isVisible('it.kpi.pos_raised') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(20, 184, 166, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>POs Raised</div>
                  <div className="text-3xl font-bold" style={{ color: '#14b8a6' }}>{stats.kpis.posRaised}</div>
                  <div className="text-xs opacity-50 mt-1">Logged this period</div>
                  <TrendDelta current={stats.kpis.posRaised} previous={previousStats?.kpis?.posRaised} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}><IconReceipt /></div>
              </div>
              )}

              {isVisible('it.kpi.total_po_value') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total PO Value</div>
                  <div className="text-3xl font-bold" style={{ color: '#10b981' }}>₹{stats.kpis.totalPoValue.toLocaleString('en-IN')}</div>
                  <div className="text-xs opacity-50 mt-1">Sum of logged POs</div>
                  <TrendDelta current={stats.kpis.totalPoValue} previous={previousStats?.kpis?.totalPoValue} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><IconReceipt /></div>
              </div>
              )}

              {isVisible('it.kpi.total_inventory_items') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total Inventory Items</div>
                  <div className="text-3xl font-bold" style={{ color: '#6366f1' }}>{stats.kpis.totalInventoryItems}</div>
                  <div className="text-xs opacity-50 mt-1">Tracked in Asset Inventory</div>
                  <TrendDelta current={stats.kpis.totalInventoryItems} previous={previousStats?.kpis?.totalInventoryItems} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}><IconDevice /></div>
              </div>
              )}

              {isVisible('it.kpi.high_criticality_inventory') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>High Criticality Assets</div>
                  <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>{stats.kpis.highCriticalityInventory}</div>
                  <div className="text-xs opacity-50 mt-1">Rated High criticality</div>
                  <TrendDelta current={stats.kpis.highCriticalityInventory} previous={previousStats?.kpis?.highCriticalityInventory} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><IconIncident /></div>
              </div>
              )}

            </section>

            {/* Compliance & Renewals countdown section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Recurring audit schedule cards */}
              {isVisible('it.chart.audit_filing_countdown') && (
              <div className="mis-card p-5 lg:col-span-1">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🗓️ Audit Filing Countdown (HO)
                </h3>
                {stats.compliance?.auditSchedule?.length ? (
                  <div className="space-y-3">
                    {stats.compliance.auditSchedule.map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{a.audit_type}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                            Due {a.next_due_date ? new Date(a.next_due_date).toLocaleDateString('en-IN') : '—'}
                          </div>
                        </div>
                        <CountdownBadge dueDate={a.next_due_date} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--text-secondary)' }}>No audit schedule entries yet.</p>
                )}
              </div>
              )}

              {/* Upcoming AMC renewals */}
              {isVisible('it.chart.upcoming_amc_renewals') && (
              <div className="mis-card p-5 lg:col-span-1">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🛠️ Upcoming AMC Renewals
                </h3>
                {stats.compliance?.upcomingAmc?.length ? (
                  <div className="space-y-3">
                    {stats.compliance.upcomingAmc.map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{a.item_covered}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{a.vendor_name || '—'}</div>
                        </div>
                        <CountdownBadge dueDate={a.amc_renewal_date} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--text-secondary)' }}>No AMC contracts recorded yet.</p>
                )}
              </div>
              )}

              {/* Expiring software licenses */}
              {isVisible('it.chart.software_licenses_expiring') && (
              <div className="mis-card p-5 lg:col-span-1">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  💿 Software Licenses Expiring
                </h3>
                {stats.compliance?.expiringSoftware?.length ? (
                  <div className="space-y-3">
                    {stats.compliance.expiringSoftware.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{s.software_name}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{s.status}</div>
                        </div>
                        <CountdownBadge dueDate={s.amc_renewal_date} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--text-secondary)' }}>No software licenses recorded yet.</p>
                )}
              </div>
              )}

            </div>

            {/* Graphs sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Bar distribution chart: Asset useful age */}
              {isVisible('it.chart.asset_life_age_brackets') && (
              <div className="mis-card p-5 lg:col-span-2">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📊 Useful Asset Life Age brackets
                </h3>
                <div className="h-64 relative">
                  <canvas ref={ageCanvasRef}></canvas>
                </div>
              </div>
              )}

              {/* Donut chart: Categories */}
              {isVisible('it.chart.device_category_distribution') && (
              <div className="mis-card p-5">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🍩 Device Category Distribution
                </h3>
                <div className="h-64 relative">
                  <canvas ref={categoryCanvasRef}></canvas>
                </div>
              </div>
              )}

              {/* Line trend chart: Expiries */}
              {isVisible('it.chart.warranty_expiries') && (
              <div className="mis-card p-5 lg:col-span-3">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📈 Upcoming Hardware & Software Warranty Expiries (Next 12 Months)
                </h3>
                <div className="h-64 relative">
                  <canvas ref={warrantyCanvasRef}></canvas>
                </div>
              </div>
              )}

              {/* Donut chart: Asset Inventory by Type */}
              {isVisible('it.chart.inventory_by_type') && (
              <div className="mis-card p-5 lg:col-span-3">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🖥️ Asset Inventory by Type
                </h3>
                <div className="h-64 relative">
                  <canvas ref={inventoryTypeCanvasRef}></canvas>
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

export default ITDashboardPage;
