---
phase: 09-agent-infrastructure-foundation
plan: 02
subsystem: agents
tags: [anthropic-sdk, agent-roles, token-budget, tool-registry, prompt-caching, typescript]

# Dependency graph
requires:
  - phase: 09-01
    provides: service-client singleton, agent DB tables (daily_token_usage, agent_conversations etc.), database.types.ts
provides:
  - AgentRole union type with 12 Turkish-English kebab-case roles
  - AGENT_MODELS mapping (4 Sonnet 4.6, 8 Haiku 4.5)
  - AgentContext interface with callStack/depth for deadlock detection
  - TokenUsageRecord interface and budget constants (50K soft / 100K hard)
  - ToolRegistry class with getTools/getModel/getToolsWithCaching
  - applyPromptCaching helper for tool definition caching (AI-10)
  - TokenBudget class with checkBudget/recordUsage/getUsage methods
  - 3 placeholder tool definitions for Phase 9 validation
affects: [09-03, 09-04, 10-first-agents, 11-financial-ops-agents]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk ^0.78.0"]
  patterns:
    - "Stateless registry class: ToolRegistry methods are pure lookups against constant maps"
    - "Service client field initialization: `private readonly supabase = createServiceClient()` — module-level singleton reuse"
    - "Prompt caching on last tool: applyPromptCaching() appends cache_control:ephemeral to last item in tool array"
    - "Fail-open on DB errors in checkBudget — avoids blocking dealers on transient errors"
    - "Turkish error messages for hard token limit — all agent responses to dealers in Turkish per convention"

key-files:
  created:
    - src/lib/agents/types.ts
    - src/lib/agents/tool-registry.ts
    - src/lib/agents/tools/index.ts
    - src/lib/agents/token-budget.ts
  modified:
    - package.json (added @anthropic-ai/sdk ^0.78.0)
    - package-lock.json

key-decisions:
  - "applyPromptCaching marks last tool in array with cache_control:ephemeral — consistent with Anthropic caching docs: last breakpoint gets cached content"
  - "TokenBudget fails open on DB errors — returning allowed:true prevents blocking dealers on transient Supabase issues"
  - "ToolRegistry exposes getToolsWithCaching convenience method — AgentRunner should use this instead of calling applyPromptCaching manually"
  - "@anthropic-ai/sdk installed at ^0.78.0 per v3.0 architecture decision (raw SDK, not Vercel AI SDK)"

patterns-established:
  - "Agent role taxonomy: Turkish-English kebab-case (e.g. 'egitimci', 'satis_temsilcisi') — use exactly these strings in DB and API"
  - "Model tiering: 4 Sonnet (Trainer/Accountant/Marketing/Executive), 8 Haiku (operational roles)"
  - "Token tracking: always sum all four fields (input+output+cache_read+cache_write) for total cost"

requirements-completed: [AI-02, AI-07, AI-10]

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 9 Plan 02: Agent Type System, Tool Registry, and Token Budget Summary

**AgentRole taxonomy (12 roles), ToolRegistry with prompt-caching helper, and TokenBudget with 50K/100K daily limits using atomic RPC increment**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T16:43:32Z
- **Completed:** 2026-03-01T16:45:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- AgentRole union type with all 12 business domain roles, AGENT_MODELS mapping (4 Sonnet 4.6 complex roles, 8 Haiku 4.5 operational roles), and full set of runtime interfaces (AgentContext, TokenUsageRecord)
- ToolRegistry stateless class with getTools/getModel/getToolsWithCaching methods and applyPromptCaching helper that applies ephemeral cache_control to the last tool definition (AI-10 compliance)
- TokenBudget class with atomic RPC-based usage increment, Turkish hard-limit error message, soft-limit console warning, and fail-open behavior on DB errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent types and tool registry** - `91a593c` (feat)
2. **Task 2: Create token budget tracker** - `3a300cf` (feat)

**Plan metadata:** committed with docs commit below

## Files Created/Modified

- `src/lib/agents/types.ts` - AgentRole (12 roles), AGENT_MODELS, AgentContext, TokenUsageRecord, and all numeric constants
- `src/lib/agents/tool-registry.ts` - ToolRegistry class, TOOL_REGISTRY map, applyPromptCaching helper, toolRegistry singleton
- `src/lib/agents/tools/index.ts` - 3 placeholder tools (echo, get_current_time, lookup_dealer) + placeholderTools array
- `src/lib/agents/token-budget.ts` - TokenBudget class with checkBudget/recordUsage/getUsage, atomic RPC increment
- `package.json` - Added @anthropic-ai/sdk ^0.78.0
- `package-lock.json` - Updated lock file

## Decisions Made

- `applyPromptCaching` marks only the last tool in the array with `cache_control: { type: 'ephemeral' }`. Per Anthropic's caching docs, the last breakpoint is where cached content ends — marking earlier tools would cause more cache misses.
- `TokenBudget` uses `private readonly supabase = createServiceClient()` field initializer instead of constructor assignment — creates the service client once at class instantiation, leveraging the module-level singleton in service-client.ts.
- `TokenBudget.checkBudget()` fails open on DB errors (returns `allowed: true`) to avoid blocking dealers when Supabase is temporarily unavailable.
- Installed `@anthropic-ai/sdk ^0.78.0` as blocking dependency (Rule 3) — the Tool type from the SDK is required for all tool definitions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @anthropic-ai/sdk dependency**
- **Found during:** Task 1 (Create agent types and tool registry)
- **Issue:** Plan referenced `import type { Tool } from '@anthropic-ai/sdk/resources/messages'` but the package was not in package.json
- **Fix:** Ran `npm install @anthropic-ai/sdk@^0.78.0` before creating tool files
- **Files modified:** package.json, package-lock.json
- **Verification:** TypeScript compiles cleanly after install; `npx tsc --noEmit` passes
- **Committed in:** `91a593c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency)
**Impact on plan:** Required for the plan to work at all — no scope creep.

## Issues Encountered

None - all files compiled cleanly after SDK installation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `AgentRunner` (Plan 09-03) can now import AgentRole, AgentContext, ToolRegistry, and TokenBudget
- `TOOL_REGISTRY` and `AGENT_MODELS` are fully populated for all 12 roles
- `applyPromptCaching` is ready for use in AgentRunner's Claude API request builder
- No blockers for Plan 09-03

## Self-Check: PASSED

All artifacts verified:
- FOUND: src/lib/agents/types.ts
- FOUND: src/lib/agents/tool-registry.ts
- FOUND: src/lib/agents/tools/index.ts
- FOUND: src/lib/agents/token-budget.ts
- FOUND: .planning/phases/09-agent-infrastructure-foundation/09-02-SUMMARY.md
- FOUND commit: 91a593c (Task 1)
- FOUND commit: 3a300cf (Task 2)

---
*Phase: 09-agent-infrastructure-foundation*
*Completed: 2026-03-01*
