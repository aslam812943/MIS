-- IEPF CLAIMS DATABASE SCHEMA
-- Run these commands in your Supabase SQL Editor to set up the iepf_claims table.

-- Drop table first to ensure schema changes are applied cleanly
DROP TABLE IF EXISTS iepf_claims CASCADE;

-- 1. CREATE IEPF CLAIMS TABLE
CREATE TABLE IF NOT EXISTS iepf_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    claim_number VARCHAR(100) UNIQUE NOT NULL,
    investor_name VARCHAR(255) NOT NULL,
    client_id VARCHAR(100), -- Nullable now as it's hidden from the UI
    pan_number VARCHAR(20) NOT NULL,
    claim_type VARCHAR(50) CHECK (claim_type IN ('Dividend', 'Shares', 'Both')),
    amount NUMERIC(15, 2) DEFAULT 0.00,
    num_shares INT DEFAULT 0,
    claim_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'New' CHECK (status IN ('New', 'Under Verification', 'Documents Pending', 'Approved', 'Rejected', 'Closed')),
    expected_closure_date DATE,
    pending_reasons TEXT[] DEFAULT '{}',
    closed_date DATE,
    resolution_remarks TEXT,
    amount_released NUMERIC(15, 2) DEFAULT 0.00,
    shares_released INT DEFAULT 0,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE iepf_claims ENABLE ROW LEVEL SECURITY;

-- 3. DEFINE ROW LEVEL SECURITY POLICIES
-- Allow service role full access (Backend bypasses RLS using service_role key)
CREATE POLICY "Allow service role full access" ON iepf_claims FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Employees can read only claims they created. IEPF HODs and executives can
-- read every IEPF claim for team oversight.
CREATE POLICY "IEPF claim visibility by role" ON iepf_claims FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (
                profiles.role IN ('admin', 'ceo', 'managing_director', 'director', 'executive')
                OR (profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IEPF')
                    AND (profiles.role = 'hod' OR iepf_claims.created_by = auth.uid()))
              )
        )
    );

-- Users must create claims as themselves; this prevents impersonating another employee.
CREATE POLICY "IEPF staff can create own claims" ON iepf_claims FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (profiles.role IN ('admin', 'ceo', 'managing_director', 'director', 'executive')
                   OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IEPF'))
        )
        AND created_by = auth.uid()
    );

-- Employees can update only their own claims; IEPF HODs and executives manage all.
CREATE POLICY "IEPF claim updates by role" ON iepf_claims FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
              AND (
                profiles.role IN ('admin', 'ceo', 'managing_director', 'director', 'executive')
                OR (profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IEPF')
                    AND (profiles.role = 'hod' OR iepf_claims.created_by = auth.uid()))
              )
        )
    );

-- Match delete access to update access.
CREATE POLICY "IEPF claim deletes by role" ON iepf_claims FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                profiles.role IN ('admin', 'ceo', 'managing_director', 'director', 'executive')
                OR (profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IEPF')
                    AND (profiles.role = 'hod' OR iepf_claims.created_by = auth.uid()))
              )
        )
    );

-- 4. AUTO-UPDATE UPDATED_AT ON CLAIMS
DROP TRIGGER IF EXISTS on_iepf_claim_updated ON iepf_claims;
CREATE TRIGGER on_iepf_claim_updated
    BEFORE UPDATE ON iepf_claims
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

-- 5. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
