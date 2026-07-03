import { supabaseAdmin } from '../config/supabase.js';

async function seedKYC() {
  const client = supabaseAdmin;
  if (!client) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is required to seed the database.');
    return;
  }

  console.log('🏁 Starting KYC seeding...');

  // 1. Get or Create KYC Department
  let deptId: string;
  const { data: dept, error: deptError } = await client
    .from('departments')
    .select('*')
    .eq('name', 'KYC')
    .maybeSingle();

  if (deptError) {
    console.error('Error fetching department:', deptError.message);
    return;
  }

  if (dept) {
    console.log(`✅ KYC Department already exists: ${dept.id}`);
    deptId = dept.id;
  } else {
    console.log('Creating KYC Department...');
    const { data: newDept, error: insertDeptError } = await client
      .from('departments')
      .insert({ name: 'KYC' })
      .select()
      .single();

    if (insertDeptError) {
      console.error('Error creating department:', insertDeptError.message);
      return;
    }
    console.log(`✅ Success! Created KYC Department: ${newDept.id}`);
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
    return userId;
  };

  const employeeId = await getOrCreateUser('kyc@mis.com', 'KYC Executive', 'employee');
  const hodId = await getOrCreateUser('kychod@mis.com', 'KYC HOD', 'hod');

  const today = new Date().toISOString().split('T')[0];

  // Helper to safely delete existing mock records by created_by before inserting
  const clearTable = async (table: string, userId: string) => {
    await client.from(table).delete().eq('created_by', userId);
  };

  console.log('Seeding mock data for KYC sheets...');

  // 1. kyc_new_account
  await clearTable('kyc_new_account', employeeId);
  await client.from('kyc_new_account').insert([
    {
      applicant_name: 'Aditya Sen',
      pan: 'ABCDE1234F',
      aadhaar_number: '123456789012',
      mobile_number: '9876543210',
      email: 'aditya.sen@gmail.com',
      address: '102, Park Street, Kolkata',
      date_of_birth: '1995-04-12',
      pan_copy: true,
      aadhaar_copy: true,
      bank_proof: true,
      photograph: true,
      signature: true,
      verified_by: 'KYC HOD',
      verification_date: today,
      status: 'Verified',
      remarks: 'All documents clear and verified.',
      branch_id: branchId,
      created_by: employeeId
    },
    {
      applicant_name: 'Siddharth Roy',
      pan: 'XYZAB5678C',
      aadhaar_number: '987654321098',
      mobile_number: '9123456789',
      email: 'siddharth@yahoo.com',
      address: 'Flat 4B, Skyview Towers, Bangalore',
      date_of_birth: '1990-08-25',
      pan_copy: true,
      aadhaar_copy: true,
      bank_proof: false,
      photograph: true,
      signature: false,
      status: 'Pending',
      remarks: 'Waiting for Bank Proof copy and signature upload.',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 2. kyc_ucc_allotment
  await clearTable('kyc_ucc_allotment', employeeId);
  await client.from('kyc_ucc_allotment').insert([
    {
      client_name: 'Aditya Sen',
      pan: 'ABCDE1234F',
      exchange: 'NSE',
      segment: 'Cash',
      ucc_code: 'UCC88019',
      upload_date: today,
      confirmation_date: today,
      status: 'Confirmed',
      branch_id: branchId,
      created_by: employeeId
    },
    {
      client_name: 'Vikram Malhotra',
      pan: 'MNOPQ9876Z',
      exchange: 'BSE',
      segment: 'F&O',
      ucc_code: 'UCC88020',
      upload_date: today,
      status: 'Uploaded',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 3. kyc_registry_updation
  await clearTable('kyc_registry_updation', employeeId);
  await client.from('kyc_registry_updation').insert([
    {
      client_name: 'Aditya Sen',
      pan: 'ABCDE1234F',
      registry: 'CKYC',
      upload_date: today,
      status: 'Verified',
      branch_id: branchId,
      created_by: employeeId
    },
    {
      client_name: 'Rahul Mehta',
      pan: 'KJHGF4321E',
      registry: 'KRA',
      upload_date: today,
      status: 'Rejected',
      rejection_reason: 'PAN details mismatch with Income Tax database.',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 4. kyc_ap_sharing
  await clearTable('kyc_ap_sharing', employeeId);
  await client.from('kyc_ap_sharing').insert([
    {
      ap_name: 'Karan Johar Broking',
      ap_code: 'AP99081',
      client_name: 'Riya Gupta',
      sharing_percentage: 60.00,
      effective_date: '2026-01-01',
      status: 'Active',
      branch_id: branchId,
      created_by: employeeId
    },
    {
      ap_name: 'Rajesh Securities',
      ap_code: 'AP99082',
      client_name: 'Dev Kumar',
      sharing_percentage: 45.00,
      effective_date: today,
      status: 'Revised',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 5. kyc_demise_reporting
  await clearTable('kyc_demise_reporting', employeeId);
  await client.from('kyc_demise_reporting').insert([
    {
      client_name: 'Late Harish Chawla',
      pan: 'HCHAW9921A',
      date_of_demise: '2026-05-15',
      reported_date: today,
      status: 'Reported',
      remarks: 'Death certificate copy submitted. Awaiting transmission process.',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 6. kyc_ap_code_exchange
  await clearTable('kyc_ap_code_exchange', employeeId);
  await client.from('kyc_ap_code_exchange').insert([
    {
      ap_name: 'Karan Johar Broking',
      ap_code: 'AP99081',
      exchange: 'NSE',
      upload_date: today,
      status: 'Confirmed',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 7. kyc_onboarding_communication
  await clearTable('kyc_onboarding_communication', employeeId);
  await client.from('kyc_onboarding_communication').insert([
    {
      client_name: 'Aditya Sen',
      mode: 'Email',
      sent_date: today,
      status: 'Sent',
      remarks: 'Welcome letter and credentials dispatched.',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 8. kyc_modification_requests
  await clearTable('kyc_modification_requests', employeeId);
  await client.from('kyc_modification_requests').insert([
    {
      client_name: 'Manish Sharma',
      pan: 'MSHAR5512B',
      modification_type: 'Mobile',
      old_value: '9888877777',
      new_value: '9777766666',
      request_date: today,
      status: 'Pending',
      branch_id: branchId,
      created_by: employeeId
    },
    {
      client_name: 'Nisha Patil',
      pan: 'NPATI8812C',
      modification_type: 'Address',
      old_value: 'Old Street 1, Pune',
      new_value: 'New Heights 2, Pune',
      request_date: '2026-06-25',
      processed_date: today,
      status: 'Processed',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 9. kyc_reactivation_requests
  await clearTable('kyc_reactivation_requests', employeeId);
  await client.from('kyc_reactivation_requests').insert([
    {
      client_name: 'Anupama Rao',
      pan: 'ARAOO9988C',
      reason: 'Account dormant for 12 months. Requesting reactivation with fresh KYC documents.',
      request_date: today,
      status: 'Pending',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 10. kyc_account_closure
  await clearTable('kyc_account_closure', employeeId);
  await client.from('kyc_account_closure').insert([
    {
      client_name: 'Suresh Raina',
      pan: 'SRAIN4455G',
      reason: 'No longer trading. Requesting closure.',
      request_date: today,
      status: 'Pending',
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  // 11. kyc_exchange_compliance
  await clearTable('kyc_exchange_compliance', employeeId);
  await client.from('kyc_exchange_compliance').insert([
    {
      client_name: 'Aditya Sen',
      pan: 'ABCDE1234F',
      compliance_item: 'PAN-Aadhaar Linkage',
      status: 'Compliant',
      due_date: '2026-12-31',
      branch_id: branchId,
      created_by: employeeId
    },
    {
      client_name: 'Riya Gupta',
      pan: 'RGUPT7788P',
      compliance_item: 'Annual KYC Refresh',
      status: 'Due',
      due_date: today,
      branch_id: branchId,
      created_by: employeeId
    }
  ]);

  console.log('🏁 KYC seeding completed successfully!');
}

seedKYC();
