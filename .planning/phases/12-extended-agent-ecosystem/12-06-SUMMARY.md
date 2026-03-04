---
phase: 12-extended-agent-ecosystem
plan: 06
subsystem: api
tags: [telegram, webhook, agents, supabase, sql-seed]

# Dependency graph
requires:
  - phase: 12-02
    provides: AgentRole types for tahsilat_uzmani, dagitim_koordinatoru, saha_satis, pazarlamaci, urun_yoneticisi, satin_alma, iade_kalite
  - phase: 12-03
    provides: pazarlamaci and saha_satis tool handlers
  - phase: 12-04
    provides: urun_yoneticisi, satin_alma, iade_kalite tool handlers
  - phase: 12-01
    provides: domain tables (purchase_orders, return_requests, dealer_visits, etc.)
provides:
  - 7 Telegram webhook routes at /api/telegram/{role}/route.ts
  - SS/12-agent-definitions-seed.sql for Supabase agent_definitions upsert
  - Webhook URLs ready for Telegram bot registration (pending user creates bots)
affects:
  - 12-07 (final wiring phase that registers bots and completes ecosystem)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Webhook per bot: each role has dedicated /api/telegram/{slug}/route.ts"
    - "Kebab-case URL path maps to underscore role enum (satin-alma -> satin_alma)"
    - "All routes identical to egitimci/route.ts with 3 substitutions: env var, role string, log prefix"

key-files:
  created:
    - src/app/api/telegram/tahsilat-uzmani/route.ts
    - src/app/api/telegram/dagitim-koordinatoru/route.ts
    - src/app/api/telegram/saha-satis/route.ts
    - src/app/api/telegram/pazarlamaci/route.ts
    - src/app/api/telegram/urun-yoneticisi/route.ts
    - src/app/api/telegram/satin-alma/route.ts
    - src/app/api/telegram/iade-kalite/route.ts
    - SS/12-agent-definitions-seed.sql
  modified: []

key-decisions:
  - "pazarlamaci gets claude-sonnet-4-6 (reasoning-heavy campaign analysis); remaining 6 agents use claude-haiku-4-5"
  - "satin_alma and iade_kalite system prompts include explicit ONEMLI confirmation gate — no DB logic, prompt-enforced"
  - "Seed uses DO $$ pattern with v_company_id from companies WHERE slug='default' — same as Phase 11 seed"
  - "Route files use TELEGRAM_BOT_TOKEN_{ROLE_UPPERCASE} env var naming convention — e.g., TELEGRAM_BOT_TOKEN_DAGITIM_KOORDINATORU"

patterns-established:
  - "Phase 12 webhooks: 7 routes follow exact egitimci template, substituting role enum + env var + log prefix only"

requirements-completed:
  - AO-01

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 12 Plan 06: 7 Webhook Routes + Agent Definitions Seed Summary

**7 Telegram webhook routes and agent_definitions seed SQL for Phase 12 agents, following established egitimci/route.ts pattern with role-specific env vars and role enum strings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T09:46:45Z
- **Completed:** 2026-03-04T09:49:00Z
- **Tasks:** 2 auto tasks complete (checkpoint pending human verification)
- **Files modified:** 8

## Accomplishments

- Created 7 dedicated Telegram webhook routes (tahsilat-uzmani, dagitim-koordinatoru, saha-satis, pazarlamaci, urun-yoneticisi, satin-alma, iade-kalite) — all based exactly on egitimci/route.ts template
- Created SS/12-agent-definitions-seed.sql with 7 INSERT INTO agent_definitions using ON CONFLICT DO UPDATE, following Phase 11 seed pattern
- TypeScript check (`npx tsc --noEmit`) passed with zero errors on all new files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 7 Telegram webhook routes** - `78fb43d` (feat)
2. **Task 2: Create SS/12-agent-definitions-seed.sql** - `c67bde8` (feat)

**Plan metadata:** (final commit after checkpoint resolution)

## Files Created/Modified

- `src/app/api/telegram/tahsilat-uzmani/route.ts` - Webhook route for tahsilat_uzmani agent (TELEGRAM_BOT_TOKEN_TAHSILAT_UZMANI)
- `src/app/api/telegram/dagitim-koordinatoru/route.ts` - Webhook route for dagitim_koordinatoru agent (TELEGRAM_BOT_TOKEN_DAGITIM_KOORDINATORU)
- `src/app/api/telegram/saha-satis/route.ts` - Webhook route for saha_satis agent (TELEGRAM_BOT_TOKEN_SAHA_SATIS)
- `src/app/api/telegram/pazarlamaci/route.ts` - Webhook route for pazarlamaci agent (TELEGRAM_BOT_TOKEN_PAZARLAMACI)
- `src/app/api/telegram/urun-yoneticisi/route.ts` - Webhook route for urun_yoneticisi agent (TELEGRAM_BOT_TOKEN_URUN_YONETICISI)
- `src/app/api/telegram/satin-alma/route.ts` - Webhook route for satin_alma agent (TELEGRAM_BOT_TOKEN_SATIN_ALMA)
- `src/app/api/telegram/iade-kalite/route.ts` - Webhook route for iade_kalite agent (TELEGRAM_BOT_TOKEN_IADE_KALITE)
- `SS/12-agent-definitions-seed.sql` - 7 agent INSERT statements with Turkish system prompts

## Decisions Made

- pazarlamaci gets claude-sonnet-4-6 (reasoning-heavy campaign analysis per plan spec); remaining 6 Phase 12 agents use claude-haiku-4-5
- satin_alma and iade_kalite system prompts contain explicit ONEMLI confirmation gate text — behavioral enforcement via prompt, not code
- Seed follows Phase 11 DO $$ pattern — company_id resolved from companies WHERE slug='default', safe upsert with ON CONFLICT

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration** before Vercel deploy verification:

1. Run `SS/12-agent-definitions-seed.sql` in Supabase Dashboard SQL Editor:
   - URL: https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
   - Verifies 7 new rows in agent_definitions: `SELECT role, name, model FROM agent_definitions ORDER BY created_at;`

2. Push code to trigger Vercel deploy: `git add . && git commit -m "..." && git push`

3. Verify routes live at:
   - https://bayi-yonetimi.vercel.app/api/telegram/tahsilat-uzmani (POST only — GET returns 405)
   - https://bayi-yonetimi.vercel.app/api/telegram/iade-kalite (POST only)

4. Add 7 new env vars to Vercel project once Telegram bots are created:
   - TELEGRAM_BOT_TOKEN_TAHSILAT_UZMANI
   - TELEGRAM_BOT_TOKEN_DAGITIM_KOORDINATORU
   - TELEGRAM_BOT_TOKEN_SAHA_SATIS
   - TELEGRAM_BOT_TOKEN_PAZARLAMACI
   - TELEGRAM_BOT_TOKEN_URUN_YONETICISI
   - TELEGRAM_BOT_TOKEN_SATIN_ALMA
   - TELEGRAM_BOT_TOKEN_IADE_KALITE

## Next Phase Readiness

- 7 webhook routes ready to receive Telegram updates once bot tokens registered
- agent_definitions seed ready to apply to Supabase
- Plan 07 (final wiring, bot registration, end-to-end test) can proceed after checkpoint verification
- Telegram bot registration (via @BotFather) needed for each of the 7 new roles

---
*Phase: 12-extended-agent-ecosystem*
*Completed: 2026-03-04*
