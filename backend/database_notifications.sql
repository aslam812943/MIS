-- NOTIFICATIONS SYSTEM DATABASE SCHEMA
-- Run in Supabase SQL Editor.
-- Stores in-app notifications for deadline/aging alerts raised by the
-- daily notification scan (see backend/src/services/NotificationService.ts).

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    department VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('due_soon', 'overdue')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    source_table VARCHAR(100) NOT NULL,
    source_id UUID NOT NULL,
    -- Identifies "this exact alert" so the daily scan can safely re-run
    -- without creating duplicate notifications for the same item/type.
    dedupe_key VARCHAR(300) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
