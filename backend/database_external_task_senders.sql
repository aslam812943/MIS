-- EXTERNAL TASK SENDERS — allow-list mapping a messaging-platform identity
-- (a Telegram chat_id today, potentially a WhatsApp number later) to a real
-- MIS user, so tasks created via the /external/tasks API are attributed to
-- an actual person and restricted to pre-approved senders only.
--
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS external_task_senders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel VARCHAR(30) NOT NULL CHECK (channel IN ('telegram', 'whatsapp')),
    external_id VARCHAR(100) NOT NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_task_senders_profile ON external_task_senders(profile_id);

ALTER TABLE external_task_senders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access external_task_senders" ON external_task_senders;
CREATE POLICY "Service role full access external_task_senders" ON external_task_senders
    FOR ALL TO service_role USING (true) WITH CHECK (true);
