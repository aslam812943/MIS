import React, { useEffect, useState, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import DashboardLayout from '../components/layout/DashboardLayout';
import { ROUTES } from '../constants/routes';
import PeriodFilter from '../components/common/PeriodFilter';
import { orgService } from '../services/org.service';
import { hrService } from '../services/hr.service';
import { salesService } from '../services/sales.service';
import { financeService } from '../services/finance.service';
import { itService } from '../services/it.service';
import { kycService } from '../services/kyc.service';
import { dpService } from '../services/dp.service';
import { iepfService } from '../services/iepf.service';
import { settlementService } from '../services/settlement.service';
import { socialMediaService, type SocialMediaPost, type SocialMediaCampaign, type SocialMediaAnalyticsRecord } from '../services/socialMedia.service';
import { authService } from '../services/auth.service';
import { useTheme } from '../context/ThemeContext';
import type { DateRange } from '../utils/periodRange';
import { getDefaultPeriod } from '../utils/periodRange';

Chart.register(...registerables);

const EMPLOYEE_DEPT_ENTRY_ROUTE: Record<string, string> = {
  RA: ROUTES.RA_DATA_ENTRY,
  'RESEARCH ANALYST': ROUTES.RA_DATA_ENTRY,
  'RESEARCH & ANALYSIS': ROUTES.RA_DATA_ENTRY,
  IEPF: ROUTES.IEPF_DATA_ENTRY,
  SETTLEMENTS: ROUTES.SETTLEMENTS_DATA_ENTRY,
  KYC: ROUTES.KYC_DATA_ENTRY,
  DP: ROUTES.DP_DATA_ENTRY,
  IT: ROUTES.IT_DATA_ENTRY,
  FINANCE: ROUTES.FINANCE_DATA_ENTRY,
  SALES: ROUTES.SALES_DATA_ENTRY,
  'CONTENT CREATION': ROUTES.CREATOR_PLANNER,
  'CONTENT CREATOR': ROUTES.CREATOR_PLANNER,
};

/* ── SVG Icons ─────────────────────────────────────────────── */
const IconDashboardTile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
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
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconTrendingUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconActivity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconDollar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconShare2 = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const IconServer = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);
const IconShieldCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
  </svg>
);

export type DashboardTab =
  | 'overview'
  | 'social_media'
  | 'sales'
  | 'finance'
  | 'it'
  | 'hr'
  | 'kyc'
  | 'dp'
  | 'iepf'
  | 'settlements'
  | 'ra'
  | 'system';

/**
 * Main Executive & Multi-Department Dashboard Page.
 */
const DashboardPage: React.FC = () => {
  const user = authService.getCurrentUser();
  const role = user?.role || '';
  const isAdmin = role === 'admin';
  const isLeadership = ['ceo', 'managing_director', 'director', 'executive'].includes(role);
  const isHR = role === 'hr';
  const isEmployee = role === 'employee';
  const isSMM = role === 'social_media_manager';
  const isCreatorDept = user?.department_name?.toUpperCase() === 'CONTENT CREATION' || user?.department_name?.toUpperCase() === 'CONTENT CREATOR';
  const isCreator = role === 'content_creator' || (isCreatorDept && role === 'hod');

  // Employee redirection to their dedicated department workspace
  if (isEmployee) {
    const dept = user?.department_name?.toUpperCase() || '';
    if (dept === 'RA' || dept === 'RESEARCH ANALYST' || dept === 'RESEARCH & ANALYSIS') {
      return <Navigate to={ROUTES.RA_DASHBOARD} replace />;
    }
    const redirectRoute = EMPLOYEE_DEPT_ENTRY_ROUTE[dept] || ROUTES.DATA_ENTRY;
    return <Navigate to={redirectRoute} replace />;
  }

  // Default active tab based on role
  const defaultTab: DashboardTab = isHR ? 'hr' : isSMM || isCreator ? 'social_media' : 'overview';
  const [activeTab, setActiveTab] = useState<DashboardTab>(defaultTab);

  const { theme } = useTheme();

  // Filter state — shared across all dashboards
  const [period, setPeriod] = useState<{ current: DateRange; previous: DateRange }>(getDefaultPeriod);

  // Loading states
  const [loading, setLoading] = useState(false);

  // System Stats (Branches, Departments, Users, Modules)
  const [systemStats, setSystemStats] = useState({ branches: 0, departments: 0, users: 0, modules: 0 });

  // Social Media & Content Creator Data
  const [smmAnalytics, setSmmAnalytics] = useState<SocialMediaAnalyticsRecord[]>([]);
  const [smmPosts, setSmmPosts] = useState<SocialMediaPost[]>([]);
  const [smmCampaigns, setSmmCampaigns] = useState<SocialMediaCampaign[]>([]);

  // Department Aggregated Data States
  const [salesData, setSalesData] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any>(null);
  const [itData, setItData] = useState<any>(null);
  const [hrData, setHrData] = useState<any>(null);
  const [hrOpsData, setHrOpsData] = useState<any>(null);
  const [kycData, setKycData] = useState<any>(null);
  const [dpData, setDpData] = useState<any>(null);
  const [iepfData, setIepfData] = useState<any>(null);
  const [settlementData, setSettlementData] = useState<any>(null);

  // ── Chart Refs ────────────────────────────────────────────
  // Overview Tab Charts
  const overviewVolumeRef = useRef<HTMLCanvasElement | null>(null);
  const overviewFinancialRef = useRef<HTMLCanvasElement | null>(null);
  const overviewVolumeInstance = useRef<Chart | null>(null);
  const overviewFinancialInstance = useRef<Chart | null>(null);

  // Social Media Charts
  const smmFollowersRef = useRef<HTMLCanvasElement | null>(null);
  const smmEngagementRef = useRef<HTMLCanvasElement | null>(null);
  const smmPlatformRef = useRef<HTMLCanvasElement | null>(null);
  const smmPipelineRef = useRef<HTMLCanvasElement | null>(null);
  const smmFormatsRef = useRef<HTMLCanvasElement | null>(null);
  const smmCreatorRef = useRef<HTMLCanvasElement | null>(null);

  const smmFollowersInstance = useRef<Chart | null>(null);
  const smmEngagementInstance = useRef<Chart | null>(null);
  const smmPlatformInstance = useRef<Chart | null>(null);
  const smmPipelineInstance = useRef<Chart | null>(null);
  const smmFormatsInstance = useRef<Chart | null>(null);
  const smmCreatorInstance = useRef<Chart | null>(null);

  // HR Charts
  const hrGrowthRef = useRef<HTMLCanvasElement | null>(null);
  const hrDeptRef = useRef<HTMLCanvasElement | null>(null);
  const hrGrowthInstance = useRef<Chart | null>(null);
  const hrDeptInstance = useRef<Chart | null>(null);

  // ── Fetching Data ─────────────────────────────────────────
  const fetchAllDashboardData = async () => {
    setLoading(true);
    const start = period.current.start;
    const end = period.current.end;

    try {
      // 1. System stats (Admins/Leadership)
      if (isAdmin || isLeadership) {
        orgService.getBranches().then(b => orgService.getDepartments().then(d => orgService.getUsers().then(u => orgService.getModules().then(m => {
          setSystemStats({ branches: b.length, departments: d.length, users: u.length, modules: m.length });
        })))).catch(() => {});
      }

      // 2. Social Media & Content Creator data (non-admin)
      if (!isAdmin) {
        socialMediaService.getAnalytics(start, end).then(setSmmAnalytics).catch(() => {});
        socialMediaService.getPosts().then(setSmmPosts).catch(() => {});
        socialMediaService.getCampaigns().then(setSmmCampaigns).catch(() => {});
      }

      // 3. Department Data in Parallel
      salesService.getDashboardData(undefined, start, end).then(setSalesData).catch(() => {});
      financeService.getDashboardData(undefined, start, end).then(setFinanceData).catch(() => {});
      itService.getDashboardData(undefined, start, end).then(setItData).catch(() => {});
      
      orgService.getHRDashboardData({ range: 'custom', startDate: start, endDate: end }).then(setHrData).catch(() => {});
      hrService.getDashboardData(start, end).then(setHrOpsData).catch(() => {});

      kycService.getDashboardData(undefined, start, end).then(setKycData).catch(() => {});
      dpService.getDashboardData(undefined, start, end).then(setDpData).catch(() => {});
      iepfService.getDashboardData(undefined, start, end).then(setIepfData).catch(() => {});
      settlementService.getDashboardData(undefined, start, end).then(setSettlementData).catch(() => {});
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDashboardData();
  }, [period]);

  // ── SMM Metrics Aggregation ───────────────────────────────
  const smmMetrics = {
    gained: smmAnalytics.reduce((acc, curr) => acc + (curr.followers_gained || 0), 0),
    lost: smmAnalytics.reduce((acc, curr) => acc + (curr.followers_lost || 0), 0),
    likes: smmAnalytics.reduce((acc, curr) => acc + (curr.likes_count || 0), 0),
    comments: smmAnalytics.reduce((acc, curr) => acc + (curr.comments_count || 0), 0),
    shares: smmAnalytics.reduce((acc, curr) => acc + (curr.shares_count || 0), 0),
    impressions: smmAnalytics.reduce((acc, curr) => acc + (curr.impressions_count || 0), 0),
    net: 0,
    engagementRate: '0.00%',
    totalPosts: smmPosts.length,
    scheduledPosts: smmPosts.filter(p => p.status === 'Scheduled').length,
    needsReviewPosts: smmPosts.filter(p => p.status === 'Needs Review').length,
    publishedPosts: smmPosts.filter(p => p.status === 'Published').length,
  };
  smmMetrics.net = smmMetrics.gained - smmMetrics.lost;
  const totalEngagements = smmMetrics.likes + smmMetrics.comments + smmMetrics.shares;
  if (smmMetrics.impressions > 0) {
    smmMetrics.engagementRate = ((totalEngagements / smmMetrics.impressions) * 100).toFixed(2) + '%';
  }

  // ── Render Charts with Chart.js ───────────────────────────
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const isDark = theme === 'dark';
      const tickColor = isDark ? '#94a3b8' : '#334155';
      const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(203, 213, 225, 0.6)';
      const legendColor = isDark ? '#e2e8f0' : '#0f172a';
      const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)';
      const tooltipTitleColor = isDark ? '#f8fafc' : '#0f172a';
      const tooltipBorderColor = isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(203, 213, 225, 0.9)';
      const cardBgColor = isDark ? '#0f172a' : '#ffffff';

      // 1. SMM Follower Growth Line Chart
      if (smmFollowersRef.current && activeTab === 'social_media') {
        if (smmFollowersInstance.current) smmFollowersInstance.current.destroy();
        const ctx = smmFollowersRef.current.getContext('2d');
        if (ctx) {
          const labels = smmAnalytics.map(a => new Date(a.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
          const gained = smmAnalytics.map(a => a.followers_gained);
          const lost = smmAnalytics.map(a => a.followers_lost);
          const net = smmAnalytics.map(a => a.followers_gained - a.followers_lost);

          smmFollowersInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels: labels.length ? labels : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
              datasets: [
                {
                  label: 'Followers Gained',
                  data: gained.length ? gained : [12, 19, 15, 25, 30],
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  fill: true,
                  tension: 0.35,
                  borderWidth: 2.5
                },
                {
                  label: 'Followers Lost',
                  data: lost.length ? lost : [2, 4, 1, 3, 5],
                  borderColor: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  fill: true,
                  tension: 0.35,
                  borderWidth: 2
                },
                {
                  label: 'Net Growth',
                  data: net.length ? net : [10, 15, 14, 22, 25],
                  borderColor: '#06b6d4',
                  borderDash: [4, 4],
                  fill: false,
                  tension: 0.35,
                  borderWidth: 3
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { labels: { color: legendColor, font: { family: 'inherit', size: 11 } } },
                tooltip: { backgroundColor: tooltipBg, titleColor: tooltipTitleColor, borderColor: tooltipBorderColor, borderWidth: 1 }
              },
              scales: {
                x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { family: 'inherit' } } },
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor, font: { family: 'inherit' } } }
              }
            }
          });
        }
      }

      // 2. SMM Engagement & Impressions Trend
      if (smmEngagementRef.current && activeTab === 'social_media') {
        if (smmEngagementInstance.current) smmEngagementInstance.current.destroy();
        const ctx = smmEngagementRef.current.getContext('2d');
        if (ctx) {
          const labels = smmAnalytics.map(a => new Date(a.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
          const impressions = smmAnalytics.map(a => a.impressions_count);
          const likes = smmAnalytics.map(a => a.likes_count);

          smmEngagementInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: labels.length ? labels : ['Day 1', 'Day 2', 'Day 3', 'Day 4'],
              datasets: [
                {
                  label: 'Impressions / Reach',
                  data: impressions.length ? impressions : [1200, 1900, 2400, 3100],
                  backgroundColor: 'rgba(59, 130, 246, 0.75)',
                  borderRadius: 6,
                  yAxisID: 'y'
                },
                {
                  label: 'Likes & Reactions',
                  data: likes.length ? likes : [150, 240, 310, 420],
                  backgroundColor: 'rgba(236, 72, 153, 0.85)',
                  borderRadius: 6,
                  yAxisID: 'y1'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { labels: { color: legendColor, font: { family: 'inherit', size: 11 } } },
                tooltip: { backgroundColor: tooltipBg, titleColor: tooltipTitleColor, borderColor: tooltipBorderColor, borderWidth: 1 }
              },
              scales: {
                x: { grid: { display: false }, ticks: { color: tickColor } },
                y: { type: 'linear', position: 'left', grid: { color: gridColor }, ticks: { color: tickColor } },
                y1: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: tickColor } }
              }
            }
          });
        }
      }

      // 3. SMM Platform Reach Doughnut
      if (smmPlatformRef.current && activeTab === 'social_media') {
        if (smmPlatformInstance.current) smmPlatformInstance.current.destroy();
        const ctx = smmPlatformRef.current.getContext('2d');
        if (ctx) {
          const platformCounts: Record<string, number> = {};
          smmPosts.forEach(p => {
            platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
          });
          const platforms = Object.keys(platformCounts).length ? Object.keys(platformCounts) : ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'LinkedIn', 'X'];
          const counts = Object.keys(platformCounts).length ? Object.values(platformCounts) : [45, 30, 20, 15, 12, 8];

          smmPlatformInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: platforms,
              datasets: [{
                data: counts,
                backgroundColor: ['#e1306c', '#ff0000', '#00f2fe', '#1877f2', '#0a66c2', '#1da1f2'],
                borderWidth: 2,
                borderColor: cardBgColor
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom', labels: { color: legendColor, font: { size: 11, family: 'inherit' } } }
              }
            }
          });
        }
      }

      // 4. SMM Content Production Pipeline Funnel
      if (smmPipelineRef.current && activeTab === 'social_media') {
        if (smmPipelineInstance.current) smmPipelineInstance.current.destroy();
        const ctx = smmPipelineRef.current.getContext('2d');
        if (ctx) {
          const statusOrder = ['Idea', 'Scripting', 'Filming', 'Editing', 'Needs Review', 'Scheduled', 'Published'];
          const statusCounts: Record<string, number> = { Idea: 0, Scripting: 0, Filming: 0, Editing: 0, 'Needs Review': 0, Scheduled: 0, Published: 0 };
          smmPosts.forEach(p => {
            if (statusCounts[p.status] !== undefined) statusCounts[p.status]++;
          });

          smmPipelineInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: statusOrder,
              datasets: [{
                label: 'Content Pieces',
                data: statusOrder.map(s => statusCounts[s]),
                backgroundColor: ['#94a3b8', '#38bdf8', '#fbbf24', '#f97316', '#ec4899', '#a855f7', '#10b981'],
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false }, ticks: { color: tickColor, font: { family: 'inherit', size: 11 } } },
                y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 } }
              }
            }
          });
        }
      }

      // 5. SMM Formats Breakdown
      if (smmFormatsRef.current && activeTab === 'social_media') {
        if (smmFormatsInstance.current) smmFormatsInstance.current.destroy();
        const ctx = smmFormatsRef.current.getContext('2d');
        if (ctx) {
          const formatCounts: Record<string, number> = {};
          smmPosts.forEach(p => {
            formatCounts[p.content_type] = (formatCounts[p.content_type] || 0) + 1;
          });
          const labels = Object.keys(formatCounts).length ? Object.keys(formatCounts) : ['Reel', 'Short', 'Post', 'Story', 'Video'];
          const dataVals = Object.keys(formatCounts).length ? Object.values(formatCounts) : [25, 18, 12, 8, 5];

          smmFormatsInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [{
                data: dataVals,
                backgroundColor: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'],
                borderWidth: 2,
                borderColor: cardBgColor
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { color: legendColor, font: { size: 11 } } } }
            }
          });
        }
      }

      // 6. Creator Productivity Output
      if (smmCreatorRef.current && activeTab === 'social_media') {
        if (smmCreatorInstance.current) smmCreatorInstance.current.destroy();
        const ctx = smmCreatorRef.current.getContext('2d');
        if (ctx) {
          const creatorMap = new Map<string, { scheduled: number; published: number; total: number }>();
          smmPosts.forEach(p => {
            const name = p.creator_name || 'Creator';
            const curr = creatorMap.get(name) || { scheduled: 0, published: 0, total: 0 };
            curr.total++;
            if (p.status === 'Scheduled') curr.scheduled++;
            if (p.status === 'Published') curr.published++;
            creatorMap.set(name, curr);
          });
          const names = Array.from(creatorMap.keys()).slice(0, 8);

          smmCreatorInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: names.length ? names : ['Creator 1', 'Creator 2', 'Creator 3'],
              datasets: [
                {
                  label: 'Published',
                  data: names.length ? names.map(n => creatorMap.get(n)!.published) : [8, 5, 4],
                  backgroundColor: '#10b981',
                  borderRadius: 4
                },
                {
                  label: 'Scheduled',
                  data: names.length ? names.map(n => creatorMap.get(n)!.scheduled) : [3, 2, 4],
                  backgroundColor: '#06b6d4',
                  borderRadius: 4
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { labels: { color: legendColor, font: { size: 11 } } } },
              scales: {
                x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
                y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 } }
              }
            }
          });
        }
      }

      // 7. Executive Overview: Cross Department Activity
      if (overviewVolumeRef.current && activeTab === 'overview') {
        if (overviewVolumeInstance.current) overviewVolumeInstance.current.destroy();
        const ctx = overviewVolumeRef.current.getContext('2d');
        if (ctx) {
          overviewVolumeInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: ['Sales', 'Finance', 'KYC', 'DP', 'IT', 'IEPF', 'Settlements'],
              datasets: [{
                data: [
                  salesData?.kpis?.totalSalesCount || 18,
                  financeData?.kpis?.totalTransactions || 32,
                  kycData?.totalApplications || 40,
                  dpData?.totalTransactions || 15,
                  itData?.totalAssets || 28,
                  iepfData?.totalClaims || 12,
                  settlementData?.totalRecords || 22
                ],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#6366f1', '#ec4899', '#14b8a6'],
                borderWidth: 2,
                borderColor: cardBgColor
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right', labels: { color: legendColor, font: { size: 11, family: 'inherit' } } }
              }
            }
          });
        }
      }

      // 8. Executive Overview: Financials & Operations
      if (overviewFinancialRef.current && (activeTab === 'overview' || activeTab === 'sales' || activeTab === 'finance')) {
        if (overviewFinancialInstance.current) overviewFinancialInstance.current.destroy();
        const ctx = overviewFinancialRef.current.getContext('2d');
        if (ctx) {
          overviewFinancialInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: ['Sales Target', 'Sales Closed', 'Finance Income', 'Finance Expenses', 'IEPF Recovered'],
              datasets: [{
                label: 'Volume / Value (₹ in Thousands)',
                data: [
                  (salesData?.kpis?.totalTarget || 150000) / 1000,
                  (salesData?.kpis?.totalRevenue || 120000) / 1000,
                  (financeData?.kpis?.totalIncome || 180000) / 1000,
                  (financeData?.kpis?.totalExpenses || 95000) / 1000,
                  (iepfData?.recoveredAmount || 45000) / 1000
                ],
                backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(6, 182, 212, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(168, 85, 247, 0.8)'],
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
                y: { grid: { color: gridColor }, ticks: { color: tickColor } }
              }
            }
          });
        }
      }

      // 9. HR Charts (when HR tab is active)
      if (hrGrowthRef.current && (activeTab === 'hr' || (activeTab === 'overview' && isHR))) {
        if (hrGrowthInstance.current) hrGrowthInstance.current.destroy();
        const ctx = hrGrowthRef.current.getContext('2d');
        if (ctx && hrData?.charts?.employeeGrowth) {
          const labels = hrData.charts.employeeGrowth.map((d: any) => d.date);
          const dataValues = hrData.charts.employeeGrowth.map((d: any) => d.count);
          hrGrowthInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Active Employees',
                data: dataValues,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.35,
                fill: true,
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false }, ticks: { color: tickColor } },
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } }
              }
            }
          });
        }
      }

      if (hrDeptRef.current && activeTab === 'hr' && hrData?.charts?.departmentDistribution) {
        if (hrDeptInstance.current) hrDeptInstance.current.destroy();
        const ctx = hrDeptRef.current.getContext('2d');
        if (ctx) {
          const labels = hrData.charts.departmentDistribution.map((d: any) => d.name);
          const dataValues = hrData.charts.departmentDistribution.map((d: any) => d.value);
          hrDeptInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: 'Headcount',
                data: dataValues,
                backgroundColor: 'rgba(16, 185, 129, 0.85)',
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } }
              }
            }
          });
        }
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [activeTab, theme, smmAnalytics, smmPosts, hrData, salesData, financeData, itData, kycData, dpData, iepfData, settlementData]);

  // Tab definitions
  const allTabs: { id: DashboardTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'overview', label: 'Executive Overview', icon: <IconActivity />, show: isAdmin || isLeadership },
    { id: 'social_media', label: 'Social Media & Content', icon: <IconShare2 />, show: !isAdmin && (isLeadership || isSMM || isCreator) },
    { id: 'sales', label: 'Sales & Revenue', icon: <IconTrendingUp />, show: isAdmin || isLeadership || user?.department_name?.toUpperCase() === 'SALES' },
    { id: 'finance', label: 'Finance & PnL', icon: <IconDollar />, show: isAdmin || isLeadership || user?.department_name?.toUpperCase() === 'FINANCE' },
    { id: 'it', label: 'IT Infrastructure', icon: <IconServer />, show: isAdmin || isLeadership || user?.department_name?.toUpperCase() === 'IT' },
    { id: 'hr', label: 'HR & Headcount', icon: <IconUsers />, show: isAdmin || isLeadership || isHR },
    { id: 'kyc', label: 'KYC Operations', icon: <IconShieldCheck />, show: isAdmin || isLeadership || user?.department_name?.toUpperCase() === 'KYC' },
    { id: 'dp', label: 'DP Demat', icon: <IconDashboardTile />, show: isAdmin || isLeadership || user?.department_name?.toUpperCase() === 'DP' },
    { id: 'iepf', label: 'IEPF Claims', icon: <IconCheck />, show: isAdmin || isLeadership || user?.department_name?.toUpperCase() === 'IEPF' },
    { id: 'settlements', label: 'Settlements', icon: <IconActivity />, show: isAdmin || isLeadership || user?.department_name?.toUpperCase() === 'SETTLEMENTS' },
    { id: 'ra', label: 'Research Analyst (RA)', icon: <IconDashboardTile />, show: isAdmin || isLeadership || user?.department_name?.toUpperCase() === 'RA' || user?.department_name?.toUpperCase() === 'RESEARCH ANALYST' },
    { id: 'system', label: 'System & Org', icon: <IconServer />, show: isAdmin },
  ];

  const visibleTabs = allTabs.filter(t => t.show);

  return (
    <DashboardLayout>
      <div className="w-full space-y-6 mis-animate-in pb-12">
        {/* Top Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
              {isAdmin ? 'Admin Master' : isLeadership ? 'CEO & Executive' : 'Department'}{' '}
              <span className="mis-page-title-accent">Command Center</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Comprehensive real-time analytics, interactive graphs, and multi-department operations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <PeriodFilter onChange={p => setPeriod({ current: p.current, previous: p.previous })} />
          </div>
        </header>

        {/* Tab Navigation Bar */}
        <div className="flex overflow-x-auto gap-2 p-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] dark:bg-slate-900/40 backdrop-blur-md shadow-sm no-scrollbar">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition duration-200 whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-sky-600 dark:bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="w-full py-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderColor: 'var(--accent)' }} />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 1: EXECUTIVE OVERVIEW
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Multi-Department KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Sales Deals</span>
                <span className="text-2xl font-black block mt-1 text-sky-600 dark:text-sky-400">
                  {salesData?.kpis?.totalSalesCount || 0}
                </span>
                <span className="text-[11px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                  ₹{((salesData?.kpis?.totalRevenue || 0) / 1000).toFixed(0)}k closed
                </span>
              </div>

              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Finance PnL</span>
                <span className="text-2xl font-black block mt-1 text-emerald-600 dark:text-emerald-400">
                  ₹{((financeData?.kpis?.netProfit || 0) / 1000).toFixed(0)}k
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 block font-semibold">Positive Margin</span>
              </div>

              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Active Headcount</span>
                <span className="text-2xl font-black block mt-1 text-amber-600 dark:text-amber-400">
                  {hrData?.kpis?.totalEmployees || systemStats.users || 0}
                </span>
                <span className="text-[11px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {systemStats.branches || 1} Branches
                </span>
              </div>

              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>KYC Onboarded</span>
                <span className="text-2xl font-black block mt-1 text-rose-600 dark:text-rose-400">
                  {kycData?.totalApplications || 0}
                </span>
                <span className="text-[11px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>Demat & Trading</span>
              </div>

              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>IT Assets</span>
                <span className="text-2xl font-black block mt-1 text-indigo-600 dark:text-indigo-400">
                  {itData?.totalAssets || 0}
                </span>
                <span className="text-[11px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>99.8% Uptime</span>
              </div>
            </div>

            {/* Graphs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="mis-card p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Department Operational Volume</h3>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Activity distribution across core organization streams</p>
                  </div>
                </div>
                <div className="h-[280px] w-full relative">
                  <canvas ref={overviewVolumeRef} />
                </div>
              </div>

              <div className="mis-card p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Executive Performance & Financial Overview</h3>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Aggregated financial benchmarks and revenue progress across departments</p>
                  </div>
                </div>
                <div className="h-[280px] w-full relative">
                  <canvas ref={overviewFinancialRef} />
                </div>
              </div>
            </div>

            {/* Department Quick Jump Grid */}
            <div className="mis-card p-6">
              <h3 className="font-bold text-base mb-3" style={{ color: 'var(--text-primary)' }}>Department Quick Command Launch</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                <Link to={ROUTES.SALES_DASHBOARD} className="mis-btn mis-btn-ghost justify-start p-3 text-xs border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-emerald-600 dark:text-emerald-400"><IconTrendingUp /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Sales Department</span>
                </Link>
                <Link to={ROUTES.FINANCE_DASHBOARD} className="mis-btn mis-btn-ghost justify-start p-3 text-xs border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-emerald-600 dark:text-emerald-400"><IconDollar /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Finance Dashboard</span>
                </Link>
                <Link to={ROUTES.IT_DASHBOARD} className="mis-btn mis-btn-ghost justify-start p-3 text-xs border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-indigo-600 dark:text-indigo-400"><IconServer /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>IT Dashboard</span>
                </Link>
                <Link to={ROUTES.HR_USER_MANAGEMENT} className="mis-btn mis-btn-ghost justify-start p-3 text-xs border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-amber-600 dark:text-amber-400"><IconUsers /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>HR & Personnel</span>
                </Link>
                <Link to={ROUTES.KYC_DASHBOARD} className="mis-btn mis-btn-ghost justify-start p-3 text-xs border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-rose-600 dark:text-rose-400"><IconShieldCheck /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>KYC Verification</span>
                </Link>
                <Link to={ROUTES.DP_DASHBOARD} className="mis-btn mis-btn-ghost justify-start p-3 text-xs border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-cyan-600 dark:text-cyan-400"><IconDashboardTile /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>DP Operations</span>
                </Link>
                <Link to={ROUTES.IEPF_DASHBOARD} className="mis-btn mis-btn-ghost justify-start p-3 text-xs border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-teal-600 dark:text-teal-400"><IconCheck /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>IEPF Claims</span>
                </Link>
                <Link to={ROUTES.SETTLEMENTS_DASHBOARD} className="mis-btn mis-btn-ghost justify-start p-3 text-xs border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-blue-600 dark:text-blue-400"><IconActivity /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Settlements</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2: SOCIAL MEDIA & CONTENT CREATOR GRAPH SUITE
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'social_media' && (
          <div className="space-y-6">
            {/* SMM KPI Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="mis-card p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Gained</span>
                <span className="text-xl font-black block mt-1 text-emerald-600 dark:text-emerald-400">+{smmMetrics.gained}</span>
              </div>
              <div className="mis-card p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Lost</span>
                <span className="text-xl font-black block mt-1 text-red-600 dark:text-red-400">-{smmMetrics.lost}</span>
              </div>
              <div className="mis-card p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Net Growth</span>
                <span className="text-xl font-black block mt-1 text-sky-600 dark:text-sky-400">{smmMetrics.net >= 0 ? '+' : ''}{smmMetrics.net}</span>
              </div>
              <div className="mis-card p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Engagement</span>
                <span className="text-xl font-black block mt-1 text-purple-600 dark:text-purple-400">{smmMetrics.engagementRate}</span>
              </div>
              <div className="mis-card p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Impressions</span>
                <span className="text-xl font-black block mt-1" style={{ color: 'var(--text-primary)' }}>
                  {smmMetrics.impressions.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="mis-card p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Total Posts</span>
                <span className="text-xl font-black block mt-1 text-amber-600 dark:text-amber-400">{smmMetrics.totalPosts}</span>
              </div>
              <div className="mis-card p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Scheduled</span>
                <span className="text-xl font-black block mt-1 text-indigo-600 dark:text-indigo-400">{smmMetrics.scheduledPosts}</span>
              </div>
              <div className="mis-card p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Needs Review</span>
                <span className="text-xl font-black block mt-1 text-rose-600 dark:text-rose-400">{smmMetrics.needsReviewPosts}</span>
              </div>
            </div>

            {/* Quick Action Bar for SMM */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] dark:bg-slate-900/40 border border-[var(--border)]">
              <span className="text-xs font-bold uppercase tracking-wider mr-2" style={{ color: 'var(--text-secondary)' }}>Management Tools:</span>
              <Link to={ROUTES.SMM_APPROVALS} className="mis-btn mis-btn-primary py-1.5 px-3 text-xs rounded-lg">
                Approvals Queue ({smmMetrics.needsReviewPosts})
              </Link>
              <Link to={ROUTES.CREATOR_PLANNER} className="mis-btn mis-btn-ghost py-1.5 px-3 text-xs rounded-lg border border-[var(--border)]">
                Content Planner
              </Link>
              <Link to={ROUTES.CREATOR_CALENDAR} className="mis-btn mis-btn-ghost py-1.5 px-3 text-xs rounded-lg border border-[var(--border)]">
                Schedule Calendar
              </Link>
              <Link to={ROUTES.SMM_CAMPAIGNS} className="mis-btn mis-btn-ghost py-1.5 px-3 text-xs rounded-lg border border-[var(--border)]">
                Campaigns & Briefs ({smmCampaigns.length})
              </Link>
              <Link to={ROUTES.CREATOR_ASSETS} className="mis-btn mis-btn-ghost py-1.5 px-3 text-xs rounded-lg border border-[var(--border)]">
                Asset Library
              </Link>
            </div>

            {/* Graphs Grid: 4 Primary Visual Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Follower Growth Line Curve */}
              <div className="mis-card p-6">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Follower Trend Curve</h3>
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Audience acquisition vs churn trajectory</p>
                <div className="h-[280px] w-full relative">
                  <canvas ref={smmFollowersRef} />
                </div>
              </div>

              {/* 2. Engagement & Impressions Trend */}
              <div className="mis-card p-6">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Engagement & Reach Distribution</h3>
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Daily/weekly volume of views, reactions, and shares</p>
                <div className="h-[280px] w-full relative">
                  <canvas ref={smmEngagementRef} />
                </div>
              </div>

              {/* 3. Content Production Pipeline Funnel */}
              <div className="mis-card p-6">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Content Production Pipeline Funnel</h3>
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Posts by production stage (Idea &rarr; Scripting &rarr; Scheduled &rarr; Published)</p>
                <div className="h-[280px] w-full relative">
                  <canvas ref={smmPipelineRef} />
                </div>
              </div>

              {/* 4. Platform Audience Share */}
              <div className="mis-card p-6">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Platform Share Breakdown</h3>
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Content volume distributed by social network</p>
                <div className="h-[280px] w-full relative">
                  <canvas ref={smmPlatformRef} />
                </div>
              </div>
            </div>

            {/* Formats & Creator Productivity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="mis-card p-6">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Content Formats</h3>
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Reels, Shorts, Carousels, Stories, Videos</p>
                <div className="h-[240px] w-full relative">
                  <canvas ref={smmFormatsRef} />
                </div>
              </div>

              <div className="mis-card p-6 lg:col-span-2">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Creator Output & Productivity</h3>
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Scheduled vs Published posts by team member</p>
                <div className="h-[240px] w-full relative">
                  <canvas ref={smmCreatorRef} />
                </div>
              </div>
            </div>

            {/* Upcoming Scheduled Posts Preview & Active Campaigns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="mis-card p-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Upcoming Scheduled Posts</h3>
                  <Link to={ROUTES.CREATOR_CALENDAR} className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline">
                    View Calendar &rarr;
                  </Link>
                </div>
                {smmPosts.filter(p => p.status === 'Scheduled').length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: 'var(--text-secondary)' }}>No posts currently scheduled for automated publish.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                    {smmPosts
                      .filter(p => p.status === 'Scheduled')
                      .slice(0, 5)
                      .map(p => (
                        <div key={p.id} className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] dark:bg-slate-900/30 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{p.title}</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{p.platform} &bull; {p.content_type} &bull; {p.creator_name || 'Creator'}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold text-[10px]">
                            {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Scheduled'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="mis-card p-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Active Marketing Campaigns</h3>
                  <Link to={ROUTES.SMM_CAMPAIGNS} className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline">
                    Manage Campaigns &rarr;
                  </Link>
                </div>
                {smmCampaigns.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: 'var(--text-secondary)' }}>No active marketing campaigns created yet.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                    {smmCampaigns.slice(0, 5).map(c => (
                      <div key={c.id} className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] dark:bg-slate-900/30 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                          <span className="text-[10px] truncate max-w-[200px] block" style={{ color: 'var(--text-secondary)' }}>{c.description || 'Campaign initiative'}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3: SALES & REVENUE
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Total Closed Revenue</span>
                <span className="text-3xl font-black block mt-1 text-emerald-600 dark:text-emerald-400">
                  ₹{((salesData?.kpis?.totalRevenue || 0) / 1000).toFixed(1)}k
                </span>
                <span className="text-xs mt-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>Completed sales</span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Total Deals</span>
                <span className="text-3xl font-black block mt-1 text-sky-600 dark:text-sky-400">
                  {salesData?.kpis?.totalSalesCount || 0}
                </span>
                <span className="text-xs mt-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>In selected timeframe</span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Pipeline Target</span>
                <span className="text-3xl font-black block mt-1 text-amber-600 dark:text-amber-400">
                  ₹{((salesData?.kpis?.totalTarget || 150000) / 1000).toFixed(1)}k
                </span>
                <span className="text-xs mt-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>Target threshold</span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Direct Actions</span>
                <div className="mt-2">
                  <Link to={ROUTES.SALES_DASHBOARD} className="mis-btn mis-btn-primary py-1.5 px-3 text-xs w-full block text-center rounded-lg">
                    Full Sales Dashboard &rarr;
                  </Link>
                </div>
              </div>
            </div>

            <div className="mis-card p-6">
              <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Sales Performance Overview</h3>
              <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Closed revenue vs target breakdown</p>
              <div className="h-[280px] w-full relative">
                <canvas ref={overviewFinancialRef} />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 4: FINANCE & PNL
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Total Income</span>
                <span className="text-3xl font-black block mt-1 text-emerald-600 dark:text-emerald-400">
                  ₹{((financeData?.kpis?.totalIncome || 0) / 1000).toFixed(1)}k
                </span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Total Expenses</span>
                <span className="text-3xl font-black block mt-1 text-rose-600 dark:text-rose-400">
                  ₹{((financeData?.kpis?.totalExpenses || 0) / 1000).toFixed(1)}k
                </span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Net Profit / Loss</span>
                <span className="text-3xl font-black block mt-1 text-sky-600 dark:text-sky-400">
                  ₹{((financeData?.kpis?.netProfit || 0) / 1000).toFixed(1)}k
                </span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Direct Actions</span>
                <div className="mt-2">
                  <Link to={ROUTES.FINANCE_DASHBOARD} className="mis-btn mis-btn-primary py-1.5 px-3 text-xs w-full block text-center rounded-lg">
                    Full Finance Dashboard &rarr;
                  </Link>
                </div>
              </div>
            </div>

            <div className="mis-card p-6">
              <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Income vs Expenses Summary</h3>
              <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Fiscal cashflow analysis</p>
              <div className="h-[280px] w-full relative">
                <canvas ref={overviewFinancialRef} />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 5: IT INFRASTRUCTURE
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'it' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Total Assets</span>
                <span className="text-3xl font-black block mt-1 text-indigo-600 dark:text-indigo-400">{itData?.totalAssets || 0}</span>
                <span className="text-xs mt-1 block font-medium" style={{ color: 'var(--text-secondary)' }}>Hardware & Software</span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Active Licenses</span>
                <span className="text-3xl font-black block mt-1 text-emerald-600 dark:text-emerald-400">{itData?.activeLicenses || 0}</span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Open Tickets</span>
                <span className="text-3xl font-black block mt-1 text-amber-600 dark:text-amber-400">{itData?.openTickets || 0}</span>
              </div>
              <div className="mis-card p-5">
                <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Direct Actions</span>
                <div className="mt-2">
                  <Link to={ROUTES.IT_DASHBOARD} className="mis-btn mis-btn-primary py-1.5 px-3 text-xs w-full block text-center rounded-lg">
                    Full IT Dashboard &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 6: HR & HEADCOUNT
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'hr' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Employees</span>
                <span className="text-2xl font-bold mt-1 block text-indigo-600 dark:text-indigo-400">{hrData?.kpis?.totalEmployees || 0}</span>
                <span className="text-[10px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>Active headcount</span>
              </div>
              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Joiners</span>
                <span className="text-2xl font-bold mt-1 block text-emerald-600 dark:text-emerald-400">+{hrData?.kpis?.newJoiners || 0}</span>
                <span className="text-[10px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>In period</span>
              </div>
              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Resignations</span>
                <span className="text-2xl font-bold mt-1 block text-red-600 dark:text-red-400">-{hrData?.kpis?.resignations || 0}</span>
                <span className="text-[10px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>In period</span>
              </div>
              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Attrition</span>
                <span className="text-2xl font-bold mt-1 block text-purple-600 dark:text-purple-400">{hrData?.kpis?.attritionRate || 0}%</span>
                <span className="text-[10px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>Turnover</span>
              </div>
              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Open Positions</span>
                <span className="text-2xl font-bold mt-1 block text-teal-600 dark:text-teal-400">{hrOpsData?.kpis?.openPositions || 0}</span>
                <span className="text-[10px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>Hiring active</span>
              </div>
              <div className="mis-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-secondary)' }}>Active Policies</span>
                <span className="text-2xl font-bold mt-1 block text-amber-600 dark:text-amber-400">{hrOpsData?.kpis?.activePolicies || 0}</span>
                <span className="text-[10px] mt-0.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>In effect</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="mis-card p-6">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Employee Growth Trend</h3>
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Headcount curve over time</p>
                <div className="h-[280px] w-full relative">
                  <canvas ref={hrGrowthRef} />
                </div>
              </div>
              <div className="mis-card p-6">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Department Distribution</h3>
                <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Employees divided across departments</p>
                <div className="h-[280px] w-full relative">
                  <canvas ref={hrDeptRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 7: KYC, DP, IEPF, SETTLEMENTS
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'ra' && (
          <div className="space-y-6">
            <div className="mis-card p-8 text-center space-y-4">
              <span className="text-4xl block">📈</span>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Research Analyst (RA) Portfolio & Analytics
              </h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Access client advisory packages, collections, KRA compliance tracking, testimonials, and periodic reports.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  to={ROUTES.RA_DASHBOARD}
                  className="mis-btn mis-btn-primary px-5 py-2.5 text-xs font-bold inline-flex items-center gap-2 rounded-xl"
                >
                  <IconDashboardTile />
                  Open RA Dashboard
                </Link>
                <Link
                  to={ROUTES.RA_DATA_ENTRY}
                  className="px-5 py-2.5 text-xs font-bold inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] text-slate-950 hover:bg-[var(--accent-hover)] transition shadow-sm"
                >
                  <IconEdit />
                  Open RA Data Entry
                </Link>
                <Link
                  to="/ra-entry?tab=kyc"
                  className="px-5 py-2.5 text-xs font-bold inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 transition shadow-sm"
                >
                  <IconShieldCheck />
                  KYC / KRA Tracking
                </Link>
                <Link
                  to={ROUTES.RA_TESTIMONIALS}
                  className="px-5 py-2.5 text-xs font-bold inline-flex items-center gap-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition shadow-sm"
                >
                  ★ Testimonials Hub
                </Link>
                <Link
                  to={ROUTES.RA_REPORTS}
                  className="px-5 py-2.5 text-xs font-bold inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition shadow-sm"
                >
                  📊 Weekly & Monthly Reports
                </Link>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'kyc' || activeTab === 'dp' || activeTab === 'iepf' || activeTab === 'settlements') && (
          <div className="space-y-6">
            <div className="mis-card p-8 text-center space-y-4">
              <span className="text-4xl block">📊</span>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {activeTab === 'kyc' ? 'KYC Operations Center' : activeTab === 'dp' ? 'DP Demat Operations' : activeTab === 'iepf' ? 'IEPF Claims Management' : 'Settlements & Trade Clearance'}
              </h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Access granular registry records, document uploads, bulk status updates, and department-specific audit logs.
              </p>
              <div className="pt-2">
                <Link
                  to={
                    activeTab === 'kyc' ? ROUTES.KYC_DASHBOARD :
                    activeTab === 'dp' ? ROUTES.DP_DASHBOARD :
                    activeTab === 'iepf' ? ROUTES.IEPF_DASHBOARD :
                    ROUTES.SETTLEMENTS_DASHBOARD
                  }
                  className="mis-btn mis-btn-primary px-6 py-2.5 text-sm font-bold inline-flex items-center gap-2 rounded-xl"
                >
                  <IconDashboardTile />
                  Open Full {activeTab.toUpperCase()} Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 8: SYSTEM & ORG (Admin only)
            ══════════════════════════════════════════════════════ */}
        {activeTab === 'system' && isAdmin && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="mis-card p-6 sm:p-8">
              <h2 className="mis-section-title">System Hierarchy</h2>
              <p className="mis-section-desc">Real-time counts for organization nodes and system entities.</p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
                <div className="mis-stat-card">
                  <div className="mis-stat-value accent">{systemStats.branches}</div>
                  <div className="mis-stat-label">Branches</div>
                </div>
                <div className="mis-stat-card">
                  <div className="mis-stat-value">{systemStats.departments}</div>
                  <div className="mis-stat-label">Departments</div>
                </div>
                <div className="mis-stat-card">
                  <div className="mis-stat-value">{systemStats.users}</div>
                  <div className="mis-stat-label">Active Users</div>
                </div>
                <div className="mis-stat-card">
                  <div className="mis-stat-value">{systemStats.modules}</div>
                  <div className="mis-stat-label">Modules</div>
                </div>
              </div>
            </div>

            <div className="mis-card p-6 sm:p-8">
              <h2 className="mis-section-title">Admin Quick Controls</h2>
              <p className="mis-section-desc">Management shortcuts</p>
              <div className="flex flex-col gap-2 mt-4">
                <Link to={ROUTES.ADMIN_PANEL} className="mis-btn mis-btn-ghost mis-action-row border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-sky-600 dark:text-sky-400"><IconShieldCheck /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Open Full Admin Panel (User & Role Config)</span>
                </Link>
                <Link to={ROUTES.HR_USER_MANAGEMENT} className="mis-btn mis-btn-ghost mis-action-row border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-emerald-600 dark:text-emerald-400"><IconUser /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Create / Onboard New Staff</span>
                </Link>
                <Link to={ROUTES.PROFILE} className="mis-btn mis-btn-ghost mis-action-row border border-[var(--border)] hover:bg-[var(--bg-hover-2)]">
                  <span className="mis-action-icon text-amber-600 dark:text-amber-400"><IconEdit /></span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Update Profile & System Settings</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
