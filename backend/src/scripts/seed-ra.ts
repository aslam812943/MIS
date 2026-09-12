import { supabaseAdmin } from '../config/supabase.js';

async function seedRA() {
  const client = supabaseAdmin;
  if (!client) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to seed the database.');
    return;
  }

  console.log('🏁 Starting RA (Research Analyst) seeding...');

  // 1. Get or Create RA Department
  let deptId: string;
  const { data: dept, error: deptError } = await client
    .from('departments')
    .select('*')
    .eq('name', 'RA')
    .maybeSingle();

  if (deptError) {
    console.error('Error fetching department:', deptError.message);
    return;
  }

  if (dept) {
    console.log(`✅ RA Department already exists: ${dept.id}`);
    deptId = dept.id;
  } else {
    console.log('Creating RA Department...');
    const { data: newDept, error: insertDeptError } = await client
      .from('departments')
      .insert({ name: 'RA' })
      .select()
      .single();

    if (insertDeptError) {
      console.error('Error creating department:', insertDeptError.message);
      return;
    }
    console.log(`✅ Success! Created RA Department: ${newDept.id}`);
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
    console.log('No branches found. Creating default Mumbai Head Office...');
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
          employee_id: `RA-${Math.floor(1000 + Math.random() * 9000)}`
        });
      console.log(`✅ Success! Created user profile for: ${email}`);
    }
    return userId;
  };

  try {
    const employeeId = await getOrCreateUser('ra@mis.com', 'RA Analyst (Executive)', 'employee');
    const hodId = await getOrCreateUser('rahod@mis.com', 'RA Department Head (HOD)', 'hod');

    console.log('\n--- Seeding Dynamic Packages ---');
    const defaultPackages = [
      {
        name: 'Diamond Equity Portfolio',
        description: 'Long term high conviction equity advisory with disciplined rebalancing',
        segment: 'Equity',
        price: 50000,
        duration_days: 90,
        is_active: true,
        created_by: hodId
      },
      {
        name: 'Platinum Momentum Pro',
        description: 'High alpha momentum equity swing trading recommendations',
        segment: 'Equity',
        price: 35000,
        duration_days: 90,
        is_active: true,
        created_by: hodId
      },
      {
        name: 'Options & Futures Alpha',
        description: 'Index and stock options strategies with strict risk-to-reward hedging',
        segment: 'Futures & Options',
        price: 25000,
        duration_days: 30,
        is_active: true,
        created_by: hodId
      },
      {
        name: 'Gold Commodity Specialist',
        description: 'Bullion and crude oil swing trading advisory signals',
        segment: 'Commodity',
        price: 20000,
        duration_days: 30,
        is_active: true,
        created_by: hodId
      },
      {
        name: 'HNI Wealth Advisory Multi-Cap',
        description: 'Exclusive bespoke multi-asset allocation for high net-worth investors',
        segment: 'HNI Alpha',
        price: 100000,
        duration_days: 365,
        is_active: true,
        created_by: hodId
      }
    ];

    for (const p of defaultPackages) {
      try {
        const { data: existingPkg } = await client
          .from('ra_packages')
          .select('id')
          .eq('name', p.name)
          .maybeSingle();

        if (!existingPkg) {
          await client.from('ra_packages').insert(p);
          console.log(`✅ Seeded Package: ${p.name}`);
        }
      } catch (pkgErr: any) {
        console.warn(`Package seeding note: ${pkgErr.message}`);
      }
    }

    console.log('\n--- Seeding Sample Clients ---');
    const sampleClients: any[] = [
      {
        client_name: 'Rajesh Sharma',
        package: 'Diamond Equity Portfolio',
        amount: 50000,
        payment_date: new Date().toISOString().split('T')[0],
        mobile_number: '+91 98765 43210',
        research_date: new Date().toISOString().split('T')[0],
        email_id: 'rajesh.sharma@example.com',
        pan: 'ABCPS1234F',
        aadhaar_no: '876543210987',
        kra_updation_status: 'Completed',
        ckyc_number: 'CKYC987654321',
        subscription_start_date: new Date().toISOString().split('T')[0],
        subscription_end_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        branch_id: branchId,
        created_by: employeeId,
        remarks: 'High net worth client, preferred large cap advisory.'
      },
      {
        client_name: 'Pooja Verma',
        package: 'Platinum Momentum Pro',
        amount: 35000,
        payment_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        mobile_number: '+91 98123 45678',
        research_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        email_id: 'pooja.verma@example.com',
        pan: 'XYZPV5678K',
        aadhaar_no: null,
        kra_updation_status: 'Completed',
        ckyc_number: null,
        subscription_start_date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
        subscription_end_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        branch_id: branchId,
        created_by: employeeId,
        remarks: 'Renewal due next week.'
      },
      {
        client_name: 'Amit Patel',
        package: 'Options & Futures Alpha',
        amount: 25000,
        payment_date: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0],
        mobile_number: '+91 97234 56789',
        research_date: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0],
        email_id: 'amit.patel@example.com',
        pan: 'QWERT9012M',
        aadhaar_no: null,
        kra_updation_status: 'In Progress',
        ckyc_number: null,
        subscription_start_date: new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0],
        subscription_end_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        branch_id: branchId,
        created_by: employeeId,
        remarks: 'Subscription expired. Follow up for renewal.'
      }
    ];

    for (const c of sampleClients) {
      const { data: existing } = await client
        .from('ra_clients')
        .select('id')
        .eq('email_id', c.email_id)
        .maybeSingle();

      let clientId = existing?.id;
      if (!existing) {
        const { data: inserted, error: insertError } = await client
          .from('ra_clients')
          .insert(c)
          .select('id')
          .single();
        if (!insertError && inserted) {
          clientId = inserted.id;
          console.log(`✅ Seeded Client: ${c.client_name}`);
        }
      }

      if (clientId && c.client_name === 'Rajesh Sharma') {
        const { data: existingTestimonial } = await client
          .from('ra_testimonials')
          .select('id')
          .eq('client_id', clientId)
          .maybeSingle();

        if (!existingTestimonial) {
          await client.from('ra_testimonials').insert({
            client_id: clientId,
            client_name: c.client_name,
            rating: 5,
            feedback_text: 'Outstanding research quality and disciplined risk management. Reaped 28% alpha in 3 months!',
            testimonial_date: new Date().toISOString().split('T')[0],
            package_name: c.package,
            is_featured: true,
            is_verified: true,
            branch_id: branchId,
            created_by: employeeId
          });
          console.log(`✅ Seeded Testimonial for ${c.client_name}`);
        }
      }
    }

    console.log('\n🎉 RA Department Seeding Complete!');
    console.log('----------------------------------------------------');
    console.log('📌 RA Employee Login:');
    console.log('   Email:    ra@mis.com');
    console.log('   Password: password123');
    console.log('   Role:     employee (Department: RA)');
    console.log('----------------------------------------------------');
    console.log('📌 RA HOD (Head of Department) Login:');
    console.log('   Email:    rahod@mis.com');
    console.log('   Password: password123');
    console.log('   Role:     hod (Department: RA)');
    console.log('----------------------------------------------------');
  } catch (err: any) {
    console.error('❌ Seeding failed:', err.message);
  }
}

seedRA();
