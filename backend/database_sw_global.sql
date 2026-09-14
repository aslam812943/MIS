-- ==============================================================================
-- SW GLOBAL DEPARTMENT DATABASE SCHEMA & POLICIES
-- ==============================================================================

-- 1. Ensure SW Global department exists
INSERT INTO departments (name)
SELECT 'SW Global'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'SW Global');

-- 2. SW GLOBAL CLIENTS TABLE
CREATE TABLE IF NOT EXISTS sw_global_clients (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    occupation VARCHAR(255) NOT NULL,
    contact VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL DEFAULT '',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sw_global_clients_name ON sw_global_clients(name);
CREATE INDEX IF NOT EXISTS idx_sw_global_clients_contact ON sw_global_clients(contact);
CREATE INDEX IF NOT EXISTS idx_sw_global_clients_location ON sw_global_clients(location);

ALTER TABLE sw_global_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access sw_global_clients" ON sw_global_clients;
CREATE POLICY "Service role full access sw_global_clients" ON sw_global_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. SW GLOBAL EVENTS TABLE (Webinars, Seminars, Client Meets)
CREATE TABLE IF NOT EXISTS sw_global_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Webinar', 'Seminar', 'Client meet', 'Other')),
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Planned', 'Conducted', 'Cancelled')),
    notes TEXT NOT NULL DEFAULT '',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sw_global_events_date ON sw_global_events(date);
CREATE INDEX IF NOT EXISTS idx_sw_global_events_status ON sw_global_events(status);

ALTER TABLE sw_global_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access sw_global_events" ON sw_global_events;
CREATE POLICY "Service role full access sw_global_events" ON sw_global_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. SW GLOBAL LEADS TABLE
CREATE TABLE IF NOT EXISTS sw_global_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES sw_global_events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    stage VARCHAR(50) NOT NULL CHECK (stage IN ('New', 'Contacted', 'Qualified', 'Converted', 'Not interested')),
    notes TEXT NOT NULL DEFAULT '',
    followup DATE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_sw_global_leads_event_contact UNIQUE(event_id, contact)
);

CREATE INDEX IF NOT EXISTS idx_sw_global_leads_event ON sw_global_leads(event_id);
CREATE INDEX IF NOT EXISTS idx_sw_global_leads_stage ON sw_global_leads(stage);
CREATE INDEX IF NOT EXISTS idx_sw_global_leads_contact ON sw_global_leads(contact);

ALTER TABLE sw_global_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access sw_global_leads" ON sw_global_leads;
CREATE POLICY "Service role full access sw_global_leads" ON sw_global_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. SW GLOBAL ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS sw_global_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_no VARCHAR(100) NOT NULL UNIQUE,
    client_code VARCHAR(50) NOT NULL REFERENCES sw_global_clients(code) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Active', 'Pending', 'Closed')),
    pending_reason TEXT NOT NULL DEFAULT '',
    followup DATE,
    lead_id UUID UNIQUE REFERENCES sw_global_leads(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sw_global_accounts_client ON sw_global_accounts(client_code);
CREATE INDEX IF NOT EXISTS idx_sw_global_accounts_status ON sw_global_accounts(status);
CREATE INDEX IF NOT EXISTS idx_sw_global_accounts_branch_id ON sw_global_accounts(branch_id);

ALTER TABLE sw_global_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access sw_global_accounts" ON sw_global_accounts;
CREATE POLICY "Service role full access sw_global_accounts" ON sw_global_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. SW GLOBAL UPLOADS TABLE (CSV Imports & Documents)
CREATE TABLE IF NOT EXISTS sw_global_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(100) NOT NULL CHECK (kind IN ('Accounts CSV', 'Leads CSV', 'Events CSV', 'Account documents')),
    file_path TEXT,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(100),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sw_global_uploads_kind ON sw_global_uploads(kind);
CREATE INDEX IF NOT EXISTS idx_sw_global_uploads_created_by ON sw_global_uploads(created_by);

ALTER TABLE sw_global_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access sw_global_uploads" ON sw_global_uploads;
CREATE POLICY "Service role full access sw_global_uploads" ON sw_global_uploads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Seed Initial Sample Data (if tables are empty)
DO $$
DECLARE
    e1_id UUID := '11111111-1111-1111-1111-111111111101';
    e2_id UUID := '11111111-1111-1111-1111-111111111102';
    e3_id UUID := '11111111-1111-1111-1111-111111111103';
    l1_id UUID := '22222222-2222-2222-2222-222222222201';
    l2_id UUID := '22222222-2222-2222-2222-222222222202';
    l3_id UUID := '22222222-2222-2222-2222-222222222203';
    l4_id UUID := '22222222-2222-2222-2222-222222222204';
    l5_id UUID := '22222222-2222-2222-2222-222222222205';
    l6_id UUID := '22222222-2222-2222-2222-222222222206';
    l7_id UUID := '22222222-2222-2222-2222-222222222207';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sw_global_clients LIMIT 1) THEN
        -- Seed Clients
        INSERT INTO sw_global_clients (code, name, location, occupation, contact, email)
        VALUES
            ('SW1001', 'Arjun Mehta', 'Mumbai', 'Business owner', '9820011001', 'arjun.mehta@example.com'),
            ('SW1002', 'Priya Nair', 'Bengaluru', 'Consultant', '9845011002', 'priya.nair@example.com'),
            ('SW1003', 'Rohan Shah', 'Mumbai', 'Entrepreneur', '9821011003', 'rohan.shah@example.com'),
            ('SW1004', 'Ananya Iyer', 'Chennai', 'Doctor', '9840011004', 'ananya.iyer@example.com'),
            ('SW1005', 'Neha Desai', 'Pune', 'Architect', '9822011005', 'neha.desai@example.com')
        ON CONFLICT (code) DO NOTHING;

        -- Seed Events
        INSERT INTO sw_global_events (id, title, type, date, status, notes)
        VALUES
            (e1_id, 'Global investing essentials', 'Webinar', '2026-09-08', 'Conducted', 'Introduction to the SW Global account.'),
            (e2_id, 'Beyond borders: portfolio perspectives', 'Seminar', '2026-09-05', 'Conducted', 'High net worth global asset allocation seminar.'),
            (e3_id, 'SW Global client connect', 'Client meet', '2026-09-24', 'Planned', 'Quarterly global markets overview.')
        ON CONFLICT (id) DO NOTHING;

        -- Seed Leads
        INSERT INTO sw_global_leads (id, event_id, name, contact, location, stage, notes, followup)
        VALUES
            (l1_id, e1_id, 'Arjun Mehta', '9820011001', 'Mumbai', 'Converted', '', NULL),
            (l2_id, e1_id, 'Dev Patel', '9824011006', 'Ahmedabad', 'Qualified', 'Requested account details.', '2026-09-15'),
            (l3_id, e1_id, 'Isha Rao', '9849011007', 'Hyderabad', 'Contacted', '', '2026-09-16'),
            (l4_id, e2_id, 'Rohan Shah', '9821011003', 'Mumbai', 'Converted', '', NULL),
            (l5_id, e2_id, 'Aditi Menon', '9847011008', 'Kochi', 'New', '', NULL),
            (l6_id, e2_id, 'Karan Sethi', '9811011009', 'Delhi', 'Not interested', '', NULL),
            (l7_id, e3_id, 'Riya Kapoor', '9810011010', 'Delhi', 'New', 'Registered interest.', NULL)
        ON CONFLICT (id) DO NOTHING;

        -- Seed Accounts
        INSERT INTO sw_global_accounts (account_no, client_code, status, pending_reason, followup, lead_id)
        VALUES
            ('SW-001', 'SW1001', 'Active', '', NULL, l1_id),
            ('SW-002', 'SW1002', 'Pending', 'KYC documents awaited', '2026-09-15', NULL),
            ('SW-003', 'SW1003', 'Active', '', NULL, l4_id),
            ('SW-004', 'SW1004', 'Pending', 'Bank verification', '2026-09-14', NULL),
            ('SW-005', 'SW1005', 'Pending', 'Client signature awaited', '2026-09-16', NULL),
            ('SW-006', 'SW1001', 'Active', '', NULL, NULL)
        ON CONFLICT (account_no) DO NOTHING;
    END IF;
END $$;
