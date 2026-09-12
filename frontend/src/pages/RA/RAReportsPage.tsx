import React, { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { raService } from '../../services/ra.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import type { RAPeriodicReport } from '../../types/ra.types';

const formatMoney = (val: number | string | undefined | null) => {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN');
};

export const RAReportsPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const isLeadership = ['ceo', 'managing_director', 'director', 'executive'].includes(currentUser?.role || '');
  const isHOD = currentUser?.role === 'hod';
  const hasMultiBranchAccess = isAdmin || isLeadership || isHOD;

  // Report Period Selection
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'custom'>('monthly');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);

  // Dates
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [report, setReport] = useState<RAPeriodicReport | null>(null);
  const [loading, setLoading] = useState(false);
  const reportContentRef = useRef<HTMLDivElement | null>(null);

  // Load branches
  useEffect(() => {
    if (hasMultiBranchAccess) {
      orgService.getBranches().then(setBranches).catch(() => {});
    }
  }, [hasMultiBranchAccess]);

  // Adjust dates when period type switches
  const handlePeriodTypeChange = (type: 'weekly' | 'monthly' | 'custom') => {
    setPeriodType(type);
    const now = new Date();
    if (type === 'weekly') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      setStartDate(past7.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'monthly') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  };

  // Quick Preset Handlers
  const handlePresetSelect = (preset: string) => {
    const now = new Date();
    if (preset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    } else if (preset === 'last_week') {
      const pastMonday = new Date();
      pastMonday.setDate(now.getDate() - now.getDay() - 6);
      const pastSunday = new Date();
      pastSunday.setDate(pastMonday.getDate() + 6);
      setStartDate(pastMonday.toISOString().split('T')[0]);
      setEndDate(pastSunday.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(last.toISOString().split('T')[0]);
    }
  };

  // Generate Report
  const generateReport = async () => {
    try {
      setLoading(true);
      const data = await raService.getPeriodicReport({
        periodType,
        startDate,
        endDate,
        branchId: selectedBranch || undefined,
      });
      setReport(data);
      toast.success('RA Report generated successfully');
    } catch (err: any) {
      console.error('Error generating report:', err);
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-6 pb-16">
        {/* Style tag for print layout optimization */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            header, aside, nav, .no-print, button, a[href^="/"] {
              display: none !important;
            }
            .printable-area {
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        ` }} />

        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600/10 dark:bg-emerald-500/20 rounded-xl text-emerald-400">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  RA Periodic Reports & PDF Generator
                </h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  Generate, inspect, print, and download official Weekly & Monthly Research Analyst performance reports.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handlePrint}
              disabled={!report}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-black dark:hover:bg-white shadow transition disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Report
            </button>

            <button
              onClick={handlePrint}
              disabled={!report}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow transition disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
          </div>
        </div>

        {/* Filter & Parameters Bar (Hidden on Print) */}
        <div className="no-print bg-[var(--bg-card)] p-6 rounded-2xl shadow-sm border border-[var(--border)] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Period Switcher */}
            <div className="flex items-center bg-[var(--bg-hover-2)] p-1 rounded-xl">
              <button
                onClick={() => handlePeriodTypeChange('weekly')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                  periodType === 'weekly'
                    ? 'bg-[var(--bg-card)] text-emerald-400 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Weekly Report
              </button>
              <button
                onClick={() => handlePeriodTypeChange('monthly')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                  periodType === 'monthly'
                    ? 'bg-[var(--bg-card)] text-emerald-400 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Monthly Report
              </button>
              <button
                onClick={() => handlePeriodTypeChange('custom')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition ${
                  periodType === 'custom'
                    ? 'bg-[var(--bg-card)] text-emerald-400 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Custom Period
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Presets:</span>
              <button
                onClick={() => handlePresetSelect('this_week')}
                className="px-2.5 py-1 text-xs rounded-lg bg-[var(--bg-hover-2)] text-[var(--text-secondary)] hover:bg-gray-200"
              >
                This Week
              </button>
              <button
                onClick={() => handlePresetSelect('last_week')}
                className="px-2.5 py-1 text-xs rounded-lg bg-[var(--bg-hover-2)] text-[var(--text-secondary)] hover:bg-gray-200"
              >
                Last Week
              </button>
              <button
                onClick={() => handlePresetSelect('this_month')}
                className="px-2.5 py-1 text-xs rounded-lg bg-[var(--bg-hover-2)] text-[var(--text-secondary)] hover:bg-gray-200"
              >
                This Month
              </button>
              <button
                onClick={() => handlePresetSelect('last_month')}
                className="px-2.5 py-1 text-xs rounded-lg bg-[var(--bg-hover-2)] text-[var(--text-secondary)] hover:bg-gray-200"
              >
                Last Month
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
              />
            </div>

            {hasMultiBranchAccess && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Branch Scope</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-primary)]"
                >
                  <option value="">All Branches Consolidation</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end">
              <button
                onClick={generateReport}
                disabled={loading}
                className="w-full py-2.5 px-4 text-sm font-bold rounded-xl bg-[var(--accent)] text-slate-950 font-semibold hover:bg-[var(--accent-hover)] transition shadow disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Update Report Data'}
              </button>
            </div>
          </div>
        </div>

        {/* PRINTABLE REPORT DOCUMENT */}
        {loading ? (
          <div className="bg-[var(--bg-card)] rounded-2xl p-16 text-center text-[var(--text-muted)] animate-pulse">
            <p className="font-semibold text-lg">Compiling Research Analyst periodic report...</p>
          </div>
        ) : report ? (
          <div
            ref={reportContentRef}
            className="printable-area bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] p-8 sm:p-12 rounded-2xl shadow-xl border border-[var(--border)] space-y-8 max-w-5xl mx-auto"
          >
            {/* Header with Organization Branding */}
            <div className="border-b-2 border-gray-900 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black tracking-tight text-blue-900 uppercase">
                      FINANCIAL ADVISORY SERVICES
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-900 text-white text-[10px] font-bold tracking-widest uppercase">
                      RA DIVISION
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-[var(--text-primary)] mt-1 uppercase tracking-tight">
                    {periodType === 'weekly' ? 'Weekly' : periodType === 'monthly' ? 'Monthly' : 'Periodic'} Research Analyst Performance Report
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    SEBI Regulated Portfolio Management & Client Subscription Audit Record
                  </p>
                </div>

                <div className="sm:text-right font-mono text-xs text-[var(--text-secondary)] space-y-1">
                  <div><strong>Period:</strong> {new Date(report.startDate).toLocaleDateString('en-IN')} to {new Date(report.endDate).toLocaleDateString('en-IN')}</div>
                  <div><strong>Scope:</strong> {report.branchName || 'Consolidated (All Branches)'}</div>
                </div>
              </div>
            </div>

            {/* KPI Summary Block (6 Cards) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                1. Executive Financial & Onboarding Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase block">New Clients</span>
                  <div className="text-xl font-black text-[var(--text-primary)] mt-1">{report.summary.totalClientsAcquired}</div>
                </div>

                <div className="p-3.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase block">Collected Revenue</span>
                  <div className="text-xl font-black text-emerald-400 mt-1">{formatMoney(report.summary.totalRevenue)}</div>
                </div>

                <div className="p-3.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase block">Active Subscriptions</span>
                  <div className="text-xl font-black text-[var(--text-primary)] mt-1">{report.summary.activeSubscriptions}</div>
                </div>

                <div className="p-3.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase block">Expiring (30d)</span>
                  <div className="text-xl font-black text-amber-400 mt-1">{report.summary.expiringSubscriptions}</div>
                </div>

                <div className="p-3.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
                  <span className="text-[11px] font-semibold text-rose-400 uppercase block">Expired Subscriptions</span>
                  <div className="text-xl font-black text-rose-400 mt-1">{report.summary.expiredSubscriptions}</div>
                </div>

                <div className="p-3.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
                  <span className="text-[11px] font-semibold text-cyan-400 uppercase block">KRA Completed</span>
                  <div className="text-xl font-black text-cyan-400 mt-1">{report.summary.kraCompletedCount}</div>
                </div>
              </div>
            </div>

            {/* Package Revenue Share Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                2. Package Performance & Product Mix
              </h3>
              <table className="w-full text-left text-xs border border-[var(--border)] rounded-lg overflow-hidden">
                <thead className="bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] uppercase font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Advisory Package</th>
                    <th className="py-2.5 px-3 text-center">Subscribers</th>
                    <th className="py-2.5 px-3 text-center">Active</th>
                    <th className="py-2.5 px-3 text-center">Expiring</th>
                    <th className="py-2.5 px-3 text-right">Revenue Collected</th>
                    <th className="py-2.5 px-3 text-right">Avg Fee / Client</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {Object.entries(report.packageBreakdown || {}).map(([pkgName, pkg], idx) => {
                    return (
                      <tr key={idx} className="hover:bg-[var(--bg-hover-2)]">
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">{pkgName}</td>
                        <td className="py-2.5 px-3 text-center font-bold">{pkg.clients}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">{pkg.active}</td>
                        <td className="py-2.5 px-3 text-center text-amber-400 font-bold">{pkg.expiring}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{formatMoney(pkg.revenue)}</td>
                        <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                          {formatMoney(pkg.clients ? pkg.revenue / pkg.clients : 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* New Clients Enrolled in Period Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                3. Client Onboarding Register (Joined within Period)
              </h3>
              {report.clientRecords.length === 0 ? (
                <div className="p-4 bg-[var(--bg-card)] rounded-lg text-xs text-[var(--text-muted)] italic text-center">
                  No new clients onboarded during this selected timeframe.
                </div>
              ) : (
                <table className="w-full text-left text-xs border border-[var(--border)] rounded-lg overflow-hidden">
                  <thead className="bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Client Name</th>
                      <th className="py-2 px-3">Mobile No</th>
                      <th className="py-2 px-3">Package</th>
                      <th className="py-2 px-3">Validity</th>
                      <th className="py-2 px-3 text-right">Fee Paid</th>
                      <th className="py-2 px-3">KRA User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {report.clientRecords.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-[var(--bg-hover-2)]">
                        <td className="py-2 px-3 text-[var(--text-muted)]">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-[var(--text-primary)]">{c.client_name}</td>
                        <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">{c.mobile_number || '-'}</td>
                        <td className="py-2 px-3 text-[var(--text-primary)]">{c.package}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">
                          {c.subscription_start_date ? new Date(c.subscription_start_date).toLocaleDateString('en-IN') : '-'} to{' '}
                          {c.subscription_end_date ? new Date(c.subscription_end_date).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">{formatMoney(c.amount)}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{c.kra_user || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Upcoming Renewals Watchlist Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                4. Renewals Forecast (Upcoming Subscriptions Due)
              </h3>
              {report.renewalRecords.length === 0 ? (
                <div className="p-4 bg-[var(--bg-card)] rounded-lg text-xs text-[var(--text-muted)] italic text-center">
                  No upcoming renewals falling in the immediate forecast.
                </div>
              ) : (
                <table className="w-full text-left text-xs border border-[var(--border)] rounded-lg overflow-hidden">
                  <thead className="bg-[var(--panel-inset-soft)] text-[var(--text-secondary)] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Client Name</th>
                      <th className="py-2 px-3">Mobile No</th>
                      <th className="py-2 px-3">Package</th>
                      <th className="py-2 px-3">Expiry Date</th>
                      <th className="py-2 px-3 text-center">Days Left</th>
                      <th className="py-2 px-3 text-right">Last Fee Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {report.renewalRecords.slice(0, 10).map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-bold text-[var(--text-primary)]">{r.client_name}</td>
                        <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">{r.mobile_number || '-'}</td>
                        <td className="py-2 px-3 text-[var(--text-primary)]">{r.package}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">
                          {r.subscription_end_date ? new Date(r.subscription_end_date).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-amber-400">
                          {r.daysLeft} days
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">
                          {formatMoney(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Testimonials Spotlight */}
            {report.recentTestimonials && report.recentTestimonials.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  5. Client Feedback & Appreciation Highlights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.recentTestimonials.slice(0, 4).map((t) => (
                    <div key={t.id} className="p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[var(--text-primary)]">{t.client_name}</span>
                        <span className="text-amber-500 font-bold">{t.rating} ★</span>
                      </div>
                      <p className="italic text-[var(--text-primary)]">"{t.feedback_text}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sign-off & Verification Footer */}
            <div className="pt-8 border-t-2 border-gray-900 grid grid-cols-3 gap-8 text-center text-xs">
              <div>
                <div className="h-12 border-b border-dashed border-gray-400 mb-2"></div>
                <p className="font-bold text-[var(--text-primary)]">Prepared By</p>
                <p className="text-[var(--text-muted)]">{currentUser?.full_name || currentUser?.email || 'RA Operations Executive'}</p>
              </div>

              <div>
                <div className="h-12 border-b border-dashed border-gray-400 mb-2"></div>
                <p className="font-bold text-[var(--text-primary)]">Verified By (RA Head)</p>
                <p className="text-[var(--text-muted)]">Research & Advisory Department</p>
              </div>

              <div>
                <div className="h-12 border-b border-dashed border-gray-400 mb-2"></div>
                <p className="font-bold text-[var(--text-primary)]">Authorized Signatory / MD</p>
                <p className="text-[var(--text-muted)]">Executive Management</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default RAReportsPage;
