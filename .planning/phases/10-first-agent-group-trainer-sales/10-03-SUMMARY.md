---
phase: 10-first-agent-group-trainer-sales
plan: 03
subsystem: api
tags: [telegram, agents, dispatcher, webhook, tool-registry, sql-seed]

# Dependency graph
requires:
  - phase: 10-first-agent-group-trainer-sales/10-01
    provides: egitimciTools array and createEgitimciHandlers factory
  - phase: 10-first-agent-group-trainer-sales/10-02
    provides: satisTools array and createSatisHandlers factory
  - phase: 09-agent-infrastructure
    provides: dispatcher.ts, tool-registry.ts, AgentRole types, Telegram webhook pattern
provides:
  - ToolRegistry wired to real tools for egitimci and satis_temsilcisi (replaces placeholderTools)
  - dispatchAgentUpdate refactored with forcedRole + botToken params for per-bot routing
  - /api/telegram/egitimci route — dedicated Egitimci bot webhook
  - /api/telegram/satis route — dedicated Satis Temsilcisi bot webhook
  - SS/10-agent-definitions-seed.sql — SQL seed for agent_definitions table with Turkish system prompts
affects: [Phase 11 (Financial + Ops Agents), Phase 12, any agent infrastructure consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - forcedRole pattern: each dedicated webhook route passes its role to dispatcher; no agent_definitions role lookup needed
    - botToken parameter pattern: each webhook route passes its own bot token; sendTelegramMessage is token-agnostic
    - handler factory injection in dispatcher: role switches select createEgitimciHandlers or createSatisHandlers; else clause retains placeholder handlers

key-files:
  created:
    - src/app/api/telegram/egitimci/route.ts
    - src/app/api/telegram/satis/route.ts
    - SS/10-agent-definitions-seed.sql
  modified:
    - src/lib/agents/tool-registry.ts
    - src/lib/agents/dispatcher.ts

key-decisions:
  - "TOOL_REGISTRY.egitimci = egitimciTools and TOOL_REGISTRY.satis_temsilcisi = satisTools — real tools replace placeholderTools at registry level"
  - "sendTelegramMessage token parameter replaces process.env.TELEGRAM_BOT_TOKEN — each route passes its own token for multi-bot support"
  - "parse_mode: 'Markdown' removed from sendTelegramMessage — prevents Telegram 400 errors from Claude's unbalanced markdown output (Pitfall 6)"
  - "agent_definitions query now filters by .eq('role', role) — retrieves system prompt for the specific role rather than first-active for company"
  - "forcedRole skips role detection; if forcedRole set, role field from agent_definitions is NOT overwritten (only systemPrompt is taken)"
  - "SQL seed creates UNIQUE INDEX on (company_id, role) before INSERT — makes ON CONFLICT safe even if index was absent"

patterns-established:
  - "Dedicated webhook per bot: /api/telegram/{role}/route.ts uses TELEGRAM_BOT_TOKEN_{ROLE} and passes forcedRole to dispatcher"
  - "Handler factory injection: dispatcher switches on role to call appropriate createXxxHandlers factory; future roles add a new else-if branch"

requirements-completed: [TR-03, TR-04, SR-07]

# Metrics
duration: 6min
completed: 2026-03-01
---

# Phase 10 Plan 03: Wire Tools into Dispatcher + Dedicated Webhook Routes Summary

**ToolRegistry wired to egitimciTools/satisTools, dispatcher refactored with forcedRole+botToken, two dedicated Telegram webhook routes created, and agent_definitions SQL seed prepared with Turkish system prompts enforcing SR-07 order confirmation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-01T19:34:27Z
- **Completed:** 2026-03-01T19:40:51Z
- **Tasks:** 3 of 3 (Task 3 human-action checkpoint completed — SQL seeded in Supabase Dashboard)
- **Files modified:** 5

## Accomplishments
- Updated `TOOL_REGISTRY` to use real tool arrays for egitimci (2 read-only tools) and satis_temsilcisi (6 tools including create_order)
- Refactored `dispatchAgentUpdate` to accept `forcedRole` + `botToken` parameters and build handler maps via factory functions per role
- Removed `parse_mode: 'Markdown'` from `sendTelegramMessage` to prevent Telegram 400 errors (Pitfall 6)
- Created `/api/telegram/egitimci` and `/api/telegram/satis` dedicated webhook routes — both verified in Next.js build output
- Created `SS/10-agent-definitions-seed.sql` with Turkish system prompts for both agents; Satis Temsilcisi prompt explicitly enforces SR-07 (order confirmation before create_order)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ToolRegistry + refactor dispatcher** - `ed94fd1` (feat)
2. **Task 2: Create webhook routes + SQL seed** - `9dcaa64` (feat)

**Plan metadata:** complete (Task 3 human-action checkpoint resolved 2026-03-02)

## Files Created/Modified
- `src/lib/agents/tool-registry.ts` - Replaced placeholderTools with egitimciTools and satisTools for their respective roles
- `src/lib/agents/dispatcher.ts` - Added forcedRole+botToken params; per-role handler factory injection; removed parse_mode; token-param sendTelegramMessage
- `src/app/api/telegram/egitimci/route.ts` - Dedicated Egitimci bot webhook using TELEGRAM_BOT_TOKEN_EGITIMCI
- `src/app/api/telegram/satis/route.ts` - Dedicated Satis Temsilcisi bot webhook using TELEGRAM_BOT_TOKEN_SATIS
- `SS/10-agent-definitions-seed.sql` - Upsert seed for egitimci (Sonnet 4.6) + satis_temsilcisi (Haiku 4.5) with Turkish prompts

## Decisions Made
- forcedRole design: each dedicated webhook route passes its role directly; dispatcher skips role detection and goes straight to system prompt fetch filtered by that role. Backward-compatible: original /api/telegram/route.ts still works with fallback 'destek' role.
- Multi-bot token: `sendTelegramMessage` now accepts a `token` string parameter. Each route passes its own env var. Falls back to `process.env.TELEGRAM_BOT_TOKEN` when botToken not provided.
- parse_mode removal: Telegram API returns 400 when Claude's markdown has unbalanced asterisks/underscores. Plain text avoids this entirely.
- SQL seed includes `CREATE UNIQUE INDEX IF NOT EXISTS` guard before `ON CONFLICT (company_id, role)` INSERT — works even if the unique constraint was never created.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript compiled clean on first attempt for both tasks.

## User Setup Required

**Task 3 requires manual SQL execution in Supabase Dashboard.**

Steps to complete:
1. Open: https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
2. Copy contents of `SS/10-agent-definitions-seed.sql`
3. Paste into the SQL Editor and click "Run"
4. Verify: Run `SELECT role, name, model, is_active FROM agent_definitions;` — should show 2 rows (egitimci + satis_temsilcisi)
5. Type "seeded" to resume execution

## Next Phase Readiness
- Complete Phase 10 agent pipeline is wired end-to-end
- Two new Telegram bot env vars needed in Vercel: `TELEGRAM_BOT_TOKEN_EGITIMCI` and `TELEGRAM_BOT_TOKEN_SATIS`
- agent_definitions SQL seed must be executed (Task 3 checkpoint) before end-to-end testing
- Phase 11 (Financial + Ops Agents) can begin once Phase 10 Plans 04-05 are complete

## Self-Check

Verifying claims:

- `/api/telegram/egitimci/route.ts` exists: FOUND
- `/api/telegram/satis/route.ts` exists: FOUND
- `SS/10-agent-definitions-seed.sql` exists: FOUND
- `ed94fd1` commit exists: FOUND
- `9dcaa64` commit exists: FOUND
- `npx tsc --noEmit` passes: PASSED (0 errors)
- `npm run build` shows both new routes: PASSED

## Self-Check: PASSED

---
*Phase: 10-first-agent-group-trainer-sales*
*Completed: 2026-03-01*
