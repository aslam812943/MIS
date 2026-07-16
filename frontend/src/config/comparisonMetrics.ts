import { itService } from '../services/it.service';
import { financeService } from '../services/finance.service';
import { kycService } from '../services/kyc.service';
import { dpService } from '../services/dp.service';
import { settlementService } from '../services/settlement.service';
import { iepfService } from '../services/iepf.service';

export interface ComparisonMetric {
  label: string;
  get: (data: any) => number | null | undefined;
  isPercentagePoint?: boolean;
  format?: (n: number) => string;
}

export interface ComparisonConfig {
  title: string;
  icon: string;
  fetch: (branchId: string | undefined, start: string, end: string) => Promise<any>;
  metrics: ComparisonMetric[];
}

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const percentage = (n: number) => `${n}%`;
const pct = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

export const COMPARISON_CONFIGS: Record<string, ComparisonConfig> = {
  it: {
    title: 'IT Compliance & Asset Analytics',
    icon: '📊',
    fetch: (branchId, start, end) => itService.getDashboardData(branchId, start, end),
    metrics: [
      { label: 'Total Users', get: d => d.kpis.totalUsers },
      { label: 'Active Devices', get: d => d.kpis.activeDevices },
      { label: 'Open Tickets', get: d => d.kpis.openTickets },
      { label: 'Critical Incidents', get: d => d.kpis.criticalIncidents },
      { label: 'System Uptime', get: d => d.kpis.systemAvailability, isPercentagePoint: true, format: percentage },
      { label: 'SLA Met', get: d => d.kpis.slaCompliance, isPercentagePoint: true, format: percentage },
      { label: 'Ongoing Projects', get: d => d.kpis.ongoingProjects },
      { label: 'Audits Overdue', get: d => d.kpis.auditsOverdue },
      { label: 'AMC Due (30d)', get: d => d.kpis.amcDueSoon },
    ],
  },
  finance: {
    title: 'Finance Performance & Compliance Analytics',
    icon: '📊',
    fetch: (branchId, start, end) => financeService.getDashboardData(branchId, start, end),
    metrics: [
      { label: 'Brokerage Revenue', get: d => d.kpis.totalBrokerageRevenue, format: money },
      { label: 'Net Profit', get: d => d.kpis.netProfit, format: money },
      { label: 'EBITDA Margin', get: d => d.kpis.ebitdaMargin, isPercentagePoint: true, format: percentage },
      { label: 'Cost-to-Income', get: d => d.kpis.costToIncome, isPercentagePoint: true, format: percentage },
      { label: 'Total Liquidity', get: d => d.kpis.totalLiquidity, format: money },
      { label: 'Renewals Due Soon', get: d => d.kpis.renewalsDueSoon },
      { label: 'Open Client Requests', get: d => d.kpis.openClientRequests },
    ],
  },
  kyc: {
    title: 'KYC Department Analytics',
    icon: '📊',
    fetch: (branchId, start, end) => kycService.getDashboardData(branchId, start, end),
    metrics: [
      { label: 'Total Onboarded Clients', get: d => d.kpis.totalOnboarded },
      { label: 'Pending Verifications', get: d => d.kpis.pendingVerifications },
      { label: 'Modifications Applied', get: d => d.kpis.processedModifications },
      { label: 'Closed Accounts', get: d => d.kpis.closedAccounts },
      { label: 'Active Reactivations', get: d => d.kpis.activeReactivations },
      { label: 'Demise Reports', get: d => d.kpis.demiseReportsCount },
    ],
  },
  dp: {
    title: 'DP Department Analytics',
    icon: '📊',
    fetch: (branchId, start, end) => dpService.getDashboardData(branchId, start, end),
    metrics: [
      { label: 'Total DP Accounts', get: d => d.kpis.totalAccounts },
      { label: 'Pending Modifications', get: d => d.kpis.pendingModifications },
      { label: 'Completed Demats', get: d => d.kpis.completedDemats },
      { label: 'Active Queries', get: d => d.kpis.activeQueries },
      { label: 'Open Audits', get: d => d.kpis.openAudits },
    ],
  },
  settlements: {
    title: 'Clearing & Settlements Analytics',
    icon: '📊',
    fetch: (branchId, start, end) => settlementService.getDashboardData(branchId, start, end),
    metrics: [
      { label: 'Securities Volume', get: d => d.payinPayout.totalBuyQty + d.payinPayout.totalSellQty },
      { label: 'Service Tickets', get: d => d.clientRequests.totalRecords },
      {
        label: 'IPO Allotment Rate',
        get: d => pct(d.ipoAllocation.totalAllottedQty, d.ipoAllocation.totalAppliedQty),
        isPercentagePoint: true,
        format: percentage,
      },
      { label: 'Corp Action Payout', get: d => d.corporateActions.totalEntitlementAmt, format: money },
    ],
  },
  iepf: {
    title: 'IEPF Department Analytics',
    icon: '📊',
    fetch: (branchId, start, end) => iepfService.getDashboardData(branchId, start, end),
    metrics: [
      { label: 'Total Active Claims', get: d => d.kpis.activeClaims },
      { label: 'Closed Cases (Year)', get: d => d.kpis.closedThisYear },
      { label: 'Pending Claims', get: d => d.kpis.pendingClaims },
      { label: 'Resolved (Month)', get: d => d.kpis.closedThisMonth },
      { label: 'Avg Resolution Time (Days)', get: d => d.kpis.averageResolutionTime },
    ],
  },
};
