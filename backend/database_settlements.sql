-- CLEARING & SETTLEMENTS DATABASE SCHEMA
-- Run these commands in your Supabase SQL Editor to set up the settlements tables.

-- Drop existing tables to ensure schema updates apply cleanly
DROP TABLE IF EXISTS settlement_payin_payout CASCADE;
DROP TABLE IF EXISTS settlement_client_requests CASCADE;
DROP TABLE IF EXISTS settlement_ipo_allocation CASCADE;
DROP TABLE IF EXISTS settlement_corporate_actions CASCADE;

-- 1. PAY-IN / PAY-OUT OF SECURITIES TABLE
CREATE TABLE IF NOT EXISTS settlement_payin_payout (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    settlement_date DATE NOT NULL,
    client_id VARCHAR(100) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    stock_symbol VARCHAR(50) NOT NULL,
    buy_sell VARCHAR(10) NOT NULL CHECK (buy_sell IN ('Buy', 'Sell')),
    quantity INT NOT NULL CHECK (quantity > 0),
    shortage_qty INT DEFAULT 0 CHECK (shortage_qty >= 0),
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Completed', 'Pending', 'Shortage')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CLIENT SERVICE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS settlement_client_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id VARCHAR(100) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    request_type VARCHAR(100) NOT NULL CHECK (request_type IN ('Demat Transfer', 'Pledge Release', 'Account Closure', 'Bank Detail Update', 'Rematerialization', 'Other')),
    date_received DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Received' CHECK (status IN ('Received', 'In Process', 'Pending', 'Completed')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. IPO ALLOCATION TABLE
CREATE TABLE IF NOT EXISTS settlement_ipo_allocation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    ipo_name VARCHAR(255) NOT NULL,
    applied_qty INT NOT NULL CHECK (applied_qty > 0),
    allotted_qty INT DEFAULT 0 CHECK (allotted_qty >= 0),
    application_amount NUMERIC(15, 2) NOT NULL CHECK (application_amount >= 0),
    refund_per_share NUMERIC(15, 2) DEFAULT 0.00 CHECK (refund_per_share >= 0),
    allotment_date DATE NOT NULL,
    refund_status VARCHAR(50) DEFAULT 'Pending' CHECK (refund_status IN ('Pending', 'Completed')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CORPORATE ACTION ALLOCATION TABLE
CREATE TABLE IF NOT EXISTS settlement_corporate_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    stock_symbol VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('Dividend', 'Bonus', 'Split', 'Rights', 'Buyback')),
    record_date DATE NOT NULL,
    ratio_rate VARCHAR(50) NOT NULL,
    eligible_qty INT NOT NULL CHECK (eligible_qty > 0),
    entitled_qty_amount NUMERIC(15, 2) NOT NULL CHECK (entitled_qty_amount >= 0),
    credit_date DATE,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Credited')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ENABLE ROW LEVEL SECURITY (RLS) FOR ALL TABLES
ALTER TABLE settlement_payin_payout ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_ipo_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_corporate_actions ENABLE ROW LEVEL SECURITY;

-- 6. DEFINE ROW LEVEL SECURITY POLICIES (Bypass for service role and filter by Settlements department or Admin)
CREATE POLICY "Allow service role full access PP" ON settlement_payin_payout FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access CR" ON settlement_client_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IPO" ON settlement_ipo_allocation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access CA" ON settlement_corporate_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users in Settlements department (or Admins) to view records
CREATE POLICY "Settlements staff can view PP" ON settlement_payin_payout FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can view CR" ON settlement_client_requests FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can view IPO" ON settlement_ipo_allocation FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can view CA" ON settlement_corporate_actions FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

-- Allow authenticated users in Settlements department (or Admins) to insert records
CREATE POLICY "Settlements staff can insert PP" ON settlement_payin_payout FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can insert CR" ON settlement_client_requests FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can insert IPO" ON settlement_ipo_allocation FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can insert CA" ON settlement_corporate_actions FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

-- Allow authenticated users in Settlements department (or Admins) to update records
CREATE POLICY "Settlements staff can update PP" ON settlement_payin_payout FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can update CR" ON settlement_client_requests FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can update IPO" ON settlement_ipo_allocation FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

CREATE POLICY "Settlements staff can update CA" ON settlement_corporate_actions FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'Settlements'))
        )
    );

-- 7. AUTO-UPDATE UPDATED_AT ON CHANGES
CREATE TRIGGER on_settlement_pp_updated BEFORE UPDATE ON settlement_payin_payout FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_settlement_cr_updated BEFORE UPDATE ON settlement_client_requests FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_settlement_ipo_updated BEFORE UPDATE ON settlement_ipo_allocation FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_settlement_ca_updated BEFORE UPDATE ON settlement_corporate_actions FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- 8. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
