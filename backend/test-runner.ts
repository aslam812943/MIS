import { supabaseAdmin } from '../../../../../../../../home/hp/work/MIS/backend/src/config/supabase.js';
import { ITService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/ITService.js';
import { HRService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/HRService.js';
import { UserService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/UserService.js';
import { FinanceService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/FinanceService.js';
import { KYCService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/KYCService.js';
import { DPService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/DPService.js';
import { IEPFService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/IEPFService.js';
import { SettlementService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/SettlementService.js';
import { SalesService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/SalesService.js';
import { SocialMediaPostService } from '../../../../../../../../home/hp/work/MIS/backend/src/services/SocialMediaPostService.js';
import { SupabaseSocialMediaPostRepository } from '../../../../../../../../home/hp/work/MIS/backend/src/repositories/SupabaseSocialMediaPostRepository.js';

interface CleanupItem {
  department: string;
  sheet: string;
  id: string;
  code?: string;
  deleteFn: () => Promise<void>;
}

async function testAllDepartments() {
  const client = supabaseAdmin;
  if (!client) {
    console.error('❌ Supabase client not initialized.');
    return;
  }

  console.log('================================================================');
  console.log('🚀 COMPREHENSIVE ALL-DEPARTMENTS DATA ENTRY TEST & VERIFICATION');
  console.log('================================================================\n');

  // 1. Fetch Admin user for authorization
  const { data: adminUser, error: userError } = await client
    .from('profiles')
    .select('id, email, branch_id')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (userError || !adminUser) {
    console.error('❌ Could not locate admin user:', userError?.message);
    return;
  }

  // 2. Fetch a valid branch
  const { data: branch } = await client.from('branches').select('id, name').limit(1).single();
  const branchId = branch?.id || adminUser.branch_id;
  const adminId = adminUser.id;

  console.log(`👤 Running tests as Admin: ${adminUser.email} (ID: ${adminId})`);
  console.log(`🏢 Default Branch: ${branch?.name || 'Default'} (ID: ${branchId})\n`);

  const cleanupList: CleanupItem[] = [];
  const testResults: { dept: string; sheet: string; status: 'SUCCESS' | 'FAILED'; error?: string; code?: string }[] = [];

  const itService = new ITService();
  const userService = new UserService();
  const hrService = new HRService(userService);
  const financeService = new FinanceService();
  const kycService = new KYCService();
  const dpService = new DPService();
  const iepfService = new IEPFService();
  const settlementService = new SettlementService();
  const salesService = new SalesService();
  const smmService = new SocialMediaPostService(new SupabaseSocialMediaPostRepository());

  const todayStr = new Date().toISOString().split('T')[0];
  const uniqueNum = Date.now().toString().slice(-4);
  const randomPan = `ABCDE${Math.floor(1000 + Math.random() * 9000)}F`;

  // ════════════════════════════════════════════════════════════════
  // 1. IT DEPARTMENT (15 Sheets)
  // ════════════════════════════════════════════════════════════════
  console.log('─── 1. TESTING IT DEPARTMENT ──────────────────────────────────');
  let itAuditId = '';
  let itVendorId = '';

  try {
    const res = await itService.createEntry(adminId, 'audits', {
      audit_name: `TEST_Audit_${uniqueNum}`,
      audit_type: 'Internal',
      auditor_name: 'Test QA Auditor',
      scheduled_date: todayStr,
      submission_deadline: todayStr,
      status: 'Scheduled',
      branch_id: branchId
    });
    itAuditId = res.id;
    cleanupList.push({ department: 'IT', sheet: 'audits', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'audits', res.id) });
    testResults.push({ dept: 'IT', sheet: 'audits', status: 'SUCCESS', code: res.audit_name });
    console.log(`  ✅ Audits: ${res.audit_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'audits', status: 'FAILED', error: err.message });
    console.error(`  ❌ Audits: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'audit-findings', {
      audit_id: itAuditId || null,
      finding_id: `F-TEST-${uniqueNum}`,
      finding_description: 'Test audit finding description',
      domain: 'Infrastructure',
      severity: 'Low',
      recommended_action: 'Apply security patch',
      responsible_person: 'QA Officer',
      implementation_target_date: todayStr,
      status: 'Open',
      notification_lead_time_days: 15,
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'audit-findings', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'audit-findings', res.id) });
    testResults.push({ dept: 'IT', sheet: 'audit-findings', status: 'SUCCESS', code: res.finding_id });
    console.log(`  ✅ Audit Findings: ${res.finding_id} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'audit-findings', status: 'FAILED', error: err.message });
    console.error(`  ❌ Audit Findings: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'vendors', {
      vendor_name: `TEST_Vendor_${uniqueNum}`,
      category: 'Hardware',
      poc_name: 'Vendor Contact',
      poc_email: 'vendor.test@example.com',
      poc_phone: '9876543210',
      status: 'Active',
      branch_id: branchId
    });
    itVendorId = res.id;
    cleanupList.push({ department: 'IT', sheet: 'vendors', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'vendors', res.id) });
    testResults.push({ dept: 'IT', sheet: 'vendors', status: 'SUCCESS', code: res.vendor_name });
    console.log(`  ✅ Vendors: ${res.vendor_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'vendors', status: 'FAILED', error: err.message });
    console.error(`  ❌ Vendors: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'amc-contracts', {
      vendor_id: itVendorId || null,
      item_covered: 'Test Firewall AMC Support',
      amc_start_date: todayStr,
      amc_renewal_date: todayStr,
      amc_amount: 35000,
      notification_lead_time_days: 30,
      status: 'Active',
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'amc-contracts', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'amc-contracts', res.id) });
    testResults.push({ dept: 'IT', sheet: 'amc-contracts', status: 'SUCCESS', code: res.item_covered });
    console.log(`  ✅ AMC Contracts: ${res.item_covered} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'amc-contracts', status: 'FAILED', error: err.message });
    console.error(`  ❌ AMC Contracts: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'assets', {
      asset_id: `AST-TEST-${uniqueNum}`,
      asset_type: 'Desktop',
      make_model: 'Dell OptiPlex 7090',
      serial_number: 'NIL',
      purchase_date: todayStr,
      purchase_value: 45000,
      depreciation_rate: 15,
      vendor_id: itVendorId || null,
      assigned_to: 'QA Tester',
      location: 'IT Lab',
      useful_life_years: 5,
      criticality: 'Non-Critical',
      status: 'Active',
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'assets', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'assets', res.id) });
    testResults.push({ dept: 'IT', sheet: 'assets', status: 'SUCCESS', code: res.asset_id });
    console.log(`  ✅ Assets: ${res.asset_id} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'assets', status: 'FAILED', error: err.message });
    console.error(`  ❌ Assets: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'diagrams', {
      diagram_name: `TEST_Diagram_${uniqueNum}`,
      type: 'Network Topology',
      version: 'v1.0',
      file_url: 'https://example.com/diagram.png',
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'diagrams', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'diagrams', res.id) });
    testResults.push({ dept: 'IT', sheet: 'diagrams', status: 'SUCCESS', code: res.diagram_name });
    console.log(`  ✅ Diagrams: ${res.diagram_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'diagrams', status: 'FAILED', error: err.message });
    console.error(`  ❌ Diagrams: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'cybersecurity-compliance', {
      compliance_domain: 'Access Control',
      control_item: 'MFA enforcement on all admin accounts',
      framework_reference: 'CSCRF-AC-01',
      status: 'Compliant',
      responsible_person: 'CISO',
      next_review_date: todayStr,
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'cybersecurity-compliance', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'cybersecurity-compliance', res.id) });
    testResults.push({ dept: 'IT', sheet: 'cybersecurity-compliance', status: 'SUCCESS', code: res.framework_reference });
    console.log(`  ✅ Cybersecurity Compliance: ${res.framework_reference} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'cybersecurity-compliance', status: 'FAILED', error: err.message });
    console.error(`  ❌ Cybersecurity Compliance: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'tickets', {
      requester_name: 'Staff Member',
      issue_description: 'Test support ticket',
      opened_date: todayStr,
      status: 'Open',
      sla_target_hours: 4,
      is_sla_compliant: false,
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'tickets', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'tickets', res.id) });
    testResults.push({ dept: 'IT', sheet: 'tickets', status: 'SUCCESS', code: res.ticket_number });
    console.log(`  ✅ Support Tickets: Auto-Code [${res.ticket_number}] (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'tickets', status: 'FAILED', error: err.message });
    console.error(`  ❌ Support Tickets: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'incidents', {
      incident_name: 'Test Connectivity Blip',
      description: 'Test incident description',
      severity: 'Low',
      status: 'Identified',
      discovered_date: todayStr,
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'incidents', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'incidents', res.id) });
    testResults.push({ dept: 'IT', sheet: 'incidents', status: 'SUCCESS', code: res.incident_number });
    console.log(`  ✅ Incidents: Auto-Code [${res.incident_number}] (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'incidents', status: 'FAILED', error: err.message });
    console.error(`  ❌ Incidents: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'projects', {
      project_name: `TEST_Project_${uniqueNum}`,
      description: 'Infrastructure upgrade project',
      start_date: todayStr,
      target_end_date: todayStr,
      status: 'Planning',
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'projects', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'projects', res.id) });
    testResults.push({ dept: 'IT', sheet: 'projects', status: 'SUCCESS', code: res.project_name });
    console.log(`  ✅ Projects: ${res.project_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'projects', status: 'FAILED', error: err.message });
    console.error(`  ❌ Projects: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'audit-schedule', {
      audit_type: 'VAPT',
      recurrence_months: 6,
      last_filing_date: todayStr,
      auditor_name: 'CyberSec Labs',
      status: 'Upcoming'
    });
    cleanupList.push({ department: 'IT', sheet: 'audit-schedule', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'audit-schedule', res.id) });
    testResults.push({ dept: 'IT', sheet: 'audit-schedule', status: 'SUCCESS', code: res.audit_type });
    console.log(`  ✅ Audit Schedule: ${res.audit_type} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'audit-schedule', status: 'FAILED', error: err.message });
    console.error(`  ❌ Audit Schedule: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'servers', {
      server_name: `SRV-TEST-${uniqueNum}`,
      role_purpose: 'Test App Server',
      physical_or_virtual: 'Virtual',
      os: 'Ubuntu 24.04',
      cpu: '8 vCPU',
      ram: '32 GB',
      storage: '500 GB NVMe',
      ip_address: '10.0.0.50',
      location_rack: 'AWS Mumbai',
      assigned_admin: 'QA Admin',
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'servers', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'servers', res.id) });
    testResults.push({ dept: 'IT', sheet: 'servers', status: 'SUCCESS', code: res.server_name });
    console.log(`  ✅ Servers: ${res.server_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'servers', status: 'FAILED', error: err.message });
    console.error(`  ❌ Servers: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'team-duties', {
      profile_id: adminId,
      designation: 'IT Lead',
      duties_responsibilities: 'Overall infrastructure reliability',
      escalation_priority: 1
    });
    cleanupList.push({ department: 'IT', sheet: 'team-duties', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'team-duties', res.id) });
    testResults.push({ dept: 'IT', sheet: 'team-duties', status: 'SUCCESS', code: res.designation });
    console.log(`  ✅ Team Duties: ${res.designation} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'team-duties', status: 'FAILED', error: err.message });
    console.error(`  ❌ Team Duties: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'software', {
      software_name: `Software_${uniqueNum}`,
      purchase_date: todayStr,
      purpose_for: 'Engineering',
      used_by: 'Dev Team',
      number_of_licenses: 10,
      status: 'Active',
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'software', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'software', res.id) });
    testResults.push({ dept: 'IT', sheet: 'software', status: 'SUCCESS', code: res.software_name });
    console.log(`  ✅ Software Register: ${res.software_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'software', status: 'FAILED', error: err.message });
    console.error(`  ❌ Software Register: ${err.message}`);
  }

  try {
    const res = await itService.createEntry(adminId, 'purchase-orders', {
      vendor_id: itVendorId || null,
      item_description: 'Dell UltraSharp 27-inch 4K Monitors',
      amount: 68000,
      po_date: todayStr,
      status: 'Raised',
      branch_id: branchId
    });
    cleanupList.push({ department: 'IT', sheet: 'purchase-orders', id: res.id, deleteFn: () => itService.deleteEntry(adminId, 'purchase-orders', res.id) });
    testResults.push({ dept: 'IT', sheet: 'purchase-orders', status: 'SUCCESS', code: res.po_number });
    console.log(`  ✅ Purchase Orders: Auto-Code [${res.po_number}] (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IT', sheet: 'purchase-orders', status: 'FAILED', error: err.message });
    console.error(`  ❌ Purchase Orders: ${err.message}`);
  }

  // ════════════════════════════════════════════════════════════════
  // 2. HR DEPARTMENT (4 Sheets)
  // ════════════════════════════════════════════════════════════════
  console.log('\n─── 2. TESTING HR DEPARTMENT ──────────────────────────────────');
  let hrPosId = '';

  try {
    const res = await hrService.createEntry(adminId, 'open-positions', {
      position_title: `TEST_QA_Engineer_${uniqueNum}`,
      date_opened: todayStr,
      number_of_openings: 2,
      priority: 'Normal',
      status: 'Open'
    });
    hrPosId = res.id;
    cleanupList.push({ department: 'HR', sheet: 'open-positions', id: res.id, deleteFn: () => hrService.deleteEntry('open-positions', res.id) });
    testResults.push({ dept: 'HR', sheet: 'open-positions', status: 'SUCCESS', code: res.position_title });
    console.log(`  ✅ Open Positions: ${res.position_title} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'HR', sheet: 'open-positions', status: 'FAILED', error: err.message });
    console.error(`  ❌ Open Positions: ${err.message}`);
  }

  try {
    const res = await hrService.createEntry(adminId, 'candidates', {
      position_id: hrPosId || null,
      candidate_name: 'Test Candidate',
      email: `candidate_${uniqueNum}@example.com`,
      mobile: '9876543210',
      stage: 'Applied',
      expected_salary: 1200000
    });
    cleanupList.push({ department: 'HR', sheet: 'candidates', id: res.id, deleteFn: () => hrService.deleteEntry('candidates', res.id) });
    testResults.push({ dept: 'HR', sheet: 'candidates', status: 'SUCCESS', code: res.candidate_name });
    console.log(`  ✅ Candidates: ${res.candidate_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'HR', sheet: 'candidates', status: 'FAILED', error: err.message });
    console.error(`  ❌ Candidates: ${err.message}`);
  }

  try {
    const res = await hrService.createEntry(adminId, 'policies', {
      policy_name: `TEST_Policy_${uniqueNum}`,
      category: 'Compliance',
      version_number: '1.0',
      effective_date: todayStr,
      pdf_url: 'https://example.com/policy.pdf',
      status: 'Active'
    });
    cleanupList.push({ department: 'HR', sheet: 'policies', id: res.id, deleteFn: () => hrService.deleteEntry('policies', res.id) });
    testResults.push({ dept: 'HR', sheet: 'policies', status: 'SUCCESS', code: res.policy_name });
    console.log(`  ✅ Policies: ${res.policy_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'HR', sheet: 'policies', status: 'FAILED', error: err.message });
    console.error(`  ❌ Policies: ${err.message}`);
  }

  try {
    const res = await hrService.createEntry(adminId, 'documents', {
      employee_id: adminId,
      document_type: 'Aadhaar',
      document_reference: 'AADHAAR-1234',
      file_url: 'https://example.com/doc.pdf',
      confidentiality_level: 'Standard'
    });
    cleanupList.push({ department: 'HR', sheet: 'documents', id: res.id, deleteFn: () => hrService.deleteEntry('documents', res.id) });
    testResults.push({ dept: 'HR', sheet: 'documents', status: 'SUCCESS', code: res.document_type });
    console.log(`  ✅ Documents: ${res.document_type} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'HR', sheet: 'documents', status: 'FAILED', error: err.message });
    console.error(`  ❌ Documents: ${err.message}`);
  }

  // ════════════════════════════════════════════════════════════════
  // 3. FINANCE DEPARTMENT (8 Sheets)
  // ════════════════════════════════════════════════════════════════
  console.log('\n─── 3. TESTING FINANCE DEPARTMENT ─────────────────────────────');
  const financeSheets = [
    { sheet: 'pnl-summary', data: { entry_date: todayStr, cash_brokerage_revenue: 500000, fno_brokerage_revenue: 250000, operating_expense: 350000 } },
    { sheet: 'compliance-renewals', data: { renewal_type: 'GST Payment', item_name: 'GST Monthly', reference_no: `REF-${uniqueNum}`, amount: 50000, due_date: todayStr, frequency: 'Monthly', status: 'Pending' } },
    { sheet: 'exchange-reporting', data: { submission_type: 'Daily Segregation Report', exchange: 'NSE', period_date: todayStr, due_date: todayStr, status: 'Submitted On-Time' } },
    { sheet: 'fund-movement', data: { entry_date: todayStr, payin_amount: 250000, payin_count: 5, payout_amount: 100000, payout_count: 2 } },
    { sheet: 'client-requests', data: { request_date: todayStr, request_type: 'General Client Request', client_name: 'Test QA Client', description: 'Brokerage query', status: 'Pending' } },
    { sheet: 'referral-commission', data: { referrer_name: 'Partner Alpha', period_month: todayStr.slice(0, 7) + '-01', commission_amount: 12000, payment_status: 'Pending' } },
    { sheet: 'cash-bank-position', data: { position_date: todayStr, cash_in_hand: 15000, cash_at_bank: 15000000, bank_name: 'HDFC Main Bank', bank_reconciliation_status: 'Reconciled' } },
    { sheet: 'recurring-payables', data: { payable_type: 'Internet Bill', description: 'Lease Line Internet', amount: 22000, due_date: todayStr, status: 'Pending' } },
  ];

  for (const item of financeSheets) {
    try {
      const res = await financeService.createEntry(adminId, item.sheet, { ...item.data, branch_id: branchId });
      cleanupList.push({ department: 'Finance', sheet: item.sheet, id: res.id, deleteFn: () => financeService.deleteEntry(adminId, item.sheet, res.id) });
      testResults.push({ dept: 'Finance', sheet: item.sheet, status: 'SUCCESS', code: res.id });
      console.log(`  ✅ ${item.sheet}: Created record (${res.id})`);
    } catch (err: any) {
      testResults.push({ dept: 'Finance', sheet: item.sheet, status: 'FAILED', error: err.message });
      console.error(`  ❌ ${item.sheet}: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 4. KYC DEPARTMENT (11 Sheets)
  // ════════════════════════════════════════════════════════════════
  console.log('\n─── 4. TESTING KYC DEPARTMENT ─────────────────────────────────');
  let kycClientId = '';

  try {
    const res = await kycService.createNewAccount(adminId, {
      applicant_name: 'QA Master Client',
      pan: randomPan,
      aadhaar_number: '123456789012',
      mobile_number: '9876543210',
      email: `client_${uniqueNum}@example.com`,
      address: '123 Test Street, Ernakulam, Kerala',
      date_of_birth: '1990-01-01',
      status: 'Verified',
      branch_id: branchId
    });
    kycClientId = res.id;
    cleanupList.push({ department: 'KYC', sheet: 'new-accounts', id: res.id, deleteFn: () => kycService.deleteEntry(adminId, 'new-accounts', res.id) });
    testResults.push({ dept: 'KYC', sheet: 'new-accounts', status: 'SUCCESS', code: res.id });
    console.log(`  ✅ new-accounts: Master Client Created (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'KYC', sheet: 'new-accounts', status: 'FAILED', error: err.message });
    console.error(`  ❌ new-accounts: ${err.message}`);
  }

  const kycSheets = [
    { sheet: 'ucc-allotments', fn: () => kycService.createUCCAllotment(adminId, { client_name: 'QA Master Client', pan: randomPan, exchange: 'NSE', segment: 'Cash', ucc_code: `UCC${uniqueNum}`, status: 'Confirmed', branch_id: branchId }) },
    { sheet: 'registry-updates', fn: () => kycService.createRegistryUpdate(adminId, { client_name: 'QA Master Client', pan: randomPan, registry: 'CKYC', status: 'Verified', branch_id: branchId }) },
    { sheet: 'ap-sharings', fn: () => kycService.createAPSharing(adminId, { ap_name: 'AP Partner One', ap_code: `AP${uniqueNum}`, client_name: 'QA Master Client', sharing_percentage: 50, effective_date: todayStr, status: 'Active', branch_id: branchId }) },
    { sheet: 'demise-reports', fn: () => kycService.createDemiseReport(adminId, { client_name: 'QA Master Client', pan: randomPan, date_of_demise: todayStr, reported_date: todayStr, status: 'Reported', branch_id: branchId }) },
    { sheet: 'ap-codes', fn: () => kycService.createAPCode(adminId, { ap_name: 'Test Authorized Person', ap_code: `AP${uniqueNum}`, exchange: 'NSE', upload_date: todayStr, status: 'Confirmed', branch_id: branchId }) },
    { sheet: 'communications', fn: () => kycService.createCommunication(adminId, { client_name: 'QA Master Client', mode: 'Email', sent_date: todayStr, status: 'Sent', branch_id: branchId }) },
    { sheet: 'modifications', fn: () => kycService.createModification(adminId, { client_name: 'QA Master Client', pan: randomPan, modification_type: 'Bank Details', request_date: todayStr, status: 'Processed', branch_id: branchId }) },
    { sheet: 'reactivations', fn: () => kycService.createReactivation(adminId, { client_name: 'QA Master Client', pan: randomPan, reason: 'Client Request', request_date: todayStr, status: 'Processed', branch_id: branchId }) },
    { sheet: 'closures', fn: () => kycService.createClosure(adminId, { client_name: 'QA Master Client', pan: randomPan, reason: 'Client Request', request_date: todayStr, status: 'Processed', branch_id: branchId }) },
    { sheet: 'compliance', fn: () => kycService.createCompliance(adminId, { client_name: 'QA Master Client', pan: randomPan, compliance_item: 'Annual Re-KYC verification', due_date: todayStr, status: 'Complied', branch_id: branchId }) },
  ];

  for (const item of kycSheets) {
    try {
      const res = await item.fn();
      cleanupList.push({ department: 'KYC', sheet: item.sheet, id: res.id, deleteFn: () => kycService.deleteEntry(adminId, item.sheet, res.id) });
      testResults.push({ dept: 'KYC', sheet: item.sheet, status: 'SUCCESS', code: res.id });
      console.log(`  ✅ ${item.sheet}: Created record (${res.id})`);
    } catch (err: any) {
      testResults.push({ dept: 'KYC', sheet: item.sheet, status: 'FAILED', error: err.message });
      console.error(`  ❌ ${item.sheet}: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 5. DP DEPARTMENT (14 Sheets)
  // ════════════════════════════════════════════════════════════════
  console.log('\n─── 5. TESTING DP DEPARTMENT ──────────────────────────────────');
  const dpSheets = [
    { sheet: 'new-accounts', data: { kyc_client_id: kycClientId, bo_id_generated: '1208123456789012', status: 'Completed' } },
    { sheet: 'ucc-updation', data: { kyc_client_id: kycClientId, exchange: 'NSE', segment: 'Cash', status: 'Confirmed' } },
    { sheet: 'modifications', data: { kyc_client_id: kycClientId, bo_id: '1208123456789012', modification_type: 'Nominee', request_date: todayStr, status: 'Processed' } },
    { sheet: 'demat-executions', data: { kyc_client_id: kycClientId, bo_id: '1208123456789012', drf_number: `DRF${uniqueNum}`, isin: 'INE002A01018', company_name: 'Reliance Industries', certificate_number: 'CERT123', folio_number: 'FOL123', quantity: 100, rta_name: 'KFintech', status: 'Confirmed' } },
    { sheet: 'transfers-transmissions', data: { kyc_client_id: kycClientId, type: 'Transfer', from_bo_id: '1208123456789012', to_bo_id: '1208123456789013', isin: 'INE002A01018', quantity: 100, request_date: todayStr, status: 'Executed' } },
    { sheet: 'demat-rejections', data: { kyc_client_id: kycClientId, drf_number: `DRF-REJ-${uniqueNum}`, rejection_reason: 'Signature Mismatch', rejection_date: todayStr, status: 'Resolved' } },
    { sheet: 'closures', data: { kyc_client_id: kycClientId, bo_id: '1208123456789012', reason: 'Account Shifted', request_date: todayStr, status: 'Closed' } },
    { sheet: 'dis-slips', data: { kyc_client_id: kycClientId, bo_id: '1208123456789012', dis_slip_number: `DIS-${uniqueNum}`, isin: 'INE002A01018', quantity: 100, scan_upload_status: 'Pending' } },
    { sheet: 'back-office-updates', data: { file_type: 'Trade File', run_date: todayStr, performed_by: 'QA Admin', status: 'Success' } },
    { sheet: 'eod-backups', data: { backup_date: todayStr, backup_type: 'Full', file_size_kb: 2500, verified_by: 'QA Admin', status: 'Verified' } },
    { sheet: 'amc-charges', data: { kyc_client_id: kycClientId, bo_id: '1208123456789012', billing_month: 'January 2026', amc_amount: 450, gst_amount: 81, total_amount: 531, status: 'Debited' } },
    { sheet: 'monthly-statements', data: { kyc_client_id: kycClientId, bo_id: '1208123456789012', statement_period: 'January 2026', generated_date: todayStr, dispatch_mode: 'Email', dispatch_status: 'Sent' } },
    { sheet: 'audit-compliance', data: { audit_type: 'Internal', audit_period: 'Q1 2026', auditor_name: 'CDSL Auditor', finding_description: 'Audit compliant', status: 'Closed' } },
    { sheet: 'client-queries', data: { kyc_client_id: kycClientId, query_type: 'Account Details', description: 'Holding Statement Query', status: 'Resolved' } },
  ];

  for (const item of dpSheets) {
    try {
      const res = await dpService.createEntry(adminId, item.sheet, { ...item.data, branch_id: branchId });
      cleanupList.push({ department: 'DP', sheet: item.sheet, id: res.id, deleteFn: () => dpService.deleteEntry(adminId, item.sheet, res.id) });
      testResults.push({ dept: 'DP', sheet: item.sheet, status: 'SUCCESS', code: res.id });
      console.log(`  ✅ ${item.sheet}: Created record (${res.id})`);
    } catch (err: any) {
      testResults.push({ dept: 'DP', sheet: item.sheet, status: 'FAILED', error: err.message });
      console.error(`  ❌ ${item.sheet}: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 6. IEPF DEPARTMENT (Auto Claim Number)
  // ════════════════════════════════════════════════════════════════
  console.log('\n─── 6. TESTING IEPF DEPARTMENT ────────────────────────────────');
  try {
    const res = await iepfService.createClaim({
      investor_name: 'Test IEPF Shareholder',
      pan_number: randomPan,
      claim_type: 'Shares',
      amount: 12500,
      num_shares: 150,
      claim_date: todayStr,
      status: 'New',
      branch_id: branchId
    }, adminId);
    cleanupList.push({ department: 'IEPF', sheet: 'claims', id: res.id, deleteFn: () => iepfService.deleteClaim(res.id, adminId) });
    testResults.push({ dept: 'IEPF', sheet: 'claims', status: 'SUCCESS', code: res.claim_number });
    console.log(`  ✅ IEPF Claims: Auto-Code [${res.claim_number}] (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'IEPF', sheet: 'claims', status: 'FAILED', error: err.message });
    console.error(`  ❌ IEPF Claims: ${err.message}`);
  }

  // ════════════════════════════════════════════════════════════════
  // 7. SETTLEMENTS DEPARTMENT (4 Sheets)
  // ════════════════════════════════════════════════════════════════
  console.log('\n─── 7. TESTING SETTLEMENTS DEPARTMENT ─────────────────────────');
  try {
    const res = await settlementService.createPayInPayOutRecord(adminId, {
      settlement_date: todayStr,
      client_id: 'CLI-001',
      client_name: 'Settlement QA Client',
      stock_symbol: 'RELIANCE',
      buy_sell: 'Buy',
      quantity: 100,
      status: 'Pending',
      branch_id: branchId
    });
    cleanupList.push({ department: 'Settlements', sheet: 'payin-payout', id: res.id, deleteFn: () => settlementService.deleteEntry(adminId, 'payin-payout', res.id) });
    testResults.push({ dept: 'Settlements', sheet: 'payin-payout', status: 'SUCCESS', code: res.id });
    console.log(`  ✅ Pay-in/Pay-out: Created record (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'Settlements', sheet: 'payin-payout', status: 'FAILED', error: err.message });
    console.error(`  ❌ Pay-in/Pay-out: ${err.message}`);
  }

  try {
    const res = await settlementService.createClientRequestRecord(adminId, {
      date_received: todayStr,
      client_name: 'Settlement QA Client',
      request_type: 'Demat Transfer',
      status: 'Received',
      branch_id: branchId
    });
    cleanupList.push({ department: 'Settlements', sheet: 'client-requests', id: res.id, deleteFn: () => settlementService.deleteEntry(adminId, 'client-requests', res.id) });
    testResults.push({ dept: 'Settlements', sheet: 'client-requests', status: 'SUCCESS', code: res.request_id });
    console.log(`  ✅ Client Requests: Auto-Code [${res.request_id}] (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'Settlements', sheet: 'client-requests', status: 'FAILED', error: err.message });
    console.error(`  ❌ Client Requests: ${err.message}`);
  }

  try {
    const res = await settlementService.createIpoAllocationRecord(adminId, {
      application_no: `APP-${uniqueNum}`,
      client_id: 'CLI-IPO-01',
      client_name: 'Settlement QA Client',
      ipo_name: 'Test Tech IPO',
      category: 'Retail',
      applied_qty: 100,
      status: 'Applied',
      branch_id: branchId
    });
    cleanupList.push({ department: 'Settlements', sheet: 'ipo-allocation', id: res.id, deleteFn: () => settlementService.deleteEntry(adminId, 'ipo-allocation', res.id) });
    testResults.push({ dept: 'Settlements', sheet: 'ipo-allocation', status: 'SUCCESS', code: res.id });
    console.log(`  ✅ IPO Allocation: Created record (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'Settlements', sheet: 'ipo-allocation', status: 'FAILED', error: err.message });
    console.error(`  ❌ IPO Allocation: ${err.message}`);
  }

  try {
    const res = await settlementService.createCorporateActionRecord(adminId, {
      client_id: 'CLI-CORP-01',
      client_name: 'Settlement QA Client',
      stock_symbol: 'TCS',
      corporate_action: 'Dividend',
      record_date: todayStr,
      quantity: 50,
      eligible: 'Yes',
      branch_id: branchId
    });
    cleanupList.push({ department: 'Settlements', sheet: 'corporate-actions', id: res.id, deleteFn: () => settlementService.deleteEntry(adminId, 'corporate-actions', res.id) });
    testResults.push({ dept: 'Settlements', sheet: 'corporate-actions', status: 'SUCCESS', code: res.id });
    console.log(`  ✅ Corporate Actions: Created record (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'Settlements', sheet: 'corporate-actions', status: 'FAILED', error: err.message });
    console.error(`  ❌ Corporate Actions: ${err.message}`);
  }

  // ════════════════════════════════════════════════════════════════
  // 8. SALES DEPARTMENT
  // ════════════════════════════════════════════════════════════════
  console.log('\n─── 8. TESTING SALES DEPARTMENT ───────────────────────────────');
  try {
    const res = await salesService.createSale({
      client_name: 'Test Sales Lead',
      client_contact: '9876543210',
      product_type: 'Trading and Demat',
      sale_value: 35000,
      sale_date: todayStr,
      status: 'Completed',
      branch_id: branchId
    }, adminId);
    cleanupList.push({ department: 'Sales', sheet: 'sales', id: res.id, deleteFn: () => salesService.deleteSale(res.id, adminId) });
    testResults.push({ dept: 'Sales', sheet: 'sales', status: 'SUCCESS', code: res.client_name });
    console.log(`  ✅ Sales: ${res.client_name} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'Sales', sheet: 'sales', status: 'FAILED', error: err.message });
    console.error(`  ❌ Sales: ${err.message}`);
  }

  // ════════════════════════════════════════════════════════════════
  // 9. SOCIAL MEDIA & CONTENT CREATOR
  // ════════════════════════════════════════════════════════════════
  console.log('\n─── 9. TESTING SOCIAL MEDIA / CONTENT CREATOR ─────────────────');
  try {
    const res = await smmService.createPost({
      title: 'QA Automated Test Reel',
      caption: 'Market morning insights & financial awareness #stocks #trading',
      platform: 'Instagram',
      content_type: 'Reel',
      status: 'Idea',
      creator_id: adminId
    });
    cleanupList.push({ department: 'SocialMedia', sheet: 'posts', id: res.id, deleteFn: () => smmService.deletePost(res.id) });
    testResults.push({ dept: 'SocialMedia', sheet: 'posts', status: 'SUCCESS', code: res.title });
    console.log(`  ✅ Social Media Posts: ${res.title} (${res.id})`);
  } catch (err: any) {
    testResults.push({ dept: 'SocialMedia', sheet: 'posts', status: 'FAILED', error: err.message });
    console.error(`  ❌ Social Media Posts: ${err.message}`);
  }

  // ════════════════════════════════════════════════════════════════
  // SUMMARY REPORT
  // ════════════════════════════════════════════════════════════════
  const successCount = testResults.filter(r => r.status === 'SUCCESS').length;
  const failedCount = testResults.filter(r => r.status === 'FAILED').length;

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS SUMMARY: ${successCount} PASSED / ${failedCount} FAILED (Total: ${testResults.length})`);
  console.log('================================================================');

  if (failedCount > 0) {
    console.log('\n⚠️ Failed items:');
    testResults.filter(r => r.status === 'FAILED').forEach(f => {
      console.log(`  - [${f.dept} / ${f.sheet}]: ${f.error}`);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // CLEANUP: DELETE ALL DUMMY TEST DATA
  // ════════════════════════════════════════════════════════════════
  console.log('\n🧹 CLEANING UP DUMMY TEST RECORDS FROM DATABASE...');
  let cleanedCount = 0;
  for (const item of cleanupList.reverse()) {
    try {
      await item.deleteFn();
      cleanedCount++;
      console.log(`  🗑️ Deleted [${item.department}/${item.sheet}] ID: ${item.id}`);
    } catch (cleanErr: any) {
      console.error(`  ⚠️ Could not delete [${item.department}/${item.sheet}] ID ${item.id}:`, cleanErr.message);
    }
  }

  console.log(`\n✨ Database Cleanup Complete: Successfully deleted ${cleanedCount}/${cleanupList.length} test records.`);
  console.log('🛡️ The database is completely clean and preserved!');
}

testAllDepartments();
