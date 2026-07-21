-- Fixes schema drift on finance_pnl_summary: the live table was created with
-- a column named period_month, but the application code (FinanceService.ts)
-- and every checked-in version of database_finance.sql have always used
-- entry_date for this table (period_month only exists on the unrelated
-- finance_referral_commission table). This mismatch made every P&L Summary
-- create request fail with a 500 ("Failed to create entry.") and silently
-- zeroed out the dashboard's revenue KPIs.
--
-- Run this once in the Supabase SQL editor.

ALTER TABLE finance_pnl_summary RENAME COLUMN period_month TO entry_date;
