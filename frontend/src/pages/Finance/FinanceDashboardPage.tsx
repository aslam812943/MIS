import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { financeService } from '../../services/finance.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';

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
      const data = await financeService.getDashboardData(
        branchFilter || undefined,
        startDate || undefined,
        endDate || undefined
      );
      setStats(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load Finance dashboard analytics.');
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
          <div>
            <h1 className="text-2.5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              📊 Finance Performance & Compliance Analytics
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Real-time monitoring of brokerage revenue, profitability ratios, cash position, and statutory renewal deadlines.
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
          <div className="text-center py-20 text-slate-400">Compiling Finance stats metrics...</div>
        ) : !stats ? (
          <div className="text-center py-20 text-red-400">Failed to aggregate Finance dashboard data.</div>
        ) : (
          <>
            {/* KPI statistics cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">

              <div className="mis-stat-card border-l-4 border-emerald-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Brokerage Revenue</span>
                  <span className="text-emerald-500 opacity-80"><IconRevenue /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">₹{stats.kpis.totalBrokerageRevenue.toLocaleString('en-IN')}</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Cash + F&O + Commodity</p>
              </div>

              <div className="mis-stat-card border-l-4 border-cyan-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Net Profit</span>
                  <span className="text-cyan-500 opacity-80"><IconProfit /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">₹{stats.kpis.netProfit.toLocaleString('en-IN')}</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Selected period</p>
              </div>

              <div className="mis-stat-card border-l-4 border-indigo-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">EBITDA Margin</span>
                  <span className="text-indigo-500 opacity-80"><IconMargin /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.ebitdaMargin}%</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Simplified proxy</p>
              </div>

              <div className="mis-stat-card border-l-4 border-amber-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Cost-to-Income</span>
                  <span className="text-amber-500 opacity-80"><IconCostRatio /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.costToIncome}%</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Lower is better</p>
              </div>

              <div className="mis-stat-card border-l-4 border-blue-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Total Liquidity</span>
                  <span className="text-blue-500 opacity-80"><IconLiquidity /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">₹{stats.kpis.totalLiquidity.toLocaleString('en-IN')}</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Cash in hand + at bank</p>
              </div>

              <div className="mis-stat-card border-l-4 border-red-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Renewals Due Soon</span>
                  <span className="text-red-500 opacity-80"><IconRenewals /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.renewalsDueSoon}</div>
                <p className="text-[9px] mt-1 text-left text-amber-400 animate-pulse">Action pending</p>
              </div>

              <div className="mis-stat-card border-l-4 border-purple-500">
                <div className="flex justify-between items-start mb-2 text-left">
                  <span className="mis-stat-label text-[10px] uppercase tracking-wider font-semibold">Open Client Requests</span>
                  <span className="text-purple-500 opacity-80"><IconRequests /></span>
                </div>
                <div className="mis-stat-value text-2.5xl font-bold text-left">{stats.kpis.openClientRequests}</div>
                <p className="text-[9px] mt-1 text-left" style={{ color: 'var(--text-secondary)' }}>Pending + In Process</p>
              </div>

            </section>

            {/* Graphs sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Stacked bar chart: Monthly revenue trend */}
              <div className="mis-card p-5 lg:col-span-2">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📊 Monthly Revenue Trend (Last 12 Months)
                </h3>
                <p className="text-[11px] text-slate-500 -mt-2.5 mb-3">Built by automatically adding up every day's P&amp;L entry within each month.</p>
                <div className="h-64 relative">
                  <canvas ref={revenueTrendCanvasRef}></canvas>
                </div>
              </div>

              {/* Donut chart: Revenue composition */}
              <div className="mis-card p-5">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  🍩 Revenue Composition
                </h3>
                <div className="h-64 relative">
                  <canvas ref={compositionCanvasRef}></canvas>
                </div>
              </div>

              {/* Line trend chart: Upcoming dues */}
              <div className="mis-card p-5 lg:col-span-3">
                <h3 className="text-sm font-bold mb-4 text-left border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  📈 Upcoming Statutory Renewals & Filings (Next 12 Months)
                </h3>
                <div className="h-64 relative">
                  <canvas ref={duesCanvasRef}></canvas>
                </div>
              </div>

            </div>
          </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default FinanceDashboardPage;
