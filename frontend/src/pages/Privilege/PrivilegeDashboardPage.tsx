import React, { useState, useEffect } from 'react';

import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { privilegeService } from '../../services/privilege.service';
import { authService } from '../../services/auth.service';
import type { PrivilegeAccount, PrivilegeUpload, PrivilegeDashboardStats } from '../../types/privilege.types';

import {
  Users,
  Wallet,
  TrendingUp,
  Briefcase,
  Search,
  Eye,
  FileText,
  ArrowDownToLine,
  X,
  FileUp,
  LayoutDashboard,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

const formatMoney = (n: number | string | undefined | null) => {
  const num = Number(n) || 0;
  if (num >= 10000000) {
    return '₹' + (num / 10000000).toFixed(2) + ' Cr';
  }
  if (num >= 100000) {
    return '₹' + (num / 100000).toFixed(2) + ' L';
  }
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const FORM_FIELDS: [keyof PrivilegeAccount, string][] = [
  ['name', 'Client name'],
  ['code', 'Client code'],
  ['location', 'Location'],
  ['occupation', 'Occupation'],
  ['contact', 'Contact'],
  ['aum', 'Account AUM (₹)'],
  ['utilised', 'Funds utilised (₹)'],
  ['returns', 'Return (%)'],
  ['stocks', 'Stocks in trade']
];

export const PrivilegeDashboardPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isHOD = currentUser?.role === 'hod';
  

  const [stats, setStats] = useState<PrivilegeDashboardStats | null>(null);
  const [tab, setTab] = useState<'Overview' | 'Accounts' | 'Uploads'>('Overview');
  const [query, setQuery] = useState('');
  const [modalAccount, setModalAccount] = useState<PrivilegeAccount | null>(null);
  const [files, setFiles] = useState<PrivilegeUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      const [dashStats, uploadsList] = await Promise.all([
        privilegeService.getDashboardStats(),
        privilegeService.getUploads()
      ]);
      setStats(dashStats);
      setFiles(uploadsList);
      if (showToast) toast.success('Privilege dashboard updated');
    } catch (err: any) {
      console.error('Failed to load privilege dashboard:', err);
      toast.error(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const accounts = stats?.accounts || [];
  const filteredAccounts = accounts.filter((a) =>
    [a.name, a.code, a.location, a.stocks].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const ratio = stats?.utilisationRatio || 0;
  const aum = stats?.totalAUM || 0;
  const used = stats?.totalUtilised || 0;
  const available = stats?.availableCapital || 0;
  const avgUtilised = stats?.avgUtilised || 0;
  const totalAccounts = stats?.totalAccounts || 0;

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-16">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[var(--bg-card)] p-5 sm:p-6 rounded-2xl shadow-sm border border-[var(--border)]">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 bg-[var(--accent-bg)] rounded-xl text-[var(--accent)] border border-[var(--border-accent)] flex-shrink-0 mt-0.5 sm:mt-0">
              <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  Privilege Account Portfolio & Analytics
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isHOD
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--border-accent)]'
                }`}>
                  {isHOD ? 'HOD Portfolio Oversight' : 'Privilege Banking'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                {tab === 'Overview' && 'Comprehensive overview of client portfolios, capital utilization, and equity positions.'}
                {tab === 'Accounts' && 'High-net-worth client accounts, allocations, and active trade exposures.'}
                {tab === 'Uploads' && 'Central repository for client trade logs, financial statements, and account documents.'}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border)]">
            {/* Refresh Button */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh Dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            
          </div>
        </div>

        {/* Tab & Toolbar Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-card)] p-3.5 sm:p-4 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="inline-flex items-center p-1 bg-[var(--bg-base)] rounded-xl border border-[var(--border)] w-fit flex-wrap">
            <button
              onClick={() => { setTab('Overview'); setQuery(''); }}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                tab === 'Overview'
                  ? 'bg-[var(--bg-card)] text-[var(--accent)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => { setTab('Accounts'); setQuery(''); }}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                tab === 'Accounts'
                  ? 'bg-[var(--bg-card)] text-[var(--accent)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Accounts</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-bg)] text-[var(--accent)]">
                {accounts.length}
              </span>
            </button>
            <button
              onClick={() => { setTab('Uploads'); setQuery(''); }}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                tab === 'Uploads'
                  ? 'bg-[var(--bg-card)] text-[var(--accent)] font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>Uploads</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-bg)] text-[var(--accent)]">
                {files.length}
              </span>
            </button>
          </div>

          {(tab === 'Overview' || tab === 'Accounts') && (
            <div className="relative flex items-center w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 text-[var(--text-muted)]" />
              <input
                placeholder="Search name, code, location..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition"
              />
            </div>
          )}
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
              <div className="lg:col-span-6 h-64 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]"></div>
              <div className="lg:col-span-6 h-64 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]"></div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Tab: Overview ── */}
            {tab === 'Overview' && (
              <>
                {/* 3 KPI Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {/* Total Accounts */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm hover:border-[var(--accent)]/40 transition flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Total Accounts
                      </span>
                      <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        {totalAccounts.toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-1.5">
                        Privilege accounts under management
                      </div>
                    </div>
                  </div>

                  {/* Total AUM */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm hover:border-emerald-500/40 transition flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Total AUM
                      </span>
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <Wallet className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        {formatMoney(aum)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-1.5">
                        Total portfolio capital deployed
                      </div>
                    </div>
                  </div>

                  {/* Avg. Money Utilised */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm hover:border-cyan-500/40 transition flex flex-col justify-between sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Avg. Money Utilised
                      </span>
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                        {formatMoney(avgUtilised)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-1.5">
                        Total utilised ÷ {totalAccounts} active accounts
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts & Analytics Row */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                  {/* Capital Allocation Card */}
                  <div className="lg:col-span-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                          Capital Allocation
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Where your capital stands today
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)]">
                        INR (₹)
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 py-2">
                      {/* Donut graphic */}
                      <div className="relative w-36 h-36 sm:w-40 sm:h-40 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-slate-200 dark:text-slate-800"
                            strokeWidth="3.8"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-[var(--accent)]"
                            strokeDasharray={`${ratio}, 100`}
                            strokeWidth="3.8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] sm:text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                            Utilisation
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                            {ratio.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Legend details */}
                      <div className="flex-1 space-y-3 w-full">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-md bg-[var(--accent)]"></span>
                            <span className="text-xs font-medium text-[var(--text-secondary)]">Funds Utilised</span>
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">{formatMoney(used)}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3 h-3 rounded-md bg-slate-400 dark:bg-slate-600"></span>
                            <span className="text-xs font-medium text-[var(--text-secondary)]">Available Capital</span>
                          </div>
                          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">{formatMoney(available)}</span>
                        </div>

                        <div className="text-xs text-[var(--text-muted)] pt-1 text-right">
                          Total Portfolio: <strong className="text-[var(--text-primary)] font-semibold">{formatMoney(aum)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Utilisation by Account Card */}
                  <div className="lg:col-span-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                          Utilisation by Account
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Funds deployed as a share of account AUM
                        </p>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)]">
                        <Briefcase className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="space-y-3.5 py-1">
                      {stats?.topAccounts && stats.topAccounts.length > 0 ? (
                        stats.topAccounts.map((item) => (
                          <div key={item.code} className="flex items-center gap-3">
                            <span className="w-20 sm:w-24 text-xs font-semibold text-[var(--text-primary)] truncate">
                              {item.shortName}
                            </span>
                            <div className="flex-1 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, item.ratio))}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs font-bold text-[var(--text-primary)] tabular-nums">
                              {item.ratio}%
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                          No account records found.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Account Summary Table */}
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-sm text-[var(--text-secondary)] min-w-[750px]">
                      <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]">
                        <tr>
                          <th className="py-3.5 px-6 min-w-[190px]">Client</th>
                          <th className="py-3.5 px-6 min-w-[120px]">Location</th>
                          <th className="py-3.5 px-6 min-w-[120px]">AUM</th>
                          <th className="py-3.5 px-6 min-w-[150px]">Funds Utilised</th>
                          <th className="py-3.5 px-6 min-w-[100px]">Return</th>
                          <th className="py-3.5 px-6 min-w-[170px]">Stocks In Trade</th>
                          <th className="py-3.5 px-6 text-right w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]/60">
                        {filteredAccounts.map((a) => {
                          const clientInitials = a.name
                            .split(' ')
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();
                          const utilRatio = a.aum > 0 ? (a.utilised / a.aum) * 100 : 0;
                          const stockList = a.stocks.split(',').map((s) => s.trim()).filter(Boolean);
                          const isNegative = a.returns < 0;

                          return (
                            <tr
                              key={a.code}
                              onClick={() => setModalAccount(a)}
                              className="hover:bg-[var(--bg-hover)] transition cursor-pointer"
                            >
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-[var(--accent)] font-bold text-xs flex items-center justify-center border border-[var(--border-accent)] flex-shrink-0">
                                    {clientInitials}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition">
                                      {a.name}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                                      {a.code}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-sm text-[var(--text-primary)]">{a.location}</td>
                              <td className="py-4 px-6 text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                                {formatMoney(a.aum)}
                              </td>
                              <td className="py-4 px-6 tabular-nums">
                                <div className="font-semibold text-[var(--text-primary)]">
                                  {formatMoney(a.utilised)}
                                </div>
                                <div className="h-1.5 w-20 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden mt-1">
                                  <div
                                    className="h-full rounded-full bg-[var(--accent)]"
                                    style={{ width: `${Math.min(100, utilRatio)}%` }}
                                  />
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                                    isNegative
                                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                  }`}
                                >
                                  {a.returns > 0 ? '+' : ''}
                                  {a.returns.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)] font-mono">
                                    {stockList[0] || '—'}
                                  </span>
                                  {stockList.length > 1 && (
                                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                                      +{stockList.length - 1}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <button
                                  aria-label={`View ${a.name}`}
                                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-base)] transition"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {filteredAccounts.length === 0 && (
                      <div className="text-center py-12">
                        <Users className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                          {query ? 'No matching accounts found' : 'No privilege accounts yet'}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          {query ? 'Try searching with another keyword.' : 'Accounts will appear here once added.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-card)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>Showing {filteredAccounts.length} of {accounts.length} accounts</span>
                    <span>All values in INR (₹)</span>
                  </div>
                </div>
              </>
            )}

            {/* ── Tab: Accounts Table ── */}
            {tab === 'Accounts' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-sm text-[var(--text-secondary)] min-w-[750px]">
                    <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]">
                      <tr>
                        <th className="py-3.5 px-6 min-w-[190px]">Client</th>
                        <th className="py-3.5 px-6 min-w-[120px]">Location</th>
                        <th className="py-3.5 px-6 min-w-[120px]">AUM</th>
                        <th className="py-3.5 px-6 min-w-[150px]">Funds Utilised</th>
                        <th className="py-3.5 px-6 min-w-[100px]">Return</th>
                        <th className="py-3.5 px-6 min-w-[170px]">Stocks In Trade</th>
                        <th className="py-3.5 px-6 text-right w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/60">
                      {filteredAccounts.map((a) => {
                        const clientInitials = a.name
                          .split(' ')
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();
                        const utilRatio = a.aum > 0 ? (a.utilised / a.aum) * 100 : 0;
                        const stockList = a.stocks.split(',').map((s) => s.trim()).filter(Boolean);
                        const isNegative = a.returns < 0;

                        return (
                          <tr
                            key={a.code}
                            onClick={() => setModalAccount(a)}
                            className="hover:bg-[var(--bg-hover)] transition cursor-pointer"
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-[var(--accent)] font-bold text-xs flex items-center justify-center border border-[var(--border-accent)] flex-shrink-0">
                                  {clientInitials}
                                </div>
                                <div>
                                  <div className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition">
                                    {a.name}
                                  </div>
                                  <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                                    {a.code}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-sm text-[var(--text-primary)]">{a.location}</td>
                            <td className="py-4 px-6 text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                              {formatMoney(a.aum)}
                            </td>
                            <td className="py-4 px-6 tabular-nums">
                              <div className="font-semibold text-[var(--text-primary)]">
                                {formatMoney(a.utilised)}
                              </div>
                              <div className="h-1.5 w-20 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden mt-1">
                                <div
                                  className="h-full rounded-full bg-[var(--accent)]"
                                  style={{ width: `${Math.min(100, utilRatio)}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                                  isNegative
                                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                }`}
                              >
                                {a.returns > 0 ? '+' : ''}
                                {a.returns.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border)] font-mono">
                                  {stockList[0] || '—'}
                                </span>
                                {stockList.length > 1 && (
                                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                                    +{stockList.length - 1}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <button
                                aria-label={`View ${a.name}`}
                                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-base)] transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredAccounts.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {query ? 'No matching accounts found' : 'No accounts recorded'}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {query ? 'Try adjusting your search filters.' : 'Accounts will appear here once saved.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-card)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <span>Showing {filteredAccounts.length} of {accounts.length} accounts</span>
                  <span>All values in INR (₹)</span>
                </div>
              </div>
            )}

            {/* ── Tab: Uploads ── */}
            {tab === 'Uploads' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden p-5 sm:p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Uploaded Files & Records</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      CSV, Excel spreadsheets and PDF account statements (up to 10 MB per file).
                    </p>
                  </div>
                </div>

                {files.length > 0 ? (
                  <div className="divide-y divide-[var(--border)]">
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center justify-between py-4 gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-2.5 rounded-xl bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--border-accent)] flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-[var(--text-primary)] truncate">{f.name}</div>
                            <div className="text-xs text-[var(--text-muted)] mt-0.5">
                              {f.kind} · {new Date(f.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        <a
                          href={privilegeService.getDownloadUrl(f.id)}
                          download
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition flex-shrink-0"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" /> Download
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileUp className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">No documents uploaded</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Uploaded client trade logs and account documents will appear here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Modal: View Account Details (Read-Only) ── */}
        {modalAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setModalAccount(null)}>
            <div
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Privilege Account · Details View
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5">
                    {modalAccount.name} ({modalAccount.code})
                  </h2>
                </div>
                <button
                  onClick={() => setModalAccount(null)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  {FORM_FIELDS.map(([key, label]) => (
                    <div key={key} className={key === 'stocks' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                        {label}
                      </label>
                      <input
                        readOnly
                        value={
                          ['aum', 'utilised'].includes(key)
                            ? formatMoney(modalAccount[key])
                            : key === 'returns'
                            ? `${modalAccount.returns > 0 ? '+' : ''}${modalAccount.returns}%`
                            : modalAccount[key] ?? ''
                        }
                        type="text"
                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none cursor-default font-medium select-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)]/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-[var(--text-muted)]">Amounts are recorded in INR (₹)</span>
                <button
                  onClick={() => setModalAccount(null)}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm w-full sm:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PrivilegeDashboardPage;
