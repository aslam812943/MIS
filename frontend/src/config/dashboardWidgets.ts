export interface DashboardWidget {
  key: string;
  label: string;
  type: 'kpi' | 'chart';
}

/**
 * Catalog of every KPI card and chart on every department dashboard, used
 * by the Admin Panel's "Dashboard Permissions" tab (the checklist shown per
 * position) and by each dashboard's own visibility gate. Keyed by the exact
 * `departments.name` value stored in the database — except 'HR', which has
 * no department row (HR access is role-only, see requireAdminOrHR) and is
 * keyed by role instead.
 *
 * Widget keys are permanent identifiers stored in dashboard_widget_permissions
 * rows — renaming a label here is safe, but changing a `key` orphans any
 * saved admin configuration for that widget (it silently reverts to visible).
 */
export const DASHBOARD_WIDGETS: Record<string, DashboardWidget[]> = {
  IT: [
    { key: 'it.kpi.total_users', label: 'Total Users', type: 'kpi' },
    { key: 'it.kpi.active_devices', label: 'Active Devices', type: 'kpi' },
    { key: 'it.kpi.open_tickets', label: 'Open Tickets', type: 'kpi' },
    { key: 'it.kpi.critical_incidents', label: 'Critical Incidents', type: 'kpi' },
    { key: 'it.kpi.system_uptime', label: 'System Uptime', type: 'kpi' },
    { key: 'it.kpi.sla_met', label: 'SLA Met', type: 'kpi' },
    { key: 'it.kpi.ongoing_projects', label: 'Ongoing Projects', type: 'kpi' },
    { key: 'it.kpi.audits_overdue', label: 'Audits Overdue', type: 'kpi' },
    { key: 'it.kpi.amc_due_30d', label: 'AMC Due (30d)', type: 'kpi' },
    { key: 'it.kpi.pos_raised', label: 'POs Raised', type: 'kpi' },
    { key: 'it.kpi.total_po_value', label: 'Total PO Value', type: 'kpi' },
    { key: 'it.kpi.total_inventory_items', label: 'Total Inventory Items', type: 'kpi' },
    { key: 'it.kpi.high_criticality_inventory', label: 'High Criticality Assets', type: 'kpi' },
    { key: 'it.chart.audit_filing_countdown', label: 'Audit Filing Countdown (HO)', type: 'chart' },
    { key: 'it.chart.upcoming_amc_renewals', label: 'Upcoming AMC Renewals', type: 'chart' },
    { key: 'it.chart.software_licenses_expiring', label: 'Software Licenses Expiring', type: 'chart' },
    { key: 'it.chart.asset_life_age_brackets', label: 'Useful Asset Life Age Brackets', type: 'chart' },
    { key: 'it.chart.device_category_distribution', label: 'Device Category Distribution', type: 'chart' },
    { key: 'it.chart.warranty_expiries', label: 'Upcoming Hardware & Software Warranty Expiries', type: 'chart' },
    { key: 'it.chart.inventory_by_type', label: 'Asset Inventory by Type', type: 'chart' },
  ],
  Finance: [
    { key: 'finance.kpi.brokerage_revenue', label: 'Brokerage Revenue', type: 'kpi' },
    { key: 'finance.kpi.net_profit', label: 'Net Profit', type: 'kpi' },
    { key: 'finance.kpi.ebitda_margin', label: 'EBITDA Margin', type: 'kpi' },
    { key: 'finance.kpi.cost_to_income', label: 'Cost-to-Income', type: 'kpi' },
    { key: 'finance.kpi.total_liquidity', label: 'Total Liquidity', type: 'kpi' },
    { key: 'finance.kpi.renewals_due_soon', label: 'Renewals Due Soon', type: 'kpi' },
    { key: 'finance.kpi.open_client_requests', label: 'Open Client Requests', type: 'kpi' },
    { key: 'finance.chart.monthly_revenue_trend', label: 'Monthly Revenue Trend', type: 'chart' },
    { key: 'finance.chart.revenue_composition', label: 'Revenue Composition', type: 'chart' },
    { key: 'finance.chart.upcoming_statutory_renewals', label: 'Upcoming Statutory Renewals & Filings', type: 'chart' },
  ],
  KYC: [
    { key: 'kyc.kpi.total_onboarded_clients', label: 'Total Onboarded Clients', type: 'kpi' },
    { key: 'kyc.kpi.pending_verifications', label: 'Pending Verifications', type: 'kpi' },
    { key: 'kyc.kpi.modifications_applied', label: 'Modifications Applied', type: 'kpi' },
    { key: 'kyc.kpi.closed_accounts', label: 'Closed Accounts / Closures', type: 'kpi' },
    { key: 'kyc.chart.verification_status_distribution', label: 'Verification Status Distribution', type: 'chart' },
    { key: 'kyc.chart.monthly_onboarding_trend', label: 'Monthly Onboarding Trend', type: 'chart' },
    { key: 'kyc.chart.modification_categories', label: 'Modification Request Categories Breakdown', type: 'chart' },
    { key: 'kyc.chart.exchange_compliance_stats', label: 'Exchange Compliance Stats', type: 'chart' },
    { key: 'kyc.chart.registry_updation_stats', label: 'Registry Updation Stats (CKYC/KRA)', type: 'chart' },
  ],
  DP: [
    { key: 'dp.kpi.total_dp_accounts', label: 'Total DP Accounts', type: 'kpi' },
    { key: 'dp.kpi.pending_modifications', label: 'Pending Modifications', type: 'kpi' },
    { key: 'dp.kpi.completed_demats', label: 'Completed Demats', type: 'kpi' },
    { key: 'dp.kpi.active_queries', label: 'Active Queries', type: 'kpi' },
    { key: 'dp.kpi.open_audits', label: 'Open Audits', type: 'kpi' },
    { key: 'dp.chart.monthly_account_openings_trend', label: 'Monthly Account Openings Trend', type: 'chart' },
    { key: 'dp.chart.dis_cdas_scan_upload_status', label: 'DIS CDAS Scan Upload Status', type: 'chart' },
    { key: 'dp.chart.client_support_queries_by_category', label: 'Client Support Queries by Category', type: 'chart' },
  ],
  Settlements: [
    { key: 'settlements.kpi.securities_volume', label: 'Securities Volume', type: 'kpi' },
    { key: 'settlements.kpi.service_tickets', label: 'Service Tickets', type: 'kpi' },
    { key: 'settlements.kpi.ipo_allotment_rate', label: 'IPO Allotment Rate', type: 'kpi' },
    { key: 'settlements.kpi.corp_action_payout', label: 'Corp Action Payout', type: 'kpi' },
    { key: 'settlements.chart.client_request_types', label: 'Client Request Types', type: 'chart' },
    { key: 'settlements.chart.corporate_actions_eligibility', label: 'Corporate Actions Eligibility', type: 'chart' },
    { key: 'settlements.chart.ipo_subscriptions_summary', label: 'IPO Subscriptions Summary', type: 'chart' },
    { key: 'settlements.chart.monthly_requests_trend', label: 'Monthly Requests Trend', type: 'chart' },
    { key: 'settlements.chart.payin_payout_status', label: 'Pay-in / Pay-out Status', type: 'chart' },
  ],
  IEPF: [
    { key: 'iepf.kpi.total_active_claims', label: 'Total Active Claims', type: 'kpi' },
    { key: 'iepf.kpi.closed_cases_year', label: 'Closed Cases (Year)', type: 'kpi' },
    { key: 'iepf.kpi.pending_claims', label: 'Pending Claims', type: 'kpi' },
    { key: 'iepf.kpi.resolved_month', label: 'Resolved (Month)', type: 'kpi' },
    { key: 'iepf.kpi.avg_resolution_time', label: 'Avg Resolution Time', type: 'kpi' },
    { key: 'iepf.chart.claim_status_breakdown', label: 'Claim Status Breakdown', type: 'chart' },
    { key: 'iepf.chart.monthly_claims_trend', label: 'Monthly Claims Trend', type: 'chart' },
    { key: 'iepf.chart.pending_reason_analysis', label: 'Pending Reason Analysis', type: 'chart' },
  ],
  HR: [
    { key: 'hr.kpi.total_employees', label: 'Total Employees', type: 'kpi' },
    { key: 'hr.kpi.new_joiners', label: 'New Joiners', type: 'kpi' },
    { key: 'hr.kpi.resignations', label: 'Resignations', type: 'kpi' },
    { key: 'hr.kpi.attrition_rate', label: 'Attrition Rate', type: 'kpi' },
    { key: 'hr.kpi.avg_tenure', label: 'Avg. Tenure', type: 'kpi' },
    { key: 'hr.kpi.pending_offboarding', label: 'Pending Offboarding', type: 'kpi' },
    { key: 'hr.kpi.open_positions', label: 'Open Positions', type: 'kpi' },
    { key: 'hr.kpi.candidates_in_pipeline', label: 'Candidates in Pipeline', type: 'kpi' },
    { key: 'hr.kpi.active_policies', label: 'Active Policies', type: 'kpi' },
    { key: 'hr.chart.candidates_by_stage', label: 'Candidates by Stage', type: 'chart' },
    { key: 'hr.chart.employee_growth', label: 'Employee Growth', type: 'chart' },
    { key: 'hr.chart.branch_distribution', label: 'Branch Distribution', type: 'chart' },
    { key: 'hr.chart.department_distribution', label: 'Department Distribution', type: 'chart' },
    { key: 'hr.chart.resignation_reasons', label: 'Resignation Reasons', type: 'chart' },
    { key: 'hr.chart.role_distribution', label: 'Role Distribution', type: 'chart' },
  ],
};
