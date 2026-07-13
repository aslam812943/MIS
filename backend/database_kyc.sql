-- KYC DEPARTMENT DATABASE SCHEMA
-- Run these commands in your Supabase SQL Editor to set up the KYC tables.

-- Drop existing tables if they exist to ensure schema updates apply cleanly
DROP TABLE IF EXISTS kyc_new_account CASCADE;
DROP TABLE IF EXISTS kyc_ucc_allotment CASCADE;
DROP TABLE IF EXISTS kyc_registry_updation CASCADE;
DROP TABLE IF EXISTS kyc_ap_sharing CASCADE;
DROP TABLE IF EXISTS kyc_demise_reporting CASCADE;
DROP TABLE IF EXISTS kyc_ap_code_exchange CASCADE;
DROP TABLE IF EXISTS kyc_onboarding_communication CASCADE;
DROP TABLE IF EXISTS kyc_modification_requests CASCADE;
DROP TABLE IF EXISTS kyc_reactivation_requests CASCADE;
DROP TABLE IF EXISTS kyc_account_closure CASCADE;
DROP TABLE IF EXISTS kyc_exchange_compliance CASCADE;

-- 1. NEW ACCOUNT OPENING VERIFICATION
CREATE TABLE IF NOT EXISTS kyc_new_account (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    applicant_name VARCHAR(255) NOT NULL,
    pan VARCHAR(20) NOT NULL UNIQUE,
    aadhaar_number VARCHAR(20) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    pan_copy BOOLEAN DEFAULT FALSE,
    aadhaar_copy BOOLEAN DEFAULT FALSE,
    bank_proof BOOLEAN DEFAULT FALSE,
    photograph BOOLEAN DEFAULT FALSE,
    signature BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(255),
    verification_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. UCC ALLOTMENT (NSE/BSE)
CREATE TABLE IF NOT EXISTS kyc_ucc_allotment (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    pan VARCHAR(20) NOT NULL,
    exchange VARCHAR(50) NOT NULL CHECK (exchange IN ('NSE', 'BSE')),
    segment VARCHAR(50) NOT NULL CHECK (segment IN ('Cash', 'F&O', 'Currency', 'Commodity')),
    ucc_code VARCHAR(100),
    upload_date DATE,
    confirmation_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Uploaded', 'Confirmed', 'Rejected')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CKYC / KRA UPDATION
CREATE TABLE IF NOT EXISTS kyc_registry_updation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    pan VARCHAR(20) NOT NULL,
    registry VARCHAR(50) NOT NULL CHECK (registry IN ('CKYC', 'KRA')),
    upload_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Rejected')),
    rejection_reason TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. AP / REMISIER SHARING UPDATION
CREATE TABLE IF NOT EXISTS kyc_ap_sharing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ap_name VARCHAR(255) NOT NULL,
    ap_code VARCHAR(100) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    sharing_percentage NUMERIC(5, 2) NOT NULL CHECK (sharing_percentage >= 0 AND sharing_percentage <= 100),
    effective_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Revised', 'Terminated')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. DEMISE REPORTING
CREATE TABLE IF NOT EXISTS kyc_demise_reporting (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    pan VARCHAR(20) NOT NULL,
    date_of_demise DATE NOT NULL,
    reported_date DATE NOT NULL,
    death_certificate_url TEXT,
    status VARCHAR(50) DEFAULT 'Reported' CHECK (status IN ('Reported', 'Forwarded to DP', 'Closed')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. AP CODE UPDATION TO EXCHANGE
CREATE TABLE IF NOT EXISTS kyc_ap_code_exchange (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ap_name VARCHAR(255) NOT NULL,
    ap_code VARCHAR(100) NOT NULL,
    exchange VARCHAR(50) NOT NULL CHECK (exchange IN ('NSE', 'BSE')),
    upload_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. CLIENT ONBOARDING COMMUNICATION
CREATE TABLE IF NOT EXISTS kyc_onboarding_communication (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    mode VARCHAR(50) NOT NULL CHECK (mode IN ('Letter', 'SMS', 'Call', 'Email')),
    sent_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Sent' CHECK (status IN ('Sent', 'Failed', 'Not Reachable')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. MODIFICATION REQUESTS
CREATE TABLE IF NOT EXISTS kyc_modification_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    pan VARCHAR(20) NOT NULL,
    modification_type VARCHAR(100) NOT NULL CHECK (modification_type IN ('Address', 'Mobile', 'Email', 'Bank Details', 'Nomination', 'Signature', 'Other')),
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

-- 9. REACTIVATION
CREATE TABLE IF NOT EXISTS kyc_reactivation_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    pan VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    request_date DATE NOT NULL,
    processed_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processed', 'Rejected')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. ACCOUNT CLOSURE / UCC CLOSURE
CREATE TABLE IF NOT EXISTS kyc_account_closure (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    pan VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    request_date DATE NOT NULL,
    closure_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processed', 'Rejected')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. EXCHANGE COMPLIANCE STATUS
CREATE TABLE IF NOT EXISTS kyc_exchange_compliance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    pan VARCHAR(20) NOT NULL,
    compliance_item VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Due' CHECK (status IN ('Compliant', 'Non-Compliant', 'Due')),
    due_date DATE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS POLICIES FOR ALL TABLES (Bypass for service_role and allow authenticated users in KYC department or Admin)
ALTER TABLE kyc_new_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_ucc_allotment ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_registry_updation ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_ap_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_demise_reporting ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_ap_code_exchange ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_onboarding_communication ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_modification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_reactivation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_account_closure ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_exchange_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access KYC NA" ON kyc_new_account FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC UA" ON kyc_ucc_allotment FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC RU" ON kyc_registry_updation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC AS" ON kyc_ap_sharing FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC DR" ON kyc_demise_reporting FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC AC" ON kyc_ap_code_exchange FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC OC" ON kyc_onboarding_communication FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC MR" ON kyc_modification_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC RR" ON kyc_reactivation_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC C" ON kyc_account_closure FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access KYC EC" ON kyc_exchange_compliance FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Define security helper rules for KYC Department or Admin
-- Table 1
CREATE POLICY "KYC staff can view NA" ON kyc_new_account FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert NA" ON kyc_new_account FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update NA" ON kyc_new_account FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 2
CREATE POLICY "KYC staff can view UA" ON kyc_ucc_allotment FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert UA" ON kyc_ucc_allotment FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update UA" ON kyc_ucc_allotment FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 3
CREATE POLICY "KYC staff can view RU" ON kyc_registry_updation FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert RU" ON kyc_registry_updation FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update RU" ON kyc_registry_updation FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 4
CREATE POLICY "KYC staff can view AS" ON kyc_ap_sharing FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert AS" ON kyc_ap_sharing FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update AS" ON kyc_ap_sharing FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 5
CREATE POLICY "KYC staff can view DR" ON kyc_demise_reporting FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert DR" ON kyc_demise_reporting FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update DR" ON kyc_demise_reporting FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 6
CREATE POLICY "KYC staff can view ACE" ON kyc_ap_code_exchange FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert ACE" ON kyc_ap_code_exchange FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update ACE" ON kyc_ap_code_exchange FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 7
CREATE POLICY "KYC staff can view OC" ON kyc_onboarding_communication FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert OC" ON kyc_onboarding_communication FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update OC" ON kyc_onboarding_communication FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 8
CREATE POLICY "KYC staff can view MR" ON kyc_modification_requests FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert MR" ON kyc_modification_requests FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update MR" ON kyc_modification_requests FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 9
CREATE POLICY "KYC staff can view RR" ON kyc_reactivation_requests FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert RR" ON kyc_reactivation_requests FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update RR" ON kyc_reactivation_requests FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 10
CREATE POLICY "KYC staff can view C" ON kyc_account_closure FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert C" ON kyc_account_closure FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update C" ON kyc_account_closure FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- Table 11
CREATE POLICY "KYC staff can view EC" ON kyc_exchange_compliance FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can insert EC" ON kyc_exchange_compliance FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));
CREATE POLICY "KYC staff can update EC" ON kyc_exchange_compliance FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'KYC'))));

-- AUTO-UPDATE UPDATED_AT TRIGGERS FOR ALL 11 TABLES
CREATE TRIGGER on_kyc_na_updated BEFORE UPDATE ON kyc_new_account FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_ua_updated BEFORE UPDATE ON kyc_ucc_allotment FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_ru_updated BEFORE UPDATE ON kyc_registry_updation FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_as_updated BEFORE UPDATE ON kyc_ap_sharing FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_dr_updated BEFORE UPDATE ON kyc_demise_reporting FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_ace_updated BEFORE UPDATE ON kyc_ap_code_exchange FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_oc_updated BEFORE UPDATE ON kyc_onboarding_communication FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_mr_updated BEFORE UPDATE ON kyc_modification_requests FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_rr_updated BEFORE UPDATE ON kyc_reactivation_requests FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_c_updated BEFORE UPDATE ON kyc_account_closure FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_kyc_ec_updated BEFORE UPDATE ON kyc_exchange_compliance FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
