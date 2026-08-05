import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import { salesService } from '../../services/sales.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PeriodFilter from '../../components/common/PeriodFilter';
import TrendDelta from '../../components/common/TrendDelta';
import { useTheme } from '../../context/ThemeContext';
import { useDashboardPermissions } from '../../hooks/useDashboardPermissions';
import type { DateRange } from '../../utils/periodRange';
import { getDefaultPeriod } from '../../utils/periodRange';

Chart.register(...registerables);

const IconRupee = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3c3 0 5-2 5-5" />
  </svg>
);
const IconReceipt = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
const IconTrendingUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconClockHistory = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 7 12 12 15.5 14" />
  </svg>
);
const IconX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const SalesDashboardPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const { theme } = useTheme();
  const { isVisible } = useDashboardPermissions();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');
  const userBranchId = currentUser?.branch_id || '';

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [previousDashboardData, setPreviousDashboardData] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [period, setPeriod] = useState<{ current: DateRange; previous: DateRange }>(getDefaultPeriod);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const productCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const branchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const productChartInstance = useRef<Chart | null>(null);
  const trendChartInstance = useRef<Chart | null>(null);
  const branchChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!hasMultiBranchAccess) return;
    orgService.getBranches().then(setBranches).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!period) return;
    fetchDashboard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, period]);

  const fetchDashboard = async (showToast = false) => {
    setLoading(true);
    setRefreshing(true);
    const branchIdParam = hasMultiBranchAccess ? (branchFilter || undefined) : userBranchId;
    const currentPromise = salesService.getDashboardData(branchIdParam, period.current.start, period.current.end);
    const previousPromise = salesService.getDashboardData(branchIdParam, period.previous.start, period.previous.end);

    try {
      setDashboardData(await currentPromise);
      if (showToast) toast.success('Dashboard metrics updated.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load Sales dashboard metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    previousPromise.then(setPreviousDashboardData).catch(() => {});
  };

  useEffect(() => {
    if (!dashboardData) return;
    const isDark = theme === 'dark';
    const tickColorStrong = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.75)';
    const tickColorSoft = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(15, 23, 42, 0.6)';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.08)';
    const borderColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff';
    const palette = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#f43f5e'];

    if (productCanvasRef.current) {
      if (productChartInstance.current) productChartInstance.current.destroy();
      const rows = dashboardData.charts.productBreakdown || [];
      const ctx = productCanvasRef.current.getContext('2d');
      if (ctx) {
        productChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: rows.map((d: any) => d.product),
            datasets: [{ data: rows.map((d: any) => d.value), backgroundColor: palette, borderWidth: 2, borderColor }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: tickColorStrong, font: { size: 10 }, boxWidth: 10 } } },
          },
        });
      }
    }

    if (trendCanvasRef.current) {
      if (trendChartInstance.current) trendChartInstance.current.destroy();
      const rows = dashboardData.charts.monthlyTrend || [];
      const ctx = trendCanvasRef.current.getContext('2d');
      if (ctx) {
        trendChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: rows.map((d: any) => d.month),
            datasets: [{
              label: 'Sales Value',
              data: rows.map((d: any) => d.value),
              fill: true,
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderColor: '#06b6d4',
              tension: 0.3,
              borderWidth: 2,
              pointBackgroundColor: '#06b6d4',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { ticks: { color: tickColorSoft }, grid: { color: gridColor } },
              x: { ticks: { color: tickColorSoft }, grid: { display: false } },
            },
            plugins: { legend: { display: false } },
          },
        });
      }
    }

    if (branchCanvasRef.current) {
      if (branchChartInstance.current) branchChartInstance.current.destroy();
      const rows = dashboardData.charts.branchDistribution || [];
      const ctx = branchCanvasRef.current.getContext('2d');
      if (ctx) {
        branchChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: rows.map((d: any) => d.name),
            datasets: [{ label: 'Sales Value', data: rows.map((d: any) => d.value), backgroundColor: '#10b981', borderRadius: 6 }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: tickColorSoft }, grid: { display: false } },
              y: { ticks: { color: tickColorSoft }, grid: { color: gridColor } },
            },
          },
        });
      }
    }

    return () => {
      if (productChartInstance.current) productChartInstance.current.destroy();
      if (trendChartInstance.current) trendChartInstance.current.destroy();
      if (branchChartInstance.current) branchChartInstance.current.destroy();
    };
  }, [dashboardData, theme]);

  const kpis = dashboardData?.kpis || {};
  const previousKpis = previousDashboardData?.kpis || {};

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">
        <header
          className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 p-4 border rounded-xl shadow-xs text-left"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="text-center lg:text-left w-full lg:w-auto">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>💰 Sales Department Analytics</h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Overall sales performance and product-wise breakdown.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PeriodFilter onChange={(p) => setPeriod({ current: p.current, previous: p.previous })} />
            {hasMultiBranchAccess && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="mis-select text-xs cursor-pointer"
                style={{ width: '150px', minWidth: '150px', padding: '6px 12px' }}
              >
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <button
              type="button"
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className="px-3 py-1 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 h-[30px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh Metrics'}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="mis-loading-center py-32">
            <div className="mis-spinner" />
            <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Sales Analytics Dashboard...</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {isVisible('sales.kpi.total_sales_value') && (
                <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(6, 182, 212, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                  <div>
                    <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total Sales Value</div>
                    <div className="text-3xl font-bold" style={{ color: '#06b6d4' }}>₹{Number(kpis.totalSalesValue || 0).toLocaleString('en-IN')}</div>
                    <div className="text-xs opacity-50 mt-1">Completed sales, this period</div>
                    <TrendDelta current={kpis.totalSalesValue} previous={previousKpis.totalSalesValue} />
                  </div>
                  <div className="p-3.5 rounded-full" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}><IconRupee /></div>
                </div>
              )}

              {isVisible('sales.kpi.total_sales_count') && (
                <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                  <div>
                    <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total Sales</div>
                    <div className="text-3xl font-bold" style={{ color: '#10b981' }}>{kpis.totalSalesCount || 0}</div>
                    <div className="text-xs opacity-50 mt-1">Completed count, this period</div>
                    <TrendDelta current={kpis.totalSalesCount} previous={previousKpis.totalSalesCount} />
                  </div>
                  <div className="p-3.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><IconReceipt /></div>
                </div>
              )}

              {isVisible('sales.kpi.avg_sale_value') && (
                <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                  <div>
                    <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Avg. Sale Value</div>
                    <div className="text-3xl font-bold" style={{ color: '#8b5cf6' }}>₹{Number(kpis.avgSaleValue || 0).toLocaleString('en-IN')}</div>
                    <div className="text-xs opacity-50 mt-1">Per completed sale</div>
                    <TrendDelta current={kpis.avgSaleValue} previous={previousKpis.avgSaleValue} />
                  </div>
                  <div className="p-3.5 rounded-full" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}><IconTrendingUp /></div>
                </div>
              )}

              {isVisible('sales.kpi.pending_count') && (
                <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                  <div>
                    <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Pending Sales</div>
                    <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{kpis.pendingCount || 0}</div>
                    <div className="text-xs opacity-50 mt-1">Not yet counted in totals</div>
                  </div>
                  <div className="p-3.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><IconClockHistory /></div>
                </div>
              )}

              {isVisible('sales.kpi.cancelled_count') && (
                <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(244, 63, 94, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                  <div>
                    <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Cancelled Sales</div>
                    <div className="text-3xl font-bold" style={{ color: '#f43f5e' }}>{kpis.cancelledCount || 0}</div>
                    <div className="text-xs opacity-50 mt-1">Didn't go through</div>
                  </div>
                  <div className="p-3.5 rounded-full" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}><IconX /></div>
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {isVisible('sales.chart.product_breakdown') && (
                <div className="mis-card p-5 flex flex-col h-[320px]">
                  <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Product-wise Sales</h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Value split across products</p>
                  <div className="flex-1 relative min-h-0"><canvas ref={productCanvasRef} /></div>
                </div>
              )}

              {isVisible('sales.chart.monthly_trend') && (
                <div className="mis-card p-5 flex flex-col h-[320px] lg:col-span-2">
                  <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Monthly Sales Trend</h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Completed sales value this year</p>
                  <div className="flex-1 relative min-h-0"><canvas ref={trendCanvasRef} /></div>
                </div>
              )}

              {isVisible('sales.chart.branch_distribution') && (
                <div className="mis-card p-5 flex flex-col h-[300px] lg:col-span-3">
                  <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Branch Distribution</h3>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Sales value by branch</p>
                  <div className="flex-1 relative min-h-0"><canvas ref={branchCanvasRef} /></div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SalesDashboardPage;
