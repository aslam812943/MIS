-- DP DEPARTMENT DATABASE SCHEMA
-- Run these commands in your Supabase SQL Editor to set up the DP tables.

DROP TABLE IF EXISTS dp_new_account CASCADE;
DROP TABLE IF EXISTS dp_ucc_updation CASCADE;
DROP TABLE IF EXISTS dp_modification CASCADE;
DROP TABLE IF EXISTS dp_demat_execution CASCADE;
DROP TABLE IF EXISTS dp_transfers_transmissions CASCADE;
DROP TABLE IF EXISTS dp_demat_rejection CASCADE;
DROP TABLE IF EXISTS dp_closure_execution CASCADE;
DROP TABLE IF EXISTS dp_dis_slip_upload CASCADE;
DROP TABLE IF EXISTS dp_back_office_update CASCADE;
DROP TABLE IF EXISTS dp_eod_backup CASCADE;
DROP TABLE IF EXISTS dp_amc_charges CASCADE;
DROP TABLE IF EXISTS dp_monthly_statements CASCADE;
DROP TABLE IF EXISTS dp_audit_compliance CASCADE;
DROP TABLE IF EXISTS dp_client_queries CASCADE;

-- 1. NEW ACCOUNT OPENING VERIFICATION & UPLOADING
CREATE TABLE IF NOT EXISTS dp_new_account (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    pan_copy BOOLEAN DEFAULT FALSE,
    aadhaar_copy BOOLEAN DEFAULT FALSE,
    bank_proof BOOLEAN DEFAULT FALSE,
    photograph BOOLEAN DEFAULT FALSE,
    signature BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(255),
    verification_date DATE,
    uploaded_to_cdsl_date DATE,
    bo_id_generated VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Uploaded', 'Completed', 'Rejected')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. UCC UPDATION STATUS / NSE-BSE
CREATE TABLE IF NOT EXISTS dp_ucc_updation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    exchange VARCHAR(50) NOT NULL CHECK (exchange IN ('NSE', 'BSE')),
    segment VARCHAR(50) NOT NULL CHECK (segment IN ('Cash', 'F&O', 'Currency', 'Commodity')),
    upload_date DATE,
    confirmation_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Uploaded', 'Confirmed', 'Rejected')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. MODIFY DATA IN EXISTING DP ACCOUNTS
CREATE TABLE IF NOT EXISTS dp_modification (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    bo_id VARCHAR(50) NOT NULL,
    modification_type VARCHAR(100) NOT NULL CHECK (modification_type IN ('Address', 'Mobile', 'Email', 'Bank Details', 'Nominee', 'Signature', 'Other')),
    old_value TEXT,
    new_value TEXT,
    supporting_document_url TEXT,
    request_date DATE NOT NULL,
    processed_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processed', 'Rejected')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. DEMAT EXECUTION
CREATE TABLE IF NOT EXISTS dp_demat_execution (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    bo_id VARCHAR(50) NOT NULL,
    drf_number VARCHAR(100) NOT NULL,
    isin VARCHAR(50) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    certificate_number VARCHAR(100) NOT NULL,
    folio_number VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    rta_name VARCHAR(255) NOT NULL,
    sent_to_rta_date DATE,
    status VARCHAR(50) DEFAULT 'Sent to RTA' CHECK (status IN ('Sent to RTA', 'Confirmed', 'Rejected', 'Resubmitted', 'Closed')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TRANSFERS & TRANSMISSIONS
CREATE TABLE IF NOT EXISTS dp_transfers_transmissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Transfer', 'Transmission')),
    from_bo_id VARCHAR(50) NOT NULL,
    to_bo_id VARCHAR(50) NOT NULL,
    isin VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    supporting_documents TEXT,
    request_date DATE NOT NULL,
    execution_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Executed', 'Rejected')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. DEMAT REJECTION EXECUTION
CREATE TABLE IF NOT EXISTS dp_demat_rejection (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    drf_number VARCHAR(100) NOT NULL,
    rejection_reason TEXT NOT NULL,
    rejection_date DATE NOT NULL,
    corrective_action TEXT,
    resubmission_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. CLOSURE EXECUTION
CREATE TABLE IF NOT EXISTS dp_closure_execution (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    bo_id VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    holdings_check_status VARCHAR(100) DEFAULT 'Clean' CHECK (holdings_check_status IN ('Clean', 'Pending Obligations', 'Shares Present')),
    request_date DATE NOT NULL,
    closure_date DATE,
    status VARCHAR(50) DEFAULT 'Requested' CHECK (status IN ('Requested', 'Approved', 'Closed', 'Rejected')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. DIS SLIP UPLOADING TO CDAS (Tasks 8 & 13)
CREATE TABLE IF NOT EXISTS dp_dis_slip_upload (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    bo_id VARCHAR(50) NOT NULL,
    dis_slip_number VARCHAR(100) NOT NULL,
    isin VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    execution_date DATE,
    scan_upload_status VARCHAR(50) DEFAULT 'Pending' CHECK (scan_upload_status IN ('Pending', 'Uploaded', 'Failed')),
    uploaded_by VARCHAR(255),
    upload_date DATE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. BACK OFFICE FILE UPDATION
CREATE TABLE IF NOT EXISTS dp_back_office_update (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_type VARCHAR(100) NOT NULL CHECK (file_type IN ('Trade File', 'Holdings File', 'Ledger File', 'Other')),
    run_date DATE NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Success' CHECK (status IN ('Success', 'Failed')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. EOD BACK UP
CREATE TABLE IF NOT EXISTS dp_eod_backup (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_date DATE NOT NULL,
    backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN ('Full', 'Incremental')),
    file_size_kb INTEGER NOT NULL CHECK (file_size_kb >= 0),
    verified_by VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Verified' CHECK (status IN ('Success', 'Failed', 'Verified')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. DP AMC CHARGES RUNNING - MONTHLY
CREATE TABLE IF NOT EXISTS dp_amc_charges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    bo_id VARCHAR(50) NOT NULL,
    billing_month VARCHAR(50) NOT NULL,
    amc_amount NUMERIC(10, 2) NOT NULL CHECK (amc_amount >= 0),
    gst_amount NUMERIC(10, 2) NOT NULL CHECK (gst_amount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    debit_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Debited', 'Waived', 'Failed')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. MONTHLY STATEMENTS TO CLIENTS
CREATE TABLE IF NOT EXISTS dp_monthly_statements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    bo_id VARCHAR(50) NOT NULL,
    statement_period VARCHAR(100) NOT NULL,
    generated_date DATE NOT NULL,
    dispatch_mode VARCHAR(50) NOT NULL CHECK (dispatch_mode IN ('Email', 'Post', 'Both')),
    dispatch_status VARCHAR(50) DEFAULT 'Pending' CHECK (dispatch_status IN ('Sent', 'Bounced', 'Pending')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. CDSL AUDIT COMPLIANCE (Task 14)
CREATE TABLE IF NOT EXISTS dp_audit_compliance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_type VARCHAR(100) NOT NULL CHECK (audit_type IN ('Internal', 'CDSL Inspection', 'SEBI')),
    audit_period VARCHAR(100) NOT NULL,
    auditor_name VARCHAR(255) NOT NULL,
    finding_description TEXT NOT NULL,
    action_taken TEXT,
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Action Pending', 'Closed')),
    closure_date DATE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. OTHER QUERY RELATED WITH CLIENTS AND BRANCHES (Task 15)
CREATE TABLE IF NOT EXISTS dp_client_queries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kyc_client_id UUID REFERENCES kyc_new_account(id) ON DELETE CASCADE,
    query_type VARCHAR(100) NOT NULL CHECK (query_type IN ('Delayed Transfer', 'AMC Issue', 'Account Details', 'Document Status', 'Other')),
    description TEXT NOT NULL,
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Escalated')),
    resolution_date DATE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for all DP tables
ALTER TABLE dp_new_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_ucc_updation ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_modification ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_demat_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_transfers_transmissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_demat_rejection ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_closure_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_dis_slip_upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_back_office_update ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_eod_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_amc_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_monthly_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_audit_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp_client_queries ENABLE ROW LEVEL SECURITY;

-- Allow full access for Supabase Service Role on all tables
CREATE POLICY "Allow service role full access DP 1" ON dp_new_account FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 2" ON dp_ucc_updation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 3" ON dp_modification FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 4" ON dp_demat_execution FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 5" ON dp_transfers_transmissions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 6" ON dp_demat_rejection FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 7" ON dp_closure_execution FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 8" ON dp_dis_slip_upload FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 9" ON dp_back_office_update FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 10" ON dp_eod_backup FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 11" ON dp_amc_charges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 12" ON dp_monthly_statements FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 13" ON dp_audit_compliance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access DP 14" ON dp_client_queries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users belonging to DP department or Admin role to read/write
CREATE POLICY "DP staff can select 1" ON dp_new_account FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 1" ON dp_new_account FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 1" ON dp_new_account FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 2" ON dp_ucc_updation FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 2" ON dp_ucc_updation FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 2" ON dp_ucc_updation FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 3" ON dp_modification FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 3" ON dp_modification FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 3" ON dp_modification FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 4" ON dp_demat_execution FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 4" ON dp_demat_execution FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 4" ON dp_demat_execution FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 5" ON dp_transfers_transmissions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 5" ON dp_transfers_transmissions FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 5" ON dp_transfers_transmissions FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 6" ON dp_demat_rejection FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 6" ON dp_demat_rejection FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 6" ON dp_demat_rejection FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 7" ON dp_closure_execution FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 7" ON dp_closure_execution FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 7" ON dp_closure_execution FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 8" ON dp_dis_slip_upload FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 8" ON dp_dis_slip_upload FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 8" ON dp_dis_slip_upload FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 9" ON dp_back_office_update FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 9" ON dp_back_office_update FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 9" ON dp_back_office_update FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 10" ON dp_eod_backup FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 10" ON dp_eod_backup FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 10" ON dp_eod_backup FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 11" ON dp_amc_charges FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 11" ON dp_amc_charges FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 11" ON dp_amc_charges FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 12" ON dp_monthly_statements FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 12" ON dp_monthly_statements FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 12" ON dp_monthly_statements FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 13" ON dp_audit_compliance FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 13" ON dp_audit_compliance FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 13" ON dp_audit_compliance FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

CREATE POLICY "DP staff can select 14" ON dp_client_queries FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can insert 14" ON dp_client_queries FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));
CREATE POLICY "DP staff can update 14" ON dp_client_queries FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'DP'))));

-- Triggers for auto-updating updated_at timestamp on all 14 tables
CREATE TRIGGER on_dp_new_account_updated BEFORE UPDATE ON dp_new_account FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_ucc_updation_updated BEFORE UPDATE ON dp_ucc_updation FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_modification_updated BEFORE UPDATE ON dp_modification FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_demat_execution_updated BEFORE UPDATE ON dp_demat_execution FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_transfers_transmissions_updated BEFORE UPDATE ON dp_transfers_transmissions FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_demat_rejection_updated BEFORE UPDATE ON dp_demat_rejection FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_closure_execution_updated BEFORE UPDATE ON dp_closure_execution FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_dis_slip_upload_updated BEFORE UPDATE ON dp_dis_slip_upload FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_back_office_update_updated BEFORE UPDATE ON dp_back_office_update FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_eod_backup_updated BEFORE UPDATE ON dp_eod_backup FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_amc_charges_updated BEFORE UPDATE ON dp_amc_charges FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_monthly_statements_updated BEFORE UPDATE ON dp_monthly_statements FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_audit_compliance_updated BEFORE UPDATE ON dp_audit_compliance FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_dp_client_queries_updated BEFORE UPDATE ON dp_client_queries FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Insert DP department record into departments table (if it doesn't already exist)
INSERT INTO departments (name)
VALUES ('DP')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
