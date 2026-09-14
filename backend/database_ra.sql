-- ==============================================================================
-- RA (RESEARCH ANALYST) DEPARTMENT DATABASE SCHEMA & POLICIES
-- Execute this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure RA department exists in departments table
INSERT INTO departments (name)
SELECT 'RA'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'RA');

-- 2. RA PACKAGES TABLE (DYNAMIC PACKAGE CATALOG)
CREATE TABLE IF NOT EXISTS ra_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    segment VARCHAR(50) DEFAULT 'Equity' CHECK (segment IN ('Equity', 'Futures & Options', 'Commodity', 'Currency', 'Combo / Multi-Asset', 'HNI Alpha', 'Other')),
    price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    duration_days INTEGER NOT NULL DEFAULT 90 CHECK (duration_days > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ra_packages_active ON ra_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_ra_packages_name ON ra_packages(name);

ALTER TABLE ra_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access ra_packages" ON ra_packages;
CREATE POLICY "Service role full access ra_packages" ON ra_packages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Packages are created by users in the RA Package Catalog.
-- Do not seed defaults here: rerunning a schema migration must never recreate
-- packages that a user intentionally deleted.

-- 3. RA CLIENTS / SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS ra_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    package VARCHAR(100) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    payment_date DATE,
    mobile_number VARCHAR(30),
    research_date DATE,
    email_id VARCHAR(255),
    sw_code VARCHAR(50),
    pan VARCHAR(20),
    aadhaar_no VARCHAR(20),
    reference VARCHAR(255),
    kyc_fetch_date DATE,
    kra_modify_date DATE,
    kra_reference_number VARCHAR(100),
    kra_updation_status VARCHAR(50) DEFAULT 'Pending' CHECK (kra_updation_status IN ('Pending', 'In Progress', 'Completed', 'Updated')),
    kra_user VARCHAR(255),
    ckyc_number VARCHAR(50),
    remarks TEXT,
    subscription_start_date DATE,
    subscription_end_date DATE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_ra_clients_package ON ra_clients(package);
CREATE INDEX IF NOT EXISTS idx_ra_clients_pan ON ra_clients(pan);
CREATE INDEX IF NOT EXISTS idx_ra_clients_mobile ON ra_clients(mobile_number);
CREATE INDEX IF NOT EXISTS idx_ra_clients_sub_end ON ra_clients(subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_ra_clients_kra_status ON ra_clients(kra_updation_status);
CREATE INDEX IF NOT EXISTS idx_ra_clients_branch_id ON ra_clients(branch_id);
CREATE INDEX IF NOT EXISTS idx_ra_clients_created_by ON ra_clients(created_by);

-- Enable Row Level Security
ALTER TABLE ra_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access ra_clients" ON ra_clients;
CREATE POLICY "Service role full access ra_clients" ON ra_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. RA CLIENT TESTIMONIALS & FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS ra_testimonials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES ra_clients(id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT NOT NULL,
    testimonial_date DATE NOT NULL DEFAULT CURRENT_DATE,
    package_name VARCHAR(100),
    screenshot_url TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT TRUE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for testimonials
CREATE INDEX IF NOT EXISTS idx_ra_testimonials_client_id ON ra_testimonials(client_id);
CREATE INDEX IF NOT EXISTS idx_ra_testimonials_rating ON ra_testimonials(rating);
CREATE INDEX IF NOT EXISTS idx_ra_testimonials_branch_id ON ra_testimonials(branch_id);
CREATE INDEX IF NOT EXISTS idx_ra_testimonials_created_by ON ra_testimonials(created_by);

-- Enable Row Level Security
ALTER TABLE ra_testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access ra_testimonials" ON ra_testimonials;
CREATE POLICY "Service role full access ra_testimonials" ON ra_testimonials FOR ALL TO service_role USING (true) WITH CHECK (true);
