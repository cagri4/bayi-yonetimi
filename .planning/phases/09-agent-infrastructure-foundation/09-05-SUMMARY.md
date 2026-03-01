---
phase: 09-agent-infrastructure-foundation
plan: 05
subsystem: api
tags: [telegram, grammy, anthropic-sdk, webhook, agent-dispatcher, next-js, after, idempotency, typescript]

# Dependency graph
requires:
  - phase: 09-01
    provides: processed_telegram_updates table (UNIQUE on update_id), createServiceClient() factory, TypeScript types for agent tables, dealers table with telegram_chat_id
  - phase: 09-02
    provides: TokenBudget class, ToolRegistry class, AgentContext/AgentRole types
  - phase: 09-03
    provides: AgentRunner class (Claude tool-use loop), ConversationManager class (rolling-50 history, auto-summarization)
  - phase: 09-04
    provides: AgentBridge class (deadlock detection, cross-agent calls, DB query helpers)
provides:
  - POST /api/telegram webhook endpoint with immediate 200 + after() background processing (AI-04)
  - Idempotency via processed_telegram_updates INSERT with 23505 error code detection (AI-05)
  - dispatchAgentUpdate() orchestrator that wires all agent infrastructure components
  - Telegram sendMessage helper scoped to TELEGRAM_BOT_TOKEN env var
  - Placeholder tool handlers (echo, get_current_time, lookup_dealer) wired in dispatcher
affects:
  - 10+ (Phase 10 agents will replace placeholder tool handlers with real implementations)
  - 10+ (Multi-bot routing: each bot will map to a specific role in Phase 10+)

# Tech tracking
tech-stack:
  added:
    - grammy@1.41.0 (grammY TypeScript-first Telegram framework — types only used, no Bot instance)
  patterns:
    - "Webhook adapter pattern: thin route file (parse/dedup/dispatch) with all logic in dispatcher"
    - "after() pattern: register background work before returning HTTP 200 — Vercel Fluid Compute up to 300s"
    - "Idempotency via INSERT + catch 23505: no SELECT-before-INSERT race condition"
    - "Fail-open idempotency: non-duplicate DB errors still return 200 to prevent Telegram retry storms"
    - "Dispatcher orchestration order: extract → resolve identity → determine role → check budget → load history → run agent → save + send"
    - "Turkish fallback messages at every failure point: unregistered chat, budget exceeded, unexpected error"

key-files:
  created:
    - src/app/api/telegram/route.ts
    - src/lib/agents/dispatcher.ts
  modified:
    - package.json (added grammy@1.41.0)

key-decisions:
  - "grammy used for types only (grammy/types Update) — no Bot instance created in webhook route"
  - "Idempotency INSERT happens synchronously before after() registration and before the return statement"
  - "Non-23505 DB errors on idempotency insert still return 200 — prevents Telegram retry storm on transient Supabase issues"
  - "Agent role resolved from agent_definitions (first active record for company); 'destek' is Phase 9 fallback"
  - "TELEGRAM_BOT_TOKEN from env vars — not hardcoded; sendTelegramMessage logs error if missing but does not throw"
  - "Tool handlers defined inline in dispatchAgentUpdate — co-located with the supabase client closure for lookup_dealer scoping"

patterns-established:
  - "Webhook route is a pure adapter: parse → dedup → schedule → 200. No business logic."
  - "Dispatcher tries to notify user on every failure via sendTelegramMessage (wrapped in its own try/catch)"
  - "Service role client shared via createServiceClient() singleton — not re-created per request in dispatcher"

requirements-completed: [AI-04, AI-05]

# Metrics
duration: 5min
completed: 2026-03-01
---

# Phase 9 Plan 05: Telegram Webhook and Agent Dispatcher Summary

**Telegram webhook at POST /api/telegram returns 200 immediately via grammy Update types, idempotency via processed_telegram_updates UNIQUE constraint, and full agent pipeline (ConversationManager + TokenBudget + AgentRunner) dispatched via Next.js after()**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-01T16:57:31Z
- **Completed:** 2026-03-01T17:02:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `src/app/api/telegram/route.ts` — thin webhook adapter with `dynamic = 'force-dynamic'`, parses Update body typed via grammy/types, synchronous idempotency INSERT with 23505 duplicate detection, returns 200 immediately, dispatches agent via after()
- Created `src/lib/agents/dispatcher.ts` — `dispatchAgentUpdate()` resolves dealer via `telegram_chat_id`, queries `agent_definitions` for role/system_prompt, checks `TokenBudget`, loads conversation via `ConversationManager`, runs `AgentRunner` with placeholder tool handlers, saves reply and sends via Telegram sendMessage API
- Installed `grammy@1.41.0` — used for TypeScript types only (no Bot instance), plus `@anthropic-ai/sdk` was already present at `^0.78.0`
- Build passes cleanly: `/api/telegram` appears as a dynamic route in build output; `npx tsc --noEmit` produces zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create Telegram webhook route** - `d2f6011` (feat)
2. **Task 2: Create agent dispatcher** - `8d68338` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/api/telegram/route.ts` — Telegram webhook endpoint (57 lines): parse Update, idempotency check, after() dispatch, immediate 200 return
- `src/lib/agents/dispatcher.ts` — Agent dispatch orchestrator (259 lines): dealer identity resolution, role determination, budget check, conversation management, AgentRunner invocation, Telegram reply
- `package.json` — Added grammy@1.41.0 dependency

## Decisions Made

- grammy is used for TypeScript types only (`grammy/types Update`) — the webhook parses the body manually via `request.json()`. No `Bot` instance is needed because we control the webhook URL registration separately.
- The idempotency INSERT runs synchronously (before `after()` is called and before `return`) to ensure the dedup record is committed before any background processing can create side effects.
- Non-23505 idempotency errors (transient Supabase failures) return 200 rather than 500 — this prevents Telegram from retrying and creating duplicate processing attempts. Errors are logged for observability.
- Agent role is resolved from `agent_definitions` (first active record for the company). In Phase 9 there is one bot per company; in Phase 10+ each bot token will map to a specific role.
- Tool handlers (`echo`, `get_current_time`, `lookup_dealer`) are defined inline inside `dispatchAgentUpdate` — this allows `lookup_dealer` to close over the `supabase` client without needing to pass it via AgentContext.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled cleanly on first attempt. Build passed without errors. Both packages installed without conflicts.

## User Setup Required

**Environment variable needed before the webhook receives real Telegram traffic:**

- `TELEGRAM_BOT_TOKEN` — the bot token from @BotFather. Add to `.env.local` for local dev and to Vercel environment variables for production.
- After adding the token, register the webhook URL with Telegram:
  ```
  curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://bayi-yonetimi.vercel.app/api/telegram"
  ```
- `ANTHROPIC_API_KEY` — already required from Phase 9 Plan 02 (AgentRunner uses it)

Note: Without TELEGRAM_BOT_TOKEN, `sendTelegramMessage` logs an error but does not throw. The webhook itself will accept messages and run the agent, but replies will not be sent.

## Next Phase Readiness

- Phase 9 infrastructure is complete: service client, types, token budget, tool registry, agent runner, conversation manager, agent bridge, webhook route, and dispatcher are all built and wired
- Phase 10 will replace placeholder tool handlers with real implementations per agent role
- Phase 10 will wire `AgentBridge.callAgent()` placeholder with actual `AgentRunner` invocations using extended callStack
- Multi-bot routing (each bot token mapping to a specific agent role) deferred to Phase 10+
- `TELEGRAM_BOT_TOKEN` environment variable must be set before real webhook traffic flows

## Self-Check: PASSED
- `src/app/api/telegram/route.ts` — FOUND
- `src/lib/agents/dispatcher.ts` — FOUND
- Commit `d2f6011` — FOUND
- Commit `8d68338` — FOUND

---
*Phase: 09-agent-infrastructure-foundation*
*Completed: 2026-03-01*
