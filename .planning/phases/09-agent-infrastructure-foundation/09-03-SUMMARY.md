---
phase: 09-agent-infrastructure-foundation
plan: 03
subsystem: agents
tags: [anthropic-sdk, agent-runner, conversation-manager, tool-use-loop, prompt-caching, supabase, typescript]

# Dependency graph
requires:
  - phase: 09-01
    provides: agent_conversations table, agent_messages table, createServiceClient() factory, TypeScript types for all agent tables
  - phase: 09-02
    provides: AgentContext, TokenUsageRecord, MAX_ITERATIONS, TokenBudget, applyPromptCaching, Tool types
provides:
  - AgentRunner class: Claude tool-use loop with MAX_ITERATIONS guard, prompt caching (AI-10), token budget recording
  - ConversationManager class: DB-backed history (rolling 50), getOrCreateConversation, saveMessage, Haiku-based auto-summarization
affects:
  - 09-04 (AgentBridge.callAgent() will invoke AgentRunner)
  - 09-05 (Telegram webhook handler uses ConversationManager + AgentRunner)
  - 10+ (All phase 10 agents use AgentRunner + ConversationManager as core execution primitives)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tool-use loop: while(iterations < MAX_ITERATIONS) with stop_reason branching (end_turn/tool_use/break)"
    - "System prompt caching: pass system as content block array with cache_control:ephemeral (NOT a plain string)"
    - "Tool error isolation: individual handler try/catch returns error as tool_result content; API errors propagate to caller"
    - "Summarization as non-blocking side-effect: try/catch in summarizeAndTruncate; failure logged but does NOT stop conversation"
    - "Summary role='system' in DB but NOT passed to Claude messages array — injected separately into system prompt by dispatcher"

key-files:
  created:
    - src/lib/agents/agent-runner.ts
    - src/lib/agents/conversation-manager.ts

key-decisions:
  - "AgentRunner receives toolHandlers as Map<string, handler> — handlers get both input AND AgentContext for company_id scoping"
  - "System prompt uses array format [{ type:'text', text:..., cache_control:{ type:'ephemeral' } }] not plain string (required for caching)"
  - "ConversationManager.summarizeAndTruncate is private; triggered automatically by saveMessage when count > SUMMARIZE_THRESHOLD"
  - "Summary system message created_at is set to earliest deleted message timestamp to preserve chronological ordering"
  - "metadata cast to Json via type assertion — Record<string,unknown> is structurally compatible but TypeScript requires explicit cast"

patterns-established:
  - "AgentRunner: pass workingMessages by value (shallow clone at start) — never mutate caller's array"
  - "Token recording: always record AFTER the API call, even if loop continues for more iterations"
  - "Haiku 4.5 for summarization regardless of agent role's assigned model — cost optimization"
  - "getOrCreateConversation is idempotent — safe to call on every incoming message without creating duplicates"

requirements-completed: [AI-01, AI-03, AI-10]

# Metrics
duration: 4min
completed: 2026-03-01
---

# Phase 9 Plan 03: AgentRunner and ConversationManager Summary

**AgentRunner drives the Claude tool-use loop (10 iterations, AI-10 prompt caching, token budget recording) and ConversationManager provides rolling-50 DB-backed history with automatic Haiku 4.5 summarization in Turkish**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-01T16:49:25Z
- **Completed:** 2026-03-01T16:53:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- AgentRunner class implementing the full Claude tool-use loop: system prompt with ephemeral cache_control, tool definitions with applyPromptCaching, per-iteration token budget recording, isolated tool handler dispatch with try/catch, Turkish fallback on iteration cap
- ConversationManager class with getOrCreateConversation (idempotent), getMessages (rolling 50, system role excluded), saveMessage (with auto-summarization trigger), and private summarizeAndTruncate (Haiku 4.5, Turkish, deletes old messages and inserts summary marker)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AgentRunner class** - `08fb296` (feat)
2. **Task 2: Create ConversationManager class** - `fb95bd8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/agents/agent-runner.ts` - AgentRunner class: Claude tool-use loop with MAX_ITERATIONS, prompt caching on system + tools, token recording, tool dispatch
- `src/lib/agents/conversation-manager.ts` - ConversationManager class: DB-backed conversation history, rolling window, Haiku-based auto-summarization

## Decisions Made

- AgentRunner's tool handlers receive `AgentContext` as a second argument (alongside `input`) so every handler can enforce `company_id` scoping without needing it in closure — pattern established for all Phase 10+ tool implementations
- System prompt uses the block array format `[{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]` rather than a plain string — required for Anthropic's prompt caching feature to activate
- `metadata` parameter in `saveMessage` is cast to Supabase's `Json` type via type assertion — `Record<string, unknown>` is structurally compatible at runtime but TypeScript requires the explicit cast since `Json` is a recursive type
- Summary system messages use `role='system'` in the DB but are excluded from `getMessages()` — the dispatcher is responsible for injecting them into the system prompt or prepended context, not the messages array

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed metadata type mismatch for agent_messages insert**
- **Found during:** Task 2 (Create ConversationManager class) — TypeScript compilation
- **Issue:** `metadata?: Record<string, unknown>` is not assignable to Supabase's `Json` type (recursive `{ [key: string]: Json | undefined }`) — compiler error TS2769
- **Fix:** Imported `Json` from `@/types/database.types` and cast metadata as `(metadata ?? {}) as Json`
- **Files modified:** `src/lib/agents/conversation-manager.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** `fb95bd8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 type correctness)
**Impact on plan:** Required for TypeScript compilation. No scope creep — single-line cast.

## Issues Encountered

Pre-existing `src/lib/agents/agent-bridge.ts` (untracked, from Plan 09-04 pre-execution) has a TypeScript error: `SelectQueryError<"column 'status' does not exist on 'orders'.">` on line 243. This is out of scope for Plan 09-03. Logged to deferred-items tracking. Compilation check for this plan excludes agent-bridge.ts since it was not created or modified here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AgentRunner` and `ConversationManager` are the core runtime primitives — all agent implementations from Phase 10 onward use these classes
- `AgentRunner` is ready to be wired with real tool handler Maps in Phase 10
- `ConversationManager` is ready for Telegram webhook handler (Plan 09-05) to call `getOrCreateConversation` + `getMessages` + `saveMessage`
- Blocking: `agent-bridge.ts` pre-existing type error must be resolved before Plan 09-04 work is committed

---
*Phase: 09-agent-infrastructure-foundation*
*Completed: 2026-03-01*
