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

-- Safe migration for databases created before branch support was added.
ALTER TABLE sw_global_accounts
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

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

-- 7. Reset SW Global data and seed fresh test data using existing branches
-- WARNING: Running this section removes all current SW Global records.
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
    branch_ids UUID[];
    branch_count INTEGER;
BEGIN
    SELECT array_agg(id ORDER BY name, id)
    INTO branch_ids
    FROM branches;

    branch_count := COALESCE(array_length(branch_ids, 1), 0);
    IF branch_count = 0 THEN
        RAISE EXCEPTION 'Cannot seed SW Global test data: no existing branches were found.';
    END IF;

    -- Delete child records first to preserve foreign-key integrity.
    DELETE FROM sw_global_uploads;
    DELETE FROM sw_global_accounts;
    DELETE FROM sw_global_leads;
    DELETE FROM sw_global_events;
    DELETE FROM sw_global_clients;

    INSERT INTO sw_global_clients (code, name, location, occupation, contact, email)
    VALUES
        ('SW2001', 'Aarav Sharma', 'Mumbai', 'Business owner', '9900012001', 'aarav.sharma@test.example'),
        ('SW2002', 'Meera Kulkarni', 'Pune', 'Consultant', '9900012002', 'meera.kulkarni@test.example'),
        ('SW2003', 'Vikram Reddy', 'Hyderabad', 'Entrepreneur', '9900012003', 'vikram.reddy@test.example'),
        ('SW2004', 'Kavya Iyer', 'Chennai', 'Doctor', '9900012004', 'kavya.iyer@test.example'),
        ('SW2005', 'Kabir Singh', 'Delhi', 'Architect', '9900012005', 'kabir.singh@test.example'),
        ('SW2006', 'Nisha Patel', 'Ahmedabad', 'Chartered accountant', '9900012006', 'nisha.patel@test.example'),
        ('SW2007', 'Aditya Nair', 'Bengaluru', 'Technology executive', '9900012007', 'aditya.nair@test.example'),
        ('SW2008', 'Sara Khan', 'Kolkata', 'Investor', '9900012008', 'sara.khan@test.example');

    INSERT INTO sw_global_events (id, title, type, date, status, notes)
    VALUES
        (e1_id, 'International investing fundamentals', 'Webinar', CURRENT_DATE - 14, 'Conducted', 'Test webinar for global account prospects.'),
        (e2_id, 'Global portfolio opportunities', 'Seminar', CURRENT_DATE - 7, 'Conducted', 'Test seminar for existing and prospective clients.'),
        (e3_id, 'SW Global investor connect', 'Client meet', CURRENT_DATE + 10, 'Planned', 'Upcoming test client engagement event.');

    INSERT INTO sw_global_leads (id, event_id, name, contact, location, stage, notes, followup)
    VALUES
        (l1_id, e1_id, 'Aarav Sharma', '9900012001', 'Mumbai', 'Converted', 'Converted test lead.', NULL),
        (l2_id, e1_id, 'Ritu Jain', '9900012010', 'Jaipur', 'Qualified', 'Requested account details.', CURRENT_DATE + 2),
        (l3_id, e1_id, 'Manav Joshi', '9900012011', 'Surat', 'Contacted', 'Initial call completed.', CURRENT_DATE + 3),
        (l4_id, e2_id, 'Vikram Reddy', '9900012003', 'Hyderabad', 'Converted', 'Converted after seminar.', NULL),
        (l5_id, e2_id, 'Tanvi Menon', '9900012012', 'Kochi', 'New', 'New test enquiry.', NULL),
        (l6_id, e2_id, 'Rahul Sethi', '9900012013', 'Delhi', 'Not interested', 'Declined for now.', NULL),
        (l7_id, e3_id, 'Simran Kapoor', '9900012014', 'Delhi', 'New', 'Registered for upcoming event.', NULL);

    -- Existing branches are assigned in name order and reused cyclically when
    -- there are fewer branches than test accounts.
    INSERT INTO sw_global_accounts
        (account_no, client_code, status, pending_reason, followup, lead_id, branch_id, created_at, updated_at)
    VALUES
        ('SWT-001', 'SW2001', 'Active',  '', NULL, l1_id, branch_ids[1 + (0 % branch_count)], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('SWT-002', 'SW2002', 'Pending', 'KYC documents awaited', CURRENT_DATE + 2, NULL, branch_ids[1 + (1 % branch_count)], CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
        ('SWT-003', 'SW2003', 'Active',  '', NULL, l4_id, branch_ids[1 + (2 % branch_count)], CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP),
        ('SWT-004', 'SW2004', 'Pending', 'Bank verification pending', CURRENT_DATE + 1, NULL, branch_ids[1 + (3 % branch_count)], CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP),
        ('SWT-005', 'SW2005', 'Closed',  '', NULL, NULL, branch_ids[1 + (4 % branch_count)], CURRENT_TIMESTAMP - INTERVAL '45 days', CURRENT_TIMESTAMP),
        ('SWT-006', 'SW2006', 'Active',  '', NULL, NULL, branch_ids[1 + (5 % branch_count)], CURRENT_TIMESTAMP - INTERVAL '100 days', CURRENT_TIMESTAMP),
        ('SWT-007', 'SW2007', 'Pending', 'Client signature awaited', CURRENT_DATE + 4, NULL, branch_ids[1 + (6 % branch_count)], CURRENT_TIMESTAMP - INTERVAL '250 days', CURRENT_TIMESTAMP),
        ('SWT-008', 'SW2008', 'Active',  '', NULL, NULL, branch_ids[1 + (7 % branch_count)], CURRENT_TIMESTAMP - INTERVAL '400 days', CURRENT_TIMESTAMP);
END $$;
