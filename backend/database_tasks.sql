-- TASK MANAGEMENT SYSTEM — cross-department task assignment & tracking.
-- Run in Supabase SQL Editor.
--
-- Deliberately org-wide (not per-department like KYC/IT/etc.) — a task can
-- be created by anyone and assigned to any existing user regardless of
-- department, so it doesn't fit the per-department table pattern used
-- elsewhere in this schema.
--
-- assigned_to/assigned_by use ON DELETE SET NULL rather than CASCADE
-- (the convention used by every other department table's created_by):
-- if a user account is later deleted, their task history is still a real
-- record of work that happened and must not silently vanish. The app must
-- render a null assignee/creator as "Unassigned" / "Deleted user".

CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Blocked', 'Completed', 'Cancelled')),
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Chronological activity feed per task — both user-written remarks and
-- auto-generated system entries (status changes, reassignment) live here,
-- so opening a task shows its full history in one ordered list.
CREATE TABLE IF NOT EXISTS task_remarks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    remark_text TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_remarks_task_id ON task_remarks(task_id, created_at);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_remarks ENABLE ROW LEVEL SECURITY;

-- Matches every other table in this schema: the backend (service_role key)
-- is the only direct DB caller, and enforces per-row authorization
-- (assignee/creator/admin) in TaskService.ts itself. These policies are
-- defense-in-depth, not the primary access-control mechanism.
DROP POLICY IF EXISTS "Service role full access tasks" ON tasks;
CREATE POLICY "Service role full access tasks" ON tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access task_remarks" ON task_remarks;
CREATE POLICY "Service role full access task_remarks" ON task_remarks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Extend the existing notifications table to support instant task events
-- alongside its original due_soon/overdue scan results.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('due_soon', 'overdue', 'task_assigned', 'task_update'));
