import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PeriodFilter from '../../components/common/PeriodFilter';
import TrendDelta from '../../components/common/TrendDelta';
import { kycService } from '../../services/kyc.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';
import { useDashboardPermissions } from '../../hooks/useDashboardPermissions';
import type { DateRange } from '../../utils/periodRange';
import { getDefaultPeriod } from '../../utils/periodRange';

Chart.register(...registerables);

const IconPeople = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconAlert = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconModify = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconCompliance = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const KYCDashboardPage: React.FC = () => {
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
  const statusCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances
  const statusChartInstance = useRef<Chart | null>(null);
  const trendChartInstance = useRef<Chart | null>(null);
  const modChartInstance = useRef<Chart | null>(null);

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
      console.error(err);
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
    const currentPromise = kycService.getDashboardData(branchIdParam, period.current.start, period.current.end);
    const previousPromise = kycService.getDashboardData(branchIdParam, period.previous.start, period.previous.end);

    try {
      setStats(await currentPromise);
      if (!initial) {
        toast.success('Metrics refreshed successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load KYC analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    previousPromise.then(setPreviousStats).catch(() => {});
  };

  const getChartThemeColors = (activeTheme: string) => {
    const isDark = activeTheme === 'dark';
    return {
      textPrimary: isDark ? '#f1f5f9' : '#0f172a',
      textSecondary: isDark ? '#94a3b8' : '#475569',
      border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      grid: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
    };
  };

  // Render ChartJS
  useEffect(() => {
    if (!stats) return;

    const colors = getChartThemeColors(theme);

    // 1. COMBINED STATUS DONUT CHART
    if (statusCanvasRef.current && stats.charts?.statusBreakdown) {
      if (statusChartInstance.current) statusChartInstance.current.destroy();

      const dataSet = stats.charts.statusBreakdown;
      const labels = dataSet.map((d: any) => d.status);
      const counts = dataSet.map((d: any) => d.count);

      const ctx = statusCanvasRef.current.getContext('2d');
      if (ctx) {
        statusChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: counts,
              backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], // Green (Verified), Yellow (Pending), Red (Rejected)
              borderWidth: 2,
              borderColor: colors.border
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: colors.textSecondary, font: { size: 11 } }
              }
            }
          }
        });
      }
    }

    // 2. MONTHLY ONBOARDING TREND LINE CHART
    if (trendCanvasRef.current && stats.charts?.monthlyTrend) {
      if (trendChartInstance.current) trendChartInstance.current.destroy();

      const dataSet = stats.charts.monthlyTrend;
      const labels = dataSet.map((d: any) => d.month);
      const counts = dataSet.map((d: any) => d.count);

      const ctx = trendCanvasRef.current.getContext('2d');
      if (ctx) {
        trendChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Onboarded Accounts',
              data: counts,
              fill: true,
              backgroundColor: 'rgba(20, 184, 166, 0.1)',
              borderColor: '#14b8a6', // Teal
              tension: 0.3,
              borderWidth: 2,
              pointBackgroundColor: '#14b8a6',
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                ticks: { color: colors.textSecondary },
                grid: { color: colors.grid }
              },
              x: {
                ticks: { color: colors.textSecondary },
                grid: { color: colors.grid }
              }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    }

    // 3. MODIFICATION REQUESTS BREAKDOWN BAR CHART
    if (modCanvasRef.current && stats.charts?.requestTypes) {
      if (modChartInstance.current) modChartInstance.current.destroy();

      const dataSet = stats.charts.requestTypes;
      const labels = dataSet.map((d: any) => d.type);
      const counts = dataSet.map((d: any) => d.count);

      const ctx = modCanvasRef.current.getContext('2d');
      if (ctx) {
        modChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Requests',
              data: counts,
              backgroundColor: '#6366f1', // Indigo
              borderRadius: 4,
              barThickness: 14
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                ticks: { color: colors.textSecondary },
                grid: { color: colors.grid }
              },
              y: {
                ticks: { color: colors.textSecondary, font: { size: 10 } },
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

    // Cleanup charts on unmount
    return () => {
      if (statusChartInstance.current) statusChartInstance.current.destroy();
      if (trendChartInstance.current) trendChartInstance.current.destroy();
      if (modChartInstance.current) modChartInstance.current.destroy();
    };
  }, [stats, theme]);

  const { kpis, compliance, registryUpdates } = stats || {
    kpis: { totalOnboarded: 0, pendingVerifications: 0, processedModifications: 0, activeReactivations: 0, closedAccounts: 0, demiseReportsCount: 0 },
    compliance: { Compliant: 0, 'Non-Compliant': 0, Due: 0 },
    newAccounts: { Total: 0, Pending: 0, Verified: 0, Rejected: 0 },
    registryUpdates: { Total: 0, Pending: 0, Verified: 0, Rejected: 0 }
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-6 border rounded-xl shadow-xs" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-center sm:text-left w-full sm:w-auto">
            <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center sm:justify-start gap-2" style={{ color: 'var(--text-primary)' }}>
              📊 KYC Department Analytics
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Performance metrics, onboarding verification trends, modifications requests audit, and registry updates logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
            <PeriodFilter onChange={p => setPeriod({ current: p.current, previous: p.previous })} />
            {hasMultiBranchAccess && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="mis-select w-44 text-xs cursor-pointer"
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => fetchDashboardData(false)}
              disabled={refreshing}
              className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              {refreshing ? 'Refreshing...' : '🔄 Refresh Metrics'}
            </button>
            <Link
              to="/comparison/kyc"
              className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              🔀 Compare Periods
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="mis-loading-center py-32 flex flex-col items-center justify-center">
            <div className="mis-spinner" />
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Loading KYC Analytics Dashboard...</p>
          </div>
        ) : (
        <>
        {/* KPI Cards Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {isVisible('kyc.kpi.total_onboarded_clients') && (
          <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(20, 184, 166, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
            <div>
              <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total Onboarded Clients</div>
              <div className="text-3xl font-bold" style={{ color: '#14b8a6' }}>{kpis.totalOnboarded}</div>
              <TrendDelta current={kpis.totalOnboarded} previous={previousStats?.kpis?.totalOnboarded} />
            </div>
            <div className="p-3.5 rounded-full" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}><IconPeople /></div>
          </div>
          )}

          {isVisible('kyc.kpi.pending_verifications') && (
          <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
            <div>
              <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Pending Verifications</div>
              <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{kpis.pendingVerifications}</div>
              <TrendDelta current={kpis.pendingVerifications} previous={previousStats?.kpis?.pendingVerifications} />
            </div>
            <div className="p-3.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><IconAlert /></div>
          </div>
          )}

          {isVisible('kyc.kpi.modifications_applied') && (
          <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
            <div>
              <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Modifications Applied</div>
              <div className="text-3xl font-bold" style={{ color: '#6366f1' }}>{kpis.processedModifications}</div>
              <TrendDelta current={kpis.processedModifications} previous={previousStats?.kpis?.processedModifications} />
            </div>
            <div className="p-3.5 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}><IconModify /></div>
          </div>
          )}

          {isVisible('kyc.kpi.closed_accounts') && (
          <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(244, 63, 94, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
            <div>
              <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Closed Accounts / Closures</div>
              <div className="text-3xl font-bold" style={{ color: '#f43f5e' }}>{kpis.closedAccounts}</div>
              <TrendDelta current={kpis.closedAccounts} previous={previousStats?.kpis?.closedAccounts} />
            </div>
            <div className="p-3.5 rounded-full" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}><IconCompliance /></div>
          </div>
          )}

        </section>

        {/* Charts Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Doughnut Chart */}
          {isVisible('kyc.chart.verification_status_distribution') && (
          <div className="border p-5 rounded-xl shadow-xs lg:col-span-1 flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Verification Status Distribution</h2>
            <div className="flex-1 relative min-h-[220px]">
              <canvas ref={statusCanvasRef} />
            </div>
          </div>
          )}

          {/* Line Chart */}
          {isVisible('kyc.chart.monthly_onboarding_trend') && (
          <div className="border p-5 rounded-xl shadow-xs lg:col-span-2 flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Monthly Onboarding Trend ({new Date().getFullYear()})</h2>
            <div className="flex-1 relative min-h-[220px]">
              <canvas ref={trendCanvasRef} />
            </div>
          </div>
          )}

        </section>

        {/* Bottom Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Bar Chart */}
          {isVisible('kyc.chart.modification_categories') && (
          <div className="border p-5 rounded-xl shadow-xs lg:col-span-2 flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Modification Request Categories Breakdown</h2>
            <div className="flex-1 relative min-h-[240px]">
              <canvas ref={modCanvasRef} />
            </div>
          </div>
          )}

          {/* Compliance & Registry panels */}
          <div className="border p-5 rounded-xl shadow-xs lg:col-span-1 flex flex-col justify-between space-y-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

            {/* Compliance stats */}
            {isVisible('kyc.chart.exchange_compliance_stats') && (
            <div>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Exchange Compliance Stats</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Compliant Clients</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{compliance.Compliant}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Non-Compliant Clients</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{compliance['Non-Compliant']}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Due Renewals</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{compliance.Due}</span>
                </div>
              </div>
            </div>
            )}

            {/* Registry stats */}
            {isVisible('kyc.chart.registry_updation_stats') && (
            <div>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Registry Updation Stats (CKYC/KRA)</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Verified Registry Code</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{registryUpdates.Verified}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Pending Verification</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{registryUpdates.Pending}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Rejected Registry Entries</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{registryUpdates.Rejected}</span>
                </div>
              </div>
            </div>
            )}

            {/* Demise / Reactivations count */}
            <div className="pt-4 border-t flex justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-center flex-1">
                <span className="text-[10px] font-bold block" style={{ color: 'var(--text-secondary)' }}>Demise Reports</span>
                <span className="text-lg font-bold block mt-0.5" style={{ color: 'var(--text-primary)' }}>{kpis.demiseReportsCount}</span>
              </div>
              <div className="text-center flex-1 border-l" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[10px] font-bold block" style={{ color: 'var(--text-secondary)' }}>Active Reactivations</span>
                <span className="text-lg font-bold block mt-0.5" style={{ color: 'var(--text-primary)' }}>{kpis.activeReactivations}</span>
              </div>
            </div>

          </div>

        </section>
        </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default KYCDashboardPage;
