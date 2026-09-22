import { supabaseAdmin } from '../src/config/supabase.js';

async function main() {
  if (!supabaseAdmin) {
    console.error('No supabaseAdmin');
    return;
  }
  const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
  console.log('AUTH USERS count:', users?.users?.length, 'error:', userError);
  console.log('AUTH USERS:', users?.users?.map(u => ({ id: u.id, email: u.email })));

  const { data: profiles, error: profError } = await supabaseAdmin.from('profiles').select('*');
  console.log('PROFILES count:', profiles?.length, 'error:', profError);
  console.log('PROFILES:', profiles?.map(p => ({ id: p.id, email: p.email, login_username: p.login_username, role: p.role, status: p.status })));
}

main().catch(console.error);
