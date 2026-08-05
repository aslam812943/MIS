import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PeriodFilter from '../../components/common/PeriodFilter';
import TrendDelta from '../../components/common/TrendDelta';
import { settlementService } from '../../services/settlement.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';
import { useDashboardPermissions } from '../../hooks/useDashboardPermissions';
import type { DateRange } from '../../utils/periodRange';
import { getDefaultPeriod } from '../../utils/periodRange';

Chart.register(...registerables);

// Icon components for KPIs
const IconSecurity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M12 2a5 5 0 0 0-5 5v4h10V7a5 5 0 0 0-5-5z"/>
  </svg>
);

const IconTicket = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
    <path d="M13 5v14"/>
  </svg>
);

const IconIpo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 16 4-4 4 4 6-6 4 4"/>
    <path d="M14 6h6v6"/>
  </svg>
);

const IconCorporate = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);

const SettlementsDashboardPage: React.FC = () => {
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
  const [period, setPeriod] = useState<{ current: DateRange; previous: DateRange }>(getDefaultPeriod);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chart canvas refs
  const donutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances
  const donutChartInstance = useRef<Chart | null>(null);
  const lineChartInstance = useRef<Chart | null>(null);
  const barChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (!period) return;
    fetchDashboardData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, period]);

  const fetchBranches = async () => {
    if (!hasMultiBranchAccess) return;
    try {
      const data = await orgService.getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const fetchDashboardData = async (initial = false) => {
    if (!period) return;
    if (initial) setLoading(true);
    else setRefreshing(true);

    const branchIdParam = hasMultiBranchAccess ? (branchFilter || undefined) : userBranchId;
    // Fired together, but only the current-period call blocks the loading
    // state — the dashboard renders as soon as it's back instead of
    // waiting on the previous-period comparison too.
    const currentPromise = settlementService.getDashboardData(branchIdParam, period.current.start, period.current.end);
    const previousPromise = settlementService.getDashboardData(branchIdParam, period.previous.start, period.previous.end);

    try {
      setStats(await currentPromise);
      if (!initial) {
        toast.success('Dashboard metrics updated.');
      }
    } catch (err) {
      console.error('Dashboard metrics load error:', err);
      toast.error('Failed to retrieve Settlements dashboard metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    previousPromise.then(setPreviousStats).catch(() => {});
  };

  // Render Chart.js instances once stats are loaded
  useEffect(() => {
    if (!stats) return;

    const isDark = theme === 'dark';
    const tickColorStrong = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.75)';
    const tickColorSoft = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(15, 23, 42, 0.6)';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.08)';
    const gridColorFaint = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.04)';
    const donutBorderColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff';

    // ── 1. DONUT CHART (PAY-IN/PAY-OUT STATUS BREAKDOWN) ──────────
    if (donutCanvasRef.current && stats.charts?.payinPayoutStatus) {
      if (donutChartInstance.current) {
        donutChartInstance.current.destroy();
      }

      const dataSet = stats.charts.payinPayoutStatus;
      const labels = dataSet.map((d: any) => d.status);
      const counts = dataSet.map((d: any) => d.count);

      const ctx = donutCanvasRef.current.getContext('2d');
      if (ctx) {
        donutChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: counts,
              backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], // Completed, Pending, Shortage
              borderWidth: 2,
              borderColor: donutBorderColor
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: tickColorStrong, font: { size: 11 } }
              }
            }
          }
        });
      }
    }

    // ── 2. LINE CHART (MONTHLY CLIENT REQUESTS TREND) ──────────────
    if (lineCanvasRef.current && stats.charts?.monthlyTrend) {
      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }

      const dataSet = stats.charts.monthlyTrend;
      const labels = dataSet.map((d: any) => d.month);
      const counts = dataSet.map((d: any) => d.count);

      const ctx = lineCanvasRef.current.getContext('2d');
      if (ctx) {
        lineChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Tickets Received',
              data: counts,
              fill: true,
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderColor: '#06b6d4',
              tension: 0.3,
              borderWidth: 2,
              pointBackgroundColor: '#06b6d4',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                ticks: { color: tickColorSoft },
                grid: { color: gridColor }
              },
              x: {
                ticks: { color: tickColorSoft },
                grid: { color: gridColorFaint }
              }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    }

    // ── 3. BAR CHART (CLIENT REQUEST TYPES DISTRIBUTION) ──────────
    if (barCanvasRef.current && stats.charts?.requestTypes) {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }

      const dataSet = stats.charts.requestTypes;
      const labels = dataSet.map((d: any) => d.type);
      const counts = dataSet.map((d: any) => d.count);

      const ctx = barCanvasRef.current.getContext('2d');
      if (ctx) {
        barChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Tickets',
              data: counts,
              backgroundColor: '#a855f7', // Purple
              borderRadius: 4,
              barThickness: 16
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                ticks: { color: tickColorSoft },
                grid: { color: gridColor }
              },
              y: {
                ticks: { color: tickColorStrong, font: { size: 10 } },
                grid: { display: false }
              }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    }

    // Cleanup on unmount
    return () => {
      if (donutChartInstance.current) donutChartInstance.current.destroy();
      if (lineChartInstance.current) lineChartInstance.current.destroy();
      if (barChartInstance.current) barChartInstance.current.destroy();
    };
  }, [stats, theme]);

  const { payinPayout, clientRequests, ipoAllocation, corporateActions } = stats || {
    payinPayout: { totalBuyQty: 0, totalSellQty: 0, totalShortageQty: 0, statusCounts: { Completed: 0, Pending: 0, Shortage: 0 }, totalRecords: 0 },
    clientRequests: { totalRecords: 0, statusCounts: { Received: 0, 'In Process': 0, Pending: 0, Completed: 0 }, overdueCount: 0 },
    ipoAllocation: { totalRecords: 0, totalAppliedQty: 0, totalAllottedQty: 0, statusCounts: { Applied: 0, Allotted: 0, Refunded: 0, 'Partially Allotted': 0 } },
    corporateActions: { totalRecords: 0, totalEntitlementAmt: 0, eligibleCounts: { Yes: 0, No: 0 }, typeCounts: { Dividend: 0, Bonus: 0, 'Stock Split': 0, 'Rights Issue': 0 } }
  };

  const getPercentage = (value: number, total: number) => {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  };

  const ipoAllotmentRate = getPercentage(ipoAllocation.totalAllottedQty, ipoAllocation.totalAppliedQty);

  const prevPayinPayout = previousStats?.payinPayout;
  const prevClientRequests = previousStats?.clientRequests;
  const prevIpoAllocation = previousStats?.ipoAllocation;
  const prevCorporateActions = previousStats?.corporateActions;
  const prevIpoAllotmentRate = prevIpoAllocation ? getPercentage(prevIpoAllocation.totalAllottedQty, prevIpoAllocation.totalAppliedQty) : undefined;

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">

        {/* ── Page Header ───────────────────────────────────── */}
        <header 
          className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 p-4 border rounded-xl shadow-xs text-left" 
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="text-center lg:text-left w-full lg:w-auto">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              📊 Clearing & Settlements Analytics
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Overview of daily transaction volumes, client service metrics, and entitlement allocations.
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
              onClick={() => fetchDashboardData(false)}
              disabled={refreshing}
              className="px-3 py-1 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 h-[30px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', minWidth: '135px' }}
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh Metrics'}
            </button>
            <Link
              to="/comparison/settlements"
              className="px-3 py-1 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 h-[30px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              🔀 Compare Periods
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="mis-loading-center py-32">
            <div className="mis-spinner" />
            <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Settlements Analytics Dashboard...</p>
          </div>
        ) : (
        <>
        {/* ── KPI Card Grid ─────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {isVisible('settlements.kpi.securities_volume') && (
          <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(20, 184, 166, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
            <div>
              <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Securities Volume</div>
              <div className="text-3xl font-bold" style={{ color: '#14b8a6' }}>
                {(payinPayout.totalBuyQty + payinPayout.totalSellQty).toLocaleString()}
              </div>
              <div className="text-xs opacity-50 mt-1">
                Buy: {payinPayout.totalBuyQty.toLocaleString()} | Sell: {payinPayout.totalSellQty.toLocaleString()}
              </div>
              <TrendDelta
                current={payinPayout.totalBuyQty + payinPayout.totalSellQty}
                previous={prevPayinPayout ? prevPayinPayout.totalBuyQty + prevPayinPayout.totalSellQty : undefined}
              />
            </div>
            <div className="p-3.5 rounded-full" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}><IconSecurity /></div>
          </div>
          )}

          {isVisible('settlements.kpi.service_tickets') && (
          <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
            <div>
              <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Service Tickets</div>
              <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{clientRequests.totalRecords}</div>
              <div className="text-xs opacity-50 mt-1">
                Open: {clientRequests.statusCounts.Received + clientRequests.statusCounts['In Process'] + clientRequests.statusCounts.Pending} | Solved: {clientRequests.statusCounts.Completed}
              </div>
              <TrendDelta current={clientRequests.totalRecords} previous={prevClientRequests?.totalRecords} />
            </div>
            <div className="p-3.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><IconTicket /></div>
          </div>
          )}

          {isVisible('settlements.kpi.ipo_allotment_rate') && (
          <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
            <div>
              <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>IPO Allotment Rate</div>
              <div className="text-3xl font-bold" style={{ color: '#6366f1' }}>{ipoAllotmentRate}%</div>
              <div className="text-xs opacity-50 mt-1">
                Allotted: {ipoAllocation.totalAllottedQty.toLocaleString()} / {ipoAllocation.totalAppliedQty.toLocaleString()}
              </div>
              <TrendDelta current={ipoAllotmentRate} previous={prevIpoAllotmentRate} isPercentagePoint />
            </div>
            <div className="p-3.5 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}><IconIpo /></div>
          </div>
          )}

          {isVisible('settlements.kpi.corp_action_payout') && (
          <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
            <div>
              <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Corp Action Payout</div>
              <div className="text-3xl font-bold" style={{ color: '#a855f7' }}>
                {corporateActions.totalEntitlementAmt > 0 ? `₹${corporateActions.totalEntitlementAmt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—'}
              </div>
              <div className="text-xs opacity-50 mt-1">
                Allocations Count: {corporateActions.totalRecords}
              </div>
              <TrendDelta current={corporateActions.totalEntitlementAmt} previous={prevCorporateActions?.totalEntitlementAmt} />
            </div>
            <div className="p-3.5 rounded-full" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><IconCorporate /></div>
          </div>
          )}

        </section>

        {/* ── Alerts & Warnings Section ────────────────────── */}
        {(payinPayout.totalShortageQty > 0 || clientRequests.overdueCount > 0) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Shortage Alert */}
            {payinPayout.totalShortageQty > 0 ? (
              <div 
                className="p-4 rounded-md border text-sm flex justify-between items-center"
                style={{ 
                  backgroundColor: 'var(--badge-danger-bg)', 
                  borderColor: 'var(--badge-danger-border)', 
                  color: 'var(--badge-danger-text)' 
                }}
              >
                <div className="font-semibold flex items-center gap-2">
                  ⚠️ Alert: Active Settlement Shortage Detected!
                </div>
                <div className="font-bold text-base">
                  {payinPayout.totalShortageQty.toLocaleString()} shares shortage
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
                ✓ No active securities shortages found.
              </div>
            )}

            {/* Overdue Ticket Alert */}
            {clientRequests.overdueCount > 0 ? (
              <div 
                className="p-4 rounded-md border text-sm flex justify-between items-center animate-pulse-subtle"
                style={{ 
                  backgroundColor: 'var(--badge-danger-bg)', 
                  borderColor: 'var(--badge-danger-border)', 
                  color: 'var(--badge-danger-text)' 
                }}
              >
                <div className="font-semibold flex items-center gap-2">
                  🚨 Action Required: Overdue Tickets Alert!
                </div>
                <div className="font-bold text-base">
                  {clientRequests.overdueCount} tickets pending &gt; 2 days
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
                ✓ All pending requests are within the 2-day SLA.
              </div>
            )}

          </section>
        )}

        {/* ── Charts Section ────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Doughnut Chart */}
          {isVisible('settlements.chart.payin_payout_status') && (
          <div className="mis-card p-5 flex flex-col h-[320px]">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Pay-in / Pay-out Status</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Completed vs Pending vs Shortages</p>
            <div className="flex-1 relative min-h-0">
              <canvas ref={donutCanvasRef} />
            </div>
          </div>
          )}

          {/* Line Chart */}
          {isVisible('settlements.chart.monthly_requests_trend') && (
          <div className="mis-card p-5 flex flex-col h-[320px] lg:col-span-2">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Monthly Requests Trend</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Service tickets received during the current calendar year</p>
            <div className="flex-1 relative min-h-0">
              <canvas ref={lineCanvasRef} />
            </div>
          </div>
          )}

          {/* Horizontal Bar Chart */}
          {isVisible('settlements.chart.client_request_types') && (
          <div className="mis-card p-5 flex flex-col h-[300px] lg:col-span-3">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Client Request Types</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Distribution count per service request ticket category</p>
            <div className="flex-1 relative min-h-0">
              <canvas ref={barCanvasRef} />
            </div>
          </div>
          )}

        </section>

        {/* ── Additional Department Breakdown Details ────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Section A: IPO Details */}
          {isVisible('settlements.chart.ipo_subscriptions_summary') && (
          <div className="mis-card p-6 space-y-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>IPO Subscriptions Summary</h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Applications metrics and subscription processing status.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Fully Allotted Applications</span>
                  <span>{getPercentage(ipoAllocation.statusCounts.Allotted, ipoAllocation.totalRecords)}% ({ipoAllocation.statusCounts.Allotted} apps)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${getPercentage(ipoAllocation.statusCounts.Allotted, ipoAllocation.totalRecords)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Partially Allotted Applications</span>
                  <span>{getPercentage(ipoAllocation.statusCounts['Partially Allotted'], ipoAllocation.totalRecords)}% ({ipoAllocation.statusCounts['Partially Allotted']} apps)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-500" 
                    style={{ width: `${getPercentage(ipoAllocation.statusCounts['Partially Allotted'], ipoAllocation.totalRecords)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Refunded / Unallotted</span>
                  <span>{getPercentage(ipoAllocation.statusCounts.Refunded, ipoAllocation.totalRecords)}% ({ipoAllocation.statusCounts.Refunded} apps)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-red-500 h-full transition-all duration-500" 
                    style={{ width: `${getPercentage(ipoAllocation.statusCounts.Refunded, ipoAllocation.totalRecords)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Section B: Corporate Actions Summary */}
          {isVisible('settlements.chart.corporate_actions_eligibility') && (
          <div className="mis-card p-6 space-y-4">
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Corporate Actions Eligibility</h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Corporate announcements records and client eligibility ratio.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200/40 dark:border-slate-800/50 flex justify-between items-center col-span-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Eligibility Ratio</span>
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {corporateActions.eligibleCounts.Yes} Eligible / {corporateActions.eligibleCounts.No} Ineligible
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200/40 dark:border-slate-800/50">
                <div className="text-[10px] uppercase font-bold text-slate-500">Dividends</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{corporateActions.typeCounts.Dividend} items</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200/40 dark:border-slate-800/50">
                <div className="text-[10px] uppercase font-bold text-slate-500">Bonus Shares</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{corporateActions.typeCounts.Bonus} items</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200/40 dark:border-slate-800/50">
                <div className="text-[10px] uppercase font-bold text-slate-500">Stock Splits</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{corporateActions.typeCounts['Stock Split']} items</div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200/40 dark:border-slate-800/50">
                <div className="text-[10px] uppercase font-bold text-slate-500">Rights Issue</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{corporateActions.typeCounts['Rights Issue']} items</div>
              </div>
            </div>
          </div>
          )}

        </section>
        </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default SettlementsDashboardPage;
