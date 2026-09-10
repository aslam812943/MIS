-- IT CUSTOM TYPES EXPANSION MIGRATION
-- Drops check constraints on classification/type fields to allow custom "Other" manual input types across all IT sheets

ALTER TABLE it_audits DROP CONSTRAINT IF EXISTS it_audits_audit_type_check;
ALTER TABLE it_audits ALTER COLUMN audit_type TYPE VARCHAR(255);

ALTER TABLE it_audit_schedule DROP CONSTRAINT IF EXISTS it_audit_schedule_audit_type_check;
ALTER TABLE it_audit_schedule ALTER COLUMN audit_type TYPE VARCHAR(255);

ALTER TABLE it_diagrams DROP CONSTRAINT IF EXISTS it_diagrams_type_check;
ALTER TABLE it_diagrams ALTER COLUMN type TYPE VARCHAR(255);

ALTER TABLE it_vendors DROP CONSTRAINT IF EXISTS it_vendors_category_check;
ALTER TABLE it_vendors ALTER COLUMN category TYPE VARCHAR(255);

ALTER TABLE it_cybersecurity_compliance DROP CONSTRAINT IF EXISTS it_cybersecurity_compliance_compliance_domain_check;
ALTER TABLE it_cybersecurity_compliance ALTER COLUMN compliance_domain TYPE VARCHAR(255);

ALTER TABLE it_audit_findings DROP CONSTRAINT IF EXISTS it_audit_findings_domain_check;
ALTER TABLE it_audit_findings ALTER COLUMN domain TYPE VARCHAR(255);

NOTIFY pgrst, 'reload schema';
