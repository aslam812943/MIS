import { supabase } from '../config/supabase.js';
import { RAService } from '../services/RAService.js';

async function runVerification() {
  console.log('=====================================================');
  console.log('🧪 STARTING COMPREHENSIVE RA DEPARTMENT VERIFICATION');
  console.log('=====================================================\n');

  // Find an RA user profile
  const { data: userProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, role, department_id, branch_id')
    .or('email.eq.ra@mis.com,email.eq.rahod@mis.com,role.eq.admin')
    .limit(1)
    .single();

  if (profileErr || !userProfile) {
    throw new Error(`Failed to find active test profile: ${profileErr?.message}`);
  }

  console.log(`👤 Using test profile: ${userProfile.email} (Role: ${userProfile.role}, ID: ${userProfile.id})\n`);
  const userId = userProfile.id;
  const branchId = userProfile.branch_id;

  const raService = new RAService();

  // 1. Test fetching stats
  console.log('Step 1: Testing getDashboardStats()...');
  const stats = await raService.getDashboardStats(userId, branchId);
  console.log('✅ getDashboardStats() succeeded! Summary:', {
    totalClients: stats.totalClients,
    active: stats.active,
    expiring: stats.expiring,
    expired: stats.expired,
    totalRevenue: stats.totalRevenue,
    thisMonthRevenue: stats.thisMonthRevenue,
    kycSummary: stats.kycSummary
  });

  // 2. Test fetching packages
  console.log('\nStep 2: Testing getPackages()...');
  const packages = await raService.getPackages(userId);
  console.log(`✅ Found ${packages.length} packages in catalog.`);

  // 3. Test creating a test client
  console.log('\nStep 3: Testing createClient()...');
  const testClient = await raService.createClient({
    client_name: 'Verification Test Client',
    package: packages.length > 0 ? packages[0].name : 'Diamond Equity Portfolio',
    amount: 50000,
    payment_date: '2026-09-12',
    mobile_number: '+91 99999 11111',
    research_date: '2026-09-12',
    email_id: 'verification.test@example.com',
    pan: 'TESTP1234A',
    aadhaar_no: '123456789012',
    kra_updation_status: 'In Progress',
    ckyc_number: 'CKYCTEST123',
    subscription_start_date: '2026-09-12',
    subscription_end_date: '2026-12-12',
    branch_id: branchId,
    remarks: 'Automated verification test client'
  }, userId);
  console.log('✅ Created test client with ID:', testClient.id);

  // 4. Test updating the client (KYC / KRA update)
  console.log('\nStep 4: Testing updateClient()...');
  const updatedClient = await raService.updateClient(testClient.id, {
    kra_updation_status: 'Completed',
    kyc_fetch_date: '2026-09-12',
    remarks: 'KYC & KRA verified successfully'
  }, userId);
  console.log('✅ Updated test client status:', updatedClient.kra_updation_status);

  // 5. Test creating a testimonial
  console.log('\nStep 5: Testing createTestimonial()...');
  const testTestimonial = await raService.createTestimonial({
    client_id: testClient.id,
    client_name: 'Verification Test Client',
    rating: 5,
    feedback_text: 'Excellent automated verification feedback!',
    testimonial_date: '2026-09-12',
    package_name: packages.length > 0 ? packages[0].name : 'Diamond Equity Portfolio',
    is_featured: true,
    is_verified: true,
    branch_id: branchId
  }, userId);
  console.log('✅ Created testimonial with ID:', testTestimonial.id);

  // 6. Test Periodic Report Generation
  console.log('\nStep 6: Testing getPeriodicReport()...');
  const report = await raService.getPeriodicReport(userId, '2026-01-01', '2026-12-31', branchId);
  console.log('✅ Generated periodic report successfully! Summary:', {
    totalRevenue: report.summary.totalRevenue,
    totalClientsAcquired: report.summary.totalClientsAcquired,
    activeSubscriptions: report.summary.activeSubscriptions,
    packagesCount: Object.keys(report.packageBreakdown).length
  });

  // 7. Cleanup verification test entity
  console.log('\nStep 7: Cleaning up temporary verification records...');
  await raService.deleteTestimonial(testTestimonial.id, userId);
  await raService.deleteClient(testClient.id, userId);
  console.log('✅ Temporary verification records cleaned up.');

  console.log('\n=====================================================');
  console.log('🎉 ALL RA DEPARTMENT SERVICES VERIFIED 100% PERFECT!');
  console.log('=====================================================\n');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
