-- Add the MIS login role used to launch the Dealer Calculation terminal.
-- Run this file once in the MIS Supabase SQL editor before creating the user.
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_username TEXT;
UPDATE public.profiles
SET login_username = lower(split_part(email, '@', 1))
WHERE role = 'dealer_calculation' AND login_username IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_login_username_unique
  ON public.profiles (lower(login_username)) WHERE login_username IS NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_login_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_login_username_format
  CHECK (login_username IS NULL OR login_username ~ '^[a-z0-9._-]{3,50}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'admin','ceo','managing_director','director','executive','hod','regional_manager',
  'employee','hr','content_creator','social_media_manager','franchise_owner','franchise_staff',
  'dealer_calculation'
));

COMMIT;
