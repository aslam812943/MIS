import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import { iepfService } from '../../services/iepf.service';
import { orgService } from '../../services/org.service';
import { authService } from '../../services/auth.service';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useTheme } from '../../context/ThemeContext';

Chart.register(...registerables);

// Icon components for KPIs
const IconActivity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconFolderCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    <path d="m9 14 2 2 4-4"/>
  </svg>
);
const IconAlertTriangle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IEPFDashboardPage: React.FC = () => {
  const currentUser = authService.getCurrentUser();
  const { theme } = useTheme();
  const isAdmin = currentUser?.role === 'admin';
  const hasMultiBranchAccess = isAdmin || ['ceo', 'managing_director', 'director', 'executive', 'hod'].includes(currentUser?.role || '');
  const userBranchId = currentUser?.branch_id || '';

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [activeClaims, setActiveClaims] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Chart canvas refs
  const donutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances trackers
  const donutChartInstance = useRef<Chart | null>(null);
  const lineChartInstance = useRef<Chart | null>(null);
  const barChartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchDashboard(false);
  }, [branchFilter, startDate, endDate]);

  const fetchBranches = async () => {
    if (!hasMultiBranchAccess) return;
    try {
      const data = await orgService.getBranches();
      setBranches(data || []);
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const fetchDashboard = async (showToast = false) => {
    setLoading(true);
    try {
      const branchIdParam = hasMultiBranchAccess ? (branchFilter || undefined) : userBranchId;
      const [metrics, claimsList] = await Promise.all([
        iepfService.getDashboardData(branchIdParam, startDate || undefined, endDate || undefined),
        iepfService.getClaims({ status: undefined, branchId: branchIdParam })
      ]);
      
      setDashboardData(metrics);
      
      // Filter list to active claims only (not closed/rejected)
      const activeOnly = (claimsList || []).filter(
        (c: any) => c.status !== 'Closed' && c.status !== 'Rejected'
      );
      setActiveClaims(activeOnly);

      if (showToast) {
        toast.success('Dashboard metrics updated.');
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      toast.error('Failed to load IEPF dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  // Render Charts once data is loaded
  useEffect(() => {
    if (!dashboardData) return;

    const isDark = theme === 'dark';
    const tickColorStrong = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.75)';
    const tickColorSoft = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(15, 23, 42, 0.6)';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.08)';
    const gridColorFaint = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.04)';
    const donutBorderColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff';

    // ── 1. DONUT CHART (CLAIM STATUS BREAKDOWN) ───────────────────
    if (donutCanvasRef.current) {
      if (donutChartInstance.current) {
        donutChartInstance.current.destroy();
      }

      const statusData = dashboardData.charts.statusBreakdown;
      const labels = statusData.map((d: any) => d.status);
      const counts = statusData.map((d: any) => d.count);

      const ctx = donutCanvasRef.current.getContext('2d');
      if (ctx) {
        donutChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: counts,
              backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#f43f5e'],
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

    // ── 2. LINE CHART (MONTHLY CLAIMS TREND) ─────────────────────
    if (lineCanvasRef.current) {
      if (lineChartInstance.current) {
        lineChartInstance.current.destroy();
      }

      const trendData = dashboardData.charts.monthlyTrend;
      const labels = trendData.map((d: any) => d.month);
      const counts = trendData.map((d: any) => d.claims);

      const ctx = lineCanvasRef.current.getContext('2d');
      if (ctx) {
        lineChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Claims Submitted',
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

    // ── 3. BAR CHART (PENDING REASONS BREAKDOWN) ──────────────────
    if (barCanvasRef.current) {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }

      const reasonData = dashboardData.charts.pendingReasons;
      const labels = reasonData.map((d: any) => d.reason);
      const counts = reasonData.map((d: any) => d.count);

      const ctx = barCanvasRef.current.getContext('2d');
      if (ctx) {
        barChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Case count',
              data: counts,
              backgroundColor: '#f59e0b',
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
  }, [dashboardData, theme]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="mis-loading-center py-32">
          <div className="mis-spinner" />
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading IEPF Analytics Dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  const kpis = dashboardData?.kpis || {};

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl mx-auto space-y-8">

        {/* ── Page Header ───────────────────────────────────── */}
        <header 
          className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 p-6 border rounded-xl shadow-xs text-left" 
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div>
            <h1 className="text-2.5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              📊 IEPF Department Analytics
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Overview of claim files processing efficiency, resolution metrics, and hold reasons.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3.5 sm:self-auto">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mis-input py-1 px-2 text-xs"
                style={{ width: '130px', minWidth: '130px' }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mis-input py-1 px-2 text-xs"
                style={{ width: '130px', minWidth: '130px' }}
              />
            </div>
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
              onClick={() => fetchDashboard(true)}
              className="px-3.5 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 h-[34px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', minWidth: '135px' }}
            >
              🔄 Refresh Metrics
            </button>
          </div>
        </header>

        {/* ── KPI Grid ──────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          <div className="mis-stat-card border-l-4 border-cyan-500">
            <div className="flex justify-between items-start mb-2">
              <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Total Active Claims</span>
              <span className="text-cyan-500 opacity-85"><IconActivity /></span>
            </div>
            <div className="mis-stat-value text-3xl font-bold">{kpis.activeClaims}</div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>Processing files</p>
          </div>

          <div className="mis-stat-card border-l-4 border-emerald-500">
            <div className="flex justify-between items-start mb-2">
              <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Closed Cases (Year)</span>
              <span className="text-emerald-500 opacity-85"><IconFolderCheck /></span>
            </div>
            <div className="mis-stat-value text-3xl font-bold">{kpis.closedThisYear}</div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>Resolved this year</p>
          </div>

          <div className="mis-stat-card border-l-4 border-amber-500">
            <div className="flex justify-between items-start mb-2">
              <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Pending Claims</span>
              <span className="text-amber-500 opacity-85"><IconAlertTriangle /></span>
            </div>
            <div className="mis-stat-value text-3xl font-bold">{kpis.pendingClaims}</div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>Held for documents/KYC</p>
          </div>

          <div className="mis-stat-card border-l-4 border-teal-500">
            <div className="flex justify-between items-start mb-2">
              <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Resolved (Month)</span>
              <span className="text-teal-500 opacity-85"><IconCalendar /></span>
            </div>
            <div className="mis-stat-value text-3xl font-bold">{kpis.closedThisMonth}</div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>Completed this month</p>
          </div>

          <div className="mis-stat-card border-l-4 border-purple-500">
            <div className="flex justify-between items-start mb-2">
              <span className="mis-stat-label text-xs uppercase tracking-wider font-semibold">Avg Resolution Time</span>
              <span className="text-purple-500 opacity-85"><IconClock /></span>
            </div>
            <div className="mis-stat-value text-3xl font-bold">
              {kpis.averageResolutionTime} <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>Days</span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>Average closure latency</p>
          </div>

        </section>

        {/* ── Charts Section ────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="mis-card p-5 flex flex-col h-[320px]">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Claim Status breakdown</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Active vs Closed vs Holds</p>
            <div className="flex-1 relative min-h-0">
              <canvas ref={donutCanvasRef} />
            </div>
          </div>

          <div className="mis-card p-5 flex flex-col h-[320px] lg:col-span-2">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Monthly Claims Trend</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Claim registrations submitted this year</p>
            <div className="flex-1 relative min-h-0">
              <canvas ref={lineCanvasRef} />
            </div>
          </div>

          <div className="mis-card p-5 flex flex-col h-[300px] lg:col-span-3">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Pending Reason Analysis</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Frequency of mismatch triggers for files in 'Documents Pending' status</p>
            <div className="flex-1 relative min-h-0">
              <canvas ref={barCanvasRef} />
            </div>
          </div>

        </section>

        {/* ── Active Claims Table Section ───────────────────── */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Active Claims Log</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Live files currently undergoing verification or holding for documentation.</p>
            </div>
            <span className="mis-badge mis-badge-info font-semibold">{activeClaims.length} active claims</span>
          </div>

          <div className="mis-table-wrap">
            {activeClaims.length === 0 ? (
              <div className="mis-empty py-12">No active claims found under processing.</div>
            ) : (
              <table className="mis-table">
                <thead>
                  <tr>
                    <th>Claim Number</th>
                    <th>Investor Name</th>
                    <th>Claim Type</th>
                    <th>Amount (₹) / Shares</th>
                    <th>Branch</th>
                    <th>Assigned Staff</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td className="font-semibold" style={{ color: 'var(--text-primary)' }}>{claim.claim_number}</td>
                      <td>
                        <div className="font-semibold">{claim.investor_name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>PAN: {claim.pan_number}</div>
                      </td>
                      <td>
                        <span className="mis-chip">{claim.claim_type}</span>
                      </td>
                      <td>
                        <div className="font-semibold" style={{ color: 'var(--text-accent)' }}>
                          {claim.amount > 0 ? `₹${claim.amount.toLocaleString()}` : '—'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {claim.num_shares > 0 ? `${claim.num_shares} Shares` : ''}
                        </div>
                      </td>
                      <td>{claim.branches?.name || 'Global'}</td>
                      <td>{claim.profiles?.full_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                      <td>
                        {claim.status === 'Documents Pending' ? (
                          <span className="mis-badge mis-badge-warning">Documents Pending</span>
                        ) : (
                          <span className="mis-badge mis-badge-info">{claim.status}</span>
                        )}
                        {claim.status === 'Documents Pending' && claim.pending_reasons?.length > 0 && (
                          <div className="text-[10px] mt-1" style={{ color: '#fbbf24' }}>
                            Hold: {claim.pending_reasons.join(', ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default IEPFDashboardPage;
