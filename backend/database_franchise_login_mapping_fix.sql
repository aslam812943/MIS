-- Repair error 42P10 when saving franchise login mappings.
-- Run this COMPLETE file in Supabase SQL Editor. No accounts or rows are deleted.
BEGIN;
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM public.franchise_users
  GROUP BY franchise_id,user_id HAVING count(*) > 1
 ) THEN
  RAISE EXCEPTION 'Duplicate franchise/user pairs exist. Review franchise_users before adding the unique key; this repair does not delete or merge accounts.';
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS franchise_users_branch_user_unique
 ON public.franchise_users(franchise_id,user_id);
NOTIFY pgrst,'reload schema';
COMMIT;
