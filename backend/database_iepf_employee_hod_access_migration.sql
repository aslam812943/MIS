-- IEPF employee/HOD access migration (safe for an existing database).
-- Run this file in Supabase SQL Editor. It does not delete claim records.

ALTER TABLE iepf_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "IEPF staff can view department claims" ON iepf_claims;
DROP POLICY IF EXISTS "IEPF staff can insert claims" ON iepf_claims;
DROP POLICY IF EXISTS "IEPF staff can update claims" ON iepf_claims;
DROP POLICY IF EXISTS "IEPF claim visibility by role" ON iepf_claims;
DROP POLICY IF EXISTS "IEPF staff can create own claims" ON iepf_claims;
DROP POLICY IF EXISTS "IEPF claim updates by role" ON iepf_claims;
DROP POLICY IF EXISTS "IEPF claim deletes by role" ON iepf_claims;

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

NOTIFY pgrst, 'reload schema';
