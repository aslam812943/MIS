import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';

import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { privilegeService } from '../../services/privilege.service';
import { authService } from '../../services/auth.service';
import { orgService } from '../../services/org.service';
import type { Branch } from '../../services/org.service';
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
  RefreshCw,
  CalendarDays,
  Printer,
  Download
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
  ['sl_no', 'Sl No'],
  ['name', 'Client name'],
  ['code', 'Client code'],
  ['account_date', 'Date'],
  ['mobile_no', 'Mobile No'],
  ['scheme', 'Scheme'],
  ['introducer', 'Introducer'],
  ['rm', 'RM'],
  ['dealer', 'Dealer'],
  ['branch', 'Branch'],
  ['trading_started', 'Trading Started'],
  ['remarks', 'Remarks'],
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
  const normalizedRole = String(currentUser?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const isHOD = normalizedRole === 'hod';
  const canViewAllBranches = ['hod', 'ceo', 'admin'].includes(normalizedRole);
  

  const [stats, setStats] = useState<PrivilegeDashboardStats | null>(null);
  const [tab, setTab] = useState<'Overview' | 'Accounts' | 'Uploads'>('Overview');
  const [query, setQuery] = useState('');
  const [modalAccount, setModalAccount] = useState<PrivilegeAccount | null>(null);
  const [files, setFiles] = useState<PrivilegeUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Show the complete register initially. Date filters remain available for reports.
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'custom' | 'all'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('all');

  const fetchData = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      const [dashStats, uploadsList, branchList] = await Promise.all([
        privilegeService.getDashboardStats(),
        privilegeService.getUploads(),
        canViewAllBranches ? orgService.getBranches() : Promise.resolve([])
      ]);
      setStats(dashStats);
      setFiles(uploadsList);
      setBranches(branchList);
      if (showToast) toast.success('Privilege dashboard updated');
    } catch (err: any) {
      console.error('Failed to load privilege dashboard:', err);
      const message = err?.response?.data?.error || err?.response?.data?.message ||
        (!err?.response ? 'Unable to connect to the server. Check your connection and try again.' : 'The dashboard could not be loaded. Please try again.');
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const accounts = stats?.accounts || [];
  const periodRange = useMemo(() => {
    if (period === 'all') return { start: null, end: null, label: 'All dates' };
    if (period === 'custom') return { start: fromDate || null, end: toDate || null, label: fromDate && toDate ? `${fromDate} to ${toDate}` : 'Custom range' };
    const end = new Date();
    const start = new Date(end);
    if (period === 'week') start.setDate(end.getDate() - 6);
    if (period === 'month') start.setMonth(end.getMonth() - 1);
    if (period === 'year') start.setFullYear(end.getFullYear() - 1);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { start: iso(start), end: iso(end), label: `Last ${period}` };
  }, [period, fromDate, toDate]);

  const dateFilteredAccounts = useMemo(() => accounts.filter((a) => {
    if (!a.account_date) return period === 'all';
    return (!periodRange.start || a.account_date >= periodRange.start) && (!periodRange.end || a.account_date <= periodRange.end);
  }), [accounts, period, periodRange]);
  const periodAccounts = useMemo(() => dateFilteredAccounts.filter((a) =>
    selectedBranch === 'all' || a.branch_id === selectedBranch
  ), [dateFilteredAccounts, selectedBranch]);
  const filteredAccounts = periodAccounts.filter((a) =>
    [a.name, a.code, a.mobile_no, a.scheme, a.rm, a.dealer, a.branch, a.location, a.stocks].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  const aum = periodAccounts.reduce((sum, a) => sum + Number(a.aum || 0), 0);
  const used = periodAccounts.reduce((sum, a) => sum + Number(a.utilised || 0), 0);
  const available = Math.max(0, aum - used);
  const ratio = aum > 0 ? (used / aum) * 100 : 0;
  const totalAccounts = periodAccounts.length;
  const avgUtilised = totalAccounts ? used / totalAccounts : 0;
  const topAccounts = [...periodAccounts].sort((a, b) => Number(b.utilised) - Number(a.utilised)).slice(0, 5);
  const selectedBranchName = selectedBranch === 'all'
    ? (canViewAllBranches ? 'All Branches' : 'My Entries')
    : branches.find((b) => b.id === selectedBranch)?.name || 'Selected Branch';
  const branchSummaries = useMemo(() => branches.map((branch) => {
    const branchAccounts = dateFilteredAccounts.filter((a) => a.branch_id === branch.id);
    const branchAum = branchAccounts.reduce((sum, a) => sum + Number(a.aum || 0), 0);
    const branchUsed = branchAccounts.reduce((sum, a) => sum + Number(a.utilised || 0), 0);
    return { ...branch, accounts: branchAccounts.length, aum: branchAum, utilised: branchUsed, ratio: branchAum > 0 ? (branchUsed / branchAum) * 100 : 0 };
  }), [branches, dateFilteredAccounts]);

  const reportTitle = `Privilege Account Report - ${selectedBranchName} - ${periodRange.label}`;
  const reportRows = filteredAccounts.map((a) => [
    String(a.sl_no || ''), a.code, a.name, a.account_date || '', a.mobile_no || '', a.scheme || '',
    a.introducer || '', a.rm || '', a.dealer || '', a.branch || '', a.trading_started ? 'Yes' : 'No',
    formatMoney(a.aum), formatMoney(a.utilised), a.remarks || ''
  ]);

  const downloadPdf = () => {
    if (!filteredAccounts.length) return toast.error('No records are available for the selected report period.');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16); doc.text(reportTitle, 10, 12);
    doc.setFontSize(9); doc.text(`Generated: ${new Date().toLocaleString('en-IN')}   Accounts: ${totalAccounts}   AUM: ${formatMoney(aum)}   Utilised: ${formatMoney(used)}`, 10, 19);
    const headers = ['Sl', 'Code', 'Name', 'Date', 'Mobile', 'Scheme', 'Introducer', 'RM', 'Dealer', 'Branch', 'Trade', 'AUM', 'Utilised', 'Remarks'];
    const widths = [8, 17, 25, 19, 23, 20, 20, 18, 18, 18, 12, 22, 22, 30];
    let y = 28;
    const drawRow = (row: string[], bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(6.5);
      let x = 6;
      row.forEach((cell, i) => { doc.text(String(cell).slice(0, 22), x, y, { maxWidth: widths[i] - 1 }); x += widths[i]; });
      y += 7;
    };
    drawRow(headers, true);
    reportRows.forEach((row) => { if (y > 195) { doc.addPage(); y = 12; drawRow(headers, true); } drawRow(row); });
    doc.save(`privilege-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF report downloaded');
  };

  const printReport = () => {
    if (!filteredAccounts.length) return toast.error('No records are available for the selected report period.');
    const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const headers = ['Sl No', 'Client Code', 'Client Name', 'Date', 'Mobile No', 'Scheme', 'Introducer', 'RM', 'Dealer', 'Branch', 'Trading', 'AUM', 'Funds Utilised', 'Remarks'];
    const popup = window.open('', '_blank');
    if (!popup) return toast.error('Allow pop-ups to print the report.');
    popup.document.write(`<html><head><title>${escape(reportTitle)}</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial;color:#111}h1{font-size:18px;margin:0 0 6px}.meta{font-size:11px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:8px}th,td{border:1px solid #bbb;padding:5px;text-align:left;vertical-align:top}th{background:#eee}tr{break-inside:avoid}</style></head><body><h1>${escape(reportTitle)}</h1><div class="meta">Generated: ${escape(new Date().toLocaleString('en-IN'))} | Accounts: ${totalAccounts} | AUM: ${escape(formatMoney(aum))} | Funds Utilised: ${escape(formatMoney(used))}</div><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${reportRows.map(row => `<tr>${row.map(v => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>{window.print();window.close()}</script></body></html>`);
    popup.document.close();
  };

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

        {(tab === 'Overview' || tab === 'Accounts') && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col xl:flex-row xl:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2">
                <CalendarDays className="w-4 h-4 text-[var(--accent)]" /> Date-wise Analysis
              </div>
              <div className="flex flex-wrap gap-2">
                {([['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly'], ['all', 'All Dates'], ['custom', 'Custom Date']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setPeriod(value)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${period === value ? 'bg-[var(--accent)] text-slate-950 border-[var(--accent)]' : 'bg-[var(--bg-base)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'}`}>{label}</button>
                ))}
              </div>
            </div>
            {period === 'custom' && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-[var(--text-secondary)]">From<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className="block mt-1 px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)]" /></label>
                <label className="text-xs text-[var(--text-secondary)]">To<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className="block mt-1 px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)]" /></label>
              </div>
            )}
            {canViewAllBranches && (
              <label className="text-xs text-[var(--text-secondary)] min-w-[190px]">
                Branch Scope
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="block w-full mt-1 px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] font-semibold">
                  <option value="all">All Branches</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] mr-1">{selectedBranchName} · {periodRange.label} · {filteredAccounts.length} records</span>
              <button type="button" onClick={downloadPdf} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] text-slate-950"><Download className="w-4 h-4" /> Download PDF</button>
              <button type="button" onClick={printReport} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-primary)] bg-[var(--bg-base)]"><Printer className="w-4 h-4" /> Print Report</button>
            </div>
          </div>
        )}

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
                {canViewAllBranches && selectedBranch === 'all' && (
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 sm:px-6 py-4 border-b border-[var(--border)]">
                      <h2 className="text-base font-bold text-[var(--text-primary)]">Branch-wise Analysis</h2>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Separate performance for each branch during {periodRange.label.toLowerCase()}.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-[var(--table-header-bg)] text-xs uppercase tracking-wider text-[var(--text-muted)]"><tr><th className="px-6 py-3 text-left">Branch</th><th className="px-6 py-3 text-right">Accounts</th><th className="px-6 py-3 text-right">AUM</th><th className="px-6 py-3 text-right">Funds Utilised</th><th className="px-6 py-3 text-right">Available</th><th className="px-6 py-3 text-right">Utilisation</th><th className="px-6 py-3 text-right">View</th></tr></thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {branchSummaries.map((branch) => (
                            <tr key={branch.id} className="hover:bg-[var(--bg-hover)]">
                              <td className="px-6 py-3 font-semibold text-[var(--text-primary)]">{branch.name}</td>
                              <td className="px-6 py-3 text-right text-[var(--text-secondary)]">{branch.accounts}</td>
                              <td className="px-6 py-3 text-right font-semibold text-[var(--text-primary)]">{formatMoney(branch.aum)}</td>
                              <td className="px-6 py-3 text-right text-[var(--text-primary)]">{formatMoney(branch.utilised)}</td>
                              <td className="px-6 py-3 text-right text-[var(--text-secondary)]">{formatMoney(Math.max(0, branch.aum - branch.utilised))}</td>
                              <td className="px-6 py-3 text-right font-semibold text-[var(--accent)]">{branch.ratio.toFixed(1)}%</td>
                              <td className="px-6 py-3 text-right"><button type="button" onClick={() => setSelectedBranch(branch.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-slate-950 transition">Open</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
                      {topAccounts.length > 0 ? (
                        topAccounts.map((item) => {
                          const itemRatio = Number(item.aum) > 0 ? (Number(item.utilised) / Number(item.aum)) * 100 : 0;
                          return <div key={item.code} className="flex items-center gap-3">
                            <span className="w-20 sm:w-24 text-xs font-semibold text-[var(--text-primary)] truncate">
                              {item.name}
                            </span>
                            <div className="flex-1 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, itemRatio))}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs font-bold text-[var(--text-primary)] tabular-nums">
                              {itemRatio.toFixed(0)}%
                            </span>
                          </div>;
                        })
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
                    <table className="w-full text-left text-sm text-[var(--text-secondary)] min-w-[1450px]">
                      <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]">
                        <tr>
                          <th className="py-3.5 px-6 min-w-[190px]">Client</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4">Mobile No</th>
                          <th className="py-3.5 px-4">Scheme</th>
                          <th className="py-3.5 px-4">RM / Dealer</th>
                          <th className="py-3.5 px-4">Branch</th>
                          <th className="py-3.5 px-4">Trading</th>
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
                              <td className="py-4 px-4">{a.account_date ? new Date(`${a.account_date}T00:00:00`).toLocaleDateString('en-IN') : '—'}</td>
                              <td className="py-4 px-4">{a.mobile_no || '—'}</td>
                              <td className="py-4 px-4">{a.scheme || '—'}</td>
                              <td className="py-4 px-4">{[a.rm, a.dealer].filter(Boolean).join(' / ') || '—'}</td>
                              <td className="py-4 px-4">{a.branch || '—'}</td>
                              <td className="py-4 px-4">{a.trading_started ? 'Yes' : 'No'}</td>
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
                  <table className="w-full text-left text-sm text-[var(--text-secondary)] min-w-[1450px]">
                    <thead className="bg-[var(--table-header-bg)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]">
                      <tr>
                        <th className="py-3.5 px-6 min-w-[190px]">Client</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Mobile No</th>
                        <th className="py-3.5 px-4">Scheme</th>
                        <th className="py-3.5 px-4">RM / Dealer</th>
                        <th className="py-3.5 px-4">Branch</th>
                        <th className="py-3.5 px-4">Trading</th>
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
                            <td className="py-4 px-4">{a.account_date ? new Date(`${a.account_date}T00:00:00`).toLocaleDateString('en-IN') : '—'}</td>
                            <td className="py-4 px-4">{a.mobile_no || '—'}</td>
                            <td className="py-4 px-4">{a.scheme || '—'}</td>
                            <td className="py-4 px-4">{[a.rm, a.dealer].filter(Boolean).join(' / ') || '—'}</td>
                            <td className="py-4 px-4">{a.branch || '—'}</td>
                            <td className="py-4 px-4">{a.trading_started ? 'Yes' : 'No'}</td>
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

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a href={privilegeService.getViewUrl(f.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition">
                            <Eye className="w-3.5 h-3.5" /> View
                          </a>
                          <a
                            href={privilegeService.getDownloadUrl(f.id)}
                            download
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
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
        {modalAccount && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-hidden" onClick={() => setModalAccount(null)} role="dialog" aria-modal="true" aria-label="Privilege account details">
            <div
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--border)] flex items-center justify-between shrink-0">
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
              <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-4 min-h-0 flex-1">
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
                            ? formatMoney(Number(modalAccount[key]))
                            : key === 'returns'
                            ? `${modalAccount.returns > 0 ? '+' : ''}${modalAccount.returns}%`
                            : key === 'trading_started'
                            ? (modalAccount.trading_started ? 'Yes' : 'No')
                            : key === 'account_date' && modalAccount.account_date
                            ? new Date(`${modalAccount.account_date}T00:00:00`).toLocaleDateString('en-IN')
                            : String(modalAccount[key] ?? '')
                        }
                        type="text"
                        className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none cursor-default font-medium select-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)]/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-[var(--text-muted)]">Amounts are recorded in INR (₹)</span>
                <button
                  onClick={() => setModalAccount(null)}
                  className="px-5 py-2 text-sm font-semibold rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm w-full sm:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </DashboardLayout>
  );
};

export default PrivilegeDashboardPage;
