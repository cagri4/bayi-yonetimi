---
status: diagnosed
trigger: "Investigate why deleting an announcement doesn't work in the admin panel"
created: 2026-03-05T00:00:00Z
updated: 2026-03-05T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - deleteAnnouncement is a soft-delete (sets is_active=false) but the admin page fetches ALL announcements regardless of is_active, so the row stays visible; meanwhile RLS silently blocks even the UPDATE because the SELECT policy only matches is_active=true rows
test: Traced code path from UI click through server action to RLS policies
expecting: RLS policy conflict explains silent failure
next_action: Report diagnosis to user

## Symptoms

expected: Delete button removes the announcement from the admin list
actual: Delete button/action doesn't work (create and edit work fine)
errors: None visible (silent failure)
reproduction: Go to /admin/announcements, try to delete an announcement
started: Unknown

## Eliminated

- hypothesis: Missing delete server action
  evidence: deleteAnnouncement function exists at line 325 of announcements.ts
  timestamp: 2026-03-05

- hypothesis: UI not wired to delete action
  evidence: handleDelete at line 45 of announcement-manager.tsx correctly calls deleteAnnouncement
  timestamp: 2026-03-05

- hypothesis: FK constraint from announcement_reads blocking deletion
  evidence: deleteAnnouncement does UPDATE (soft delete), not DELETE; also announcement_reads has ON DELETE CASCADE so even real DELETE would work
  timestamp: 2026-03-05

## Evidence

- timestamp: 2026-03-05
  checked: deleteAnnouncement server action (src/lib/actions/announcements.ts:325-340)
  found: It performs a SOFT delete - sets is_active=false via .update(), NOT a real SQL DELETE
  implication: The row stays in the table; it just becomes inactive

- timestamp: 2026-03-05
  checked: getAllAnnouncements server action (src/lib/actions/announcements.ts:237-252)
  found: It fetches ALL announcements with .select('*') and NO .eq('is_active', true) filter
  implication: Even after soft-delete, the announcement would still appear in admin list (but with Pasif badge)

- timestamp: 2026-03-05
  checked: RLS policies on announcements table (007_dashboard_campaigns.sql:222-242)
  found: Original SELECT policy was "Authenticated can read active announcements" with USING(is_active = true AND published_at IS NOT NULL AND published_at <= NOW() AND ...). The FOR ALL admin policy was separate.
  implication: Two competing policies existed - one for SELECT, one for ALL

- timestamp: 2026-03-05
  checked: Multi-tenant migration RLS (009_multi_tenant.sql:1033-1057)
  found: Old policies dropped and replaced with three new policies:
    1. "Company members can read own company announcements" FOR SELECT USING (company_id = current_company_id())
    2. "Company admins can manage announcements" FOR ALL USING (company_id = current_company_id() AND is_company_admin())
    3. "Superadmin can manage all announcements" FOR ALL USING (is_superadmin())
  implication: FOR ALL policy requires BOTH its USING clause to pass for reads AND writes. Admin must have company_id in JWT matching the announcement's company_id, AND is_company_admin() must return true.

- timestamp: 2026-03-05
  checked: Supabase client creation (src/lib/supabase/server.ts)
  found: Uses ANON KEY (not service role key). All queries go through RLS.
  implication: The deleteAnnouncement UPDATE is subject to RLS policies

- timestamp: 2026-03-05
  checked: current_company_id() function (009_multi_tenant.sql:38-41)
  found: Reads company_id from JWT via auth.jwt() ->> 'company_id'. This requires inject_company_claim hook to be active.
  implication: If JWT does not contain company_id claim, current_company_id() returns NULL, and company_id = NULL never matches any row

- timestamp: 2026-03-05
  checked: is_company_admin() function (009_multi_tenant.sql:46-53)
  found: Returns TRUE only if user role='admin' AND current_company_id() IS NOT NULL
  implication: If company_id is missing from JWT, is_company_admin() returns FALSE even for admin users

## Resolution

root_cause: |
  The deleteAnnouncement action performs a soft-delete (UPDATE is_active=false) which silently fails due to RLS policy evaluation.

  The multi-tenant RLS policy "Company admins can manage announcements" uses a FOR ALL policy with:
    USING (company_id = current_company_id() AND is_company_admin())

  For the UPDATE to succeed, Supabase must first SELECT the row to update (the USING clause acts as a WHERE filter). If current_company_id() returns NULL (because the JWT lacks a company_id claim, or the inject_company_claim hook isn't functioning), the USING clause evaluates to FALSE for every row. The UPDATE matches zero rows and silently succeeds with no effect.

  Additionally, there is a secondary design issue: even if the UPDATE DID succeed, the soft-delete only sets is_active=false, but getAllAnnouncements() fetches all rows without filtering by is_active. So the announcement would remain visible in the admin table (just showing a "Pasif" badge instead of disappearing).

  The likely primary cause is that current_company_id() returns NULL for the admin user, making the RLS USING clause match zero rows. The UPDATE returns no error (it just affects 0 rows), and Supabase client does not treat "0 rows updated" as an error.

fix:
verification:
files_changed: []
