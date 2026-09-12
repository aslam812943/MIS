import { supabaseAdmin } from '../config/supabase';
import { ITService } from '../services/ITService';
import { IEPFService } from '../services/IEPFService';
import { SettlementService } from '../services/SettlementService';
import { KYCService } from '../services/KYCService';
import { DPService } from '../services/DPService';
import { FinanceService } from '../services/FinanceService';
import { SalesService } from '../services/SalesService';
import { HRService } from '../services/HRService';
import { RAService } from '../services/RAService';

async function testAllServices() {
  console.log('==============================================');
  console.log('🧪 TESTING ALL DEPARTMENT DASHBOARDS IN BACKEND');
  console.log('==============================================\n');

  const { data: adminUser } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (!adminUser) {
    throw new Error('No admin user found.');
  }

  console.log(`Using Admin User: ${adminUser.email} (${adminUser.id})\n`);

  const services: { name: string; test: () => Promise<any> }[] = [
    { name: 'IT Service', test: () => new ITService().getDashboardStats(adminUser.id) },
    { name: 'IEPF Service', test: () => new IEPFService().getDashboardStats(adminUser.id) },
    { name: 'Settlement Service', test: () => new SettlementService().getDashboardStats(adminUser.id) },
    { name: 'KYC Service', test: () => new KYCService().getDashboardStats(adminUser.id) },
    { name: 'DP Service', test: () => new DPService().getDashboardStats(adminUser.id) },
    { name: 'Finance Service', test: () => new FinanceService().getDashboardStats(adminUser.id) },
    { name: 'Sales Service', test: () => new SalesService().getDashboardStats(adminUser.id) },
    { name: 'HR Service', test: () => new HRService().getDashboardStats() },
    { name: 'RA Service', test: () => new RAService().getDashboardStats(adminUser.id) },
  ];

  for (const s of services) {
    try {
      const res = await s.test();
      console.log(`✅ [${s.name}] SUCCESS! Output keys:`, Object.keys(res || {}));
    } catch (err: any) {
      console.error(`❌ [${s.name}] FAILED:`, err.message);
    }
  }
}

testAllServices().catch(console.error);
