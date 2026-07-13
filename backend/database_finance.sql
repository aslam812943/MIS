-- FINANCE DEPARTMENT DATABASE SCHEMA
-- Run these commands in your Supabase SQL Editor to set up the Finance department tables.

DROP TABLE IF EXISTS finance_pnl_summary CASCADE;
DROP TABLE IF EXISTS finance_compliance_renewals CASCADE;
DROP TABLE IF EXISTS finance_exchange_reporting CASCADE;
DROP TABLE IF EXISTS finance_fund_movement CASCADE;
DROP TABLE IF EXISTS finance_client_requests CASCADE;
DROP TABLE IF EXISTS finance_referral_commission CASCADE;
DROP TABLE IF EXISTS finance_cash_bank_position CASCADE;
DROP TABLE IF EXISTS finance_recurring_payables CASCADE;

-- 1. MONTHLY P&L SUMMARY
CREATE TABLE IF NOT EXISTS finance_pnl_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_date DATE NOT NULL,
    cash_brokerage_revenue NUMERIC(15, 2) DEFAULT 0.00,
    fno_brokerage_revenue NUMERIC(15, 2) DEFAULT 0.00,
    commodity_brokerage_revenue NUMERIC(15, 2) DEFAULT 0.00,
    dp_other_income NUMERIC(15, 2) DEFAULT 0.00,
    operating_expense NUMERIC(15, 2) DEFAULT 0.00,
    cash_flow_bank NUMERIC(15, 2) DEFAULT 0.00,
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. COMPLIANCE & STATUTORY RENEWALS
CREATE TABLE IF NOT EXISTS finance_compliance_renewals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    renewal_type VARCHAR(100) NOT NULL CHECK (renewal_type IN ('Land Tax', 'Insurance', 'TDS Payment', 'TDS Return Filing', 'GST Payment', 'GST Return Filing', 'Fixed Deposit Renewal', 'Exchange Security Deposit Renewal', 'AMC Renewal', 'License/Membership Fee', 'LPC Running', 'Other')),
    item_name VARCHAR(255) NOT NULL,
    reference_no VARCHAR(100),
    amount NUMERIC(15, 2) DEFAULT 0.00,
    due_date DATE NOT NULL,
    last_paid_date DATE,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('One-time', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annually')),
    notification_lead_time_days INT DEFAULT 15,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Renewed', 'Overdue', 'Filed')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. EXCHANGE REPORTING & SUBMISSIONS
CREATE TABLE IF NOT EXISTS finance_exchange_reporting (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_type VARCHAR(100) NOT NULL CHECK (submission_type IN ('Daily Segregation Report', 'Holdings Statement', 'Monthly Settlement Report', 'Quarterly Settlement Report', 'Other')),
    exchange VARCHAR(50) NOT NULL CHECK (exchange IN ('NSE', 'BSE', 'MCX', 'All')),
    period_date DATE NOT NULL,
    due_date DATE NOT NULL,
    submitted_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted On-Time', 'Submitted Late', 'Not Submitted')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CLIENT FUND MOVEMENT (PAYIN / PAYOUT)
CREATE TABLE IF NOT EXISTS finance_fund_movement (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_date DATE NOT NULL,
    payin_amount NUMERIC(15, 2) DEFAULT 0.00,
    payin_count INT DEFAULT 0,
    payout_amount NUMERIC(15, 2) DEFAULT 0.00,
    payout_count INT DEFAULT 0,
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. CLIENT REQUESTS & BROKERAGE REVISIONS
CREATE TABLE IF NOT EXISTS finance_client_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_date DATE NOT NULL,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('General Client Request', 'Brokerage Revision Request')),
    client_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Process', 'Approved', 'Rejected', 'Completed')),
    resolved_date DATE,
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. REFERRAL COMMISSION
CREATE TABLE IF NOT EXISTS finance_referral_commission (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_name VARCHAR(255) NOT NULL,
    period_month DATE NOT NULL,
    commission_amount NUMERIC(15, 2) DEFAULT 0.00,
    statement_generated BOOLEAN DEFAULT FALSE,
    statement_date DATE,
    payment_date DATE,
    payment_status VARCHAR(50) DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'On Hold')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. CASH & BANK POSITION
CREATE TABLE IF NOT EXISTS finance_cash_bank_position (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    position_date DATE NOT NULL,
    cash_in_hand NUMERIC(15, 2) DEFAULT 0.00,
    cash_at_bank NUMERIC(15, 2) DEFAULT 0.00,
    bank_name VARCHAR(255),
    bank_reconciliation_status VARCHAR(50) DEFAULT 'Pending' CHECK (bank_reconciliation_status IN ('Reconciled', 'Pending', 'Discrepancy Found')),
    pis_reporting_done BOOLEAN DEFAULT FALSE,
    pis_reporting_date DATE,
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. RECURRING PAYABLES
CREATE TABLE IF NOT EXISTS finance_recurring_payables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payable_type VARCHAR(50) NOT NULL CHECK (payable_type IN ('EMI', 'Mobile Bill', 'Internet Bill', 'Rent Payable', 'Rent Receivable', 'Other Utility')),
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) DEFAULT 0.00,
    due_date DATE NOT NULL,
    paid_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Overdue')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security on all 8 tables
ALTER TABLE finance_pnl_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_compliance_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_exchange_reporting ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_fund_movement ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_referral_commission ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_cash_bank_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recurring_payables ENABLE ROW LEVEL SECURITY;

-- Allow full access for Supabase Service Role on all tables
CREATE POLICY "Allow service role full access Finance 1" ON finance_pnl_summary FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access Finance 2" ON finance_compliance_renewals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access Finance 3" ON finance_exchange_reporting FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access Finance 4" ON finance_fund_movement FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access Finance 5" ON finance_client_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access Finance 6" ON finance_referral_commission FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access Finance 7" ON finance_cash_bank_position FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access Finance 8" ON finance_recurring_payables FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users belonging to Finance department or Admin role to read/write
CREATE POLICY "Finance staff can select 1" ON finance_pnl_summary FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can insert 1" ON finance_pnl_summary FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can update 1" ON finance_pnl_summary FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));

CREATE POLICY "Finance staff can select 2" ON finance_compliance_renewals FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can insert 2" ON finance_compliance_renewals FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can update 2" ON finance_compliance_renewals FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));

CREATE POLICY "Finance staff can select 3" ON finance_exchange_reporting FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can insert 3" ON finance_exchange_reporting FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can update 3" ON finance_exchange_reporting FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));

CREATE POLICY "Finance staff can select 4" ON finance_fund_movement FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can insert 4" ON finance_fund_movement FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can update 4" ON finance_fund_movement FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));

CREATE POLICY "Finance staff can select 5" ON finance_client_requests FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can insert 5" ON finance_client_requests FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can update 5" ON finance_client_requests FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));

CREATE POLICY "Finance staff can select 6" ON finance_referral_commission FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can insert 6" ON finance_referral_commission FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can update 6" ON finance_referral_commission FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));

CREATE POLICY "Finance staff can select 7" ON finance_cash_bank_position FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can insert 7" ON finance_cash_bank_position FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can update 7" ON finance_cash_bank_position FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));

CREATE POLICY "Finance staff can select 8" ON finance_recurring_payables FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can insert 8" ON finance_recurring_payables FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));
CREATE POLICY "Finance staff can update 8" ON finance_recurring_payables FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Finance'))));

-- Triggers for auto-updating updated_at timestamp on all 8 tables
CREATE TRIGGER on_finance_pnl_summary_updated BEFORE UPDATE ON finance_pnl_summary FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_finance_compliance_renewals_updated BEFORE UPDATE ON finance_compliance_renewals FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_finance_exchange_reporting_updated BEFORE UPDATE ON finance_exchange_reporting FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_finance_fund_movement_updated BEFORE UPDATE ON finance_fund_movement FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_finance_client_requests_updated BEFORE UPDATE ON finance_client_requests FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_finance_referral_commission_updated BEFORE UPDATE ON finance_referral_commission FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_finance_cash_bank_position_updated BEFORE UPDATE ON finance_cash_bank_position FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_finance_recurring_payables_updated BEFORE UPDATE ON finance_recurring_payables FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Insert Finance department record into departments table (if it doesn't already exist)
INSERT INTO departments (name)
VALUES ('Finance')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
