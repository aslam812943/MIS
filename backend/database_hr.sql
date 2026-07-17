-- HR DEPARTMENT SCHEMA
-- Recruitment pipeline (Open Positions + Candidates), Policy Repository,
-- and employee Document Management. HR access is purely role-based
-- (profiles.role IN ('admin','hr')) — there is no HR department-membership
-- or branch-scoping concept anywhere else in this app, so unlike IT/DP
-- these tables are all HO-only/org-wide by design: no branch_id column.

DROP TABLE IF EXISTS hr_candidates CASCADE;
DROP TABLE IF EXISTS hr_open_positions CASCADE;
DROP TABLE IF EXISTS hr_policies CASCADE;
DROP TABLE IF EXISTS hr_documents CASCADE;

-- 1. OPEN POSITIONS (job requisitions)
CREATE TABLE IF NOT EXISTS hr_open_positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    position_title VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL, -- which branch is hiring; a data field, not an access-scoping column
    number_of_openings INT NOT NULL DEFAULT 1 CHECK (number_of_openings > 0),
    date_opened DATE NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Urgent', 'Normal', 'Low')),
    job_description TEXT,
    job_description_url TEXT,
    requested_by VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'On Hold', 'Closed', 'Filled')),
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CANDIDATES (linked to an Open Position, moves through hiring stages)
CREATE TABLE IF NOT EXISTS hr_candidates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20),
    email VARCHAR(255),
    position_id UUID REFERENCES hr_open_positions(id) ON DELETE SET NULL,
    source VARCHAR(50) CHECK (source IN ('Referral', 'Job Portal', 'Walk-in', 'LinkedIn', 'Other')),
    resume_url TEXT,
    stage VARCHAR(50) NOT NULL DEFAULT 'Applied' CHECK (stage IN ('Applied', 'Screening', 'Interview Scheduled', 'Interviewed', 'Offer Extended', 'Offer Accepted', 'Joined', 'Rejected')),
    interviewers VARCHAR(500),
    feedback_notes TEXT,
    expected_salary NUMERIC(12, 2),
    offered_salary NUMERIC(12, 2),
    rejection_reason TEXT,
    joining_date DATE,
    -- Set once an employee login account is auto-created for this candidate
    -- (see HRService.updateEntry's stage->'Joined' trigger). Also the
    -- idempotency guard: prevents creating a second account if the row is
    -- saved again while already at 'Joined'.
    created_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. HR POLICY REPOSITORY (versioned policy PDFs)
CREATE TABLE IF NOT EXISTS hr_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) CHECK (category IN ('Leave', 'Conduct', 'Safety', 'IT Usage', 'Compliance', 'Other')),
    version_number VARCHAR(50) NOT NULL,
    effective_date DATE NOT NULL,
    superseded_date DATE,
    pdf_url TEXT NOT NULL,
    applicable_to VARCHAR(50) NOT NULL DEFAULT 'All Employees' CHECK (applicable_to IN ('All Employees', 'Specific Department', 'Specific Role')),
    applicable_to_detail VARCHAR(255),
    acknowledgement_required BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Active', 'Superseded', 'Draft')),
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE, -- also serves as "Uploaded By"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. HR DOCUMENT MANAGEMENT (per-employee documents)
CREATE TABLE IF NOT EXISTS hr_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('Offer Letter', 'Appointment Letter', 'PAN', 'Aadhaar', 'Educational Certificate', 'Bank Proof', 'Performance Review', 'Exit Document', 'Other')),
    document_reference VARCHAR(255),
    upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    file_url TEXT NOT NULL,
    -- Label only for now (confirmed with business owner) — not yet used to
    -- filter query results. A future pass can add row-level filtering
    -- without a schema change.
    confidentiality_level VARCHAR(50) NOT NULL DEFAULT 'Standard' CHECK (confidentiality_level IN ('Standard', 'Confidential')),
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE hr_open_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_documents ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Allow service role full access HR 1" ON hr_open_positions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access HR 2" ON hr_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access HR 3" ON hr_policies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access HR 4" ON hr_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated access gated by role (admin or hr) — no department-membership
-- subquery, since HR access has never been department-scoped in this app.
CREATE POLICY "HR staff can select 1" ON hr_open_positions FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));
CREATE POLICY "HR staff can insert 1" ON hr_open_positions FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));
CREATE POLICY "HR staff can update 1" ON hr_open_positions FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));

CREATE POLICY "HR staff can select 2" ON hr_candidates FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));
CREATE POLICY "HR staff can insert 2" ON hr_candidates FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));
CREATE POLICY "HR staff can update 2" ON hr_candidates FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));

CREATE POLICY "HR staff can select 3" ON hr_policies FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));
CREATE POLICY "HR staff can insert 3" ON hr_policies FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));
CREATE POLICY "HR staff can update 3" ON hr_policies FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));

CREATE POLICY "HR staff can select 4" ON hr_documents FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));
CREATE POLICY "HR staff can insert 4" ON hr_documents FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));
CREATE POLICY "HR staff can update 4" ON hr_documents FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr')));

-- updated_at triggers
CREATE TRIGGER on_hr_open_positions_updated BEFORE UPDATE ON hr_open_positions FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_hr_candidates_updated BEFORE UPDATE ON hr_candidates FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_hr_policies_updated BEFORE UPDATE ON hr_policies FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
CREATE TRIGGER on_hr_documents_updated BEFORE UPDATE ON hr_documents FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

NOTIFY pgrst, 'reload schema';
