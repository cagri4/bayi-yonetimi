---
phase: 12-extended-agent-ecosystem
plan: 05
subsystem: api
tags: [agents, anthropic, typescript, dispatcher, agent-bridge, handler-factory]

# Dependency graph
requires:
  - phase: 12-02
    provides: "5 tool files (egitimci, satis, muhasebeci, depo-sorumlusu, genel-mudur) with handler factory pattern"
  - phase: 12-03
    provides: "4 tool files (tahsilat-uzmani, dagitim-koordinatoru, saha-satis, pazarlamaci)"
  - phase: 12-04
    provides: "3 tool files (urun-yoneticisi, satin-alma, iade-kalite) and tool-registry wiring"
provides:
  - "handler-factory.ts: shared buildHandlersForRole() mapping all 12 roles to real handlers"
  - "TOOL_REGISTRY: all 12 active roles mapped to real tool arrays (no more placeholderTools for any new role)"
  - "dispatcher.ts: single-line buildHandlersForRole() replaces 40-line else-if chain"
  - "agent-bridge.ts: real AgentRunner invocation for cross-agent handoffs with deadlock protection"
affects:
  - phase 12-06
  - phase 12-07
  - all future agent infrastructure changes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "handler-factory pattern: single function centralizes all role-to-handler mapping, shared by both dispatcher and agent-bridge"
    - "sub-agent context: telegramChatId: 0 prevents double Telegram messages in cross-agent calls"
    - "AgentRunner as sub-agent runner: same class reused with synthetic single-message history"

key-files:
  created:
    - "src/lib/agents/handler-factory.ts"
  modified:
    - "src/lib/agents/tool-registry.ts"
    - "src/lib/agents/dispatcher.ts"
    - "src/lib/agents/agent-bridge.ts"

key-decisions:
  - "handler-factory.ts introduced as single source of truth for role-to-handler mapping — both dispatcher and agent-bridge import it, eliminating duplication risk"
  - "Sub-agent synthetic messages: MessageParam[] = [{ role: 'user', content: query }] — single-turn invocation, no conversation history passed to sub-agent"
  - "AgentRunner reused as sub-agent runner — same infrastructure, same tool-use loop, just with extended callStack and depth+1"
  - "callAgent() catch block returns { success: false, error } on AgentRunner throw — outer caller gets structured error, never a thrown exception"
  - "TOOL_REGISTRY: destek role keeps placeholderTools — intentional (no dedicated destek bot in current deployment)"

patterns-established:
  - "buildHandlersForRole(role, supabase): standard factory function signature for role-to-handler dispatch"
  - "Sub-agent pattern: fetch agent_definitions → build targetContext (telegramChatId: 0) → buildHandlersForRole → new AgentRunner → runner.run()"

requirements-completed: [AO-02]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 12 Plan 05: Wire Handler Factory and Real AgentBridge Summary

**handler-factory.ts unifies all 12 role mappings into a shared factory; AgentBridge.callAgent() now runs real AgentRunner loops for cross-agent handoffs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T09:46:48Z
- **Completed:** 2026-03-04T09:50:45Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created handler-factory.ts exporting `buildHandlersForRole()` covering all 12 roles plus destek fallback
- Updated TOOL_REGISTRY to replace placeholder entries for tahsilat_uzmani, dagitim_koordinatoru, saha_satis, pazarlamaci with real tool arrays — all 12 active roles now wired to real tools
- Refactored dispatcher.ts: 5 individual handler imports + 40-line else-if chain removed, replaced with single `buildHandlersForRole(role, supabase)` call
- Implemented real `AgentBridge.callAgent()`: fetches agent_definitions, builds targetContext with `telegramChatId: 0`, runs AgentRunner with extended callStack and depth+1
- Full codebase compiles with zero TypeScript errors (`npx tsc --noEmit` clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create handler-factory.ts and update tool-registry.ts** - `f75bb89` (feat)
2. **Task 2: Refactor dispatcher.ts and implement real AgentBridge.callAgent()** - `56c75db` (feat)

**Plan metadata:** committed with this SUMMARY

## Files Created/Modified
- `src/lib/agents/handler-factory.ts` - New shared factory: buildHandlersForRole(role, supabase) maps all 12 roles to real handler Maps
- `src/lib/agents/tool-registry.ts` - Added 4 new imports (tahsilat, dagitim, saha-satis, pazarlamaci); TOOL_REGISTRY all 13 entries populated
- `src/lib/agents/dispatcher.ts` - Removed 5 individual handler imports; Step 5 reduced from 40 lines to single buildHandlersForRole call
- `src/lib/agents/agent-bridge.ts` - Added 5 imports; callAgent() replaces Phase 9 placeholder with real AgentRunner invocation

## Decisions Made
- handler-factory.ts introduced as shared source of truth — both dispatcher and agent-bridge import the same function, eliminating divergence risk as more roles are added
- Sub-agent synthetic messages use `[{ role: 'user', content: query }]` — single-turn invocation, no conversation history passed (sub-agents are stateless within a cross-agent call)
- `telegramChatId: 0` in targetContext is a critical guard: prevents sub-agent from attempting to send Telegram messages (only the top-level dispatcher should respond to the user)
- callAgent() catch block returns `{ success: false, error }` — structured error, never throws, consistent with existing logAgentCall/checkDeadlock error handling pattern

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None — TypeScript compiled cleanly on first attempt for both tasks.

## User Setup Required
None — no external service configuration required. All changes are compile-time wiring.

## Next Phase Readiness
- All 12 agent roles are now fully wired end-to-end: tools in TOOL_REGISTRY, handlers via buildHandlersForRole, cross-agent calls via real AgentRunner
- Phase 12 Plan 06 (webhook routes for 7 new bots) can proceed immediately
- The handler-factory pattern is extensible: adding a 13th role requires one if-branch in handler-factory.ts and one line in TOOL_REGISTRY

## Self-Check: PASSED

All created files exist. All task commits verified in git log.

| Check | Result |
|-------|--------|
| src/lib/agents/handler-factory.ts | FOUND |
| src/lib/agents/tool-registry.ts | FOUND |
| src/lib/agents/dispatcher.ts | FOUND |
| src/lib/agents/agent-bridge.ts | FOUND |
| Commit f75bb89 (Task 1) | FOUND |
| Commit 56c75db (Task 2) | FOUND |
