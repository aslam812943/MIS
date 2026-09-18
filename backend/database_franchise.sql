-- Franchise Management System. Run the COMPLETE file in Supabase SQL Editor.
BEGIN;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'admin','ceo','managing_director','director','executive','hod','regional_manager',
  'employee','hr','content_creator','social_media_manager','franchise_owner','franchise_staff'
));

INSERT INTO departments(name) VALUES ('Franchise') ON CONFLICT(name) DO NOTHING;

CREATE TABLE IF NOT EXISTS franchise_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 120),
  description TEXT,
  joining_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(joining_fee >= 0),
  recurring_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(recurring_fee >= 0),
  billing_frequency TEXT NOT NULL DEFAULT 'None' CHECK(billing_frequency IN ('None','Monthly','Yearly')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO franchise_plans(name, active) VALUES
 ('Starter', true),
 ('Growth', true),
 ('Premier', true)
ON CONFLICT(name) DO NOTHING;

CREATE TABLE IF NOT EXISTS franchise_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  sale_product_type TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL,
  completion_criteria TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO franchise_products(code,name,sale_product_type,unit,completion_criteria) VALUES
 ('TRADING_DEMAT','Trading and Demat Account','Trading and Demat','Account package','Account package activated'),
 ('SW_GLOBAL','SW Global','SW Global','Subscription','Subscription activated'),
 ('PRIVILEGE','Privilege Customer','Privilege Customer','Membership','Membership activated'),
 ('MUTUAL_FUND','Mutual Fund','Mutual Fund','Order','Investment order confirmed'),
 ('CHILD_MUTUAL','Child Mutual Fund','Child Mutual Fund','Order','Investment order confirmed'),
 ('CHILD_DEMAT','Child Demat','Child Demat','Account','Account activated'),
 ('UNLISTED_SHARES','Unlisted Shares','Unlisted Shares','Shares','Share order fulfilled'),
 ('IEPF','IEPF','IEPF','Case','Case completed'),
 ('COURSE','Course','Course','Enrollment','Enrollment confirmed')
ON CONFLICT(code) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS franchise_code_seq;
CREATE TABLE IF NOT EXISTS franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE DEFAULT ('FR-' || lpad(nextval('franchise_code_seq')::text,6,'0')),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 255),
  owner_name TEXT NOT NULL CHECK(length(trim(owner_name)) BETWEEN 1 AND 255),
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT,
  address TEXT,
  postal_code TEXT,
  has_office BOOLEAN NOT NULL DEFAULT false,
  office_sqft NUMERIC(12,2),
  registered_on DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Draft','Active','Suspended','Closed')),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  remarks TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE franchises ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE TABLE IF NOT EXISTS franchise_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  membership_role TEXT NOT NULL DEFAULT 'owner' CHECK(membership_role IN ('owner','staff')),
  login_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(franchise_id, user_id)
);

ALTER TABLE franchise_users ADD COLUMN IF NOT EXISTS login_email TEXT;
-- Existing tables also need the composite unique key used by login upserts.
CREATE UNIQUE INDEX IF NOT EXISTS franchise_users_branch_user_unique
 ON public.franchise_users(franchise_id,user_id);
-- One role account can be assigned to multiple franchise branches.
DROP INDEX IF EXISTS franchise_role_login_unique;
CREATE INDEX IF NOT EXISTS franchise_role_login_lookup ON franchise_users(lower(login_email),membership_role);

CREATE TABLE IF NOT EXISTS franchise_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK(amount >= 0),
  sale_date DATE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS franchise_sales_branch_date_idx ON franchise_sales(franchise_id,sale_date);

CREATE TABLE IF NOT EXISTS franchise_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES franchise_plans(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS franchises_location_idx ON franchises(state,city,status);
CREATE INDEX IF NOT EXISTS franchise_users_user_idx ON franchise_users(user_id);
CREATE INDEX IF NOT EXISTS franchise_users_franchise_idx ON franchise_users(franchise_id);

GRANT USAGE, SELECT ON SEQUENCE franchise_code_seq TO service_role;

DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['franchise_plans','franchise_products','franchises','franchise_users','franchise_plan_assignments','franchise_sales'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS franchise_service_only ON %I',t);
  EXECUTE format('CREATE POLICY franchise_service_only ON %I FOR ALL TO service_role USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO service_role',t);
 END LOOP;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
