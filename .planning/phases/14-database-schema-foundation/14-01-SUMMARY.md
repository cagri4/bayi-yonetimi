---
phase: 14-database-schema-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, rls, migrations, typescript]

# Dependency graph
requires:
  - phase: 09-agent-infrastructure
    provides: agent_definitions table and agent_conversations pattern used as reference
  - phase: 12-domain-tables
    provides: 011_phase12_domain_tables.sql pattern for table conventions

provides:
  - "supabase/migrations/012_v4_schema_foundation.sql — 10-block Dashboard-executable migration"
  - "onboarding_sessions table (wizard FSM state, nullable company_id, deep_link_token UNIQUE)"
  - "subscriptions table (company-scoped, plan/status enums, Mollie fields, UNIQUE company_id)"
  - "agent_marketplace table (global catalog, 12 seeded rows with Turkish display names)"
  - "payment_webhook_events table (mollie_event_id UNIQUE for idempotency)"
  - "superadmin_audit_log table (append-only, no UPDATE/DELETE RLS policies)"
  - "onboarding_invites table (token_hash UNIQUE, single-use enforcement at DB level)"
  - "companies.trial_ends_at column (nullable TIMESTAMPTZ)"
  - "agent_definitions.subscription_tier column (nullable TEXT with CHECK constraint)"
  - "TypeScript Row/Insert/Update types for all 6 new tables in database.types.ts"
  - "18 convenience type aliases exported (OnboardingSession, Subscription, AgentMarketplace, etc.)"

affects:
  - phase 15 (company-creation — reads subscriptions, agent_marketplace, onboarding_invites)
  - phase 16 (wizard — reads/writes onboarding_sessions, onboarding_invites)
  - phase 17 (billing — reads/writes subscriptions, payment_webhook_events)
  - phase 18 (marketplace — reads agent_marketplace, writes agent_definitions.subscription_tier)
  - phase 19 (superadmin — reads superadmin_audit_log, writes all tables)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "(SELECT is_superadmin()) wrapper on all superadmin RLS policies for performance (1 eval per query, not per row)"
    - "Block-based migration structure — 10 numbered BLOCK comments for Supabase Dashboard execution"
    - "IF NOT EXISTS on all CREATE TABLE and ADD COLUMN for migration idempotency"
    - "DROP TRIGGER IF EXISTS before CREATE TRIGGER for trigger idempotency"
    - "Global catalog pattern — agent_marketplace has no company_id, all authenticated can read"
    - "Append-only audit log — superadmin_audit_log has no authenticated INSERT/UPDATE/DELETE policies"
    - "UNIQUE constraint for DB-level idempotency — mollie_event_id, token_hash, subscriptions.company_id"
    - "Service-role-only access pattern — onboarding_sessions and payment_webhook_events bypass RLS"

key-files:
  created:
    - supabase/migrations/012_v4_schema_foundation.sql
  modified:
    - src/types/database.types.ts

key-decisions:
  - "agent_marketplace seed data uses actual AgentRole enum values (egitimci, satis_temsilcisi, etc.) not English placeholder names — 12 roles excluding destek which has placeholderTools only"
  - "onboarding_sessions.company_id is nullable — session must exist before company is provisioned (wizard creates the company)"
  - "update_updated_at_column() function uses CREATE OR REPLACE — safe re-run if function existed from earlier migrations"
  - "subscriptions.plan and companies.plan both kept — subscriptions.plan is billing source of truth; Phase 17 will resolve authoritative field question"
  - "agent_marketplace RLS: all authenticated SELECT (USING true) + superadmin FOR ALL — global catalog, no tenant scoping"
  - "BLOCK 6 verification DO block raises EXCEPTION if agent_marketplace count != 12 — Dashboard execution fails loudly on seed error"

patterns-established:
  - "v4.0 tables follow same row-level security conventions as v3.0 (009-011 migrations)"
  - "TypeScript types for non-company-scoped tables have no company_id in Row type"
  - "Append-only tables (audit log, webhook events) have no updated_at column"

requirements-completed: [DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 14 Plan 01: v4.0 Schema Foundation Summary

**PostgreSQL migration with 6 new tables, 12-row agent marketplace seed, and full TypeScript types for v4.0 onboarding, billing, and superadmin features**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T23:18:35Z
- **Completed:** 2026-03-05T23:23:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `supabase/migrations/012_v4_schema_foundation.sql` with 10 independently pasteable Dashboard blocks covering 6 new tables, 2 ALTER TABLE columns, RLS policies, indexes, triggers, and 12-row agent marketplace seed data
- Seeded `agent_marketplace` with exactly 12 rows using actual AgentRole enum values (egitimci, satis_temsilcisi, muhasebeci, depo_sorumlusu, genel_mudur_danismani, tahsilat_uzmani, dagitim_koordinatoru, saha_satis, pazarlamaci, urun_yoneticisi, satin_alma, iade_kalite) — all RLS policies use `(SELECT is_superadmin())` wrapper pattern
- Extended `src/types/database.types.ts` with Row/Insert/Update types for all 6 new tables plus column additions to companies and agent_definitions — TypeScript compilation passes with exit code 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration SQL file with 10 labeled blocks** - `ba6fffa` (feat)
2. **Task 2: Update TypeScript database types for all new tables and columns** - `72785e3` (feat)

## Files Created/Modified

- `supabase/migrations/012_v4_schema_foundation.sql` — 10-block Supabase Dashboard migration: 2 ALTER TABLE columns, 6 CREATE TABLE, RLS policies, indexes, triggers, 12-row agent marketplace seed, and a DO block verification
- `src/types/database.types.ts` — Added 6 new table types (onboarding_sessions, subscriptions, agent_marketplace, payment_webhook_events, superadmin_audit_log, onboarding_invites), companies.trial_ends_at, agent_definitions.subscription_tier, and 18 convenience aliases

## Decisions Made

- `agent_marketplace` seed data uses actual AgentRole enum values (matching `src/lib/agents/types.ts`) — not English names from the research code example (which used wrong placeholder values like 'trainer', 'sales')
- `onboarding_sessions.company_id` is nullable — the Telegram wizard session must exist before the company is created; making it NOT NULL would require a company before starting onboarding
- `update_updated_at_column()` uses `CREATE OR REPLACE` — the function likely already exists from migrations 001-011, but CREATE OR REPLACE makes the block idempotent
- Both `subscriptions.plan` and `companies.plan` are kept; subscriptions is the billing source of truth, but companies.plan is not deprecated in this migration — Phase 17 will resolve which is authoritative

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Database migration required before Phase 15 coding begins.** The file `supabase/migrations/012_v4_schema_foundation.sql` must be executed in the Supabase Dashboard SQL Editor:

1. Open: https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
2. Paste and run BLOCK 1 (ALTER TABLE companies)
3. Paste and run BLOCK 2 (ALTER TABLE agent_definitions)
4. Paste and run BLOCK 3 (CREATE TABLE subscriptions)
5. Paste and run BLOCK 4 (CREATE TABLE agent_marketplace)
6. Paste and run BLOCK 5 (INSERT 12 seed rows)
7. Paste and run BLOCK 6 (verification — must complete without exception)
8. Paste and run BLOCK 7 (CREATE TABLE onboarding_sessions)
9. Paste and run BLOCK 8 (CREATE TABLE onboarding_invites)
10. Paste and run BLOCK 9 (CREATE TABLE payment_webhook_events)
11. Paste and run BLOCK 10 (CREATE TABLE superadmin_audit_log)

## Next Phase Readiness

- All 6 v4.0 tables ready for schema execution in Supabase Dashboard
- TypeScript types available for immediate use in Phase 15 application code
- Phase 15 (Company Creation) can begin as soon as the migration is applied to the database
- `agent_marketplace` seed data will be available once BLOCK 5 is executed — Phase 18 Marketplace UI depends on this data

---
*Phase: 14-database-schema-foundation*
*Completed: 2026-03-05*
