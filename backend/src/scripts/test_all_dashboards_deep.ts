import { supabaseAdmin } from '../config/supabase.js';
import { IEPFService } from '../services/IEPFService.js';
import { SalesService } from '../services/SalesService.js';
import { SettlementService } from '../services/SettlementService.js';
import { KYCService } from '../services/KYCService.js';
import { DPService } from '../services/DPService.js';
import { ITService } from '../services/ITService.js';
import { HRService } from '../services/HRService.js';
import { FinanceService } from '../services/FinanceService.js';
import { RAService } from '../services/RAService.js';

async function testAllControllers() {
  console.log('=====================================================');
  console.log('🔍 DEEP VERIFICATION: ALL 9 DEPARTMENT DASHBOARDS');
  console.log('=====================================================\n');

  const { data: admin } = await supabaseAdmin.from('profiles').select('id, email, role, branch_id').eq('role', 'admin').limit(1).single();
  if (!admin) throw new Error('No admin profile found');

  console.log(`Testing with Admin Profile: ${admin.email} (ID: ${admin.id})\n`);

  const tests: { name: string; fn: () => Promise<any> }[] = [
    {
      name: '1. IEPF Dashboard (/admin/iepf/dashboard)',
      fn: () => new IEPFService().getDashboardData(admin.id, admin.branch_id)
    },
    {
      name: '2. Sales Dashboard (/admin/sales/dashboard)',
      fn: () => new SalesService().getDashboardData(admin.id, admin.branch_id)
    },
    {
      name: '3. Settlements Dashboard (/admin/settlements/dashboard)',
      fn: () => new SettlementService().getDashboardStats(admin.id, admin.branch_id)
    },
    {
      name: '4. KYC Dashboard (/admin/kyc/dashboard)',
      fn: () => new KYCService().getDashboardStats(admin.id, admin.branch_id)
    },
    {
      name: '5. DP Dashboard (/admin/dp/dashboard)',
      fn: () => new DPService().getDashboardStats(admin.id, admin.branch_id)
    },
    {
      name: '6. IT Dashboard (/admin/it/dashboard)',
      fn: () => new ITService().getDashboardStats(admin.id, admin.branch_id)
    },
    {
      name: '7. HR Dashboard (/admin/hr/dashboard)',
      fn: () => new HRService().getDashboardStats()
    },
    {
      name: '8. Finance Dashboard (/admin/finance/dashboard)',
      fn: () => new FinanceService().getDashboardStats(admin.id, admin.branch_id)
    },
    {
      name: '9. RA Dashboard (/admin/ra/dashboard)',
      fn: () => new RAService().getDashboardStats(admin.id, admin.branch_id)
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      const res = await t.fn();
      console.log(`✅ ${t.name}: PASSED`);
      passed++;
    } catch (err: any) {
      console.error(`❌ ${t.name}: FAILED -> ${err.message}`);
      failed++;
    }
  }

  console.log('\n=====================================================');
  console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================\n');
}

testAllControllers().catch(console.error);
