-- ==============================================================================
-- PRIVILEGE ACCOUNT MANAGEMENT DATABASE SCHEMA & POLICIES
-- ==============================================================================

-- 1. Ensure Privilege Account department exists
INSERT INTO departments (name)
SELECT 'Privilege Account'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Privilege Account');

-- 2. PRIVILEGE ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS privilege_accounts (
    sl_no BIGINT UNIQUE,
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    account_date DATE,
    mobile_no VARCHAR(20),
    scheme VARCHAR(255),
    introducer VARCHAR(255),
    rm VARCHAR(255),
    dealer VARCHAR(255),
    branch VARCHAR(255),
    trading_started BOOLEAN NOT NULL DEFAULT FALSE,
    remarks TEXT,
    location VARCHAR(255) NOT NULL,
    occupation VARCHAR(255) NOT NULL,
    contact VARCHAR(255) NOT NULL,
    aum NUMERIC(16, 2) NOT NULL CHECK (aum >= 0),
    utilised NUMERIC(16, 2) NOT NULL CHECK (utilised >= 0 AND utilised <= aum),
    returns NUMERIC(8, 2) NOT NULL,
    stocks TEXT NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_privilege_accounts_name ON privilege_accounts(name);
CREATE INDEX IF NOT EXISTS idx_privilege_accounts_location ON privilege_accounts(location);
CREATE INDEX IF NOT EXISTS idx_privilege_accounts_branch_id ON privilege_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_privilege_accounts_created_by ON privilege_accounts(created_by);

ALTER TABLE privilege_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access privilege_accounts" ON privilege_accounts;
CREATE POLICY "Service role full access privilege_accounts" ON privilege_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. PRIVILEGE UPLOADS TABLE (Files & Trade Logs)
CREATE TABLE IF NOT EXISTS privilege_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(100) NOT NULL CHECK (kind IN ('Accounts CSV', 'Trade log', 'Account documents')),
    file_path TEXT,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_privilege_uploads_kind ON privilege_uploads(kind);
CREATE INDEX IF NOT EXISTS idx_privilege_uploads_created_by ON privilege_uploads(created_by);

ALTER TABLE privilege_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access privilege_uploads" ON privilege_uploads;
CREATE POLICY "Service role full access privilege_uploads" ON privilege_uploads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Initial sample accounts seed
DELETE FROM privilege_accounts WHERE code IN ('PA1001', 'PA1002', 'PA1003', 'PA1004', 'PA1005', 'PA1006');
INSERT INTO privilege_accounts (sl_no, code, name, account_date, mobile_no, scheme, introducer, rm, dealer, branch, trading_started, remarks, location, occupation, contact, aum, utilised, returns, stocks, updated_at)
VALUES
    (1, 'PA1001', 'Aarav Sharma', '2026-09-02', '9876501001', 'Privilege Plus', 'Direct', 'Rahul Menon', 'Neha Patil', 'Mumbai Central', TRUE, 'Active priority client', 'Mumbai', 'Business owner', '9876501001', 8500000, 6200000, 12.4, 'HDFCBANK, RELIANCE', timezone('utc'::text, now())),
    (2, 'PA1002', 'Diya Nair', '2026-09-06', '9876501002', 'Privilege Elite', 'Anil Kumar', 'Meera Shah', 'Karan Joshi', 'Bengaluru', TRUE, 'Monthly review completed', 'Bengaluru', 'Technology consultant', '9876501002', 6500000, 4100000, 9.8, 'TCS, INFY', timezone('utc'::text, now())),
    (3, 'PA1003', 'Kabir Patel', '2026-09-11', '9876501003', 'Privilege Select', 'Direct', 'Rahul Menon', 'Sneha Rao', 'Ahmedabad', FALSE, 'Trading activation pending', 'Ahmedabad', 'Entrepreneur', '9876501003', 12000000, 7500000, 14.2, 'ICICIBANK, LT', timezone('utc'::text, now()))
ON CONFLICT (code) DO NOTHING;
