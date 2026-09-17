// Explicitly replaces ONLY the fictional CSV Kochi sample. Refuses linked sales/finance.
import { supabaseAdmin as db } from '../src/config/supabase.js';
import { FranchiseService } from '../src/services/FranchiseService.js';
import assert from 'node:assert/strict';
import ws from 'ws';
if (!db) throw new Error('Supabase admin is required');
if (!process.argv.includes('--execute')) throw new Error('Pass --execute to replace this sample');
const check = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data; };
const email = 'kochi@example.invalid';
const existing = check(await db.from('franchises').select('*').eq('email', email));
if (existing.length !== 1 || existing[0].name !== 'Kochi Franchise') throw new Error('Expected exactly the fictional Kochi CSV sample');
const old = existing[0];
for (const table of ['sales', 'franchise_earnings', 'franchise_expenses', 'franchise_payments', 'franchise_manager_assignments']) {
  const r = await db.from(table).select('id', { count: 'exact', head: true }).eq('franchise_id', old.id);
  check(r); if (r.count) throw new Error(`Sample has linked ${table}; stopping`);
}
const memberships = check(await db.from('franchise_users').select('*').eq('franchise_id', old.id));
const users = [];
for (const m of memberships) {
  const p = check(await db.from('profiles').select('id,email,role').eq('id', m.user_id).single());
  if (!['franchise_owner', 'franchise_staff'].includes(p.role) || (p.email !== email && !p.email.endsWith('@login.invalid'))) throw new Error('Unexpected sample account; stopping');
  users.push(p);
}
const admin = check(await db.from('profiles').select('id').eq('role', 'admin').eq('status', 'active').limit(1).single());
const service = new FranchiseService(db, { sendFranchiseCredentials: async () => { throw new Error('Fictional address: no real email delivery'); } } as any);
const access = await service.access(admin.id);
check(await db.from('franchise_users').delete().eq('franchise_id', old.id));
check(await db.from('franchise_plan_assignments').delete().eq('franchise_id', old.id));
check(await db.from('franchises').delete().eq('id', old.id));
for (const p of users) {
  check(await db.auth.admin.deleteUser(p.id));
  check(await db.from('profiles').delete().eq('id', p.id));
}
const result = await service.register(access, { name: 'Kochi Franchise', owner_name: 'Arun Kumar', phone: '9876543210', email, state: 'Kerala', city: 'Kochi', area: 'Kakkanad', address: 'First floor, Main Road', postal_code: '682030', plan_name: 'Standard', has_office: true, office_sqft: 450, registered_on: new Date().toISOString().slice(0,10) });
const fresh = check(await db.from('franchise_users').select('user_id,membership_role,login_email,shared_access,status').eq('franchise_id', result.id));
assert.equal(fresh.length, 2);
for (const role of ['owner', 'staff']) {
  const member = fresh.find((m: any) => m.membership_role === role);
  assert.equal(member.login_email, email); assert.equal(member.shared_access, false);
  const auth = check(await db.auth.admin.getUserById(member.user_id));
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws as any } });
  const login = await client.auth.signInWithPassword({ email: auth.user.email!, password: role === 'owner' ? 'password123' : 'password1234' });
  if (login.error) throw new Error(`${role} password verification failed: ${login.error.message}`);
  assert.equal(login.data.user?.id, member.user_id);
  await client.auth.signOut();
  console.log(`${role}: password verified; saved-email role mapping verified`);
}
console.log('Old Kochi sample removed. New Active Kochi sample created. No mail sent to fictional address.');
