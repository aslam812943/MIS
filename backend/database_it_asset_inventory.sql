-- IT Asset Inventory / CIA Register — a separate register from the existing
-- financial `it_assets` table (purchase value / 15% WDV depreciation).
-- This one tracks physical hardware components (monitors, CPUs, keyboards,
-- mice, etc.) the way the company's actual asset-tagging spreadsheet does,
-- including the CIA security classification (Confidentiality/Integrity/
-- Availability/Criticality, each rated Low/Medium/High) used for
-- cybersecurity-audit purposes. Deliberately NOT merged into `it_assets`,
-- since that table requires serial numbers, purchase value, useful-life
-- years, and locks asset_type/criticality to enums this data doesn't match.
--
-- HO-only (no branch_id): every row in the source register is "HEAD OFFICE"
-- and this data is tracked centrally by IT, same as it_audit_schedule /
-- it_team_duties (see NO_BRANCH_SHEETS in ITService.ts).

CREATE TABLE IF NOT EXISTS it_asset_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_tag VARCHAR(100) UNIQUE NOT NULL,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('MONITOR', 'CPU', 'KEYBOARD', 'MOUSE', 'LAPTOP', 'PRINTER', 'NETWORK DEVICE', 'SERVER', 'UPS', 'OTHER')),
    model VARCHAR(500),
    purchase_date DATE,
    host_name VARCHAR(255),
    ip_address VARCHAR(100),
    supplier_warranty VARCHAR(255),
    supplier VARCHAR(255),
    purpose VARCHAR(255),
    department VARCHAR(255),
    location VARCHAR(255),
    owner VARCHAR(255),
    additional_information TEXT,
    criticality VARCHAR(20) CHECK (criticality IN ('LOW', 'MEDIUM', 'HIGH')),
    confidentiality VARCHAR(20) CHECK (confidentiality IN ('LOW', 'MEDIUM', 'HIGH')),
    integrity VARCHAR(20) CHECK (integrity IN ('LOW', 'MEDIUM', 'HIGH')),
    availability VARCHAR(20) CHECK (availability IN ('LOW', 'MEDIUM', 'HIGH')),
    remarks TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_it_asset_inventory_type ON it_asset_inventory (asset_type);
CREATE INDEX IF NOT EXISTS idx_it_asset_inventory_criticality ON it_asset_inventory (criticality);

ALTER TABLE it_asset_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "IT staff and admins can manage asset inventory" ON it_asset_inventory;
CREATE POLICY "IT staff and admins can manage asset inventory"
    ON it_asset_inventory
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            LEFT JOIN departments ON departments.id = profiles.department_id
            WHERE profiles.id = auth.uid()
              AND (
                profiles.role = 'admin'
                OR profiles.role IN ('ceo', 'managing_director', 'director', 'executive')
                OR UPPER(departments.name) = 'IT'
              )
        )
    );
