-- Run once in Supabase SQL Editor before using the expanded Privilege form.
ALTER TABLE privilege_accounts
  ADD COLUMN IF NOT EXISTS sl_no BIGINT,
  ADD COLUMN IF NOT EXISTS account_date DATE,
  ADD COLUMN IF NOT EXISTS mobile_no VARCHAR(20),
  ADD COLUMN IF NOT EXISTS scheme VARCHAR(255),
  ADD COLUMN IF NOT EXISTS introducer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rm VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dealer VARCHAR(255),
  ADD COLUMN IF NOT EXISTS branch VARCHAR(255),
  ADD COLUMN IF NOT EXISTS trading_started BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_privilege_accounts_sl_no
  ON privilege_accounts(sl_no) WHERE sl_no IS NOT NULL;

-- Database sequences make simultaneous saves safe and prevent duplicate identifiers.
CREATE SEQUENCE IF NOT EXISTS privilege_sl_no_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS privilege_client_code_seq START WITH 1001;

SELECT setval(
  'privilege_sl_no_seq',
  GREATEST(COALESCE((SELECT MAX(sl_no) FROM privilege_accounts), 0), 1),
  COALESCE((SELECT MAX(sl_no) FROM privilege_accounts), 0) > 0
);

SELECT setval(
  'privilege_client_code_seq',
  GREATEST(COALESCE((SELECT MAX(substring(code FROM '[0-9]+')::BIGINT) FROM privilege_accounts WHERE code ~ '^PA[0-9]+$'), 1001), 1001),
  COALESCE((SELECT MAX(substring(code FROM '[0-9]+')::BIGINT) FROM privilege_accounts WHERE code ~ '^PA[0-9]+$'), 0) > 0
);

CREATE OR REPLACE FUNCTION next_privilege_account_identifiers()
RETURNS TABLE(sl_no BIGINT, client_code TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('privilege_sl_no_seq'),
         'PA' || lpad(nextval('privilege_client_code_seq')::TEXT, 4, '0');
$$;

REVOKE ALL ON FUNCTION next_privilege_account_identifiers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_privilege_account_identifiers() TO service_role;
