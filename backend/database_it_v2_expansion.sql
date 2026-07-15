-- IT DEPARTMENT EXPANSION MIGRATION (v2)
-- Adds: recurring Audit Filing schedule w/ days-to-go countdown, dedicated AMC
-- contracts (one vendor can cover multiple AMC items), WDV asset
-- depreciation, Servers & Configuration, Team Members & Duties, Software
-- Register. Layers on top of database_it.sql — run that first if not
-- already applied.
--
-- Confirmed with the business owner before writing this: it_audits/
-- it_vendors/it_assets currently hold only test data, so this migration
-- safely ALTERs those tables in place instead of requiring a data backfill.

-- ============================================================
-- 1. it_assets: switch depreciation to Written Down Value (WDV) @ 15%/year
-- ============================================================
ALTER TABLE it_assets ADD COLUMN IF NOT EXISTS depreciation_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00;
ALTER TABLE it_assets ALTER COLUMN depreciation_method SET DEFAULT 'WDV';
UPDATE it_assets SET depreciation_method = 'WDV' WHERE depreciation_method = 'Straight-Line';

-- ============================================================
-- 2. it_vendors: AMC tracking moves to its own table (a vendor can cover
--    more than one AMC item, e.g. server maintenance AND software support)
-- ============================================================
ALTER TABLE it_vendors DROP COLUMN IF EXISTS amc_last_paid_date;
ALTER TABLE it_vendors DROP COLUMN IF EXISTS amc_due_date;
ALTER TABLE it_vendors DROP COLUMN IF EXISTS notification_lead_time_days;
ALTER TABLE it_vendors DROP COLUMN IF EXISTS contract_value;

-- ============================================================
-- 3. it_amc_contracts — AMC renewal tracking w/ days-to-go countdown
-- ============================================================
DROP TABLE IF EXISTS it_amc_contracts CASCADE;
CREATE TABLE it_amc_contracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id UUID REFERENCES it_vendors(id) ON DELETE SET NULL,
    item_covered VARCHAR(255) NOT NULL,
    amc_start_date DATE NOT NULL,
    amc_renewal_date DATE NOT NULL,
    last_paid_date DATE,
    amc_amount NUMERIC(15, 2) DEFAULT 0.00,
    notification_lead_time_days INT DEFAULT 30,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Renewal Due', 'Renewed', 'Lapsed')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 4. it_audit_schedule — recurring audit filing + auto-computed due date.
--    HO-only: deliberately no branch_id, per confirmed scope.
-- ============================================================
DROP TABLE IF EXISTS it_audit_schedule CASCADE;
CREATE TABLE it_audit_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_type VARCHAR(100) NOT NULL CHECK (audit_type IN ('System Audit', 'Cybersecurity Audit', 'VAPT')),
    recurrence_months INT NOT NULL CHECK (recurrence_months > 0),
    last_filing_date DATE NOT NULL,
    -- Server-computed on every insert/update as last_filing_date + recurrence_months.
    -- Never accepted directly from the client (see ITService.computeNextAuditDueDate).
    next_due_date DATE NOT NULL,
    auditor_name VARCHAR(255),
    report_upload_url TEXT,
    status VARCHAR(50) DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Filed', 'Overdue')),
    is_ad_hoc BOOLEAN DEFAULT FALSE,
    trigger_event_description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 5. it_servers — server-specific operational configuration
-- ============================================================
DROP TABLE IF EXISTS it_servers CASCADE;
CREATE TABLE it_servers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    server_name VARCHAR(255) UNIQUE NOT NULL,
    linked_asset_id UUID REFERENCES it_assets(id) ON DELETE SET NULL,
    role_purpose VARCHAR(255) NOT NULL,
    physical_or_virtual VARCHAR(50) NOT NULL CHECK (physical_or_virtual IN ('Physical', 'Virtual')),
    os VARCHAR(255),
    cpu VARCHAR(255),
    ram VARCHAR(100),
    storage VARCHAR(255),
    ip_address VARCHAR(100),
    location_rack VARCHAR(255),
    assigned_admin VARCHAR(255),
    last_config_update_date DATE,
    linked_diagram_id UUID REFERENCES it_diagrams(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 6. it_team_duties — IT team roster: who owns what, escalation order.
--    References profiles for identity instead of duplicating name/contact.
--    Org-wide roster, deliberately no branch_id.
-- ============================================================
DROP TABLE IF EXISTS it_team_duties CASCADE;
CREATE TABLE it_team_duties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    designation VARCHAR(255) NOT NULL,
    duties_responsibilities TEXT NOT NULL,
    escalation_priority INT CHECK (escalation_priority > 0),
    reporting_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 7. it_software — software/license register w/ AMC-style renewal countdown
-- ============================================================
DROP TABLE IF EXISTS it_software CASCADE;
CREATE TABLE it_software (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    software_name VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    purpose_for VARCHAR(255) NOT NULL,
    used_by VARCHAR(255) NOT NULL,
    amc_renewal_date DATE,
    po_number VARCHAR(100),
    po_pdf_url TEXT,
    vendor_id UUID REFERENCES it_vendors(id) ON DELETE SET NULL,
    number_of_licenses INT DEFAULT 1 CHECK (number_of_licenses > 0),
    notification_lead_time_days INT DEFAULT 30,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring Soon', 'Expired')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- RLS: enable + mirror the exact "service role full access" / "IT staff or
-- admin can select/insert/update" pattern used by every other it_* table.
-- ============================================================
ALTER TABLE it_amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_audit_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_team_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_software ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access IT AMC" ON it_amc_contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT Audit Schedule" ON it_audit_schedule FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT Servers" ON it_servers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT Team Duties" ON it_team_duties FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT Software" ON it_software FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "IT staff can select amc" ON it_amc_contracts FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert amc" ON it_amc_contracts FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update amc" ON it_amc_contracts FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select audit schedule" ON it_audit_schedule FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert audit schedule" ON it_audit_schedule FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update audit schedule" ON it_audit_schedule FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select servers" ON it_servers FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert servers" ON it_servers FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update servers" ON it_servers FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select team duties" ON it_team_duties FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert team duties" ON it_team_duties FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update team duties" ON it_team_duties FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select software" ON it_software FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert software" ON it_software FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update software" ON it_software FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER on_it_amc_contracts_updated BEFORE UPDATE ON it_amc_contracts FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_audit_schedule_updated BEFORE UPDATE ON it_audit_schedule FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_servers_updated BEFORE UPDATE ON it_servers FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_team_duties_updated BEFORE UPDATE ON it_team_duties FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_software_updated BEFORE UPDATE ON it_software FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

NOTIFY pgrst, 'reload schema';
