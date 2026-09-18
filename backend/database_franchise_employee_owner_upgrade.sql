-- Enable Employee/HOD franchise logins and product sale entries on an existing database.
-- Run the COMPLETE file once in Supabase SQL Editor. Existing data is preserved.
BEGIN;
ALTER TABLE public.franchise_users ADD COLUMN IF NOT EXISTS login_email TEXT;
-- Existing tables also need the composite unique key used by login upserts.
CREATE UNIQUE INDEX IF NOT EXISTS franchise_users_branch_user_unique
 ON public.franchise_users(franchise_id,user_id);
DROP INDEX IF EXISTS public.franchise_role_login_unique;
CREATE INDEX IF NOT EXISTS franchise_role_login_lookup ON public.franchise_users(lower(login_email),membership_role);
CREATE TABLE IF NOT EXISTS public.franchise_sales (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
 product TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 amount NUMERIC(14,2) NOT NULL CHECK(amount >= 0),
 sale_date DATE NOT NULL,
 created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS franchise_sales_branch_date_idx ON public.franchise_sales(franchise_id,sale_date);
ALTER TABLE public.franchise_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS franchise_service_only ON public.franchise_sales;
CREATE POLICY franchise_service_only ON public.franchise_sales FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON TABLE public.franchise_sales FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.franchise_sales TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
