-- IT AUTO-NUMBERING MIGRATION
-- po_number, ticket_number, and incident_number are now server-generated
-- (see ITService.ts AUTO_CODE_FIELDS) instead of manually typed, to
-- eliminate typos and guarantee no duplicate reference numbers. This adds
-- the DB-level uniqueness constraint po_number was missing entirely
-- (ticket_number/incident_number already have UNIQUE from database_it.sql)
-- as defense-in-depth alongside the application-level collision retry.

ALTER TABLE it_purchase_orders ADD CONSTRAINT it_purchase_orders_po_number_key UNIQUE (po_number);

NOTIFY pgrst, 'reload schema';
