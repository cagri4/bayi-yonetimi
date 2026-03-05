---
phase: 00-full-app-uat
plan: "04"
subsystem: ui
tags: [next.js, supabase, rls, server-actions, reports, announcements, campaigns]

# Dependency graph
requires:
  - phase: 00-full-app-uat
    provides: UAT gap analysis identifying 3 critical failures
provides:
  - Report pages using .bind() server action pattern (no inline closure serialization error)
  - Campaign form that re-throws NEXT_REDIRECT so redirects work cleanly
  - Announcement admin actions (create/update/delete/list) using service role client to bypass RLS
affects: [deployment, admin-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server action .bind() pattern: use exportFn.bind(null, ...args) instead of async () => fn(...args) when passing server actions as props to client components"
    - "isRedirectError guard: import isRedirectError from next/dist/client/components/redirect-error and re-throw in catch blocks to allow NEXT_REDIRECT to propagate"
    - "Admin mutation service role pattern: verify admin via session client, then use createServiceClient() for DB mutation to bypass RLS when JWT lacks company_id claim"

key-files:
  created: []
  modified:
    - src/app/(admin)/admin/reports/sales/page.tsx
    - src/app/(admin)/admin/reports/products/page.tsx
    - src/app/(admin)/admin/reports/dealers/page.tsx
    - src/components/admin/campaign-form.tsx
    - src/lib/actions/announcements.ts

key-decisions:
  - "Report pages use .bind(null, ...args) on server actions — Next.js 16 can serialize bound server actions but not inline async closures that close over variables"
  - "isRedirectError from next/dist/client/components/redirect-error re-throws NEXT_REDIRECT so campaign saves redirect cleanly instead of triggering false error alert"
  - "Announcement admin mutations use service role client after session-based admin auth verification — RLS policies require current_company_id() which returns NULL from admin JWT"
  - "getAllAnnouncements scoped by userData.company_id via service role — shows all states (active + inactive) so admin can see Aktif/Pasif badge and toggle back"
  - "deleteAnnouncement uses .select('id') on UPDATE to detect silent no-op failures (0 rows affected = announcement not found)"
  - "userData.company_id null guard added in getAllAnnouncements — TypeScript requires non-null string for .eq() filter"

patterns-established:
  - "bind-server-action: exportFn.bind(null, arg1, arg2) for passing parameterized server actions from server to client components"
  - "admin-service-role: session client for identity, service client for DB mutation — never expose service client without prior auth check"

requirements-completed: [UAT-23, UAT-24, UAT-25]

# Metrics
duration: 19min
completed: 2026-03-05
---

# Phase 00 Plan 04: UAT Gap Closure (Reports, Campaign, Announcements) Summary

**Fixed 3 UAT-blocking bugs: Next.js server action serialization error on report pages (.bind() fix), campaign false error alert (isRedirectError guard), and announcement admin RLS bypass (service role client for all admin mutations)**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-05T15:52:38Z
- **Completed:** 2026-03-05T16:11:41Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 5

## Accomplishments
- Report export pages (sales, products, dealers) fixed: replaced invalid inline async closure props with `.bind()` pattern, resolving Next.js 16 serialization crash
- Campaign form fixed: `isRedirectError` guard re-throws NEXT_REDIRECT so successful create/edit redirects cleanly without false error alert
- All 4 announcement admin functions (`getAllAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`) refactored to use service role client after admin auth verification, bypassing RLS that blocked operations when admin JWT lacks `company_id` claim

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix report page serialization and campaign redirect error** - `db177a3` (fix)
2. **Task 2: Fix announcement admin actions to bypass RLS via service role client** - `4100b57` (fix)
3. **Task 3: Verify all 3 UAT fixes on deployed app** - ✓ Approved by user

## Files Created/Modified
- `src/app/(admin)/admin/reports/sales/page.tsx` - Changed exportFn to use .bind() instead of async closure
- `src/app/(admin)/admin/reports/products/page.tsx` - Changed exportFn to use .bind() instead of async closure
- `src/app/(admin)/admin/reports/dealers/page.tsx` - Changed exportFn to use .bind() instead of async closure
- `src/components/admin/campaign-form.tsx` - Added isRedirectError import and re-throw guard in catch block
- `src/lib/actions/announcements.ts` - Rewrote 4 admin functions to use service role client with auth verification

## Decisions Made
- `.bind(null, ...args)` used on server action functions instead of wrapping in `async () =>`. Next.js 16 can serialize bound server actions across server/client boundary; inline closures that capture variables cannot be serialized.
- `isRedirectError` imported from `next/dist/client/components/redirect-error` (internal Next.js module). This is the established Next.js pattern for distinguishing intentional redirects from real errors in try/catch blocks.
- Announcement admin mutations use two-step pattern: (1) session client verifies identity + gets admin role + gets company_id, (2) service role client performs the actual DB mutation. This maintains security while bypassing the broken RLS that requires `current_company_id()` to return non-NULL.
- `userData.company_id` null guard added in `getAllAnnouncements` — if admin's company_id is somehow null, returns empty array rather than TypeScript compile error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript null type error on userData.company_id**
- **Found during:** Task 2 (announcement actions fix)
- **Issue:** `userData.company_id` typed as `string | null` but `.eq()` requires `string` — TypeScript error TS2345
- **Fix:** Added `|| !userData.company_id` to the admin role guard so null company_id returns early
- **Files modified:** `src/lib/actions/announcements.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `4100b57` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type correctness)
**Impact on plan:** Necessary for TypeScript correctness. No scope creep.

## Issues Encountered
- None beyond the auto-fixed TypeScript null type issue above.

## User Setup Required
None - no external service configuration required for code changes. However, for Task 3 (checkpoint), the user should verify that the SQL reporting functions (get_sales_report, get_top_products, get_dealer_performance) are applied in Supabase Dashboard if report pages show empty data.

## Next Phase Readiness
- Tasks 1 and 2 committed and pushed to GitHub, Vercel deployment triggered
- Human verification passed — UAT-23, UAT-24, UAT-25 confirmed closed

## Self-Check: PASSED

- FOUND: src/app/(admin)/admin/reports/sales/page.tsx
- FOUND: src/app/(admin)/admin/reports/products/page.tsx
- FOUND: src/app/(admin)/admin/reports/dealers/page.tsx
- FOUND: src/components/admin/campaign-form.tsx
- FOUND: src/lib/actions/announcements.ts
- FOUND commit db177a3: fix report page serialization and campaign redirect error
- FOUND commit 4100b57: fix announcement admin actions to bypass RLS via service role client
- VERIFIED: isRedirectError import and guard present in campaign-form.tsx
- VERIFIED: .bind(null, ...) pattern present in all 3 report pages
- VERIFIED: createServiceClient called 4 times in announcements.ts

---
*Phase: 00-full-app-uat*
*Completed: 2026-03-05*
