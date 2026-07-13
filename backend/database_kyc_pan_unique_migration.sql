-- KYC PAN UNIQUENESS MIGRATION
-- Run this once against the existing Supabase project (SQL Editor) to add the
-- database-level safety net that stops the same PAN from being onboarded
-- twice in kyc_new_account. The application now blocks this too, but the DB
-- constraint is the real backstop against a race condition (two requests
-- both passing the app-level check at the same instant).
--
-- Safe to run: it only ADDS a constraint, it does not touch existing rows.
-- It WILL fail if duplicate PANs already exist in the table — run the check
-- below first and clean up any duplicates before applying the constraint.

-- STEP 1: Check for existing duplicate PANs first.
-- If this returns zero rows, skip straight to STEP 3.
SELECT pan, COUNT(*) AS duplicate_count, array_agg(id) AS record_ids
FROM kyc_new_account
GROUP BY pan
HAVING COUNT(*) > 1;

-- STEP 2 (only if STEP 1 returned rows): decide which record per duplicate
-- PAN is the correct one to keep, then either delete or re-key the others
-- before proceeding. This needs a human decision — do not blindly delete.

-- STEP 3: Add the uniqueness constraint (idempotent — safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kyc_new_account_pan_unique'
  ) THEN
    ALTER TABLE kyc_new_account ADD CONSTRAINT kyc_new_account_pan_unique UNIQUE (pan);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
