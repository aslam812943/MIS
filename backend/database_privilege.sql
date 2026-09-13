-- ==============================================================================
-- PRIVILEGE ACCOUNT MANAGEMENT DATABASE SCHEMA & POLICIES
-- ==============================================================================

-- 1. Ensure Privilege Account department exists
INSERT INTO departments (name)
SELECT 'Privilege Account'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Privilege Account');

-- 2. PRIVILEGE ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS privilege_accounts (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    occupation VARCHAR(255) NOT NULL,
    contact VARCHAR(255) NOT NULL,
    aum NUMERIC(16, 2) NOT NULL CHECK (aum >= 0),
    utilised NUMERIC(16, 2) NOT NULL CHECK (utilised >= 0),
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
INSERT INTO privilege_accounts (code, name, location, occupation, contact, aum, utilised, returns, stocks, updated_at)
VALUES
    ('PA1001', 'Arjun Mehta', 'Mumbai', 'Business owner', 'Sample account', 8500000.00, 6300000.00, 12.80, 'HDFCBANK, RELIANCE, INFY', timezone('utc'::text, now())),
    ('PA1002', 'Priya Nair', 'Bengaluru', 'Technology', 'Sample account', 6500000.00, 4800000.00, 9.40, 'TCS, INFY', timezone('utc'::text, now())),
    ('PA1003', 'Rohan Shah', 'Mumbai', 'Consultant', 'Sample account', 12000000.00, 9600000.00, 15.20, 'RELIANCE, ICICIBANK', timezone('utc'::text, now())),
    ('PA1004', 'Ananya Iyer', 'Chennai', 'Doctor', 'Sample account', 4500000.00, 2700000.00, 7.60, 'SUNPHARMA, ITC', timezone('utc'::text, now())),
    ('PA1005', 'Vikram Kapoor', 'Delhi', 'Business owner', 'Sample account', 9500000.00, 7100000.00, -2.10, 'LT, TATAMOTORS', timezone('utc'::text, now())),
    ('PA1006', 'Neha Desai', 'Pune', 'Architect', 'Sample account', 5500000.00, 3800000.00, 11.30, 'HDFCBANK, TCS', timezone('utc'::text, now()))
ON CONFLICT (code) DO NOTHING;
