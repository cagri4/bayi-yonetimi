---
phase: 11-financial-operations-agents
plan: 04
subsystem: api
tags: [telegram, agents, dispatcher, tool-registry, sql-seed, webhook]

# Dependency graph
requires:
  - phase: 11-01
    provides: muhasebeciTools array and createMuhasebeciHandlers factory
  - phase: 11-02
    provides: depoSorumlusuTools array and createDepoSorumlusuHandlers factory
  - phase: 11-03
    provides: genelMudurTools array and createGenelMudurHandlers factory
  - phase: 10-03
    provides: dispatcher pattern, dedicated webhook route pattern, SQL seed pattern
provides:
  - TOOL_REGISTRY updated: muhasebeci, depo_sorumlusu, genel_mudur_danismani use real tool arrays
  - Dispatcher extended: 3 new role branches (muhasebeci, depo_sorumlusu, genel_mudur_danismani)
  - 3 dedicated Telegram webhook routes at /api/telegram/{muhasebeci,depo-sorumlusu,genel-mudur}
  - SS/11-agent-definitions-seed.sql with Turkish system prompts enforcing MH-06 and DS-03
affects:
  - phase-12 (relies on all 3 new agents being wired and live)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedicated webhook per agent bot: /api/telegram/{role}/route.ts pattern with TELEGRAM_BOT_TOKEN_{ROLE}"
    - "TOOL_REGISTRY update cadence: placeholder -> real tools per phase as agents are implemented"
    - "Dispatcher role switch extension: ordered else-if chain, fallback last"
    - "SQL seed upsert: ON CONFLICT (company_id, role) DO UPDATE for idempotent re-runs"

key-files:
  created:
    - src/app/api/telegram/muhasebeci/route.ts
    - src/app/api/telegram/depo-sorumlusu/route.ts
    - src/app/api/telegram/genel-mudur/route.ts
    - SS/11-agent-definitions-seed.sql
  modified:
    - src/lib/agents/tool-registry.ts
    - src/lib/agents/dispatcher.ts

key-decisions:
  - "URL path uses kebab-case (depo-sorumlusu, genel-mudur) while role enum uses underscores (depo_sorumlusu, genel_mudur_danismani) — consistent with Phase 10 satis pattern"
  - "SQL seed contains KRITIK KURAL in Muhasebeci prompt (MH-06) and ONEMLI KURAL in Depo Sorumlusu prompt (DS-03) — enforced via system prompt text, not code logic"
  - "Genel Mudur Danismani URL is shortened (genel-mudur) while full role name is genel_mudur_danismani — URL brevity vs code clarity tradeoff"

patterns-established:
  - "Phase N tool wiring: import {roleTools} from tools/role-tools, update TOOL_REGISTRY, add createRoleHandlers import, extend dispatcher else-if, create /api/telegram/role/route.ts"

requirements-completed:
  - MH-06
  - DS-03
  - GM-04

# Metrics
duration: 13min
completed: 2026-03-02
---

# Phase 11 Plan 04: Wire Financial and Operations Agents Summary

**TOOL_REGISTRY and dispatcher extended for 3 new agents; 3 dedicated Telegram webhook routes created; SQL seed with Turkish system prompts enforcing MH-06 hallucination prevention and DS-03 stock confirmation**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-02T09:05:15Z
- **Completed:** 2026-03-02T09:18:04Z
- **Tasks:** 2 of 3 complete (Task 3 is a human-action checkpoint — SQL seed execution)
- **Files modified:** 6

## Accomplishments
- TOOL_REGISTRY updated: muhasebeci, depo_sorumlusu, genel_mudur_danismani now point to real tool arrays (no longer placeholderTools)
- Dispatcher extended with 3 new role branches: muhasebeci → createMuhasebeciHandlers, depo_sorumlusu → createDepoSorumlusuHandlers, genel_mudur_danismani → createGenelMudurHandlers
- 3 dedicated Telegram webhook routes created following Phase 10 pattern — each uses its own TELEGRAM_BOT_TOKEN_{ROLE} env var
- SQL seed prepared with Turkish system prompts: MH-06 KRITIK KURAL (no financial numbers without tool call), DS-03 ONEMLI KURAL (explicit confirmation before update_stock), GM-04 cross-domain analysis instruction
- TypeScript check and npm run build both pass — all 3 new routes appear in build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ToolRegistry and extend dispatcher** - `d49b4c2` (feat)
2. **Task 2: Create 3 webhook routes and SQL seed** - `cd1a0d5` (feat)
3. **Task 3: Execute SQL seed** - Pending — requires human action (Supabase Dashboard SQL Editor)

## Files Created/Modified
- `src/lib/agents/tool-registry.ts` - Added 3 new imports; muhasebeci/depo_sorumlusu/genel_mudur_danismani now use real tool arrays
- `src/lib/agents/dispatcher.ts` - Added 3 new handler factory imports; 3 new else-if role branches before fallback
- `src/app/api/telegram/muhasebeci/route.ts` - Muhasebeci bot webhook, TELEGRAM_BOT_TOKEN_MUHASEBECI, forcedRole=muhasebeci
- `src/app/api/telegram/depo-sorumlusu/route.ts` - Depo Sorumlusu bot webhook, TELEGRAM_BOT_TOKEN_DEPO_SORUMLUSU, forcedRole=depo_sorumlusu
- `src/app/api/telegram/genel-mudur/route.ts` - Genel Mudur Danismani bot webhook, TELEGRAM_BOT_TOKEN_GENEL_MUDUR, forcedRole=genel_mudur_danismani
- `SS/11-agent-definitions-seed.sql` - 3 agent definitions with Turkish system prompts, ON CONFLICT upsert pattern

## Decisions Made
- URL path uses kebab-case (depo-sorumlusu, genel-mudur) while role enum uses underscores — consistent with satis/satis_temsilcisi pattern from Phase 10
- SQL seed contains KRITIK KURAL in Muhasebeci prompt and ONEMLI KURAL in Depo Sorumlusu prompt — system prompt enforcement, not code logic (MH-06, DS-03)
- Genel Mudur URL shortened to genel-mudur while role enum remains full genel_mudur_danismani — URL brevity tradeoff

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript passed zero errors on first run; build succeeded with all 3 new routes confirmed in output.

## User Setup Required

**Task 3 requires manual SQL execution in Supabase Dashboard:**

1. Open: https://supabase.com/dashboard/project/neqcuhejmornybmbclwt/sql/new
2. Copy contents of `SS/11-agent-definitions-seed.sql`
3. Paste into the SQL Editor and click "Run"
4. Verify: Run `SELECT role, name, model, is_active FROM agent_definitions WHERE role IN ('muhasebeci', 'depo_sorumlusu', 'genel_mudur_danismani');`
5. Should show 3 rows: muhasebeci (sonnet-4-6), depo_sorumlusu (haiku-4-5), genel_mudur_danismani (sonnet-4-6)

**Additionally, 3 Vercel env vars must be set before bots go live:**
- `TELEGRAM_BOT_TOKEN_MUHASEBECI` — from BotFather, create new bot for Muhasebeci
- `TELEGRAM_BOT_TOKEN_DEPO_SORUMLUSU` — from BotFather, create new bot for Depo Sorumlusu
- `TELEGRAM_BOT_TOKEN_GENEL_MUDUR` — from BotFather, create new bot for Genel Mudur Danismani

## Next Phase Readiness
- All code wiring is complete and deployed — Phase 11 code is fully done
- Pending only: SQL seed execution (Task 3 human-action) and bot token env var configuration
- Phase 12 can begin once bot tokens are set and SQL seed is executed
- After bot tokens are set, register webhooks for all 3 bots:
  `https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://bayi-yonetimi.vercel.app/api/telegram/{muhasebeci|depo-sorumlusu|genel-mudur}`

---
*Phase: 11-financial-operations-agents*
*Completed: 2026-03-02*
