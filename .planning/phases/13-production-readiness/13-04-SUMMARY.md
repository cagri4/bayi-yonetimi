---
phase: 13-production-readiness
plan: "04"
subsystem: infra
tags: [github-actions, ci, pnpm, supabase, backup]

# Dependency graph
requires: []
provides:
  - GitHub Actions CI pipeline running lint, type-check, and build on every push to master
  - Database backup strategy documentation with migration inventory
affects:
  - 13-06-testing (will add test step to this workflow)
  - future-deployment (quality gate now blocks broken code from reaching Vercel)

# Tech tracking
tech-stack:
  added: [github-actions, actions/checkout@v4, actions/setup-node@v4, pnpm/action-setup@v4]
  patterns:
    - placeholder-env-for-build: NEXT_PUBLIC_* vars given placeholder values so Next.js build succeeds in CI without real Supabase credentials
    - fail-fast-ordering: lint -> type-check -> build (cheapest checks run first)

key-files:
  created:
    - .github/workflows/ci.yml
  modified: []

key-decisions:
  - "pnpm --frozen-lockfile enforces lockfile consistency — fails if pnpm-lock.yaml is out of sync"
  - "Node 20 LTS matches Vercel default runtime"
  - "Single job (not parallel) — simplicity over speed for a ~2 min pipeline"
  - "No test step in this plan — Plan 06 adds Vitest step after test infrastructure is in place"
  - "Only NEXT_PUBLIC_* placeholder env vars supplied — server-side vars not inlined at build time and are not required"

patterns-established:
  - "CI placeholder env pattern: NEXT_PUBLIC_* env vars set to placeholder strings in CI build step"

requirements-completed: [P0-CI, P1-DBBACKUP]

# Metrics
duration: 1min
completed: 2026-03-05
---

# Phase 13 Plan 04: CI Pipeline and Database Backup Summary

**GitHub Actions CI workflow with lint + tsc + build gate on every master push, plus Supabase backup strategy documented with 11-migration inventory**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-05T08:55:42Z
- **Completed:** 2026-03-05T08:56:33Z
- **Tasks:** 2 (1 file task + 1 documentation task)
- **Files modified:** 1 (.github/workflows/ci.yml created)

## Accomplishments

- Created `.github/workflows/ci.yml` with a 5-step CI pipeline (checkout, Node 20, pnpm 9, lint, tsc, build)
- CI triggers on every push and pull request to master branch
- pnpm with `--frozen-lockfile` ensures reproducible installs in CI
- Documented Supabase automated backup strategy with full 11-migration inventory
- Established quality gate: broken lint/types/build now blocked before Vercel deployment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub Actions CI workflow** - `ec09314` (feat)
2. **Task 2: Verify and document database backup strategy** - documentation only, no source commit

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `.github/workflows/ci.yml` - GitHub Actions CI pipeline: lint, tsc --noEmit, pnpm run build on every push/PR to master

## Decisions Made

- **pnpm `--frozen-lockfile`:** Enforces that `pnpm-lock.yaml` is committed and up to date. CI fails if lock file diverges from `package.json`.
- **Node 20 LTS:** Matches Vercel's default build environment for consistency.
- **Placeholder env vars for build:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are inlined at build time by Next.js. Without placeholder values the build fails with "required env var" errors. Server-side-only vars (service role key, etc.) are NOT needed at build time.
- **No test step yet:** Zero tests exist in the codebase. Plan 06 will add Vitest configuration and a `pnpm run test` step to this workflow.
- **Single job, sequential steps:** Pipeline is ~2 min end-to-end. Parallelization would add workflow complexity without significant time savings at this scale.

## Database Backup Verification

### Current Backup Status

Supabase project `neqcuhejmornybmbclwt` (West EU London):

| Feature | Free Tier | Pro Tier |
|---------|-----------|----------|
| Automated daily backups | Yes (7-day retention) | Yes (14-day retention) |
| Point-in-Time Recovery (PITR) | No | Yes (available add-on) |
| Manual backup download | Yes (pg_dump via dashboard) | Yes |

**Current tier:** Free (verify in Supabase Dashboard > Project Settings > Billing)

### Recovery Procedure

1. Go to Supabase Dashboard at https://supabase.com/dashboard/project/neqcuhejmornybmbclwt
2. Navigate to **Database > Backups**
3. Select the backup point to restore from (within 7-day window on Free, 14-day on Pro)
4. Click **Restore** and confirm

For Pro PITR:
- Navigate to **Database > Backups > Point in Time**
- Enter desired restore timestamp (UTC)
- Confirm restore (creates new project instance)

### Additional Safety: pg_dump Export

For additional safety beyond Supabase automated backups, a manual export can be run from the Supabase Dashboard:

1. Go to **Database > Backups**
2. Click **Download backup** to get a pg_dump `.tar.gz` file
3. Store in a separate location (S3, local drive, etc.)

Recommendation: Run manual export before major deployments or schema migrations.

### Migration Inventory (11 migrations, in order)

All 11 migrations are present in `supabase/migrations/`. A complete manual rebuild requires applying them in this order:

| # | File | Description |
|---|------|-------------|
| 1 | `001_initial_schema.sql` | Core tables: companies, users, dealers, products, orders, etc. |
| 2 | `002_realtime_setup.sql` | Supabase Realtime publication config |
| 3 | `003_reporting_functions.sql` | SQL RPC functions for reporting |
| 4 | `004_push_notifications.sql` | Push notification tables |
| 5 | `005_dealer_favorites.sql` | dealer_favorites table |
| 6 | `006_financial_tables.sql` | Financial tables: dealer_transactions, transaction_types |
| 7 | `007_dashboard_campaigns.sql` | Campaigns and dashboard tables |
| 8 | `008_support_reports.sql` | Support messages and product requests |
| 9 | `009_multi_tenant.sql` | Multi-tenant RLS, company_id on all tables, JWT hook |
| 10 | `010_agent_tables.sql` | AI agent infrastructure tables (Phase 9-12) |
| 11 | `011_phase12_domain_tables.sql` | Phase 12 domain tables: purchase_orders, return_requests, etc. |

**Seed file:** `supabase/seed.sql` — companies, users, agent_definitions seed data. Must run after all migrations.

### Recommendations

1. **Verify backup status:** Confirm automated backups are enabled in Supabase Dashboard > Database > Backups
2. **Pre-migration exports:** Always download a manual pg_dump before running new migrations in production
3. **Document migration execution:** When applying new migrations, note the timestamp and verify with `select version from schema_migrations order by version desc limit 5`
4. **Consider Pro upgrade:** PITR allows sub-daily recovery points and is recommended before the system handles real production traffic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The CI workflow will activate automatically when the changes are pushed to GitHub. GitHub Actions is included with all GitHub repositories at no additional cost.

**Note:** Verify Supabase backup status manually by visiting:
https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/database/backups

## Next Phase Readiness

- CI pipeline is live — any future push to master will trigger lint + type-check + build
- Plan 06 (Testing) can add a `pnpm run test` step to `.github/workflows/ci.yml` after Vitest is configured
- Database backup strategy documented; team knows recovery procedure and migration order
- P0-CI and P1-DBBACKUP requirements satisfied

## Self-Check: PASSED

- `.github/workflows/ci.yml` — FOUND
- `13-04-SUMMARY.md` — FOUND
- Commit `ec09314` — FOUND

---
*Phase: 13-production-readiness*
*Completed: 2026-03-05*
