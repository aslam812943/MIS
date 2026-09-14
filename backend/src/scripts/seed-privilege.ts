import { supabaseAdmin } from '../config/supabase.js';

async function seedPrivilege() {
  const client = supabaseAdmin;
  if (!client) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to seed the database.');
    return;
  }

  console.log('🏁 Starting Privilege Account seeding...');

  // 1. Get or Create Privilege Account Department
  let deptId: string;
  const { data: dept, error: deptError } = await client
    .from('departments')
    .select('*')
    .ilike('name', 'Privilege Account')
    .maybeSingle();

  if (deptError) {
    console.error('Error fetching department:', deptError.message);
    return;
  }

  if (dept) {
    console.log(`✅ Privilege Account Department exists: ${dept.id}`);
    deptId = dept.id;
  } else {
    console.log('Creating Privilege Account Department...');
    const { data: newDept, error: insertDeptError } = await client
      .from('departments')
      .insert({ name: 'Privilege Account' })
      .select()
      .single();

    if (insertDeptError) {
      console.error('Error creating department:', insertDeptError.message);
      return;
    }
    console.log(`✅ Success! Created Privilege Account Department: ${newDept.id}`);
    deptId = newDept.id;
  }

  // 2. Get default branch
  let branchId: string | null = null;
  const { data: branch } = await client
    .from('branches')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (branch) {
    branchId = branch.id;
  }

  // Helper function to seed user in Auth & Profiles
  const getOrCreateUser = async (email: string, fullName: string, role: string) => {
    let userId: string;

    const { data: userList } = await client.auth.admin.listUsers();
    const existingAuthUser = userList?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      console.log(`✅ Auth user exists: ${email} (${userId})`);
      // Update password to ensure it's known
      await client.auth.admin.updateUserById(userId, {
        password: 'password123',
        email_confirm: true
      });
    } else {
      console.log(`Creating auth user: ${email}...`);
      const { data: authUser, error: authCreateError } = await client.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true
      });

      if (authCreateError) {
        throw new Error(`Failed to create auth user: ${authCreateError.message}`);
      }
      userId = authUser.user.id;
      console.log(`✅ Created auth user: ${email} (${userId})`);
    }

    // Upsert Profile
    const { error: profileError } = await client
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name: fullName,
        role,
        department_id: deptId,
        branch_id: branchId,
        status: 'active'
      }, { onConflict: 'id' });

    if (profileError) {
      console.error(`Error upserting profile for ${email}:`, profileError.message);
    } else {
      console.log(`✅ Profile configured for ${email} as ${role}`);
    }

    return userId;
  };

  // 3. Seed HOD User
  await getOrCreateUser('privilege.hod@gmail.com', 'Privilege HOD', 'hod');

  // 4. Seed Employee User
  await getOrCreateUser('privilege.employee@gmail.com', 'Privilege Executive', 'employee');

  // 5. Seed sample privilege accounts
  const sampleAccounts = [
    { sl_no: 1, code: 'PA1001', name: 'Aarav Sharma', account_date: '2026-09-02', mobile_no: '9876501001', scheme: 'Privilege Plus', introducer: 'Direct', rm: 'Rahul Menon', dealer: 'Neha Patil', branch: 'Mumbai Central', trading_started: true, remarks: 'Active priority client', location: 'Mumbai', occupation: 'Business owner', contact: '9876501001', aum: 8500000, utilised: 6200000, returns: 12.4, stocks: 'HDFCBANK, RELIANCE', branch_id: branchId },
    { sl_no: 2, code: 'PA1002', name: 'Diya Nair', account_date: '2026-09-06', mobile_no: '9876501002', scheme: 'Privilege Elite', introducer: 'Anil Kumar', rm: 'Meera Shah', dealer: 'Karan Joshi', branch: 'Bengaluru', trading_started: true, remarks: 'Monthly review completed', location: 'Bengaluru', occupation: 'Technology consultant', contact: '9876501002', aum: 6500000, utilised: 4100000, returns: 9.8, stocks: 'TCS, INFY', branch_id: branchId },
    { sl_no: 3, code: 'PA1003', name: 'Kabir Patel', account_date: '2026-09-11', mobile_no: '9876501003', scheme: 'Privilege Select', introducer: 'Direct', rm: 'Rahul Menon', dealer: 'Sneha Rao', branch: 'Ahmedabad', trading_started: false, remarks: 'Trading activation pending', location: 'Ahmedabad', occupation: 'Entrepreneur', contact: '9876501003', aum: 12000000, utilised: 7500000, returns: 14.2, stocks: 'ICICIBANK, LT', branch_id: branchId }
  ];

  try {
    await client.from('privilege_accounts').delete().in('code', ['PA1001', 'PA1002', 'PA1003', 'PA1004', 'PA1005', 'PA1006']);
    const { error: seedError } = await client
      .from('privilege_accounts')
      .upsert(sampleAccounts, { onConflict: 'code' });

    if (seedError) {
      console.warn('Note on seeding privilege_accounts:', seedError.message);
    } else {
      console.log('✅ Seeded sample privilege accounts into database.');
    }
  } catch (e: any) {
    console.warn('Could not insert sample accounts:', e.message);
  }

  console.log('\n🎉 Privilege Account seeding completed successfully!');
}

seedPrivilege().catch(console.error);
