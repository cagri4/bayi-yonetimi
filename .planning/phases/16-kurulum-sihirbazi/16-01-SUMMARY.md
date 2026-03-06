---
phase: 16-kurulum-sihirbazi
plan: 01
subsystem: api
tags: [telegram, fsm, wizard, onboarding, session, supabase]

# Dependency graph
requires:
  - phase: 15-company-creation-infrastructure
    provides: "onboarding_sessions + onboarding_invites tables, sendTelegramMessage utility, createServiceClient, provision_company RPC already called by superadmin"
  - phase: 14-v4-schema-foundation
    provides: "onboarding_sessions schema (step, collected_data, status, deep_link_token, telegram_chat_id)"
provides:
  - "AGENT_DESCRIPTIONS: 12 dijital calisanlar with Turkish role/name/description for wizard intro"
  - "WizardSession type + loadOrCreateSession + updateSession session management helpers"
  - "handleStep FSM dispatcher covering steps 0-6 + completed guard + runProvisioning"
affects: [16-02-PLAN.md, 16-dispatcher, sihirbaz-webhook-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-backed wizard FSM: switch(session.step) on onboarding_sessions.step integer"
    - "Resume-first lookup: session by deep_link_token checked BEFORE invite used_at validation"
    - "Fresh temp password at wizard completion via auth.admin.updateUserById (not stored password)"
    - "(supabase as any) cast for onboarding_sessions/companies/users tables — consistent with Phase 10-15 pattern"
    - "4096-char Telegram message split logic: introLines check at 3800-char threshold"

key-files:
  created:
    - src/lib/sihirbaz/agents.ts
    - src/lib/sihirbaz/session.ts
    - src/lib/sihirbaz/steps.ts
  modified: []

key-decisions:
  - "Resume check (session by deep_link_token) precedes invite used_at validation — prevents wrongly rejecting returning users whose invite is already used"
  - "Fresh temp password generated at wizard completion via auth.admin.updateUserById — original createCompany temp password is ephemeral and never stored (Pitfall 1 from research)"
  - "Agent intros sent as single message (or two if >3800 chars) — not 12 separate messages; satisfies 'sequential order' requirement without 12 API calls"
  - "Step 5 both saves beklentiler AND sends agent intros + confirmation prompt — step 6 is purely the evet/hayir handler; keeps FSM linear"
  - "company_id null guard in runProvisioning returns early with error message — defensive against misconfigured sessions"

patterns-established:
  - "WizardSession type mirrors onboarding_sessions row shape exactly for clean casting"
  - "updateSession helper accepts Partial<Pick<>> to enforce only patchable fields"
  - "All Telegram replies go through sendTelegramMessage from @/lib/telegram/send — no direct fetch calls in FSM"

requirements-completed: [KS-02, KS-03, KS-04, KS-07]

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 16 Plan 01: Kurulum Sihirbazi FSM Core Summary

**DB-backed 7-step Telegram wizard FSM with SHA-256 token validation, 5-step data collection, 12-agent introduction, evet/hayir confirmation, and fresh temp password provisioning at completion**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T12:47:18Z
- **Completed:** 2026-03-06T12:53:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `agents.ts`: 12 dijital calisanlar descriptions with Turkish names/descriptions matching all AgentRole enum values
- `session.ts`: `WizardSession` type, `loadOrCreateSession` (token validation + resume-first logic + session create), `updateSession` patch helper
- `steps.ts`: `handleStep` FSM covering the complete wizard: step 0 welcome, steps 1-4 data collection, step 5 agent intros + confirmation prompt, step 6 evet/hayir handler, step 7+ completed guard, `runProvisioning` private function with fresh temp password via `auth.admin.updateUserById`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent descriptions data file and session management module** - `fdf52b7` (feat)
2. **Task 2: Create step handler functions with provisioning completion** - `2a8fc57` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/sihirbaz/agents.ts` - 12 AGENT_DESCRIPTIONS with role/name/description for wizard step 5 intro
- `src/lib/sihirbaz/session.ts` - WizardSession type, loadOrCreateSession (SHA-256 token validation + resume), updateSession helper
- `src/lib/sihirbaz/steps.ts` - handleStep FSM dispatcher (steps 0-6 + default), runProvisioning private helper

## Decisions Made

- **Resume-first lookup:** `loadOrCreateSession` checks for an existing session by `deep_link_token` BEFORE querying `onboarding_invites`. This handles the "returning user re-clicks /start" scenario where the invite's `used_at` is already set but the session is still active.
- **Fresh temp password at completion:** `runProvisioning` generates a new 12-char temp password via `crypto.randomUUID().slice(0,12)` and resets the admin user's password with `auth.admin.updateUserById`. The original `createCompany` temp password is ephemeral (shown once in superadmin UI, never stored) — resetting here gives the wizard owner a clean credential at the moment they need it.
- **Single multi-message agent intro:** Agent introductions are sent as a single Telegram message (or two if >3800 chars). This satisfies KS-04's "sequential order" requirement without 12 separate API calls. Split threshold is 3800 chars (300-char safety margin below Telegram's 4096 limit).
- **Step 5 dual responsibility:** Step 5 both saves `beklentiler` to `collected_data` AND sends the 12-agent intro + confirmation prompt. Step 6 is purely the evet/hayir handler. This keeps the FSM linear (no intermediate "sent intros, waiting for ack" state).
- **`(supabase as any)` cast consistent:** onboarding_sessions, onboarding_invites, companies, users queries all use `(supabase as any)` — consistent with Phase 10-15 pattern where tables exist in DB but typed client may not expose them fully.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for these library files. Plan 02 will wire steps.ts into the sihirbaz webhook route.

## Next Phase Readiness

Plan 02 (dispatcher wiring) can proceed immediately:
- `agents.ts`, `session.ts`, `steps.ts` all compile without TypeScript errors
- All exports match the dispatcher interface described in Plan 02: `handleStep(supabase, session, chatId, text, botToken)`, `loadOrCreateSession`, `updateSession`
- The existing sihirbaz webhook route stub (`src/app/api/telegram/sihirbaz/route.ts`) is ready to import `dispatchSihirbazUpdate` from Plan 02's dispatcher module

---
*Phase: 16-kurulum-sihirbazi*
*Completed: 2026-03-06*
