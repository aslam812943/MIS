-- IT PURCHASE ORDERS LOG MIGRATION
-- Manual log of POs raised via the external PO Generator tool
-- (po.sharewealthindia.in, now embedded inline in the IT Data Entry page).
-- That tool has no backend/API of its own — this table is the only source
-- of PO data for dashboard analytics; staff record each PO here after
-- generating it. Layers on top of database_it.sql / database_it_v2_expansion.sql.

DROP TABLE IF EXISTS it_purchase_orders CASCADE;
CREATE TABLE it_purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_number VARCHAR(100) NOT NULL,
    vendor_id UUID REFERENCES it_vendors(id) ON DELETE SET NULL,
    item_description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    po_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Raised' CHECK (status IN ('Raised', 'Approved', 'Fulfilled', 'Cancelled')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE it_purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access IT Purchase Orders" ON it_purchase_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "IT staff can select purchase orders" ON it_purchase_orders FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can insert purchase orders" ON it_purchase_orders FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));
CREATE POLICY "IT staff can update purchase orders" ON it_purchase_orders FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.department_id = (SELECT id FROM departments WHERE name ILIKE 'IT'))));

CREATE TRIGGER on_it_purchase_orders_updated BEFORE UPDATE ON it_purchase_orders FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

NOTIFY pgrst, 'reload schema';
