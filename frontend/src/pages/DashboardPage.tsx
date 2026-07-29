import React, { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import DashboardLayout from '../components/layout/DashboardLayout';
import { ROUTES } from '../constants/routes';
import PeriodFilter from '../components/common/PeriodFilter';
import TrendDelta from '../components/common/TrendDelta';
import { orgService } from '../services/org.service';
import { hrService } from '../services/hr.service';
import { authService } from '../services/auth.service';
import { useTheme } from '../context/ThemeContext';
import { useDashboardPermissions } from '../hooks/useDashboardPermissions';
import type { DateRange } from '../utils/periodRange';
import { getDefaultPeriod } from '../utils/periodRange';

Chart.register(...registerables);

// Employees land on their department's actual workspace instead of this
// System/HR overview page, which has nothing meaningful for their role (no
// org-wide stats, no HR access) — mirrors Sidebar.tsx's per-department entry
// links. Departments without a dedicated entry page fall back to the
// generic modules-based Data Entry page.
const EMPLOYEE_DEPT_ENTRY_ROUTE: Record<string, string> = {
  IEPF: ROUTES.IEPF_DATA_ENTRY,
  SETTLEMENTS: ROUTES.SETTLEMENTS_DATA_ENTRY,
  KYC: ROUTES.KYC_DATA_ENTRY,
  DP: ROUTES.DP_DATA_ENTRY,
  IT: ROUTES.IT_DATA_ENTRY,
  FINANCE: ROUTES.FINANCE_DATA_ENTRY,
};

const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-15.5z" />
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconUserPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const IconUserMinus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const IconPercent = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const IconClockHistory = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 7 12 12 15.5 14" />
  </svg>
);

const IconBriefcase = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const IconUserSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="8" r="4" />
    <path d="M2 21c0-4 3.6-7 8-7" />
    <circle cx="17" cy="17" r="3" />
    <line x1="21" y1="21" x2="19.2" y2="19.2" />
  </svg>
);

const IconFileCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="m9 15 2 2 4-4" />
  </svg>
);

/**
 * Main Dashboard landing page.
 */
const DashboardPage: React.FC = () => {
  const user = authService.getCurrentUser();
  // Admin gets the System Overview (org-wide branch/department/user counts)
  // as their landing dashboard — HR's employee/recruitment metrics are a
  // separate surface owned by the 'hr' role, not something admin's main
  // dashboard doubles up on.
  const showHRDashboard = user?.role === 'hr';
  const { theme } = useTheme();
  const { isVisible } = useDashboardPermissions();

  const [stats, setStats] = useState({ branches: 0, departments: 0, users: 0, modules: 0 });
  const [hrData, setHRData] = useState<any>(null);
  const [previousHrData, setPreviousHrData] = useState<any>(null);
  // Recruitment/policy aggregates — separate from hrData (which owns
  // employee-headcount KPIs), fetched from HRService.getDashboardStats.
  const [hrOpsData, setHROpsData] = useState<any>(null);
  // Each role now lands on exactly one fixed view — no toggle to switch,
  // so this is derived from role rather than being its own piece of state.
  const dashboardTab: 'system' | 'hr' = showHRDashboard ? 'hr' : 'system';
  const [loading, setLoading] = useState(true);
  const [hrLoading, setHRLoading] = useState(false);

  // Filter state — Monthly/Quarterly/Yearly/Custom, shared across every dashboard
  const [period, setPeriod] = useState<{ current: DateRange; previous: DateRange }>(getDefaultPeriod);

  // Chart refs
  const growthCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const branchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const deptCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resignReasonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const candidateStageCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const growthChartInstance = useRef<Chart | null>(null);
  const branchChartInstance = useRef<Chart | null>(null);
  const deptChartInstance = useRef<Chart | null>(null);
  const resignReasonChartInstance = useRef<Chart | null>(null);
  const roleChartInstance = useRef<Chart | null>(null);
  const candidateStageChartInstance = useRef<Chart | null>(null);

  const fetchHRData = async (range: { current: DateRange; previous: DateRange }) => {
    if (!showHRDashboard) return;
    setHRLoading(true);

    // Fired together, but only the current-period call blocks the loading
    // state — the dashboard renders as soon as it's back instead of
    // waiting on the previous-period comparison too.
    const currentPromise = orgService.getHRDashboardData({ range: 'custom', startDate: range.current.start, endDate: range.current.end });
    const previousPromise = orgService.getHRDashboardData({ range: 'custom', startDate: range.previous.start, endDate: range.previous.end });
    const opsPromise = hrService.getDashboardData(range.current.start, range.current.end);

    try {
      setHRData(await currentPromise);
    } catch (err) {
      console.error(err);
    } finally {
      setHRLoading(false);
    }

    previousPromise.then(setPreviousHrData).catch(() => {});
    opsPromise.then(setHROpsData).catch(err => console.error(err));
  };

  useEffect(() => {
    // Only admins see the System Overview stats, and only admins have
    // access to all four endpoints at once (getUsers 403s for everyone
    // else) — so skip the fetch entirely for other roles instead of
    // making a call that's guaranteed to fail and go unused.
    if (user?.role === 'admin') {
      setLoading(true);
      Promise.all([
        orgService.getBranches(),
        orgService.getDepartments(),
        orgService.getUsers(),
        orgService.getModules()
      ])
        .then(([b, d, u, m]) => {
          setStats({
            branches: b.length,
            departments: d.length,
            users: u.length,
            modules: m.length
          });
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

  }, [showHRDashboard, user?.role]);

  useEffect(() => {
    if (!period || !showHRDashboard) return;
    fetchHRData(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, showHRDashboard]);

  // Chart renderer useEffect
  useEffect(() => {
    if (!hrData || dashboardTab !== 'hr') return;

    // The page wrapper animates in (opacity/transform) via .mis-animate-in.
    // Creating the charts synchronously on mount can measure the canvas
    // before that layout has settled, silently sizing it to 0 — it then
    // never redraws until something forces a fresh `new Chart()` (e.g.
    // toggling the theme, which is in this effect's deps). Deferring to the
    // next animation frame lets layout settle first, every time.
    const rafId = requestAnimationFrame(() => {

    // Chart.js colors were previously hardcoded for the dark theme (pure
    // white ticks/legend/grid), which made axis numbers and legend text
    // invisible against a light-mode white background. Derive every color
    // from the active theme instead.
    const isDark = theme === 'dark';
    const tickColor = isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(17, 24, 39, 0.65)';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)';
    const legendColor = isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(17, 24, 39, 0.75)';
    const tooltipBg = isDark ? 'rgba(9, 13, 22, 0.95)' : 'rgba(255, 255, 255, 0.98)';
    const tooltipTitleColor = isDark ? '#ffffff' : '#111827';
    const tooltipBorderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.1)';
    const cardBgColor = isDark ? '#1e293b' : '#ffffff';

    // ── 1. GROWTH CHART (LINE) ───────────────────
    if (growthCanvasRef.current) {
      if (growthChartInstance.current) {
        growthChartInstance.current.destroy();
      }
      const ctx = growthCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrData.charts.growth.map((d: any) => d.month);
        const dataValues = hrData.charts.growth.map((d: any) => d.count);

        // Generate a smooth theme-aligned gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        growthChartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Active Employees',
              data: dataValues,
              borderColor: '#06b6d4',
              backgroundColor: gradient,
              tension: 0.3,
              fill: true,
              borderWidth: 3,
              pointBackgroundColor: '#06b6d4',
              pointBorderColor: cardBgColor,
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: tooltipBg,
                titleColor: tooltipTitleColor,
                bodyColor: '#0891b2',
                borderColor: tooltipBorderColor,
                borderWidth: 1,
                padding: 10
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: tickColor, font: { family: 'inherit' } } },
              y: {
                grid: { color: gridColor },
                ticks: { color: tickColor, stepSize: 1, font: { family: 'inherit' } },
                beginAtZero: true
              }
            }
          }
        });
      }
    }

    // ── 2. BRANCH CHART (DOUGHNUT) ───────────
    if (branchCanvasRef.current) {
      if (branchChartInstance.current) {
        branchChartInstance.current.destroy();
      }
      const ctx = branchCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrData.charts.branchDistribution.map((d: any) => d.name);
        const dataValues = hrData.charts.branchDistribution.map((d: any) => d.value);
        branchChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: dataValues,
              backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'],
              borderWidth: 2,
              borderColor: cardBgColor
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: legendColor, font: { size: 11, family: 'inherit' }, padding: 15 }
              },
              tooltip: {
                backgroundColor: tooltipBg,
                titleColor: tooltipTitleColor,
                borderColor: tooltipBorderColor,
                borderWidth: 1,
                padding: 10
              }
            }
          }
        });
      }
    }

    // ── 3. DEPARTMENT CHART (BAR) ───────────────
    if (deptCanvasRef.current) {
      if (deptChartInstance.current) {
        deptChartInstance.current.destroy();
      }
      const ctx = deptCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrData.charts.departmentDistribution.map((d: any) => d.name);
        const dataValues = hrData.charts.departmentDistribution.map((d: any) => d.value);
        deptChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Headcount',
              data: dataValues,
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
              borderColor: '#10b981',
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: tooltipBg,
                titleColor: tooltipTitleColor,
                borderColor: tooltipBorderColor,
                borderWidth: 1,
                padding: 10
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: tickColor, font: { family: 'inherit' } } },
              y: {
                grid: { color: gridColor },
                ticks: { color: tickColor, stepSize: 1, font: { family: 'inherit' } },
                beginAtZero: true
              }
            }
          }
        });
      }
    }

    // ── 4. RESIGNATION REASONS (HORIZONTAL BAR) ───────────
    if (resignReasonCanvasRef.current && hrData.charts?.resignationReasons) {
      if (resignReasonChartInstance.current) resignReasonChartInstance.current.destroy();
      const ctx = resignReasonCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrData.charts.resignationReasons.map((d: any) => d.name);
        const dataValues = hrData.charts.resignationReasons.map((d: any) => d.value);
        resignReasonChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Resignations',
              data: dataValues,
              backgroundColor: 'rgba(239, 68, 68, 0.85)',
              hoverBackgroundColor: 'rgba(239, 68, 68, 1)',
              borderColor: '#ef4444',
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: tooltipBg, titleColor: tooltipTitleColor, borderColor: tooltipBorderColor, borderWidth: 1, padding: 10 }
            },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1, font: { family: 'inherit' } }, beginAtZero: true },
              y: { grid: { display: false }, ticks: { color: tickColor, font: { family: 'inherit', size: 10 } } }
            }
          }
        });
      }
    }

    // ── 5. ROLE DISTRIBUTION (DOUGHNUT) ───────────
    if (roleCanvasRef.current && hrData.charts?.roleDistribution) {
      if (roleChartInstance.current) roleChartInstance.current.destroy();
      const ctx = roleCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrData.charts.roleDistribution.map((d: any) => d.name);
        const dataValues = hrData.charts.roleDistribution.map((d: any) => d.value);
        roleChartInstance.current = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: dataValues,
              backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#f43f5e', '#84cc16', '#eab308'],
              borderWidth: 2,
              borderColor: cardBgColor
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: legendColor, font: { size: 11, family: 'inherit' }, padding: 15 } },
              tooltip: { backgroundColor: tooltipBg, titleColor: tooltipTitleColor, borderColor: tooltipBorderColor, borderWidth: 1, padding: 10 }
            }
          }
        });
      }
    }

    // ── 6. CANDIDATES BY STAGE (HORIZONTAL BAR) ───────────
    if (candidateStageCanvasRef.current && hrOpsData?.charts?.candidatesByStage) {
      if (candidateStageChartInstance.current) candidateStageChartInstance.current.destroy();
      const ctx = candidateStageCanvasRef.current.getContext('2d');
      if (ctx) {
        const labels = hrOpsData.charts.candidatesByStage.map((d: any) => d.name);
        const dataValues = hrOpsData.charts.candidatesByStage.map((d: any) => d.value);
        candidateStageChartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Candidates',
              data: dataValues,
              backgroundColor: 'rgba(6, 182, 212, 0.85)',
              hoverBackgroundColor: 'rgba(6, 182, 212, 1)',
              borderColor: '#06b6d4',
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: tooltipBg, titleColor: tooltipTitleColor, borderColor: tooltipBorderColor, borderWidth: 1, padding: 10 }
            },
            scales: {
              x: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1, font: { family: 'inherit' } }, beginAtZero: true },
              y: { grid: { display: false }, ticks: { color: tickColor, font: { family: 'inherit', size: 10 } } }
            }
          }
        });
      }
    }

    });

    return () => {
      cancelAnimationFrame(rafId);
      if (growthChartInstance.current) growthChartInstance.current.destroy();
      if (branchChartInstance.current) branchChartInstance.current.destroy();
      if (deptChartInstance.current) deptChartInstance.current.destroy();
      if (resignReasonChartInstance.current) resignReasonChartInstance.current.destroy();
      if (roleChartInstance.current) roleChartInstance.current.destroy();
      if (candidateStageChartInstance.current) candidateStageChartInstance.current.destroy();
    };
  }, [hrData, hrOpsData, dashboardTab, theme]);

  if (user?.role === 'employee') {
    const dept = user.department_name?.toUpperCase();
    const target = (dept && EMPLOYEE_DEPT_ENTRY_ROUTE[dept]) || ROUTES.DATA_ENTRY;
    return <Navigate to={target} replace />;
  }

  return (
    <DashboardLayout>
      <div className="mis-page mis-animate-in max-w-7xl">
        <header className="mis-page-header">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-center md:text-left w-full md:w-auto">
              <h1 className="mis-page-title mis-page-title-accent">Welcome back</h1>
              <p className="mis-page-desc">
                {showHRDashboard 
                  ? 'Overview of your HR metrics and MIS environment settings.' 
                  : 'Overview of your MIS environment. Use the sidebar to open assigned modules and tools.'}
              </p>
            </div>
            
          </div>
        </header>

        {loading ? (
          <div className="mis-empty py-20">Loading dashboard metrics...</div>
        ) : dashboardTab === 'hr' ? (
          /* ── HR Dashboard Tab ──────────────────────────────────── */
          <div className="space-y-8">
            {/* Filter Bar — rendered unconditionally (not gated behind
                hrData) so PeriodFilter can mount and report its default
                period; hrData only exists AFTER that period is set and
                fetched, so gating this on hrData would deadlock. */}
            <div className="mis-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-60 mr-2" style={{ color: 'var(--text-secondary)' }}>Filter Period:</span>
              <PeriodFilter onChange={p => setPeriod({ current: p.current, previous: p.previous })} />
            </div>

            {hrLoading || !hrData ? (
              <div className="mis-empty py-20">{hrLoading ? 'Refreshing HR metrics...' : 'Loading HR metrics...'}</div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {isVisible('hr.kpi.total_employees') && (
                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(6, 182, 212, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Total Employees</div>
                      <div className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>{hrData.kpis.totalEmployees}</div>
                      <div className="text-xs opacity-50 mt-1">Currently working (Active)</div>
                      <TrendDelta current={hrData.kpis.totalEmployees} previous={previousHrData?.kpis?.totalEmployees} />
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent)' }}>
                      <IconUsers />
                    </div>
                  </div>
                  )}

                  {isVisible('hr.kpi.new_joiners') && (
                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>New Joiners</div>
                      <div className="text-3xl font-bold" style={{ color: '#10b981' }}>{hrData.kpis.newJoiners}</div>
                      <div className="text-xs opacity-50 mt-1">Joined in selected period</div>
                      <TrendDelta current={hrData.kpis.newJoiners} previous={previousHrData?.kpis?.newJoiners} />
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                      <IconUserPlus />
                    </div>
                  </div>
                  )}

                  {isVisible('hr.kpi.resignations') && (
                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239, 68, 68, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Resignations</div>
                      <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>{hrData.kpis.resignations}</div>
                      <div className="text-xs opacity-50 mt-1">Resigned in selected period</div>
                      <TrendDelta current={hrData.kpis.resignations} previous={previousHrData?.kpis?.resignations} />
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                      <IconUserMinus />
                    </div>
                  </div>
                  )}

                  {isVisible('hr.kpi.attrition_rate') && (
                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(139, 92, 246, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Attrition Rate</div>
                      <div className="text-3xl font-bold" style={{ color: '#8b5cf6' }}>{hrData.kpis.attritionRate}%</div>
                      <div className="text-xs opacity-50 mt-1">Resignations vs headcount at period start</div>
                      <TrendDelta current={hrData.kpis.attritionRate} previous={previousHrData?.kpis?.attritionRate} isPercentagePoint />
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                      <IconPercent />
                    </div>
                  </div>
                  )}

                  {isVisible('hr.kpi.avg_tenure') && (
                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Avg. Tenure</div>
                      <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{hrData.kpis.avgTenureYears} <span className="text-sm font-normal opacity-60">yrs</span></div>
                      <div className="text-xs opacity-50 mt-1">Across all active employees</div>
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                      <IconClockHistory />
                    </div>
                  </div>
                  )}

                  {isVisible('hr.kpi.pending_offboarding') && (
                  <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(244, 63, 94, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                    <div>
                      <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Pending Offboarding</div>
                      <div className="text-3xl font-bold" style={{ color: '#f43f5e' }}>{hrData.kpis.pendingOffboarding}</div>
                      <div className="text-xs opacity-50 mt-1">Resigned, still serving notice period</div>
                    </div>
                    <div className="p-3.5 rounded-full" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
                      <IconUserMinus />
                    </div>
                  </div>
                  )}

                  {hrOpsData && (
                    <>
                      {isVisible('hr.kpi.open_positions') && (
                      <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(20, 184, 166, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                        <div>
                          <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Open Positions</div>
                          <div className="text-3xl font-bold" style={{ color: '#14b8a6' }}>{hrOpsData.kpis.openPositions}</div>
                          <div className="text-xs opacity-50 mt-1">Currently hiring for</div>
                        </div>
                        <div className="p-3.5 rounded-full" style={{ background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6' }}>
                          <IconBriefcase />
                        </div>
                      </div>
                      )}

                      {isVisible('hr.kpi.candidates_in_pipeline') && (
                      <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(6, 182, 212, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                        <div>
                          <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Candidates in Pipeline</div>
                          <div className="text-3xl font-bold" style={{ color: '#06b6d4' }}>{hrOpsData.kpis.candidatesInPipeline}</div>
                          <div className="text-xs opacity-50 mt-1">Not yet Joined or Rejected</div>
                        </div>
                        <div className="p-3.5 rounded-full" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
                          <IconUserSearch />
                        </div>
                      </div>
                      )}

                      {isVisible('hr.kpi.active_policies') && (
                      <div className="mis-card p-6 flex items-center justify-between" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(132, 204, 22, 0.1) 0%, rgba(0,0,0,0) 70%), var(--card-bg)' }}>
                        <div>
                          <div className="text-sm font-semibold opacity-60 mb-1" style={{ color: 'var(--text-secondary)' }}>Active Policies</div>
                          <div className="text-3xl font-bold" style={{ color: '#84cc16' }}>{hrOpsData.kpis.activePolicies}</div>
                          <div className="text-xs opacity-50 mt-1">Currently in effect</div>
                        </div>
                        <div className="p-3.5 rounded-full" style={{ background: 'rgba(132, 204, 22, 0.1)', color: '#84cc16' }}>
                          <IconFileCheck />
                        </div>
                      </div>
                      )}
                    </>
                  )}
                </div>

                {/* Recruitment pipeline */}
                {isVisible('hr.chart.candidates_by_stage') && hrOpsData?.charts?.candidatesByStage?.length > 0 && (
                  <div className="mis-card p-6">
                    <div>
                      <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Candidates by Stage</h3>
                      <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>Where candidates are stuck in the hiring pipeline, and for how long.</p>
                    </div>
                    <div className="h-[280px] w-full relative">
                      <canvas ref={candidateStageCanvasRef} />
                    </div>
                  </div>
                )}

                {/* Growth & Distribution charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {isVisible('hr.chart.employee_growth') && (
                  <div className="mis-card p-6 lg:col-span-2 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Employee Growth</h3>
                      <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>Trend of active employees headcount over the selected period.</p>
                    </div>
                    <div className="h-[300px] w-full relative">
                      <canvas ref={growthCanvasRef} />
                    </div>
                  </div>
                  )}

                  {isVisible('hr.chart.branch_distribution') && (
                  <div className="mis-card p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Branch Distribution</h3>
                      <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>Total headcount divided across all regional branches.</p>
                    </div>
                    <div className="h-[300px] w-full relative">
                      <canvas ref={branchCanvasRef} />
                    </div>
                  </div>
                  )}
                </div>

                {/* Department-wise employees */}
                {isVisible('hr.chart.department_distribution') && (
                <div className="mis-card p-6">
                  <div>
                    <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Department Distribution</h3>
                    <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>Total headcount divided across organizational departments.</p>
                  </div>
                  <div className="h-[300px] w-full relative">
                    <canvas ref={deptCanvasRef} />
                  </div>
                </div>
                )}

                {/* Resignation reasons & Role distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {isVisible('hr.chart.resignation_reasons') && (
                  <div className="mis-card p-6 lg:col-span-2 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Resignation Reasons</h3>
                      <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>What's actually driving attrition in the selected period.</p>
                    </div>
                    <div className="h-[300px] w-full relative">
                      <canvas ref={resignReasonCanvasRef} />
                    </div>
                  </div>
                  )}

                  {isVisible('hr.chart.role_distribution') && (
                  <div className="mis-card p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Role Distribution</h3>
                      <p className="text-xs opacity-75 mb-6" style={{ color: 'var(--text-secondary)' }}>Active headcount broken down by role.</p>
                    </div>
                    <div className="h-[300px] w-full relative">
                      <canvas ref={roleCanvasRef} />
                    </div>
                  </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : user?.role === 'admin' ? (
          /* ── System Overview Tab (admin only — org-wide counts aren't
             meaningful/available to other roles) ──────────────────── */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            <div className="mis-card p-6 sm:p-8">
              <h2 className="mis-section-title">System Overview</h2>
              <p className="mis-section-desc">Real-time metrics for organization hierarchy and users.</p>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="mis-stat-card">
                  <div className="mis-stat-value accent">{stats.branches}</div>
                  <div className="mis-stat-label">Total Branches</div>
                </div>
                <div className="mis-stat-card">
                  <div className="mis-stat-value">{stats.departments}</div>
                  <div className="mis-stat-label">Departments</div>
                </div>
                <div className="mis-stat-card">
                  <div className="mis-stat-value">{stats.users}</div>
                  <div className="mis-stat-label">Active Users</div>
                </div>
                <div className="mis-stat-card">
                  <div className="mis-stat-value">{stats.modules}</div>
                  <div className="mis-stat-label">Data Modules</div>
                </div>
              </div>
            </div>

            <div className="mis-card p-6 sm:p-8">
              <h2 className="mis-section-title">Quick Actions</h2>
              <p className="mis-section-desc">Common tasks available from the navigation menu.</p>

              <div className="flex flex-col gap-2">
                <button type="button" className="mis-btn mis-btn-ghost mis-action-row">
                  <span className="mis-action-icon"><IconEdit /></span>
                  <span>Enter new data</span>
                </button>
                <button type="button" className="mis-btn mis-btn-ghost mis-action-row">
                  <span className="mis-action-icon"><IconCheck /></span>
                  <span>Verify pending entries</span>
                </button>
                <button type="button" className="mis-btn mis-btn-ghost mis-action-row">
                  <span className="mis-action-icon"><IconUser /></span>
                  <span>Update my profile</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
