-- Lets admin control which dashboard widgets (KPI cards / charts) are
-- visible to each (role, department) position — e.g. "KYC HOD only sees
-- Pending Verifications, nothing else". Configured per role+department
-- combination, not per individual user, so it stays manageable as staff
-- come and go.
--
-- Design: only rows that admin has explicitly touched exist here. A widget
-- with NO row for a given (role, department) is treated as VISIBLE by the
-- backend/frontend default — this means every dashboard looks exactly like
-- it does today until admin actively starts unchecking specific widgets for
-- a specific position. Nothing breaks the day this ships.
--
-- department_id is nullable: roles that aren't department-scoped (admin,
-- ceo, managing_director, director, executive) always see every widget on
-- every dashboard regardless of this table — enforced in application code,
-- not here — so no rows are ever created for those roles.

CREATE TABLE IF NOT EXISTS dashboard_widget_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    widget_key VARCHAR(150) NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Note: Postgres treats two NULL department_id values as non-conflicting
    -- under this constraint, so it does NOT prevent duplicate rows for
    -- org-wide roles (ceo/managing_director/director/executive) or hr —
    -- those always have department_id NULL. DashboardPermissionService
    -- avoids relying on this constraint for them (delete-then-insert
    -- instead of upsert-on-conflict). Still useful, harmless defense-in-depth
    -- for the common department-scoped (hod/employee/regional_manager) case.
    UNIQUE (role, department_id, widget_key)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widget_permissions_lookup
    ON dashboard_widget_permissions (role, department_id);

ALTER TABLE dashboard_widget_permissions ENABLE ROW LEVEL SECURITY;

-- Backend always uses the service-role client for this app (see every other
-- database_*.sql file in this repo) — RLS here is defense-in-depth only,
-- mirroring the admin/hr-gated pattern used by database_hr.sql.
DROP POLICY IF EXISTS "Admins can manage dashboard widget permissions" ON dashboard_widget_permissions;
CREATE POLICY "Admins can manage dashboard widget permissions"
    ON dashboard_widget_permissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Authenticated users can read dashboard widget permissions" ON dashboard_widget_permissions;
CREATE POLICY "Authenticated users can read dashboard widget permissions"
    ON dashboard_widget_permissions
    FOR SELECT
    USING (auth.role() = 'authenticated');
