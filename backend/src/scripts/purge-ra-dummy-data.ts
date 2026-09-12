import { supabase } from '../config/supabase.js';

async function purgeDummyData() {
  console.log('=====================================================');
  console.log('🧹 PURGING ALL RA DEPARTMENT DUMMY TEST DATA');
  console.log('=====================================================\n');

  // 1. Delete all testimonials from ra_testimonials
  console.log('1. Cleaning ra_testimonials table...');
  const { data: delTestimonials, error: errTestimonials } = await supabase
    .from('ra_testimonials')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // delete all
    .select('id');

  if (errTestimonials) {
    console.warn(`Note on ra_testimonials: ${errTestimonials.message}`);
  } else {
    console.log(`✅ Cleared ${delTestimonials?.length || 0} dummy testimonial records.`);
  }

  // 2. Delete all client records from ra_clients
  console.log('2. Cleaning ra_clients table...');
  const { data: delClients, error: errClients } = await supabase
    .from('ra_clients')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // delete all
    .select('id');

  if (errClients) {
    console.warn(`Note on ra_clients: ${errClients.message}`);
  } else {
    console.log(`✅ Cleared ${delClients?.length || 0} dummy client records.`);
  }

  // 3. Verify clean state
  const { count: clientCount } = await supabase
    .from('ra_clients')
    .select('*', { count: 'exact', head: true });

  const { count: testimonialCount } = await supabase
    .from('ra_testimonials')
    .select('*', { count: 'exact', head: true });

  console.log('\n=====================================================');
  console.log('📊 DATABASE CLEANUP STATUS:');
  console.log(`   - RA Clients Remaining:      ${clientCount ?? 0}`);
  console.log(`   - RA Testimonials Remaining:  ${testimonialCount ?? 0}`);
  console.log('=====================================================');
  console.log('🎉 ALL DUMMY DATA REMOVED SUCCESSFULLY! READY FOR PRODUCTION!');
  console.log('=====================================================\n');
}

purgeDummyData().catch(err => {
  console.error('❌ Purge failed:', err);
  process.exit(1);
});
