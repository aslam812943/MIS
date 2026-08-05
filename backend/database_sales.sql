-- SALES DEPARTMENT — client sales logging, tracked by product line.
-- Run in Supabase SQL Editor.
--
-- Single-table department, same shape as iepf_claims: one employee/HOD
-- department, branch-scoped like every other department table.

CREATE TABLE IF NOT EXISTS sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    client_contact VARCHAR(100),
    product_type VARCHAR(40) NOT NULL CHECK (product_type IN (
        'Trading and Demat', 'Mutual Fund', 'Unlisted Shares',
        'Child Demat', 'Child Mutual Fund', 'IEPF', 'SW Global'
    )),
    sale_value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (sale_value >= 0),
    units NUMERIC(14, 2),
    sale_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
    remarks TEXT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_product_type ON sales(product_type);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Matches every other department table: the backend (service_role key) is
-- the only direct DB caller and enforces per-row authorization
-- (branch lock, employee/HOD/admin rules) in SalesService.ts itself.
DROP POLICY IF EXISTS "Service role full access sales" ON sales;
CREATE POLICY "Service role full access sales" ON sales FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed the Sales department if it doesn't already exist.
INSERT INTO departments (name)
SELECT 'Sales'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Sales');
