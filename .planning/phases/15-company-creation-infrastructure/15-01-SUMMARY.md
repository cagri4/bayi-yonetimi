---
phase: 15-company-creation-infrastructure
plan: 01
subsystem: api
tags: [postgres, supabase, server-actions, telegram, auth, audit-log, sha256]

# Dependency graph
requires:
  - phase: 14-database-schema-foundation
    provides: "superadmin_audit_log, onboarding_invites, companies, subscriptions, agent_definitions, onboarding_sessions tables in DB"

provides:
  - "provision_company SECURITY DEFINER RPC: atomic company+users+subscription+12 agent_definitions in one Postgres TX"
  - "createCompany Server Action with compensating auth user rollback on RPC failure"
  - "generateInviteLink Server Action with SHA-256 hashed single-use token and 7-day expiry"
  - "assertSuperadmin() guard: server-only, returns actor_id for audit log, throws FORBIDDEN"
  - "sendTelegramMessage standalone utility (independent of agent layer)"
  - "Middleware updated to handle superadmin role for /admin and /superadmin routes"
  - "TELEGRAM_BOT_TOKEN_SIHIRBAZ and TELEGRAM_BOT_USERNAME_SIHIRBAZ env vars registered"

affects:
  - phase-16-onboarding-wizard
  - phase-19-superadmin-dashboard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "assertSuperadmin() guard pattern: first line of every superadmin Server Action, try/catch returns structured 403"
    - "Compensating transaction pattern: auth.admin.createUser -> RPC -> on failure: auth.admin.deleteUser"
    - "SHA-256 invite token pattern: raw UUID returned in deep link, only hash stored in DB"
    - "Superadmin audit log: every write produces a superadmin_audit_log row"
    - "SECURITY DEFINER + REVOKE pattern for RPC functions callable only by service role"

key-files:
  created:
    - supabase/migrations/013_provision_company_rpc.sql
    - src/lib/superadmin/guard.ts
    - src/lib/actions/superadmin.ts
    - src/lib/telegram/send.ts
  modified:
    - src/middleware.ts
    - src/lib/env.ts
    - .env.example

key-decisions:
  - "provision_company clones agent_definitions from companies WHERE slug='default'; falls back to minimal definition (model=claude-haiku-4-5, empty system_prompt) if no template found"
  - "Auth user rollback is explicit: serviceClient.auth.admin.deleteUser() called if RPC fails — Supabase auth.users is NOT in the same transaction as public tables"
  - "SHA-256 hash via Web Crypto API (crypto.subtle.digest) — Edge-compatible, no Node.js crypto import needed"
  - "Middleware: superadmin allowed through /admin routes (existing admin UI works for superadmin); /superadmin protected from non-superadmin; redirects superadmin to /superadmin on login"
  - "(serviceClient as any) cast used for RPC, onboarding_invites, superadmin_audit_log inserts — these tables are in database.types.ts but the typed client may not expose .rpc() for custom functions; consistent with Phase 10 orders/order_items pattern"
  - "generateInviteLink is both inline (in createCompany) and standalone action — wizard Phase 16 uses the standalone for regeneration without creating a company"

patterns-established:
  - "Superadmin Server Action pattern: 'use server' + assertSuperadmin() in try/catch returning {error, status:403} + (serviceClient as any) for new tables"
  - "Invite token lifecycle: raw=randomUUID, hash=SHA-256(raw), DB stores hash, deep link carries raw — token is unguessable and single-use"

requirements-completed: [SA-01, SA-02, SA-05, SA-06, KS-05, KS-06]

# Metrics
duration: 17min
completed: 2026-03-06
---

# Phase 15 Plan 01: Company Creation Infrastructure Summary

**Atomic company provisioning via SECURITY DEFINER RPC with compensating auth rollback, SHA-256 invite tokens, superadmin guard pattern, and middleware updated for superadmin role**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-06T11:22:17Z
- **Completed:** 2026-03-06T11:39:17Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- provision_company Postgres function atomically creates company + users row + subscription + 12 agent_definitions in a single transaction, cloning from default company template
- createCompany Server Action implements two-phase commit (auth.admin.createUser then RPC) with explicit compensating deleteUser on RPC failure
- generateInviteLink Server Action produces SHA-256 hashed tokens (raw UUID in deep link, hash stored in DB) with 7-day expiry; every invocation writes to superadmin_audit_log
- assertSuperadmin() guard established as server-only module returning actor_id; all superadmin actions protected from day 1
- Middleware updated to handle superadmin role across four code paths: auth page redirects, root path redirects, /admin route protection, and new /superadmin route protection

## Task Commits

Each task was committed atomically:

1. **Task 1: provision_company RPC + middleware + guard** - `fdbff48` (feat)
2. **Task 2: createCompany + generateInviteLink + sendTelegramMessage + env** - `7dae349` (feat)

**Plan metadata:** (docs commit — created after summary)

## Files Created/Modified

- `supabase/migrations/013_provision_company_rpc.sql` - SECURITY DEFINER RPC for atomic 4-table provisioning + 12-role agent_definitions clone loop
- `src/lib/superadmin/guard.ts` - assertSuperadmin() server-only guard, returns actor_id, throws FORBIDDEN
- `src/lib/actions/superadmin.ts` - createCompany and generateInviteLink Server Actions with audit logging
- `src/lib/telegram/send.ts` - Standalone sendTelegramMessage utility (no agent layer dependency)
- `src/middleware.ts` - Superadmin role handling: auth redirects, root redirects, /admin allow-through, /superadmin gate
- `src/lib/env.ts` - TELEGRAM_BOT_TOKEN_SIHIRBAZ and TELEGRAM_BOT_USERNAME_SIHIRBAZ added as optional
- `.env.example` - Sihirbaz bot vars documented in Telegram section

## Decisions Made

- provision_company clones agent_definitions from companies WHERE slug='default'; fallback to minimal definition (claude-haiku-4-5, empty system_prompt) if no default template exists
- Auth user rollback is explicit — Supabase auth.users is NOT inside the same Postgres transaction as public schema tables; compensating deleteUser is required
- SHA-256 via crypto.subtle.digest (Web Crypto API) — Edge-compatible without Node.js crypto import, consistent with Next.js Edge runtime
- (serviceClient as any) casts used for RPC and new table inserts — consistent with Phase 10-12 pattern for tables not yet surfaced by TypeScript query builder
- superadmin allowed through /admin routes (not just /superadmin) — superadmin needs admin UI access for company oversight; /superadmin panel is separate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled clean on first attempt. pnpm build passed with exit code 0, 38 routes generated.

## User Setup Required

**Two Telegram env vars needed before Phase 16 wizard is functional:**

| Variable | Source |
|---|---|
| `TELEGRAM_BOT_TOKEN_SIHIRBAZ` | Register new bot via BotFather `/newbot` command |
| `TELEGRAM_BOT_USERNAME_SIHIRBAZ` | Username chosen during BotFather registration (without @) |

The Server Actions degrade gracefully when these are unset — deep link falls back to `SihirbazBot` username placeholder.

## Next Phase Readiness

- Phase 16 (Onboarding Wizard) can import `createCompany` and `generateInviteLink` directly from `@/lib/actions/superadmin`
- Phase 19 (Superadmin Dashboard) can import the same actions; UI forms call them via useActionState
- 013_provision_company_rpc.sql needs to be executed in Supabase Dashboard SQL Editor before first real company creation
- Telegram bot registration (BotFather) should happen before Phase 16 coding begins

---
*Phase: 15-company-creation-infrastructure*
*Completed: 2026-03-06*
