import { supabaseAdmin as db } from '../src/config/supabase.js';
import { FranchiseService } from '../src/services/FranchiseService.js';
import assert from 'node:assert/strict';

async function runE2ETest() {
  console.log('--- Starting Franchise E2E Integration Test ---');
  if (!db) throw new Error('Supabase database client is required');

  const adminProfile = await db.from('profiles').select('id,role').eq('role', 'admin').eq('status', 'active').limit(1).single();
  if (adminProfile.error || !adminProfile.data) {
    throw new Error('Admin profile not found: ' + adminProfile.error?.message);
  }
  const adminId = adminProfile.data.id;
  console.log('Using Admin User ID:', adminId);

  const service = new FranchiseService(db);
  const access = await service.access(adminId);
  console.log('Access verified:', { canManage: access.canManage, canCreatePlans: access.canCreatePlans, canWrite: access.canWrite });

  // 1. Test Bootstrap
  const bootstrap = await service.bootstrap(access);
  console.log('Bootstrap loaded. Total franchises:', bootstrap.directory.length, 'Plans count:', bootstrap.plans.length);
  assert.ok(bootstrap.plans.length >= 3, 'Expected at least Starter, Growth, Premier plans');
  assert.equal(bootstrap.products.length, 9, 'Expected 9 products');

  // 2. Test Create Plan
  const planName = `Enterprise-${Date.now()}`;
  const newPlan = await service.createPlan(access, { name: planName, description: 'Test enterprise plan' });
  console.log('Plan created successfully:', newPlan.name);
  assert.equal(newPlan.name, planName);

  // 3. Test Register Franchise
  const testEmail = `test-aarav-${Date.now()}@example.com`;
  const regResult = await service.register(access, {
    location: 'Mumbai',
    name: 'Aarav Shah',
    phone: '+919876543210',
    email: testEmail,
    plan: 'Premier',
    office: 'Yes',
    sqft: '750',
    registered: '2026-03-04',
    sales: ['Trading & demat account', 'Mutual fund', 'Course']
  });

  console.log('Franchise created successfully:', regResult.franchise.name, 'Email Sent:', regResult.emailSent);
  assert.equal(regResult.franchise.location, 'Mumbai');
  assert.equal(regResult.franchise.office, 'Yes');
  assert.equal(regResult.franchise.sqft, '750');
  assert.equal(regResult.franchise.sales.length, 3);

  const franchiseId = regResult.franchise.id;

  // 4. Verify Overview & Products Summary
  const overview = await service.getOverview(access);
  console.log('Overview KPIs:', overview.kpis);
  assert.ok(overview.kpis.totalFranchises >= 1);
  assert.ok(overview.kpis.withOffice >= 1);
  assert.ok(overview.kpis.productsSold >= 3);

  const productsSummary = await service.getProductsSummary(access);
  console.log('Products Summary Count:', productsSummary.summary.length);
  const tradingDemat = productsSummary.summary.find(p => p.product === 'Trading & demat account');
  assert.ok(tradingDemat && tradingDemat.sold >= 1, 'Trading & demat account should have at least 1 sale');

  // 5. Test Update Franchise
  const updated = await service.updateFranchise(access, franchiseId, {
    location: 'Mumbai Central',
    name: 'Aarav Shah',
    phone: '+919876543210',
    email: testEmail,
    plan: 'Premier',
    office: 'Yes',
    sqft: '850',
    registered: '2026-03-04',
    sales: ['Trading & demat account', 'Mutual fund', 'Course', 'IEPF']
  });
  console.log('Franchise updated:', updated.location, updated.sqft, 'Sales count:', updated.sales.length);
  assert.equal(updated.location, 'Mumbai Central');
  assert.equal(updated.sqft, '850');
  assert.equal(updated.sales.length, 4);

  // 6. Test Delete Franchise
  const delResult = await service.deleteFranchise(access, franchiseId);
  console.log('Franchise delete result:', delResult);

  // Clean up test plan
  await db.from('franchise_plans').delete().eq('id', newPlan.id);
  console.log('Cleaned up test plan.');

  // Clean up test auth user if created
  const users = await db.auth.admin.listUsers();
  const testUser = users.data?.users?.find(u => u.email?.toLowerCase() === testEmail.toLowerCase());
  if (testUser) {
    await db.auth.admin.deleteUser(testUser.id);
    await db.from('profiles').delete().eq('id', testUser.id);
    console.log('Cleaned up test auth user.');
  }

  console.log('--- ALL FRANCHISE E2E INTEGRATION TESTS PASSED ---');
}

runE2ETest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
