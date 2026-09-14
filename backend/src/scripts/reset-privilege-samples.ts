import { supabaseAdmin } from '../config/supabase.js';

const sampleCodes = ['PA1001', 'PA1002', 'PA1003', 'PA1004', 'PA1005', 'PA1006'];

async function resetPrivilegeSamples() {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');

  const { data: branch } = await supabaseAdmin.from('branches').select('id').limit(1).maybeSingle();
  const branchId = branch?.id || null;
  const samples = [
    { sl_no: 1, code: 'PA1001', name: 'Aarav Sharma', account_date: '2026-09-02', mobile_no: '9876501001', scheme: 'Privilege Plus', introducer: 'Direct', rm: 'Rahul Menon', dealer: 'Neha Patil', branch: 'Mumbai Central', trading_started: true, remarks: 'Active priority client', location: 'Mumbai', occupation: 'Business owner', contact: '9876501001', aum: 8500000, utilised: 6200000, returns: 12.4, stocks: 'HDFCBANK, RELIANCE', branch_id: branchId },
    { sl_no: 2, code: 'PA1002', name: 'Diya Nair', account_date: '2026-09-06', mobile_no: '9876501002', scheme: 'Privilege Elite', introducer: 'Anil Kumar', rm: 'Meera Shah', dealer: 'Karan Joshi', branch: 'Bengaluru', trading_started: true, remarks: 'Monthly review completed', location: 'Bengaluru', occupation: 'Technology consultant', contact: '9876501002', aum: 6500000, utilised: 4100000, returns: 9.8, stocks: 'TCS, INFY', branch_id: branchId },
    { sl_no: 3, code: 'PA1003', name: 'Kabir Patel', account_date: '2026-09-11', mobile_no: '9876501003', scheme: 'Privilege Select', introducer: 'Direct', rm: 'Rahul Menon', dealer: 'Sneha Rao', branch: 'Ahmedabad', trading_started: false, remarks: 'Trading activation pending', location: 'Ahmedabad', occupation: 'Entrepreneur', contact: '9876501003', aum: 12000000, utilised: 7500000, returns: 14.2, stocks: 'ICICIBANK, LT', branch_id: branchId }
  ];

  const { error: deleteError } = await supabaseAdmin.from('privilege_accounts').delete().in('code', sampleCodes);
  if (deleteError) throw deleteError;
  const { error: insertError } = await supabaseAdmin.from('privilege_accounts').insert(samples);
  if (insertError && (insertError.code === 'PGRST204' || insertError.message.includes('schema cache'))) {
    const legacySamples = samples.map(({ code, name, location, occupation, contact, aum, utilised, returns, stocks, branch_id }) => ({ code, name, location, occupation, contact, aum, utilised, returns, stocks, branch_id }));
    const { error: legacyError } = await supabaseAdmin.from('privilege_accounts').insert(legacySamples);
    if (legacyError) throw legacyError;
    console.log('Inserted 3 replacement samples. Run database_privilege_register_fields.sql, then rerun this script to add all expanded details.');
    return;
  }
  if (insertError) throw insertError;
  console.log('Replaced old Privilege sample records with 3 complete samples.');
}

resetPrivilegeSamples().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
