-- Franchise department. Run the COMPLETE file in Supabase SQL Editor.
-- Requires database.sql and database_sales.sql. Existing sales are preserved.
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
  registered_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Active','Suspended','Closed')),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  remarks TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((has_office AND office_sqft IS NOT NULL AND office_sqft > 0) OR (NOT has_office AND office_sqft IS NULL))
);
CREATE TABLE IF NOT EXISTS franchise_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  membership_role TEXT NOT NULL CHECK(membership_role IN ('owner','staff')),
  shared_access BOOLEAN NOT NULL DEFAULT false,
  login_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE franchise_users ADD COLUMN IF NOT EXISTS login_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS franchise_role_login_unique ON franchise_users(lower(login_email),membership_role) WHERE login_email IS NOT NULL;
ALTER TABLE franchise_users ADD COLUMN IF NOT EXISTS shared_access BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS franchise_manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  UNIQUE(franchise_id,user_id)
);
CREATE TABLE IF NOT EXISTS franchise_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES franchise_plans(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(franchise_id,effective_from)
);
CREATE TABLE IF NOT EXISTS franchise_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES franchise_plans(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES franchise_products(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK(method IN ('Fixed','Percentage')),
  value NUMERIC(14,4) NOT NULL CHECK(value >= 0),
  -- Percentages always apply to company revenue, never investment value.
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(method <> 'Percentage' OR value <= 100),
  UNIQUE(plan_id,product_id,effective_from)
);

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_product_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_product_type_check CHECK(product_type IN (
 'Trading and Demat','Mutual Fund','Unlisted Shares','Child Demat','Child Mutual Fund','IEPF','SW Global','Privilege Customer','Course'
));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id) ON DELETE RESTRICT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES franchise_products(id) ON DELETE RESTRICT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_reference TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS completed_date DATE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS decision_note TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS sales_id_franchise_unique ON sales(id,franchise_id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_franchise_order_unique ON sales(franchise_id,order_reference) WHERE franchise_id IS NOT NULL AND order_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS franchise_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE RESTRICT,
  sale_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES franchise_products(id) ON DELETE RESTRICT,
  recognition_date DATE NOT NULL,
  earning_type TEXT NOT NULL,
  reference TEXT NOT NULL,
  company_revenue NUMERIC(14,2) NOT NULL CHECK(company_revenue >= 0),
  franchise_amount NUMERIC(14,2) NOT NULL CHECK(franchise_amount >= 0),
  rule_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Approved','Rejected','Reversed')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(sale_id,franchise_id) REFERENCES sales(id,franchise_id) ON DELETE RESTRICT,
  UNIQUE(franchise_id,reference)
);
CREATE TABLE IF NOT EXISTS franchise_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE RESTRICT,
  owner TEXT NOT NULL CHECK(owner IN ('Company','Franchise')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK(amount > 0),
  expense_date DATE NOT NULL,
  allocation_basis TEXT,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Approved','Rejected','Reversed')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS franchise_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id UUID NOT NULL REFERENCES franchises(id) ON DELETE RESTRICT,
  earning_id UUID NOT NULL REFERENCES franchise_earnings(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL CHECK(direction IN ('Receipt','Payout')),
  amount NUMERIC(14,2) NOT NULL CHECK(amount > 0),
  payment_date DATE NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Verified' CHECK(status IN ('Verified','Reversed')),
  reversed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reversed_at TIMESTAMPTZ,
  reversal_note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(franchise_id,direction,reference)
);

CREATE INDEX IF NOT EXISTS franchises_location_idx ON franchises(state,city,status);
CREATE INDEX IF NOT EXISTS franchise_managers_user_idx ON franchise_manager_assignments(user_id);
CREATE INDEX IF NOT EXISTS sales_franchise_date_idx ON sales(franchise_id,completed_date,status);
CREATE INDEX IF NOT EXISTS franchise_earnings_date_idx ON franchise_earnings(franchise_id,recognition_date,status);
CREATE INDEX IF NOT EXISTS franchise_expenses_date_idx ON franchise_expenses(franchise_id,expense_date,status);
CREATE INDEX IF NOT EXISTS franchise_payments_earning_idx ON franchise_payments(earning_id,direction);
CREATE INDEX IF NOT EXISTS franchise_payments_date_idx ON franchise_payments(franchise_id,payment_date);

-- Only the authenticated backend uses these tables. Every endpoint checks
-- live profile, franchise membership/manager assignment and row ownership.
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['franchise_plans','franchise_products','franchises','franchise_users',
 'franchise_manager_assignments','franchise_plan_assignments','franchise_commission_rules',
 'franchise_earnings','franchise_expenses','franchise_payments'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS franchise_service_only ON %I',t);
  EXECUTE format('CREATE POLICY franchise_service_only ON %I FOR ALL TO service_role USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO service_role',t);
 END LOOP;
END $$;

-- Auth identities are created by the backend before this transaction. Save
-- the franchise, initial plan, profiles and access together or save none.
CREATE OR REPLACE FUNCTION onboard_franchise(p_data JSONB,p_plan UUID,p_actor UUID,p_users JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f UUID; u JSONB;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='admin' AND status='active') THEN RAISE EXCEPTION 'Only administrators can create franchise logins.'; END IF;
 IF jsonb_array_length(p_users) NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'Owner and staff login information is required.'; END IF;
 f:=register_franchise(p_data,p_plan,p_actor);
 FOR u IN SELECT value FROM jsonb_array_elements(p_users) LOOP
  INSERT INTO profiles(id,email,full_name,role,status,branch_id,department_id,allowed_modules)
  VALUES((u->>'id')::uuid,u->>'email',u->>'name',CASE WHEN u->>'role'='owner' THEN 'franchise_owner' ELSE 'franchise_staff' END,'active',NULL,NULL,'{}')
  ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,full_name=EXCLUDED.full_name,role=EXCLUDED.role,status='active',branch_id=NULL,department_id=NULL,allowed_modules='{}';
  INSERT INTO franchise_users(franchise_id,user_id,membership_role,shared_access,login_email)
  VALUES(f,(u->>'id')::uuid,u->>'role',coalesce((u->>'shared_access')::boolean,false),u->>'login_email');
 END LOOP;
 RETURN f;
END $$;
GRANT USAGE, SELECT ON SEQUENCE franchise_code_seq TO service_role;

-- Atomic registration: a franchise cannot be left without its initial plan.
CREATE OR REPLACE FUNCTION register_franchise(p_data JSONB,p_plan UUID,p_actor UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f UUID;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM franchise_plans WHERE id=p_plan AND active) THEN RAISE EXCEPTION 'Select an active plan.'; END IF;
 INSERT INTO franchises(name,owner_name,phone,email,state,city,area,address,postal_code,has_office,office_sqft,registered_on,status,branch_id,remarks,created_by)
 VALUES(p_data->>'name',p_data->>'owner_name',p_data->>'phone',p_data->>'email',p_data->>'state',p_data->>'city',p_data->>'area',p_data->>'address',p_data->>'postal_code',
 (p_data->>'has_office')::boolean,(p_data->>'office_sqft')::numeric,(p_data->>'registered_on')::date,p_data->>'status',(p_data->>'branch_id')::uuid,p_data->>'remarks',p_actor) RETURNING id INTO f;
 INSERT INTO franchise_plan_assignments(franchise_id,plan_id,effective_from,created_by) VALUES(f,p_plan,(p_data->>'registered_on')::date,p_actor);
 RETURN f;
END $$;

CREATE OR REPLACE FUNCTION submit_franchise_earning(p_data JSONB,p_actor UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s sales%ROWTYPE; a franchise_plan_assignments%ROWTYPE; r franchise_commission_rules%ROWTYPE;
 f UUID := (p_data->>'franchise_id')::uuid; d DATE := (p_data->>'recognition_date')::date;
 revenue NUMERIC := (p_data->>'company_revenue')::numeric; entitlement NUMERIC; snapshot JSONB; result UUID;
BEGIN
 SELECT * INTO s FROM sales WHERE id=(p_data->>'sale_id')::uuid AND franchise_id=f FOR UPDATE;
 IF s.id IS NULL OR s.status<>'Completed' THEN RAISE EXCEPTION 'Select a completed sale from this franchise.'; END IF;
 IF d<s.completed_date THEN RAISE EXCEPTION 'Recognition date cannot precede sale completion.'; END IF;
 SELECT * INTO a FROM franchise_plan_assignments WHERE franchise_id=f AND effective_from<=d ORDER BY effective_from DESC LIMIT 1;
 IF coalesce((p_data->>'use_rule')::boolean,false) THEN
  SELECT * INTO r FROM franchise_commission_rules WHERE plan_id=a.plan_id AND product_id=s.product_id AND effective_from<=d ORDER BY effective_from DESC LIMIT 1;
  IF r.id IS NULL THEN RAISE EXCEPTION 'No commission rule applies. Configure a rule or enter a manual earning.'; END IF;
  entitlement := CASE WHEN r.method='Fixed' THEN r.value ELSE round(revenue*r.value/100,2) END;
  snapshot := jsonb_build_object('plan_id',a.plan_id,'rule_id',r.id,'method',r.method,'value',r.value,'basis','Company revenue','effective_from',r.effective_from);
 ELSE
  entitlement := (p_data->>'franchise_amount')::numeric;
  IF length(trim(coalesce(p_data->>'manual_reason','')))<5 THEN RAISE EXCEPTION 'Explain the manual commission calculation.'; END IF;
  snapshot := jsonb_build_object('plan_id',a.plan_id,'method','Manual','reason',p_data->>'manual_reason');
 END IF;
 INSERT INTO franchise_earnings(franchise_id,sale_id,product_id,recognition_date,earning_type,reference,company_revenue,franchise_amount,rule_snapshot,created_by)
 VALUES(f,s.id,s.product_id,d,p_data->>'earning_type',p_data->>'reference',revenue,entitlement,snapshot,p_actor) RETURNING id INTO result;
 RETURN result;
END $$;

-- Serializes approvals and reversals with payment writes on the earning row.
CREATE OR REPLACE FUNCTION decide_franchise_record(p_kind TEXT,p_id UUID,p_actor UUID,p_action TEXT,p_note TEXT,p_date DATE DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_status TEXT; row_franchise UUID;
BEGIN
 IF p_kind='sales' THEN
  SELECT status,franchise_id INTO current_status,row_franchise FROM sales WHERE id=p_id FOR UPDATE;
  IF row_franchise IS NULL OR current_status<>'Pending' THEN RAISE EXCEPTION 'Only pending franchise sales can be decided.'; END IF;
  IF p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid sale action.'; END IF;
  IF p_action='approve' AND (p_date IS NULL OR p_date<(SELECT sale_date FROM sales WHERE id=p_id)) THEN RAISE EXCEPTION 'Completion date must be on or after submission.'; END IF;
  UPDATE sales SET status=CASE WHEN p_action='approve' THEN 'Completed' ELSE 'Cancelled' END,
   completed_date=CASE WHEN p_action='approve' THEN p_date ELSE NULL END,verified_by=p_actor,verified_at=now(),decision_note=p_note,updated_at=now() WHERE id=p_id;
 ELSIF p_kind IN ('earnings','expenses') THEN
  IF p_kind='earnings' THEN
   SELECT status INTO current_status FROM franchise_earnings WHERE id=p_id FOR UPDATE;
  ELSE SELECT status INTO current_status FROM franchise_expenses WHERE id=p_id FOR UPDATE; END IF;
  IF current_status IS NULL THEN RAISE EXCEPTION 'Record not found.'; END IF;
  IF (p_action IN ('approve','reject') AND current_status<>'Submitted') OR (p_action='reverse' AND current_status<>'Approved') OR p_action NOT IN ('approve','reject','reverse') THEN
   RAISE EXCEPTION 'Record was already decided or action is invalid.';
  END IF;
  IF p_action='reverse' AND p_kind='earnings' AND EXISTS(SELECT 1 FROM franchise_payments WHERE earning_id=p_id AND status='Verified') THEN
   RAISE EXCEPTION 'Paid or received earnings cannot be reversed. Reconcile payments before correction.';
  END IF;
  IF p_kind='earnings' THEN
   UPDATE franchise_earnings SET status=CASE p_action WHEN 'approve' THEN 'Approved' WHEN 'reject' THEN 'Rejected' ELSE 'Reversed' END,approved_by=p_actor,decided_at=now(),decision_note=p_note WHERE id=p_id;
  ELSE
   UPDATE franchise_expenses SET status=CASE p_action WHEN 'approve' THEN 'Approved' WHEN 'reject' THEN 'Rejected' ELSE 'Reversed' END,approved_by=p_actor,decided_at=now(),decision_note=p_note WHERE id=p_id;
  END IF;
 ELSE RAISE EXCEPTION 'Invalid record kind.'; END IF;
END $$;

CREATE OR REPLACE FUNCTION record_franchise_payment(p_data JSONB,p_actor UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e franchise_earnings%ROWTYPE; paid NUMERIC; ceiling NUMERIC; result UUID; pay_direction TEXT:=p_data->>'direction'; pay_amount NUMERIC:=(p_data->>'amount')::numeric;
BEGIN
 SELECT * INTO e FROM franchise_earnings WHERE id=(p_data->>'earning_id')::uuid AND franchise_id=(p_data->>'franchise_id')::uuid FOR UPDATE;
 IF e.id IS NULL OR e.status<>'Approved' THEN RAISE EXCEPTION 'Select an approved earning from this franchise.'; END IF;
 IF (p_data->>'payment_date')::date<e.recognition_date THEN RAISE EXCEPTION 'Payment date cannot precede recognition.'; END IF;
 IF pay_direction NOT IN ('Receipt','Payout') OR pay_amount IS NULL OR pay_amount<=0 THEN RAISE EXCEPTION 'Invalid payment.'; END IF;
 SELECT coalesce(sum(p.amount),0) INTO paid FROM franchise_payments p WHERE p.earning_id=e.id AND p.direction=pay_direction AND p.status='Verified';
 ceiling:=CASE WHEN pay_direction='Payout' THEN e.franchise_amount ELSE e.company_revenue END;
 IF paid+pay_amount>ceiling THEN RAISE EXCEPTION 'Payment exceeds the outstanding amount.'; END IF;
 INSERT INTO franchise_payments(franchise_id,earning_id,direction,amount,payment_date,method,reference,created_by)
 VALUES(e.franchise_id,e.id,pay_direction,pay_amount,(p_data->>'payment_date')::date,p_data->>'method',p_data->>'reference',p_actor) RETURNING id INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION reverse_franchise_payment(p_id UUID,p_actor UUID,p_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE earning UUID;
BEGIN
 SELECT earning_id INTO earning FROM franchise_payments WHERE id=p_id;
 IF earning IS NULL THEN RAISE EXCEPTION 'Payment not found.'; END IF;
 -- Same lock ordering as payment creation and earning reversal.
 PERFORM id FROM franchise_earnings WHERE id=earning FOR UPDATE;
 IF length(trim(coalesce(p_note,'')))<5 THEN RAISE EXCEPTION 'Explain the payment reversal.'; END IF;
 UPDATE franchise_payments SET status='Reversed',reversed_by=p_actor,reversed_at=now(),reversal_note=p_note WHERE id=p_id AND status='Verified';
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment was already reversed.'; END IF;
END $$;

REVOKE ALL ON FUNCTION register_franchise(JSONB,UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION onboard_franchise(JSONB,UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION onboard_franchise(JSONB,UUID,UUID,JSONB) TO service_role;
REVOKE ALL ON FUNCTION submit_franchise_earning(JSONB,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION decide_franchise_record(TEXT,UUID,UUID,TEXT,TEXT,DATE) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION record_franchise_payment(JSONB,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION reverse_franchise_payment(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION register_franchise(JSONB,UUID,UUID),submit_franchise_earning(JSONB,UUID),decide_franchise_record(TEXT,UUID,UUID,TEXT,TEXT,DATE),record_franchise_payment(JSONB,UUID),reverse_franchise_payment(UUID,UUID,TEXT) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
