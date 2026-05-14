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
    role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'ceo', 'managing_director', 'director', 'executive', 'hod', 'regional_manager', 'employee')),
    full_name TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    allowed_modules TEXT[] DEFAULT '{}', -- Array of module IDs user can access
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

-- Optional: Allow authenticated users to read branches/departments/modules
CREATE POLICY "Authenticated users can view branches" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view modules" ON modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

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

-- 7. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
