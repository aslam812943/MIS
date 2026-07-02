-- 1. DROP OLD TABLES (Cascades drops old policies and triggers)
DROP TABLE IF EXISTS settlement_ipo_allocation CASCADE;
DROP TABLE IF EXISTS settlement_corporate_actions CASCADE;

-- 2. RECREATE IPO ALLOCATION TABLE
CREATE TABLE settlement_ipo_allocation (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_no VARCHAR(100) UNIQUE NOT NULL,
    client_id VARCHAR(100) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    ipo_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('Retail', 'HNI', 'QIB', 'Employee')),
    applied_qty INT NOT NULL CHECK (applied_qty > 0),
    allotted_qty INT DEFAULT 0 CHECK (allotted_qty >= 0),
    status VARCHAR(50) DEFAULT 'Applied' CHECK (status IN ('Applied', 'Allotted', 'Refunded', 'Partially Allotted')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RECREATE CORPORATE ACTION ALLOCATION TABLE
CREATE TABLE settlement_corporate_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id VARCHAR(100) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    stock_symbol VARCHAR(50) NOT NULL,
    corporate_action VARCHAR(100) NOT NULL CHECK (corporate_action IN ('Dividend', 'Bonus', 'Stock Split', 'Rights Issue')),
    record_date DATE NOT NULL,
    quantity INT NOT NULL CHECK (quantity >= 0),
    eligible VARCHAR(10) NOT NULL CHECK (eligible IN ('Yes', 'No')),
    entitlement_amt_qty NUMERIC(15, 2) DEFAULT 0.00 CHECK (entitlement_amt_qty >= 0),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ENABLE ROW LEVEL SECURITY (RLS) FOR NEW TABLES
ALTER TABLE settlement_ipo_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_corporate_actions ENABLE ROW LEVEL SECURITY;

-- 5. DEFINE ROW LEVEL SECURITY POLICIES
CREATE POLICY "Allow service role full access IPO" ON settlement_ipo_allocation FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access CA" ON settlement_corporate_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users in Settlements department (or Admins) to view records
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

-- 6. AUTO-UPDATE UPDATED_AT ON CHANGES
CREATE TRIGGER on_settlement_ipo_updated BEFORE UPDATE ON settlement_ipo_allocation FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_settlement_ca_updated BEFORE UPDATE ON settlement_corporate_actions FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- 7. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
