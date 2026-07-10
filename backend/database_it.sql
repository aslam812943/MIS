-- IT DEPARTMENT DATABASE SCHEMA
-- Run these commands in your Supabase SQL Editor to set up the IT department tables.

DROP TABLE IF EXISTS it_audit_findings CASCADE;
DROP TABLE IF EXISTS it_audits CASCADE;
DROP TABLE IF EXISTS it_assets CASCADE;
DROP TABLE IF EXISTS it_vendors CASCADE;
DROP TABLE IF EXISTS it_diagrams CASCADE;
DROP TABLE IF EXISTS it_cybersecurity_compliance CASCADE;
DROP TABLE IF EXISTS it_tickets CASCADE;
DROP TABLE IF EXISTS it_incidents CASCADE;
DROP TABLE IF EXISTS it_projects CASCADE;

-- 1. IT AUDITS TABLE
CREATE TABLE IF NOT EXISTS it_audits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_name VARCHAR(255) NOT NULL,
    audit_type VARCHAR(100) NOT NULL CHECK (audit_type IN ('Internal', 'CERT-In Empanelled External', 'SEBI-Mandated Cyber Audit', 'VAPT')),
    tor_document_url TEXT,
    auditor_name VARCHAR(255) NOT NULL,
    scheduled_date DATE NOT NULL,
    start_date DATE,
    end_date DATE,
    submission_deadline DATE NOT NULL,
    actual_submission_date DATE,
    status VARCHAR(50) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Report Received', 'Submitted', 'Overdue')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. IT AUDIT FINDINGS TABLE
CREATE TABLE IF NOT EXISTS it_audit_findings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_id UUID REFERENCES it_audits(id) ON DELETE CASCADE,
    finding_id VARCHAR(50) NOT NULL,
    finding_description TEXT NOT NULL,
    domain VARCHAR(100) NOT NULL CHECK (domain IN ('Governance', 'Infrastructure', 'Data Security', 'Network Security', 'Access Control', 'Incident Management')),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    recommended_action TEXT NOT NULL,
    responsible_person VARCHAR(255) NOT NULL,
    implementation_target_date DATE NOT NULL,
    actual_implementation_date DATE,
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Implemented', 'Closed', 'Overdue')),
    notification_lead_time_days INT DEFAULT 7,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. IT VENDORS TABLE
CREATE TABLE IF NOT EXISTS it_vendors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('Hardware', 'Software', 'Network & ISP', 'Cloud', 'Security', 'AMC Service')),
    poc_name VARCHAR(255) NOT NULL,
    poc_email VARCHAR(255) NOT NULL,
    poc_phone VARCHAR(50) NOT NULL,
    other_members TEXT,
    remarks TEXT,
    amc_last_paid_date DATE,
    amc_due_date DATE NOT NULL,
    notification_lead_time_days INT DEFAULT 15,
    contract_value NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Under Renewal', 'Expired', 'Terminated')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. IT ASSETS TABLE
CREATE TABLE IF NOT EXISTS it_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id VARCHAR(100) UNIQUE NOT NULL,
    asset_type VARCHAR(100) NOT NULL CHECK (asset_type IN ('Desktop', 'Laptop', 'Server', 'Printer', 'Network Device', 'Software License')),
    make_model VARCHAR(255) NOT NULL,
    serial_number VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    purchase_value NUMERIC(15, 2) NOT NULL,
    vendor_id UUID REFERENCES it_vendors(id) ON DELETE SET NULL,
    assigned_to VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    useful_life_years INT NOT NULL,
    depreciation_method VARCHAR(100) DEFAULT 'Straight-Line' NOT NULL,
    warranty_start_date DATE,
    warranty_end_date DATE,
    amc_coverage BOOLEAN DEFAULT FALSE,
    criticality VARCHAR(50) NOT NULL CHECK (criticality IN ('Critical', 'Non-Critical')),
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Under Repair', 'Retired', 'Disposed')),
    time_to_upgrade BOOLEAN DEFAULT FALSE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. IT DIAGRAMS TABLE
CREATE TABLE IF NOT EXISTS it_diagrams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diagram_name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL CHECK (type IN ('Network Topology', 'Server Architecture', 'Data Center Layout')),
    version VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    description TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. IT CYBERSECURITY COMPLIANCE TABLE
CREATE TABLE IF NOT EXISTS it_cybersecurity_compliance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    compliance_domain VARCHAR(100) NOT NULL CHECK (compliance_domain IN ('Governance', 'Infrastructure', 'Data Security', 'Network Security', 'Access Control', 'Incident Management')),
    control_item TEXT NOT NULL,
    framework_reference VARCHAR(255) NOT NULL,
    last_assessed_date DATE,
    status VARCHAR(50) DEFAULT 'Due for Review' CHECK (status IN ('Compliant', 'Non-Compliant', 'Due for Review', 'In Remediation')),
    evidence_document_url TEXT,
    responsible_person VARCHAR(255) NOT NULL,
    next_review_date DATE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. IT TICKETS TABLE
CREATE TABLE IF NOT EXISTS it_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number VARCHAR(100) UNIQUE NOT NULL,
    requester_name VARCHAR(255) NOT NULL,
    issue_description TEXT NOT NULL,
    assigned_to VARCHAR(255),
    opened_date DATE NOT NULL,
    closed_date DATE,
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    sla_target_hours INT DEFAULT 24,
    is_sla_compliant BOOLEAN DEFAULT TRUE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. IT INCIDENTS TABLE
CREATE TABLE IF NOT EXISTS it_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_number VARCHAR(100) UNIQUE NOT NULL,
    incident_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    root_cause_analysis TEXT,
    remediation_action TEXT,
    status VARCHAR(50) DEFAULT 'Identified' CHECK (status IN ('Identified', 'Investigating', 'Mitigated', 'Resolved')),
    discovered_date DATE NOT NULL,
    resolved_date DATE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. IT PROJECTS TABLE
CREATE TABLE IF NOT EXISTS it_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    target_end_date DATE NOT NULL,
    actual_end_date DATE,
    status VARCHAR(50) DEFAULT 'Planning' CHECK (status IN ('Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for all IT tables
ALTER TABLE it_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_cybersecurity_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_projects ENABLE ROW LEVEL SECURITY;

-- Allow full access for Supabase Service Role on all tables
CREATE POLICY "Allow service role full access IT 1" ON it_audits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT 2" ON it_audit_findings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT 3" ON it_vendors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT 4" ON it_assets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT 5" ON it_diagrams FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT 6" ON it_cybersecurity_compliance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT 7" ON it_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT 8" ON it_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access IT 9" ON it_projects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users belonging to IT department or Admin role to read/write
CREATE POLICY "IT staff can select 1" ON it_audits FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 1" ON it_audits FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 1" ON it_audits FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select 2" ON it_audit_findings FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 2" ON it_audit_findings FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 2" ON it_audit_findings FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select 3" ON it_vendors FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 3" ON it_vendors FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 3" ON it_vendors FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select 4" ON it_assets FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 4" ON it_assets FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 4" ON it_assets FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select 5" ON it_diagrams FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 5" ON it_diagrams FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 5" ON it_diagrams FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select 6" ON it_cybersecurity_compliance FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 6" ON it_cybersecurity_compliance FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 6" ON it_cybersecurity_compliance FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select 7" ON it_tickets FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 7" ON it_tickets FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 7" ON it_tickets FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select 8" ON it_incidents FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 8" ON it_incidents FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 8" ON it_incidents FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE POLICY "IT staff can select 9" ON it_projects FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert 9" ON it_projects FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update 9" ON it_projects FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

-- Triggers for auto-updating updated_at timestamp on all 9 tables
CREATE TRIGGER on_it_audits_updated BEFORE UPDATE ON it_audits FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_audit_findings_updated BEFORE UPDATE ON it_audit_findings FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_vendors_updated BEFORE UPDATE ON it_vendors FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_assets_updated BEFORE UPDATE ON it_assets FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_diagrams_updated BEFORE UPDATE ON it_diagrams FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_cybersecurity_compliance_updated BEFORE UPDATE ON it_cybersecurity_compliance FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_tickets_updated BEFORE UPDATE ON it_tickets FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_incidents_updated BEFORE UPDATE ON it_incidents FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_it_projects_updated BEFORE UPDATE ON it_projects FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Insert IT department record into departments table (if it doesn't already exist)
INSERT INTO departments (name)
VALUES ('IT')
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
