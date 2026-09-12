import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { raService } from '../../services/ra.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../context/ThemeContext';
import { ROUTES } from '../../constants/routes';
import type { RADashboardStats } from '../../types/ra.types';

Chart.register(...registerables);

const formatMoney = (val: number | string | undefined | null) => {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN');
};

export const RADashboardPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const isAdmin = currentUser?.role === 'admin';
  const isLeadership = ['ceo', 'managing_director', 'director', 'executive'].includes(currentUser?.role || '');
  const isHOD = currentUser?.role === 'hod';
  const hasMultiBranchAccess = isAdmin || isLeadership || isHOD;

  const [stats, setStats] = useState<RADashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const revenueCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const packageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const revenueChartInstance = useRef<Chart | null>(null);
  const packageChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (hasMultiBranchAccess) {
      orgService.getBranches().then(setBranches).catch(() => {});
    }
  }, [hasMultiBranchAccess]);

  const loadData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      const data = await raService.getDashboardStats(selectedBranch || undefined);
      setStats(data);
      if (showToast) toast.success('RA Dashboard updated');
    } catch (err: any) {
      console.error('Failed to load RA dashboard stats:', err);
      toast.error(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  // Chart Rendering
  useEffect(() => {
    if (!stats) return;

    // Monthly Revenue Chart
    if (revenueCanvasRef.current) {
      if (revenueChartInstance.current) {
        revenueChartInstance.current.destroy();
      }

      const monthlyKeys = Object.keys(stats.monthlyRevenue || {});
      const monthlyValues = Object.values(stats.monthlyRevenue || {});

      revenueChartInstance.current = new Chart(revenueCanvasRef.current, {
        type: 'bar',
        data: {
          labels: monthlyKeys.length ? monthlyKeys : ['Current'],
          datasets: [
            {
              label: 'Revenue (₹)',
              data: monthlyValues.length ? monthlyValues : [0],
              backgroundColor: 'rgba(59, 130, 246, 0.75)',
              borderColor: '#3B82F6',
              borderWidth: 1.5,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: {
                color: isDark ? '#E5E7EB' : '#374151',
                font: { family: 'Inter, sans-serif', size: 12 },
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` Revenue: ${formatMoney(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
              ticks: { color: isDark ? '#9CA3AF' : '#4B5563' },
            },
            y: {
              type: 'linear',
              grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
              ticks: {
                color: isDark ? '#9CA3AF' : '#4B5563',
                callback: (val) => '₹' + Number(val).toLocaleString('en-IN'),
              },
            },
          },
        },
      });
    }

    // Package Distribution Doughnut Chart
    if (packageCanvasRef.current) {
      if (packageChartInstance.current) {
        packageChartInstance.current.destroy();
      }

      const pkgKeys = Object.keys(stats.packageRevenue || {});
      const pkgValues = Object.values(stats.packageRevenue || {});
      const colors = [
        '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
        '#EC4899', '#06B6D4', '#6366F1', '#14B8A6'
      ];

      packageChartInstance.current = new Chart(packageCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: pkgKeys.length ? pkgKeys : ['No Data'],
          datasets: [
            {
              data: pkgValues.length ? pkgValues : [0],
              backgroundColor: colors.slice(0, Math.max(1, pkgKeys.length)),
              borderWidth: 2,
              borderColor: isDark ? '#1F2937' : '#FFFFFF',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: isDark ? '#E5E7EB' : '#374151',
                boxWidth: 12,
                font: { size: 11 },
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${formatMoney(ctx.raw as number)}`,
              },
            },
          },
          cutout: '65%',
        },
      });
    }

    return () => {
      revenueChartInstance.current?.destroy();
      packageChartInstance.current?.destroy();
    };
  }, [stats, isDark]);

  const kpis = [
    {
      title: 'Active Subscriptions',
      value: stats?.active ?? 0,
      sub: `Out of ${stats?.totalClients ?? 0} total onboarded`,
      icon: (
        <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      ),
      glow: 'hover:border-blue-500/40',
    },
    {
      title: 'Total Revenue Collected',
      value: formatMoney(stats?.totalRevenue),
      sub: `Year to Date: ${formatMoney(stats?.thisYearRevenue)}`,
      icon: (
        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      glow: 'hover:border-emerald-500/40',
    },
    {
      title: 'This Month Collections',
      value: formatMoney(stats?.thisMonthRevenue),
      sub: 'Current billing period',
      icon: (
        <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
      ),
      glow: 'hover:border-indigo-500/40',
    },
    {
      title: 'Expiring Soon (30d)',
      value: stats?.expiring ?? 0,
      sub: 'Action required for retention',
      icon: (
        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      glow: 'hover:border-amber-500/40',
    },
    {
      title: 'Expired Subscriptions',
      value: stats?.expired ?? 0,
      sub: 'Lapsed accounts',
      icon: (
        <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      ),
      glow: 'hover:border-rose-500/40',
    },
    {
      title: 'KRA Verified Clients',
      value: stats?.kycSummary?.kraCompleted ?? 0,
      sub: `${stats?.kycSummary?.kraPending ?? 0} pending verification`,
      icon: (
        <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      ),
      glow: 'hover:border-cyan-500/40',
    },
  ];

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-16">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[var(--accent-bg)] rounded-xl text-[var(--accent)]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                    Research Analyst (RA) Portfolio & Analytics
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-bg-2)]">
                    RA Department
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Real-time client package management, KRA verification, collections, and feedback hub.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {hasMultiBranchAccess && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3.5 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Branches ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition shadow-sm"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            <Link
              to={ROUTES.RA_DATA_ENTRY}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-[var(--accent)] text-slate-950 font-semibold hover:bg-[var(--accent-hover)] transition shadow-sm hover:shadow"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Data Entry
            </Link>
          </div>
        </div>

        {/* KPI Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700/50 rounded-2xl"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {kpis.map((kpi, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${kpi.glow} flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {kpi.title}
                  </span>
                  {kpi.icon}
                </div>
                <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1 truncate">
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Trend */}
          <div className="lg:col-span-2 bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Monthly Revenue Performance
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Collections by month (₹)
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-hover-2)] text-[var(--text-secondary)] font-medium">
                Last 12 Months
              </span>
            </div>
            <div className="h-72">
              <canvas ref={revenueCanvasRef}></canvas>
            </div>
          </div>

          {/* Package Distribution Doughnut */}
          <div className="bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Package Revenue Share
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Distribution by client packages
                </p>
              </div>
              <Link to={ROUTES.RA_DATA_ENTRY} className="text-xs text-[var(--accent)] hover:underline">
                View All →
              </Link>
            </div>
            <div className="h-72 relative flex items-center justify-center">
              {stats?.packageRevenue && Object.keys(stats.packageRevenue).length > 0 ? (
                <canvas ref={packageCanvasRef}></canvas>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No package data recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Critical Renewals & Quick Operations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Renewals Watchlist */}
          <div className="lg:col-span-2 bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  Upcoming Renewals Watchlist (Next 30 Days)
                </h2>
              </div>
              <Link
                to={ROUTES.RA_DATA_ENTRY}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Open Data Entry →
              </Link>
            </div>

            {stats?.upcomingRenewals && stats.upcomingRenewals.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase bg-[var(--panel-inset-soft)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="py-3 px-4">Client Name</th>
                      <th className="py-3 px-4">Mobile</th>
                      <th className="py-3 px-4">Package</th>
                      <th className="py-3 px-4">End Date</th>
                      <th className="py-3 px-4">Days Left</th>
                      <th className="py-3 px-4 text-right">Fee Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {stats.upcomingRenewals.slice(0, 5).map((client) => {
                      const daysLeft = client.daysLeft ?? client.days_left ?? 0;
                      const badgeColor =
                        daysLeft <= 7
                          ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                          : daysLeft <= 15
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';

                      return (
                        <tr key={client.id} className="hover:bg-[var(--bg-hover-2)] transition">
                          <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                            {client.client_name}
                          </td>
                          <td className="py-3 px-4 text-[var(--text-secondary)] font-mono text-xs">
                            {client.mobile_number || '-'}
                          </td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">
                            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-hover-2)] text-xs font-medium">
                              {client.package || 'Standard'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 dark:text-[var(--text-muted)] text-xs">
                            {client.subscription_end_date ? new Date(client.subscription_end_date).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeColor}`}>
                              {daysLeft <= 0 ? 'Expiring Today' : `${daysLeft} days`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-400">
                            {formatMoney(client.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-[var(--text-secondary)]">
                <svg className="w-12 h-12 mx-auto text-[var(--text-muted)] dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">No subscriptions expiring in the next 30 days.</p>
              </div>
            )}
          </div>

          {/* Quick Action & Hub Navigation Cards */}
          <div className="space-y-4">
            {/* Testimonials Quick Card */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-bold tracking-wider bg-white/20 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                  Client Feedback Hub
                </span>
                <span className="text-yellow-300 text-sm font-bold">
                  ★ Testimonials
                </span>
              </div>
              <h3 className="text-xl font-extrabold mb-1">Testimonials Hub</h3>
              <p className="text-sm text-purple-100 mb-4">
                Capture client appreciation, WhatsApp feedback screenshots, and star ratings.
              </p>
              <Link
                to={ROUTES.RA_TESTIMONIALS}
                className="inline-flex items-center gap-2 bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] font-bold px-4 py-2 rounded-xl text-sm font-bold transition shadow"
              >
                Browse Testimonials →
              </Link>
            </div>

            {/* Reports Quick Card */}
            <div className="bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-bold text-[var(--text-primary)]">Weekly & Monthly Reports</h4>
                  <p className="text-xs text-[var(--text-secondary)]">Print & Download PDF reports</p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-4">
                Generate comprehensive periodic reports with revenue charts, package breakdown, and renewals.
              </p>
              <Link
                to={ROUTES.RA_REPORTS}
                className="block w-full text-center px-4 py-2.5 text-sm font-semibold rounded-xl bg-[var(--bg-hover-2)] text-[var(--text-primary)] hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                Open Periodic Reports
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RADashboardPage;
