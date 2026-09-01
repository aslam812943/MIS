-- IT ASSET TYPE OTHER MIGRATION
-- Drops check constraint on asset_type to allow custom "Other" manual input types (e.g. UPS, Biometric, CCTV, etc.)

ALTER TABLE it_assets DROP CONSTRAINT IF EXISTS it_assets_asset_type_check;
ALTER TABLE it_assets ALTER COLUMN asset_type TYPE VARCHAR(255);

NOTIFY pgrst, 'reload schema';
