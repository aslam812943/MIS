# Simple franchise workflow

1. **Admin logs in** at `/login` and opens **Franchise Management**.
2. **Add franchise**: enter name, owner name, phone, email, state, city, address,
   office details and registration date. Or download the **CSV template**,
   fill it and choose **Import CSV** (up to 100 rows). **Sample CSV** downloads
   two example franchises. Upload opens a preview; review it and click
   **Submit & email logins** to save. Cancel closes the preview without saving
   or sending emails. Replace sample contact details with real ones first.
3. **Submit & email login**: the system saves an Active franchise, creates its
   login and sends Owner and Staff passwords to the saved email. No separate login-creation step.
4. **Staff logs in** at `/franchise/login`, selects **Franchise Staff**, and uses
   the saved email and Staff password (`password1234`). Open **Manage → Product sales → Add record**, enter
   customer, product, quantity, amount and date, then save. Repeat for more sales.
5. **Owner logs in** with the **same email** and Owner password (`password123`), selecting
   **Franchise Owner**. Their dashboard shows that franchise's sales and statuses.
6. **Admin dashboard** shows sales across franchises and can filter by location
   or franchise. Click **Refresh** to see the latest Completed sales on either dashboard. They show total franchises, entered sales, pending sales, completed
   sales, monthly sales and top products by completed sale count.

**Only three management tabs:** Franchises, Product sales and How it works.
Login creation and credential email
happen on Submit. No separate earnings, expense, payment or plan setup forms.
Sales amounts are customer transaction amounts; this flow does not calculate
business revenue or net profit.

**Owner and Staff have separate accounts using the same saved login email.**
Owner starts with `password123`; Staff starts with `password1234`.
Two credential emails are sent to that saved email, one for each role.
Change each password after signing in; changing one does not change the other.
A login can access only its franchise. Existing shared accounts keep their
previous password until migrated; this change applies to newly added franchises.

**If email fails:** the franchise remains saved. Click **Send new login email**
to reset both new accounts to their initial role passwords and email them again.

**CSV columns:** `name`, `owner_name`, `phone`, `email`, `state`, `city`, `area`,
`address`, `postal_code`, `has_office`, `office_sqft`, `registered_on`.
Use Yes/No for office and YYYY-MM-DD for the date. Office sqft is required only
for Yes. Keep phone numbers as text. Replace all sample template cells. Check
per-row import results; successful rows stay saved if another row fails. Do not
reimport successful rows: their existing login emails will be rejected.

**Setup:** run the complete updated `backend/database_franchise.sql` in Supabase
SQL Editor, restart the backend and reload the frontend. Set `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `FRONTEND_URL` on the backend so login
emails contain the correct portal link. No real credential emails were sent
while developing/testing this change.

**Login error: missing login_email:** if you already ran an older franchise SQL
file, run `backend/database_franchise_login_upgrade.sql` completely in Supabase
SQL Editor. This preserves existing accounts/passwords and upgrades onboarding.
It does not create the sample CSV accounts or reset existing passwords.

**Bulk sales upload:** in Product sales, download Sample CSV, replace customer
and order details, then choose Bulk upload. Review the preview, select your
franchise and click Submit sales. Upload up to 100 rows (under 1 MB). Use an
active product name or product code and YYYY-MM-DD dates on or after registration.
Saved sales appear as Completed in Owner/Admin dashboards. Check row results;
successful rows remain saved if another row fails. Retry only failed rows to
avoid duplicate sales. Cancel closes the preview without saving.

**No individual sale approvals:** Staff saves sales directly as Completed. Admin
manages franchise access/status and views sales across franchises.

**Bulk removal:** tick sales individually or tick the header checkbox to select
all removable sales in the current filtered view. Click Remove selected, review
the list and Confirm bulk removal. Cancel removes nothing. Each sale uses the
same server permission checks as single removal. Results show successes and
failures; successful deletions stay deleted if another selected sale fails.
