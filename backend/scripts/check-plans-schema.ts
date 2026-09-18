import { supabaseAdmin as db } from '../src/config/supabase.js';

async function checkPlans() {
  const { data, error } = await db.from('franchise_plans').select('*');
  console.log('Plans in DB:', data, 'Error:', error);
}

checkPlans();
