import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PeriodFilter from '../../components/common/PeriodFilter';
import TrendDelta from '../../components/common/TrendDelta';
import { financeService } from '../../services/finance.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';
import { useDashboardPermissions } from '../../hooks/useDashboardPermissions';
import type { DateRange } from '../../utils/periodRange';

Chart.register(...registerables);

// Icon components for KPI cards
const IconRevenue = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const IconProfit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const IconMargin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19"/>
    <circle cx="6.5" cy="6.5" r="2.5"/>
    <circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
);

const IconCostRatio = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
  </svg>
);

const IconLiquidity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v16"/>
  </svg>
);

const IconRenewals = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconRequests = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const FinanceDashboardPage: React.FC = () => {
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
  const revenueTrendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const duesCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart Instances Refs
  const revenueTrendChartInstance = useRef<Chart | null>(null);
  const compositionChartInstance = useRef<Chart | null>(null);
  const duesChartInstance = useRef<Chart | null>(null);

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
    // waiting on the previous-period comparison too.
    const currentPromise = financeService.getDashboardData(branchFilter || undefined, period.current.start, period.current.end);
    const previousPromise = financeService.getDashboardData(branchFilter || undefined, period.previous.start, period.previous.end);

    try {
      setStats(await currentPromise);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load Finance dashboard analytics.');
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

    // 1. Stacked Bar Chart: Monthly Revenue Trend (Cash / F&O / Commodity)
    if (revenueTrendCanvasRef.current) {
      if (revenueTrendChartInstance.current) revenueTrendChartInstance.current.destroy();
      const ctx = revenueTrendCanvasRef.current.getContext('2d');
      if (ctx) {
        revenueTrendChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: stats.charts.revenueTrendLabels,
            datasets: [
              { label: 'Cash', data: stats.charts.cashSeries, backgroundColor: '#10b981', borderRadius: 4, borderWidth: 0, stack: 'revenue' },
              { label: 'F&O', data: stats.charts.fnoSeries, backgroundColor: '#3b82f6', borderRadius: 4, borderWidth: 0, stack: 'revenue' },
              { label: 'Commodity', data: stats.charts.commoditySeries, backgroundColor: '#f59e0b', borderRadius: 4, borderWidth: 0, stack: 'revenue' }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: legendColor, font: { size: 10 }, boxWidth: 10 } } },
            scales: {
              y: { stacked: true, grid: { color: gridColor }, ticks: { color: tickColor } },
              x: { stacked: true, grid: { display: false }, ticks: { color: tickColor } }
            }
          }
        });
      }
    }

    // 2. Donut Chart: Revenue Composition
    if (compositionCanvasRef.current) {
      if (compositionChartInstance.current) compositionChartInstance.current.destroy();
      const ctx = compositionCanvasRef.current.getContext('2d');
      if (ctx) {
        compositionChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: stats.charts.revenueCompositionLabels,
            datasets: [{
              data: stats.charts.revenueComposition,
              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#a855f7'],
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

    // 3. Line Chart: Upcoming Statutory & Compliance Dues (Next 12 Months)
    if (duesCanvasRef.current) {
      if (duesChartInstance.current) duesChartInstance.current.destroy();
      const ctx = duesCanvasRef.current.getContext('2d');
      if (ctx) {
        duesChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: stats.charts.upcomingDuesLabels,
            datasets: [{
              label: 'Renewals/Filings Due',
              data: stats.charts.upcomingDues,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointBackgroundColor: '#ef4444'
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
          <div className="text-center lg:text-left w-full lg:w-auto">
            <h1 className="text-2.5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              📊 Finance Performance & Compliance Analytics
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Real-time monitoring of brokerage revenue, profitability ratios, cash position, and statutory renewal deadlines.
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
              to="/comparison/finance"
              className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              🔀 Compare Periods
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Compiling Finance stats metrics...</div>
        ) : !stats ? (
          <div className="text-center py-20 text-red-400">Failed to aggregate Finance dashboard data.</div>
        ) : (
          <>
            {/* KPI statistics cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              {isVisible('finance.kpi.brokerage_revenue') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Brokerage Revenue</div>
                  <div className="text-3xl font-bold" style={{ color: '#10b981' }}>₹{stats.kpis.totalBrokerageRevenue.toLocaleString('en-IN')}</div>
                  <div className="text-xs opacity-50 mt-1">Cash + F&O + Commodity</div>
                  <TrendDelta current={stats.kpis.totalBrokerageRevenue} previous={previousStats?.kpis?.totalBrokerageRevenue} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><IconRevenue /></div>
              </div>
              )}

              {isVisible('finance.kpi.net_profit') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(6, 182, 212, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Net Profit</div>
                  <div className="text-3xl font-bold" style={{ color: '#06b6d4' }}>₹{stats.kpis.netProfit.toLocaleString('en-IN')}</div>
                  <div className="text-xs opacity-50 mt-1">Selected period</div>
                  <TrendDelta current={stats.kpis.netProfit} previous={previousStats?.kpis?.netProfit} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}><IconProfit /></div>
              </div>
              )}

              {isVisible('finance.kpi.ebitda_margin') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>EBITDA Margin</div>
                  <div className="text-3xl font-bold" style={{ color: '#6366f1' }}>{stats.kpis.ebitdaMargin}%</div>
                  <div className="text-xs opacity-50 mt-1">Simplified proxy</div>
                  <TrendDelta current={stats.kpis.ebitdaMargin} previous={previousStats?.kpis?.ebitdaMargin} isPercentagePoint />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}><IconMargin /></div>
              </div>
              )}

              {isVisible('finance.kpi.cost_to_income') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Cost-to-Income</div>
                  <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{stats.kpis.costToIncome}%</div>
                  <div className="text-xs opacity-50 mt-1">Lower is better</div>
                  <TrendDelta current={stats.kpis.costToIncome} previous={previousStats?.kpis?.costToIncome} isPercentagePoint />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><IconCostRatio /></div>
              </div>
              )}

              {isVisible('finance.kpi.total_liquidity') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(59, 130, 246, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total Liquidity</div>
                  <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>₹{stats.kpis.totalLiquidity.toLocaleString('en-IN')}</div>
                  <div className="text-xs opacity-50 mt-1">Cash in hand + at bank</div>
                  <TrendDelta current={stats.kpis.totalLiquidity} previous={previousStats?.kpis?.totalLiquidity} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><IconLiquidity /></div>
              </div>
              )}

              {isVisible('finance.kpi.renewals_due_soon') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Renewals Due Soon</div>
                  <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>{stats.kpis.renewalsDueSoon}</div>
                  <div className="text-xs mt-1 text-amber-400 animate-pulse">Action pending</div>
                  <TrendDelta current={stats.kpis.renewalsDueSoon} previous={previousStats?.kpis?.renewalsDueSoon} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><IconRenewals /></div>
              </div>
              )}

              {isVisible('finance.kpi.open_client_requests') && (
              <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                <div>
                  <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Open Client Requests</div>
                  <div className="text-3xl font-bold" style={{ color: '#a855f7' }}>{stats.kpis.openClientRequests}</div>
                  <div className="text-xs opacity-50 mt-1">Pending + In Process</div>
                  <TrendDelta current={stats.kpis.openClientRequests} previous={previousStats?.kpis?.openClientRequests} />
                </div>
                <div className="p-3.5 rounded-full" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><IconRequests /></div>
              </div>
              )}

            </section>

            {/* Graphs sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Stacked bar chart: Monthly revenue trend */}
              {isVisible('finance.chart.monthly_revenue_trend') && (
              <div className="mis-card p-5 lg:col-span-2">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📊 Monthly Revenue Trend (Last 12 Months)
                </h3>
                <p className="text-[11px] text-slate-500 -mt-2.5 mb-3">Built by automatically adding up every day's P&amp;L entry within each month.</p>
                <div className="h-64 relative">
                  <canvas ref={revenueTrendCanvasRef}></canvas>
                </div>
              </div>
              )}

              {/* Donut chart: Revenue composition */}
              {isVisible('finance.chart.revenue_composition') && (
              <div className="mis-card p-5">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🍩 Revenue Composition
                </h3>
                <div className="h-64 relative">
                  <canvas ref={compositionCanvasRef}></canvas>
                </div>
              </div>
              )}

              {/* Line trend chart: Upcoming dues */}
              {isVisible('finance.chart.upcoming_statutory_renewals') && (
              <div className="mis-card p-5 lg:col-span-3">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📈 Upcoming Statutory Renewals & Filings (Next 12 Months)
                </h3>
                <div className="h-64 relative">
                  <canvas ref={duesCanvasRef}></canvas>
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

export default FinanceDashboardPage;
