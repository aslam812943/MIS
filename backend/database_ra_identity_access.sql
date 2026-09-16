-- Run once in Supabase SQL Editor. No PAN/Aadhaar values are copied into history.
CREATE TABLE IF NOT EXISTS ra_identity_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES ra_clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  requester_id UUID NOT NULL REFERENCES profiles(id),
  requester_role TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 5),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Consumed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID REFERENCES profiles(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  consumed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ra_identity_requests_active ON ra_identity_requests(requester_id,client_id) WHERE status IN ('Pending','Approved');
ALTER TABLE ra_identity_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role identity requests" ON ra_identity_requests;
CREATE POLICY "Service role identity requests" ON ra_identity_requests FOR ALL TO service_role USING(true) WITH CHECK(true);

CREATE OR REPLACE FUNCTION save_ra_identity(p_user_id UUID, p_client_id UUID, p_pan TEXT, p_aadhaar TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_id UUID;
BEGIN
  -- Lock the permission so concurrent saves cannot reuse the same approval.
  SELECT id INTO request_id FROM ra_identity_requests
  WHERE requester_id=p_user_id AND client_id=p_client_id AND status='Approved'
  FOR UPDATE;
  IF request_id IS NULL THEN RAISE EXCEPTION 'Admin approval is required to save identity changes.'; END IF;
  IF p_pan IS NOT NULL AND p_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN RAISE EXCEPTION 'Enter a valid 10-character PAN.'; END IF;
  IF p_aadhaar IS NOT NULL AND p_aadhaar !~ '^[0-9]{12}$' THEN RAISE EXCEPTION 'Enter a valid 12-digit Aadhaar.'; END IF;
  UPDATE ra_clients SET pan=p_pan, aadhaar_no=p_aadhaar, updated_at=now() WHERE id=p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client no longer exists.'; END IF;
  UPDATE ra_identity_requests SET status='Consumed', consumed_at=now() WHERE id=request_id;
END $$;
REVOKE ALL ON FUNCTION save_ra_identity(UUID,UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION save_ra_identity(UUID,UUID,TEXT,TEXT) TO service_role;
