import { supabaseAdmin } from '../config/supabase.js';

async function seedIEPF() {
  if (!supabaseAdmin) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to seed the database.');
    return;
  }

  console.log('Checking departments for IEPF...');

  // 1. Check if IEPF department already exists
  const { data: dept, error: fetchError } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('name', 'IEPF')
    .maybeSingle();

  if (fetchError) {
    console.error('Error querying departments:', fetchError.message);
    return;
  }

  if (dept) {
    console.log(`✅ IEPF Department already exists with ID: ${dept.id}`);
  } else {
    console.log('IEPF Department not found. Creating it...');
    
    // 2. Insert IEPF department
    const { data: newDept, error: insertError } = await supabaseAdmin
      .from('departments')
      .insert({ name: 'IEPF' })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating IEPF department:', insertError.message);
      return;
    }

    console.log(`✅ Success! Created IEPF Department with ID: ${newDept.id}`);
  }

  // List all departments for validation
  const { data: allDepts } = await supabaseAdmin.from('departments').select('id, name');
  console.log('\nCurrent Departments List:');
  console.log(allDepts);
}

seedIEPF();
