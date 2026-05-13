import { supabase } from '../config/supabase.js';

async function seedAdmin() {
  const manualId = process.argv[2];
  const email = 'admin@mis.com'; // Change this if you used a different email

  if (!manualId) {
    console.log('Usage: npx tsx src/scripts/seed-admin.ts <USER_ID>');
    console.log('Please provide the User ID from your Supabase Auth dashboard.');
    return;
  }

  console.log(`Setting admin role for User ID: ${manualId}`);

  // Update/Insert into profiles table with admin role
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: manualId,
      email: email,
      role: 'admin',
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('Error updating profile role:', profileError.message);
  } else {
    console.log('✅ Success! Admin role assigned.');
    console.log(`You can now log in with the email you used in the dashboard.`);
  }
}

seedAdmin();
