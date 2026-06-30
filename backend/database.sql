-- MIS PORTAL - MASTER DATABASE SCHEMA
-- This file contains the complete structure for the MIS system.
-- Run these commands in the Supabase SQL Editor to set up your database.

-- 1. BRANCHES TABLE
CREATE TABLE IF NOT EXISTS branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. MODULES TABLE
CREATE TABLE IF NOT EXISTS modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    fields JSONB DEFAULT '[]'::jsonb, -- Stores dynamic form field configurations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PROFILES TABLE (Extends Supabase Auth)
-- This table is linked to auth.users via the id column
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'ceo', 'managing_director', 'director', 'executive', 'hod', 'regional_manager', 'employee', 'hr')),
    full_name TEXT,
    phone_number TEXT,
    avatar_url TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    allowed_modules TEXT[] DEFAULT '{}', -- Array of module IDs user can access
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'resigned')),
    employee_id TEXT UNIQUE,
    joining_date DATE,
    resignation_date DATE,
    resignation_reason TEXT,
    last_working_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. DATA ENTRIES TABLE
-- Stores dynamic data entry submissions for each module
CREATE TABLE IF NOT EXISTS data_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(module_id, user_id, entry_date)
);

-- Note: Run these SQL queries in your Supabase SQL Editor if you are updating an existing database:
-- ALTER TABLE data_entries ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
-- ALTER TABLE data_entries ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
-- ALTER TABLE data_entries ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
-- ALTER TABLE data_entries ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Note: If you already created the data_entries table, run this to apply the new constraint:
-- ALTER TABLE data_entries DROP CONSTRAINT IF EXISTS data_entries_module_id_branch_id_entry_date_key;
-- ALTER TABLE data_entries ADD CONSTRAINT data_entries_module_id_user_id_entry_date_key UNIQUE (module_id, user_id, entry_date);

-- 5. STORAGE BUCKETS (Supabase Storage)
-- Run these in SQL Editor to set up image storage
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
-- CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 5. ROW LEVEL SECURITY (RLS)
-- Disable RLS for now to allow backend access, or set up policies
-- For better security, keep RLS enabled and add policies for the 'service_role'
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow all access to service_role (Admin)
CREATE POLICY "Allow service role full access" ON branches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON departments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON modules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON data_entries FOR ALL TO service_role USING (true) WITH CHECK (true);


-- Optional: Allow authenticated users to read branches/departments/modules
CREATE POLICY "Authenticated users can view branches" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view modules" ON modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert their own branch entries" ON data_entries FOR INSERT TO authenticated WITH CHECK (branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can view their own branch entries" ON data_entries FOR SELECT TO authenticated USING (branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update their own branch entries" ON data_entries FOR UPDATE TO authenticated USING (branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()));


-- 6. FUNCTIONS & TRIGGERS
-- Auto-update 'updated_at' on profile changes
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER on_data_entry_updated
    BEFORE UPDATE ON data_entries
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

-- 7. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
