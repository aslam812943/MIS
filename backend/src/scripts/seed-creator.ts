import { supabaseAdmin } from '../config/supabase.js';

async function seedCreator() {
  const client = supabaseAdmin;
  if (!client) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to seed the database.');
    return;
  }

  console.log('🏁 Starting Creator seeding...');

  // 1. Get or Create Content Creation Department
  let deptId: string;
  const { data: dept, error: deptError } = await client
    .from('departments')
    .select('*')
    .eq('name', 'Content Creation')
    .maybeSingle();

  if (deptError) {
    console.error('Error fetching department:', deptError.message);
    return;
  }

  if (dept) {
    console.log(`✅ Content Creation Department already exists: ${dept.id}`);
    deptId = dept.id;
  } else {
    console.log('Creating Content Creation Department...');
    const { data: newDept, error: insertDeptError } = await client
      .from('departments')
      .insert({ name: 'Content Creation' })
      .select()
      .single();

    if (insertDeptError) {
      console.error('Error creating department:', insertDeptError.message);
      return;
    }
    console.log(`✅ Success! Created Content Creation Department: ${newDept.id}`);
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
    console.log(`✅ Using existing branch: ${branch.name} (${branch.id})`);
    branchId = branch.id;
  } else {
    console.log('No branches found. Creating default Mumbai Branch...');
    const { data: newBranch, error: insertBranchError } = await client
      .from('branches')
      .insert({ name: 'Mumbai Head Office' })
      .select()
      .single();

    if (insertBranchError) {
      console.error('Error creating branch:', insertBranchError.message);
      return;
    }
    console.log(`✅ Success! Created Mumbai Branch: ${newBranch.id}`);
    branchId = newBranch.id;
  }

  // Helper function to seed user in Auth & Profiles
  const getOrCreateUser = async (email: string, fullName: string, role: string) => {
    let userId: string;
    const { data: profile, error: profileFetchError } = await client
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (profileFetchError) {
      throw new Error(`Error fetching user profile: ${profileFetchError.message}`);
    }

    if (profile) {
      console.log(`✅ User profile already exists: ${email} (${profile.id})`);
      userId = profile.id;

      // Update role & department
      await client
        .from('profiles')
        .update({
          role,
          department_id: deptId,
          branch_id: branchId,
          full_name: fullName
        })
        .eq('id', userId);
    } else {
      console.log(`Creating user in Supabase Auth: ${email}...`);
      const { data: authUser, error: authCreateError } = await client.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true
      });

      if (authCreateError) {
        if (authCreateError.message.includes('already registered') || authCreateError.message.includes('already exists')) {
          const { data: userList } = await client.auth.admin.listUsers();
          const existingAuthUser = userList?.users.find(u => u.email === email);
          if (existingAuthUser) {
            userId = existingAuthUser.id;
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
    await getOrCreateUser('creator@mis.com', 'Jane Doe (Creator)', 'content_creator');
    await getOrCreateUser('creator_hod@mis.com', 'John Smith (Creator HOD)', 'hod');
    console.log('🎉 Seeding Content Creator users completed!');
  } catch (err: any) {
    console.error('❌ Seeding failed:', err.message);
  }
}

seedCreator();
