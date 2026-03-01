---
phase: 09-agent-infrastructure-foundation
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, typescript, agent, telegram]

# Dependency graph
requires:
  - phase: 08-multi-tenant-database-migration
    provides: companies table, current_company_id(), is_company_admin(), is_superadmin() functions, RLS pattern
provides:
  - 6 agent infrastructure tables with RLS (agent_definitions, agent_conversations, agent_messages, agent_calls, processed_telegram_updates, daily_token_usage)
  - increment_daily_token_usage RPC for atomic token budget upsert
  - dealers.telegram_chat_id column for webhook identity resolution
  - createServiceClient() factory (service role, bypasses RLS)
  - TypeScript types for all 6 agent tables and RPC function
affects:
  - 09-02 (AgentRunner/ConversationManager use these tables via service client)
  - 09-03 (ToolRegistry uses agent_definitions)
  - 09-04 (TokenBudget uses daily_token_usage + increment_daily_token_usage RPC)
  - 09-05 (Telegram webhook uses processed_telegram_updates idempotency + dealers.telegram_chat_id)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service role client singleton: module-level cached SupabaseClient<Database> with persistSession: false"
    - "Agent table RLS: service role full access; company admins limited to agent_definitions + agent_calls SELECT"
    - "Token budget: composite PK (dealer_id, date) with atomic UPSERT via SQL LANGUAGE function"
    - "Telegram idempotency: processed_telegram_updates with BIGINT PRIMARY KEY on Telegram's update_id"

key-files:
  created:
    - supabase/migrations/010_agent_tables.sql
    - src/lib/supabase/service-client.ts
  modified:
    - src/types/database.types.ts

key-decisions:
  - "Service role client: module-level singleton pattern (not per-request) for agent serverless reuse"
  - "agent_conversations/messages/daily_token_usage: service role only RLS (no user-facing queries — agent layer owns these)"
  - "agent_definitions: company admins CAN manage via authenticated session (UI config); agent_calls: company admins can SELECT for audit"
  - "increment_daily_token_usage uses LANGUAGE sql (not plpgsql) — simpler, no variable overhead for atomic upsert"
  - "processed_telegram_updates uses Telegram's own update_id as PRIMARY KEY (not gen_random_uuid()) — natural idempotency key"

patterns-established:
  - "All agent layer DB access goes through createServiceClient() — never the anon/session client"
  - "New table types follow Row/Insert/Update with Relationships: [] pattern from database.types.ts"
  - "Insert types: company_id required for agent tables (unlike pre-Phase-8 tables which had company_id optional)"

requirements-completed: [AI-09, AI-11]

# Metrics
duration: 3min
completed: 2026-03-01
---

# Phase 9 Plan 01: Agent Infrastructure Foundation Summary

**SQL migration with 6 agent tables (RLS + 5 indexes + 1 RPC), service role singleton client, and full TypeScript types for the agent database layer**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-01T16:37:11Z
- **Completed:** 2026-03-01T16:40:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `010_agent_tables.sql` migration with 6 tables, 6 RLS enables, company-scoped policies, 5 performance indexes, and `increment_daily_token_usage` atomic upsert RPC
- Created `createServiceClient()` singleton factory with service role key and no session persistence for all agent layer DB access
- Updated `database.types.ts` with Row/Insert/Update types for all 6 agent tables, the RPC function, dealers.telegram_chat_id, and Phase 9 convenience type aliases

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent infrastructure database migration** - `6de23a1` (feat)
2. **Task 2: Create service role client and update TypeScript types** - `4970aba` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/010_agent_tables.sql` - 6 agent tables with RLS, indexes, policies, increment_daily_token_usage RPC, dealers.telegram_chat_id ALTER
- `src/lib/supabase/service-client.ts` - createServiceClient() singleton factory using SUPABASE_SERVICE_ROLE_KEY
- `src/types/database.types.ts` - Added 6 agent table types, increment_daily_token_usage RPC type, dealers.telegram_chat_id field, Phase 9 type aliases

## Decisions Made
- Service role client uses module-level singleton (`let _serviceClient`) for reuse across agent calls within a single serverless instance
- agent_conversations, agent_messages, processed_telegram_updates, daily_token_usage have NO user-facing RLS policies — service role access only (agents run via service role, not user sessions)
- agent_definitions gives company admins management access (needed for UI config screens in later phases)
- agent_calls gives company admins SELECT access for audit log viewing
- increment_daily_token_usage uses LANGUAGE sql for simplicity — pure atomic INSERT ON CONFLICT DO UPDATE with no variable overhead
- processed_telegram_updates uses Telegram's own BIGINT update_id as PRIMARY KEY (natural idempotency key — no UUID needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

External services require manual configuration before Phase 9 can be fully operational:

**Environment variables to add to Vercel and local .env.local:**
- `ANTHROPIC_API_KEY` — Claude API key from Anthropic Console > API Keys > Create key (needed for Plans 09-02 through 09-05)
- `TELEGRAM_BOT_TOKEN` — From Telegram BotFather > /newbot > copy token (needed for Plan 09-05)

**Database:** The `010_agent_tables.sql` migration must be executed in the Supabase Dashboard SQL Editor (paste each BLOCK separately in order 1 → 9) before any agent code can run.

## Next Phase Readiness
- All 6 agent tables defined and typed — AgentRunner, ConversationManager, TokenBudget, AgentBridge can now be built
- createServiceClient() available for import at src/lib/supabase/service-client.ts
- Plan 09-02 can proceed immediately (depends on these tables and the service client)
- Blocking: migration SQL must be applied in Dashboard before any runtime agent calls succeed

---
*Phase: 09-agent-infrastructure-foundation*
*Completed: 2026-03-01*
