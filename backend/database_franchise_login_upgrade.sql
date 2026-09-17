-- Upgrade an existing franchise database for separate Owner/Staff passwords.
-- Run this COMPLETE file in Supabase SQL Editor.
-- Existing accounts and passwords are preserved. New accounts use role mapping.
BEGIN;
ALTER TABLE public.franchise_users ADD COLUMN IF NOT EXISTS login_email TEXT;
ALTER TABLE public.franchise_users ADD COLUMN IF NOT EXISTS shared_access BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS franchise_role_login_unique
 ON public.franchise_users(lower(login_email),membership_role)
 WHERE login_email IS NOT NULL;
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
REVOKE ALL ON FUNCTION onboard_franchise(JSONB,UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION onboard_franchise(JSONB,UUID,UUID,JSONB) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
