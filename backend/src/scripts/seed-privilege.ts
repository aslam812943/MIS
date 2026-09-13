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
    { code: 'PA1001', name: 'Arjun Mehta', location: 'Mumbai', occupation: 'Business owner', contact: '9876543210', aum: 8500000.00, utilised: 6300000.00, returns: 12.80, stocks: 'HDFCBANK, RELIANCE, INFY', branch_id: branchId },
    { code: 'PA1002', name: 'Priya Nair', location: 'Bengaluru', occupation: 'Technology', contact: '9876543211', aum: 6500000.00, utilised: 4800000.00, returns: 9.40, stocks: 'TCS, INFY', branch_id: branchId },
    { code: 'PA1003', name: 'Rohan Shah', location: 'Mumbai', occupation: 'Consultant', contact: '9876543212', aum: 12000000.00, utilised: 9600000.00, returns: 15.20, stocks: 'RELIANCE, ICICIBANK', branch_id: branchId },
    { code: 'PA1004', name: 'Ananya Iyer', location: 'Chennai', occupation: 'Doctor', contact: '9876543213', aum: 4500000.00, utilised: 2700000.00, returns: 7.60, stocks: 'SUNPHARMA, ITC', branch_id: branchId },
    { code: 'PA1005', name: 'Vikram Kapoor', location: 'Delhi', occupation: 'Business owner', contact: '9876543214', aum: 9500000.00, utilised: 7100000.00, returns: -2.10, stocks: 'LT, TATAMOTORS', branch_id: branchId },
    { code: 'PA1006', name: 'Neha Desai', location: 'Pune', occupation: 'Architect', contact: '9876543215', aum: 5500000.00, utilised: 3800000.00, returns: 11.30, stocks: 'HDFCBANK, TCS', branch_id: branchId }
  ];

  try {
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
