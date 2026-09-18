import { supabaseAdmin as db } from '../src/config/supabase.js';
import { FranchiseService } from '../src/services/FranchiseService.js';
import assert from 'node:assert/strict';

async function testPlansFeature() {
  console.log('--- Testing Plans Management & Fee Inputs ---');
  const adminProfile = await db.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const service = new FranchiseService(db);
  const access = await service.access(adminProfile.data.id);

  // 1. Create a plan with joining fee and recurring fee
  const planPayload = {
    name: `Enterprise Tier ${Date.now()}`,
    description: 'Includes full franchise software suite and premium support',
    joining_fee: 75000,
    recurring_fee: 5000,
    billing_frequency: 'Monthly',
    active: true
  };

  const createdPlan = await service.createPlan(access, planPayload);
  console.log('Created Plan:', createdPlan);
  assert.equal(createdPlan.name, planPayload.name);
  assert.equal(Number(createdPlan.joining_fee), 75000);
  assert.equal(Number(createdPlan.recurring_fee), 5000);
  assert.equal(createdPlan.billing_frequency, 'Monthly');

  // 2. Fetch all plans
  const plans = await service.getPlans(access);
  console.log('Fetched plans count:', plans.length);
  const found = plans.find((p: any) => p.id === createdPlan.id);
  assert.ok(found, 'Created plan should be in fetched plans');
  assert.equal(Number(found.joining_fee), 75000);

  // 3. Update plan
  const updatedPlan = await service.updatePlan(access, createdPlan.id, {
    name: createdPlan.name,
    description: 'Updated description',
    joining_fee: 80000,
    recurring_fee: 6000,
    billing_frequency: 'Monthly',
    active: true
  });
  console.log('Updated Plan:', updatedPlan);
  assert.equal(Number(updatedPlan.joining_fee), 80000);

  // 4. Delete plan
  const del = await service.deletePlan(access, createdPlan.id);
  console.log('Deleted Plan:', del);

  console.log('--- ALL PLAN MANAGEMENT & FEE TESTS PASSED ---');
}

testPlansFeature().catch(err => {
  console.error('Plan test failed:', err);
  process.exit(1);
});
