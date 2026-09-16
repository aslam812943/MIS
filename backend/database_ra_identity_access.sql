-- Run the COMPLETE file in Supabase SQL Editor, including when upgrading.
-- Existing requests are preserved. No PAN/Aadhaar values are copied into history.
BEGIN;
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
-- Safe upgrade: group older submissions made at the same time into one request.
ALTER TABLE ra_identity_requests ADD COLUMN IF NOT EXISTS batch_id UUID;
WITH grouped AS (
 SELECT id, first_value(id) OVER (PARTITION BY requester_id, requested_at, reason ORDER BY id) AS batch
 FROM ra_identity_requests
)
UPDATE ra_identity_requests r SET batch_id=g.batch FROM grouped g WHERE r.id=g.id AND r.batch_id IS NULL;
ALTER TABLE ra_identity_requests ALTER COLUMN batch_id SET DEFAULT gen_random_uuid();
ALTER TABLE ra_identity_requests ALTER COLUMN batch_id SET NOT NULL;
ALTER TABLE ra_identity_requests ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES profiles(id);
ALTER TABLE ra_identity_requests ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE ra_identity_requests DROP CONSTRAINT IF EXISTS ra_identity_requests_status_check;
ALTER TABLE ra_identity_requests ADD CONSTRAINT ra_identity_requests_status_check CHECK(status IN ('Pending','Approved','Rejected','Consumed','Revoked'));
CREATE INDEX IF NOT EXISTS ra_identity_requests_batch ON ra_identity_requests(batch_id);
ALTER TABLE ra_identity_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role identity requests" ON ra_identity_requests;
CREATE POLICY "Service role identity requests" ON ra_identity_requests FOR ALL TO service_role USING(true) WITH CHECK(true);
GRANT SELECT, INSERT, UPDATE ON TABLE public.ra_identity_requests TO service_role;

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

-- Make newly added batch/revocation columns immediately visible to the REST API.
-- Decide a selection atomically: unchecked pending clients are rejected.
CREATE OR REPLACE FUNCTION decide_ra_identity_batch(
  p_admin_id UUID, p_request_id UUID, p_approved_client_ids UUID[], p_note TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_batch UUID; request_user UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id=p_admin_id AND lower(role::text)='admin') THEN
    RAISE EXCEPTION 'Only admins can decide identity requests.';
  END IF;
  SELECT batch_id, requester_id INTO request_batch, request_user
  FROM ra_identity_requests WHERE id=p_request_id;
  IF request_batch IS NULL OR request_user=p_admin_id THEN
    RAISE EXCEPTION 'Request not found or self approval is not allowed.';
  END IF;
  PERFORM id FROM ra_identity_requests WHERE batch_id=request_batch AND requester_id=request_user ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM ra_identity_requests WHERE batch_id=request_batch AND requester_id=request_user AND status='Pending') THEN
    RAISE EXCEPTION 'Request was already decided.';
  END IF;
  IF p_approved_client_ids IS NULL OR EXISTS (
    SELECT 1 FROM unnest(p_approved_client_ids) selected(client_id)
    WHERE NOT EXISTS (SELECT 1 FROM ra_identity_requests r WHERE r.batch_id=request_batch
      AND r.requester_id=request_user AND r.client_id=selected.client_id AND r.status='Pending')
  ) THEN RAISE EXCEPTION 'Selection contains clients outside this pending request.'; END IF;
  UPDATE ra_identity_requests SET
    status=CASE WHEN client_id=ANY(p_approved_client_ids) THEN 'Approved' ELSE 'Rejected' END,
    decided_by=p_admin_id, decided_at=now(), decision_note=trim(coalesce(p_note,''))
  WHERE batch_id=request_batch AND requester_id=request_user AND status='Pending';
END $$;
REVOKE ALL ON FUNCTION decide_ra_identity_batch(UUID,UUID,UUID[],TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION decide_ra_identity_batch(UUID,UUID,UUID[],TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
