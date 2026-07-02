import { supabaseAdmin } from '../config/supabase.js';

async function seedSettlements() {
  if (!supabaseAdmin) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to seed the database.');
    return;
  }

  console.log('🏁 Starting settlements seeding...');

  // 1. Get or Create Settlements Department
  let deptId: string;
  const { data: dept, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('name', 'Settlements')
    .maybeSingle();

  if (deptError) {
    console.error('Error fetching department:', deptError.message);
    return;
  }

  if (dept) {
    console.log(`✅ Settlements Department already exists: ${dept.id}`);
    deptId = dept.id;
  } else {
    console.log('Creating Settlements Department...');
    const { data: newDept, error: insertDeptError } = await supabaseAdmin
      .from('departments')
      .insert({ name: 'Settlements' })
      .select()
      .single();

    if (insertDeptError) {
      console.error('Error creating department:', insertDeptError.message);
      return;
    }
    console.log(`✅ Success! Created Settlements Department: ${newDept.id}`);
    deptId = newDept.id;
  }

  // 2. Get or Create Mumbai Branch
  let branchId: string;
  const { data: branch, error: branchError } = await supabaseAdmin
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
    const { data: newBranch, error: insertBranchError } = await supabaseAdmin
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

  // 3. Create settlements employee in Supabase Auth & profiles table
  const email = 'settlements@mis.com';
  const password = 'password123';
  let userId: string;

  const { data: profile, error: profileFetchError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (profileFetchError) {
    console.error('Error fetching user profile:', profileFetchError.message);
    return;
  }

  if (profile) {
    console.log(`✅ Settlements employee profile already exists: ${profile.id}`);
    userId = profile.id;

    // Make sure role and department are set correctly
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'employee',
        department_id: deptId,
        branch_id: branchId,
        full_name: 'Settlements Executive'
      })
      .eq('id', userId);

    if (updateProfileError) {
      console.error('Error updating existing profile:', updateProfileError.message);
      return;
    }
  } else {
    console.log(`Creating settlements user in Supabase Auth: ${email}...`);
    const { data: authUser, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authCreateError) {
      if (authCreateError.message.includes('already registered') || authCreateError.message.includes('already exists')) {
        console.warn('⚠️ User already exists in Auth metadata. Please check authentication.');
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = userList?.users.find(u => u.email === email);
        if (existingAuthUser) {
          userId = existingAuthUser.id;
          console.log(`Found Auth User ID: ${userId}`);
        } else {
          console.error('Failed to create or retrieve user ID:', authCreateError.message);
          return;
        }
      } else {
        console.error('Failed to create auth user:', authCreateError.message);
        return;
      }
    } else {
      userId = authUser.user.id;
      console.log(`✅ Success! Created Auth User with ID: ${userId}`);
    }

    // Insert into profiles table
    console.log('Upserting user profile...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        role: 'employee',
        full_name: 'Settlements Executive',
        branch_id: branchId,
        department_id: deptId,
        status: 'active',
        employee_id: 'SET-90812'
      });

    if (profileError) {
      console.error('Error creating profile entry:', profileError.message);
      return;
    }
    console.log('✅ Success! Profile details updated.');
  }

  // 4. Seed pay-in/pay-out default rows to test Part 1
  console.log('Seeding initial Pay-in / Pay-out securities data rows...');
  await supabaseAdmin.from('settlement_payin_payout').delete().eq('created_by', userId);

  const today = new Date().toISOString().split('T')[0];

  const payinPayoutMockData = [
    {
      settlement_date: today,
      client_id: 'CLIENT-10023',
      client_name: 'Rohan Sharma',
      stock_symbol: 'RELIANCE',
      buy_sell: 'Buy',
      quantity: 1200,
      shortage_qty: 0,
      status: 'Completed',
      branch_id: branchId,
      created_by: userId
    },
    {
      settlement_date: today,
      client_id: 'CLIENT-10098',
      client_name: 'Priyal Patel',
      stock_symbol: 'TCS',
      buy_sell: 'Sell',
      quantity: 850,
      shortage_qty: 150,
      status: 'Shortage',
      branch_id: branchId,
      created_by: userId
    },
    {
      settlement_date: today,
      client_id: 'CLIENT-10254',
      client_name: 'Amit Verma',
      stock_symbol: 'INFOSYS',
      buy_sell: 'Buy',
      quantity: 500,
      shortage_qty: 0,
      status: 'Pending',
      branch_id: branchId,
      created_by: userId
    }
  ];

  const { error: seedError } = await supabaseAdmin
    .from('settlement_payin_payout')
    .insert(payinPayoutMockData);

  if (seedError) {
    console.error('Error seeding Pay-in/Pay-out data:', seedError.message);
  } else {
    console.log('✅ Success! Seeded Pay-in / Pay-out Securities rows.');
  }

  // 5. Seed client requests default rows to test Part 2
  console.log('Seeding initial Client Requests data rows...');
  await supabaseAdmin.from('settlement_client_requests').delete().eq('created_by', userId);

  const getDateDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const clientRequestsMockData = [
    {
      request_id: 'REQ-10283',
      client_name: 'Rohan Sharma',
      request_type: 'Demat Transfer',
      date_received: getDateDaysAgo(0),
      status: 'Received',
      remarks: 'Demat transfer form received; signature verification in progress.',
      branch_id: branchId,
      created_by: userId
    },
    {
      request_id: 'REQ-10352',
      client_name: 'Priyal Patel',
      request_type: 'Bank Detail Update',
      date_received: getDateDaysAgo(4), // Overdue!
      status: 'Pending',
      remarks: 'Pending client signature on bank update form. Emailed follow-up.',
      branch_id: branchId,
      created_by: userId
    },
    {
      request_id: 'REQ-10491',
      client_name: 'Amit Verma',
      request_type: 'Account Closure',
      date_received: getDateDaysAgo(2),
      status: 'In Process',
      remarks: 'Forms processed; awaiting closure confirmation from depository agent.',
      branch_id: branchId,
      created_by: userId
    }
  ];

  const { error: seedReqError } = await supabaseAdmin
    .from('settlement_client_requests')
    .insert(clientRequestsMockData);

  if (seedReqError) {
    console.error('Error seeding Client Requests data:', seedReqError.message);
  } else {
    console.log('✅ Success! Seeded Client Requests rows.');
  }

  // 6. Seed IPO Allocations default rows to test Part 3
  console.log('Seeding initial IPO Allocations data rows...');
  await supabaseAdmin.from('settlement_ipo_allocation').delete().eq('created_by', userId);

  const ipoMockData = [
    {
      application_no: 'IPO-APP-90112',
      client_id: 'CLIENT-10023',
      client_name: 'Rohan Sharma',
      ipo_name: 'Zomato IPO',
      category: 'Retail',
      applied_qty: 150,
      allotted_qty: 150, // Highlight: Green (allotted_qty === applied_qty)
      status: 'Allotted',
      branch_id: branchId,
      created_by: userId
    },
    {
      application_no: 'IPO-APP-90248',
      client_id: 'CLIENT-10098',
      client_name: 'Priyal Patel',
      ipo_name: 'Paytm IPO',
      category: 'Retail',
      applied_qty: 200,
      allotted_qty: 0, // Highlight: Red (allotted_qty === 0 && status === Refunded)
      status: 'Refunded',
      branch_id: branchId,
      created_by: userId
    },
    {
      application_no: 'IPO-APP-90516',
      client_id: 'CLIENT-10254',
      client_name: 'Amit Verma',
      ipo_name: 'LIC IPO',
      category: 'HNI',
      applied_qty: 1000,
      allotted_qty: 450, // Normal styling
      status: 'Partially Allotted',
      branch_id: branchId,
      created_by: userId
    },
    {
      application_no: 'IPO-APP-90812',
      client_id: 'CLIENT-10332',
      client_name: 'Sunil Kumar',
      ipo_name: 'Nykaa IPO',
      category: 'QIB',
      applied_qty: 5000,
      allotted_qty: 0, // Normal styling
      status: 'Applied',
      branch_id: branchId,
      created_by: userId
    }
  ];

  const { error: seedIpoError } = await supabaseAdmin
    .from('settlement_ipo_allocation')
    .insert(ipoMockData);

  if (seedIpoError) {
    console.error('Error seeding IPO Allocations data:', seedIpoError.message);
  } else {
    console.log('✅ Success! Seeded IPO Allocations rows.');
  }

  // 7. Seed Corporate Actions default rows to test Part 4
  console.log('Seeding initial Corporate Actions data rows...');
  await supabaseAdmin.from('settlement_corporate_actions').delete().eq('created_by', userId);

  const corpMockData = [
    {
      client_id: 'CLIENT-10023',
      client_name: 'Rohan Sharma',
      stock_symbol: 'TCS',
      corporate_action: 'Dividend',
      record_date: getDateDaysAgo(0),
      quantity: 500,
      eligible: 'Yes',
      entitlement_amt_qty: 1250.00, // Highlight: Green (eligible === 'Yes')
      branch_id: branchId,
      created_by: userId
    },
    {
      client_id: 'CLIENT-10098',
      client_name: 'Priyal Patel',
      stock_symbol: 'RELIANCE',
      corporate_action: 'Bonus',
      record_date: getDateDaysAgo(2),
      quantity: 100,
      eligible: 'No',
      entitlement_amt_qty: 0, // Highlight: Red (eligible === 'No')
      branch_id: branchId,
      created_by: userId
    },
    {
      client_id: 'CLIENT-10254',
      client_name: 'Amit Verma',
      stock_symbol: 'INFOSYS',
      corporate_action: 'Stock Split',
      record_date: getDateDaysAgo(4),
      quantity: 300,
      eligible: 'Yes',
      entitlement_amt_qty: 600, // Highlight: Green (eligible === 'Yes')
      branch_id: branchId,
      created_by: userId
    }
  ];

  const { error: seedCorpError } = await supabaseAdmin
    .from('settlement_corporate_actions')
    .insert(corpMockData);

  if (seedCorpError) {
    console.error('Error seeding Corporate Actions data:', seedCorpError.message);
  } else {
    console.log('✅ Success! Seeded Corporate Actions rows.');
  }

  console.log('🎉 Seeding complete! Login details:\nEmail: settlements@mis.com\nPassword: password123');
}

seedSettlements();
