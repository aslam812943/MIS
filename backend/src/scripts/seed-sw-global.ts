import { supabaseAdmin } from '../config/supabase.js';

async function seedSWGlobal() {
  const client = supabaseAdmin;
  if (!client) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to seed users.');
    return;
  }

  console.log('🏁 Starting SW Global users seeding...');

  // 1. Get or Create SW Global Department
  let deptId: string;
  const { data: dept, error: deptError } = await client
    .from('departments')
    .select('*')
    .ilike('name', 'SW Global')
    .maybeSingle();

  if (deptError) {
    console.error('Error fetching department:', deptError.message);
    return;
  }

  if (dept) {
    console.log(`✅ SW Global Department already exists: ${dept.id}`);
    deptId = dept.id;
  } else {
    console.log('Creating SW Global Department...');
    const { data: newDept, error: insertDeptError } = await client
      .from('departments')
      .insert({ name: 'SW Global' })
      .select()
      .single();

    if (insertDeptError) {
      console.error('Error creating department:', insertDeptError.message);
      return;
    }
    console.log(`✅ Success! Created SW Global Department: ${newDept.id}`);
    deptId = newDept.id;
  }

  // 2. Get default branch
  let branchId: string;
  const { data: branch, error: branchError } = await client
    .from('branches')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (branchError) {
    console.error('Error fetching branches:', branchError.message);
    return;
  }

  if (branch) {
    console.log(`✅ Using branch: ${branch.name} (${branch.id})`);
    branchId = branch.id;
  } else {
    console.log('Creating default branch...');
    const { data: newBranch, error: insertBranchError } = await client
      .from('branches')
      .insert({ name: 'Head Office' })
      .select()
      .single();

    if (insertBranchError) {
      console.error('Error creating branch:', insertBranchError.message);
      return;
    }
    branchId = newBranch.id;
  }

  // Helper function to seed user in Supabase Auth & Profiles
  const getOrCreateUser = async (email: string, fullName: string, role: string, password = 'password123') => {
    let userId: string;
    const { data: profile, error: profileFetchError } = await client
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (profileFetchError) {
      throw new Error(`Error fetching profile: ${profileFetchError.message}`);
    }

    if (profile) {
      console.log(`✅ User profile already exists: ${email} (${profile.id})`);
      userId = profile.id;

      // Update password in Supabase Auth
      try {
        await client.auth.admin.updateUserById(userId, { password });
      } catch (err) {
        console.warn('Could not update auth password:', err);
      }

      // Update role & department
      await client
        .from('profiles')
        .update({
          role,
          department_id: deptId,
          branch_id: branchId,
          full_name: fullName,
          status: 'active'
        })
        .eq('id', userId);
    } else {
      console.log(`Creating user in Supabase Auth: ${email}...`);
      const { data: authUser, error: authCreateError } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authCreateError) {
        if (authCreateError.message.includes('already registered') || authCreateError.message.includes('already exists')) {
          const { data: userList } = await client.auth.admin.listUsers();
          const existingAuthUser = userList?.users.find(u => u.email === email);
          if (existingAuthUser) {
            userId = existingAuthUser.id;
            await client.auth.admin.updateUserById(userId, { password });
          } else {
            throw new Error(`Failed to create or retrieve user ID: ${authCreateError.message}`);
          }
        } else {
          throw new Error(`Failed to create auth user: ${authCreateError.message}`);
        }
      } else {
        userId = authUser.user.id;
      }

      await client
        .from('profiles')
        .upsert({
          id: userId,
          email,
          role,
          full_name: fullName,
          branch_id: branchId,
          department_id: deptId,
          status: 'active',
          employee_id: `EMP-${Math.floor(10000 + Math.random() * 90000)}`
        });
      console.log(`✅ Success! Created user profile for: ${email}`);
    }
  };

  try {
    // 1. SW Global HOD Users
    await getOrCreateUser('swhod@gmail.com', 'SW Global HOD', 'hod', 'password123');
    await getOrCreateUser('swhod@mis.com', 'SW Global HOD', 'hod', 'password123');

    // 2. SW Global Employee / Executive Users
    await getOrCreateUser('sw@gmail.com', 'SW Global Executive', 'employee', 'password123');
    await getOrCreateUser('sw@mis.com', 'SW Global Executive', 'employee', 'password123');

    console.log('🎉 Seeding SW Global MIS users completed successfully!');
  } catch (err: any) {
    console.error('❌ Seeding failed:', err.message);
  }
}

seedSWGlobal();
