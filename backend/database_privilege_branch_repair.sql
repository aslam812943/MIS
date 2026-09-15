-- Repair branch links for Privilege accounts imported before CSV branch mapping.
-- Matching is case-insensitive, so "TVM" and "tvm" use the same branch.

INSERT INTO branches (name)
SELECT DISTINCT trim(pa.branch)
FROM privilege_accounts pa
WHERE NULLIF(trim(pa.branch), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM branches b WHERE lower(trim(b.name)) = lower(trim(pa.branch))
  );

UPDATE privilege_accounts pa
SET branch_id = b.id,
    updated_at = timezone('utc'::text, now())
FROM branches b
WHERE pa.branch_id IS NULL
  AND NULLIF(trim(pa.branch), '') IS NOT NULL
  AND lower(trim(b.name)) = lower(trim(pa.branch));
