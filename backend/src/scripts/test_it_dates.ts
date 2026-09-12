import { supabaseAdmin } from '../config/supabase.js';
import { ITService } from '../services/ITService.js';

async function testITWithDates() {
  const { data: adminUser } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();

  const it = new ITService();

  console.log('--- Testing without dates ---');
  try {
    const s1 = await it.getDashboardStats(adminUser.id);
    console.log('✅ s1 (no dates) passed');
  } catch (e: any) {
    console.error('❌ s1 error:', e.message);
  }

  console.log('--- Testing WITH startDate and endDate ---');
  try {
    const s2 = await it.getDashboardStats(adminUser.id, undefined, '2026-09-01', '2026-09-30');
    console.log('✅ s2 (with dates) passed');
  } catch (e: any) {
    console.error('❌ s2 error:', e.message);
  }
}

testITWithDates().catch(console.error);
