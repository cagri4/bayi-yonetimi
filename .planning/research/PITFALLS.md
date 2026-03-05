# Pitfalls Research: v4.0 — Agent-Native SaaS Onboarding & Marketplace

**Domain:** Adding Conversational Onboarding, Per-Agent Billing, Agent Marketplace, Trial Periods, and Superadmin Panel to Existing Multi-Tenant Telegram-First B2B SaaS
**Researched:** 2026-03-05
**Confidence:** HIGH — based on official Anthropic/Supabase/iyzico docs, existing codebase analysis, and verified industry patterns

---

## Context

This research covers pitfalls specific to **adding v4.0 features on top of an already-running multi-tenant system** — not building from scratch. The existing infrastructure includes:

- **12 deployed AI agents** with AgentRunner/ToolRegistry/AgentBridge/ConversationManager
- **Multi-tenant DB** with company_id isolation and RLS on all tables
- **Dispatcher pattern** using `after()` for async Telegram processing
- **Deadlock guards** (MAX_AGENT_DEPTH=5, MAX_TOOL_CALLS=10, cycle detection)
- **Token budget** (SOFT: 50K/day, HARD: 100K/day per dealer)

The v4.0 additions are: a 13th agent (Kurulum Sihirbazi / Setup Wizard), superadmin panel, per-agent billing, agent marketplace (hire/fire), trial period management, and Turkish payment provider integration (iyzico/PayTR).

---

## Critical Pitfalls

### Pitfall 1: Onboarding Wizard Creates Partial DB Records — No Rollback

**What goes wrong:**
The Setup Wizard has a conversational multi-step flow: collects company name → creates `companies` row → collects admin email → creates `users` row → collects agent preferences → creates 12 `agent_definitions` rows → sends confirmation. If the user drops the Telegram conversation at step 3 (company created, no admin), the system has an orphan company record with no users, no RLS policies can ever protect it, and the next attempt creates a duplicate company or fails on a unique constraint.

This is compounded by the existing dispatcher: `getOrCreateConversation()` is idempotent, but the agent tools that write to `companies`, `users`, and `agent_definitions` are not. A second onboarding attempt for the same Telegram chat_id will either duplicate records or crash on UNIQUE violations.

**Why it happens:**
Conversational onboarding is an inherently non-atomic multi-step process. Developers add tool calls that write to the DB at each step, trusting the conversation will complete. The LLM context may be lost on cold start, the user may never return, or Vercel may cold-start and drop the `after()` async job.

**How to avoid:**
Use a staging-first pattern with explicit commit:

```typescript
// WRONG: wizard tools write directly to production tables
await supabase.from('companies').insert({ name: collectedName })

// RIGHT: wizard writes to an onboarding_sessions staging table
await supabase.from('onboarding_sessions').upsert({
  telegram_chat_id: chatId,
  status: 'in_progress',
  collected_data: { company_name: collectedName },
  step: 'company_name_collected',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
})

// Only when wizard says /tamamla or detects all required fields:
await commitOnboardingSession(sessionId)
// commitOnboardingSession runs as a Postgres transaction:
// BEGIN
//   INSERT INTO companies ...
//   INSERT INTO users ...
//   INSERT INTO agent_definitions (12 rows) ...
//   DELETE FROM onboarding_sessions WHERE id = sessionId
// COMMIT
```

The commit function runs as a single Postgres transaction — either all records are created or none are. Orphan cleanup: a pg_cron job runs daily to delete `onboarding_sessions` where `status = 'in_progress' AND expires_at < now()`.

**Warning signs:**
- Wizard agent tools INSERT into `companies` or `users` directly (not staging)
- No `onboarding_sessions` table in the schema
- No pg_cron or scheduled cleanup for abandoned sessions
- Superadmin panel shows companies with 0 users

**Phase to address:** Phase 1 of v4.0 (Kurulum Sihirbazi / Setup Wizard) — the staging table MUST be designed before the first tool definition is written.

---

### Pitfall 2: Telegram Deep Link Token — Replay Attacks and Link Sharing

**What goes wrong:**
Superadmin generates a Telegram onboarding link: `https://t.me/BayiBot?start=INVITE_TOKEN`. The link is shared in a company-wide WhatsApp group. 50 people click it. Each person goes through the wizard and creates a separate `companies` record (or crashes on UNIQUE constraint). Worse: an ex-employee with the link tries to start a second company using the same token after the first company was created.

Additionally, the Telegram `start` parameter is visible in the bot message received as `/start INVITE_TOKEN`. The token appears in plain text in the chat history — anyone who screenshots the Telegram conversation has the invite link.

**Why it happens:**
Developers generate a static token and embed it in the link. They assume only the intended recipient will click it. Telegram deep link parameters are not secret — they're passed as plain text in the `/start` message payload.

**How to avoid:**
1. **One-time tokens with expiry:** Generate a cryptographically random 256-bit hex token (64 chars, fits Telegram's 64-char limit). Store in `onboarding_invites` table with `used_at`, `used_by_telegram_chat_id`, and `expires_at` (48-hour window).
2. **Single-use enforcement:** When the wizard receives `/start TOKEN`, immediately mark `used_at = now()` in a Postgres transaction. If `used_at IS NOT NULL`, reject: "Bu davet linki zaten kullanilmistir."
3. **Rate-limit by telegram_chat_id:** Even before DB lookup, reject if the same `chat_id` has made more than 3 `/start` attempts in 10 minutes.
4. **Bind token to expected company context:** Store `company_name_hint` and `admin_email_hint` in the invite record. If the wizard-collected email doesn't match, warn superadmin (don't block — they may have a different email).

```sql
CREATE TABLE onboarding_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token           text UNIQUE NOT NULL,          -- 64-char hex, stored hashed
  token_hash      text UNIQUE NOT NULL,          -- SHA-256 of token for lookup
  company_hint    text,                          -- expected company name
  admin_email     text,                          -- expected admin email
  created_by      uuid REFERENCES auth.users(id), -- superadmin who generated
  expires_at      timestamptz NOT NULL,           -- 48h from creation
  used_at         timestamptz,                   -- NULL = unused
  used_by_chat_id bigint,
  CONSTRAINT single_use CHECK (used_at IS NULL OR used_by_chat_id IS NOT NULL)
);
```

**Warning signs:**
- `onboarding_invites` table has no `used_at` column
- Same token appears in multiple `onboarding_sessions` rows
- Superadmin panel doesn't show invite usage count or expiry status
- Token is generated with `Math.random()` instead of `crypto.randomBytes(32)`

**Phase to address:** Phase 1 of v4.0 (Superadmin Panel + Invite Generation) — security model designed before first invite is generated.

---

### Pitfall 3: Per-Agent Subscription State and Agent Active State Diverge

**What goes wrong:**
The agent marketplace lets admins toggle individual agents on/off. Billing tracks which agents are in the active subscription. These become two separate sources of truth that drift:

- Scenario A: Admin disables the Muhasebeci (Accountant) in the marketplace UI → `agent_definitions.is_active = false`. But the billing system still charges for it because subscription item was not updated. Company overpays.
- Scenario B: Payment fails → billing system sets all agents to `is_active = false` → admin re-enables Muhasebeci in marketplace UI → `is_active = true`. But payment is still failed. Agent responds to dealer messages despite unpaid subscription.
- Scenario C: Admin enables 3 new agents mid-month → billing system creates proration but calculation fails → agents are active but billing webhook never fires → company gets free agents indefinitely.

**Why it happens:**
The `agent_definitions.is_active` flag and the billing subscription line items are maintained by two different systems (the marketplace UI and the payment provider webhook). They're not in the same transaction boundary, so any failure between them creates a split-brain state.

**How to avoid:**
Treat billing subscription as the authoritative source of truth for which agents are active. The marketplace UI only updates the *desired* state, not the active state directly:

```typescript
// marketplace toggle → writes to desired_agents table, NOT agent_definitions
await supabase.from('subscription_desired_agents').upsert({
  company_id: companyId,
  agent_role: agentRole,
  desired: true, // admin wants this agent active
})

// billing webhook (on payment success/failure) → updates agent_definitions
// This is the SINGLE place that sets is_active
async function syncAgentStateFromBilling(companyId: string, activeAgentRoles: string[]) {
  await supabase
    .from('agent_definitions')
    .update({ is_active: false })
    .eq('company_id', companyId)

  if (activeAgentRoles.length > 0) {
    await supabase
      .from('agent_definitions')
      .update({ is_active: true })
      .eq('company_id', companyId)
      .in('role', activeAgentRoles)
  }
}
```

Add a reconciliation job (pg_cron, daily) that checks for mismatches between billing state and `is_active` and alerts superadmin via email.

**Warning signs:**
- `agent_definitions.is_active` is SET directly by the marketplace UI toggle
- No reconciliation table or job between desired-state and billing-state
- Billing webhook and marketplace toggle both call `UPDATE agent_definitions SET is_active`
- Companies with failed payments have active agents

**Phase to address:** Phase 2 of v4.0 (Billing + Agent Marketplace) — the data model for desired vs. active state must be designed before billing integration begins.

---

### Pitfall 4: Payment Failure Disables Agents Mid-Active-Conversation

**What goes wrong:**
A company's monthly payment fails at 14:32. The billing webhook fires at 14:33 and sets all 12 agents to `is_active = false`. At 14:31, a dealer had sent a message to the Satis Temsilcisi (Sales Rep) agent. The dispatcher's `after()` job picks up at 14:34, queries `agent_definitions` where `is_active = true`, gets 0 results, and sends: "Bot is not configured." The dealer gets a confusing error in the middle of placing an order. The order is lost.

The reverse is also dangerous: if the system disables agents too slowly after payment failure, a company with chronic payment issues gets weeks of free agent access.

**Why it happens:**
There's no grace period model. The dispatcher checks `is_active` at the moment it runs, which may be after the billing webhook has already fired.

**How to avoid:**
Implement a two-tier grace period:
1. **Soft failure (3 days):** On first payment failure, send email to admin but DO NOT disable agents. Continue charging for grace period. Add a banner in the web admin panel: "Odeme basarisiz — X gune kadar guncelleyiniz."
2. **Hard failure (after 3-day grace):** If payment is still failed and no update, disable agents. But do it gracefully: check `agent_conversations` for active conversations (last message < 5 minutes ago). Mark those conversations as `status = 'billing_paused'` and send the dealer a message: "Hesap askiya alindi. Lutfen admin panelinizi kontrol ediniz." Do not drop the conversation silently.
3. **Re-enable on payment success:** When webhook fires for payment success, re-enable agents based on the subscription's active items list.

```typescript
// dispatcher check — include grace period
const { data: company } = await supabase
  .from('companies')
  .select('subscription_status, grace_period_ends_at')
  .eq('id', companyId)
  .single()

const isInGracePeriod = company.grace_period_ends_at > new Date()
if (company.subscription_status === 'past_due' && !isInGracePeriod) {
  await sendTelegramMessage(chatId, 'Hesabiniz askiya alindi. Lutfen admin panelinizi kontrol ediniz.', token)
  return
}
// proceed with agent dispatch
```

**Warning signs:**
- No `grace_period_ends_at` or equivalent column on companies table
- Billing webhook immediately sets `is_active = false` on all agents without checking active conversations
- Dispatcher has no subscription status check — relies entirely on `agent_definitions.is_active`
- Dealers receive silent failures when subscription lapses

**Phase to address:** Phase 2 of v4.0 (Billing Integration) — grace period model must be specified before iyzico/PayTR webhook handler is written.

---

### Pitfall 5: Trial Period Expires During Active Conversation — Abrupt Cutoff

**What goes wrong:**
Trial period is 14 days. A dealer is in the middle of a 20-message conversation with the Muhasebeci at 23:59 on day 14. At 00:00 day 15, a pg_cron job sets `trial_expires_at < now()` → `subscription_status = 'trial_expired'`. The dispatcher checks subscription status at the start of each `after()` call. The dealer's next message (00:01) hits the dispatcher, which checks status, finds `trial_expired`, and sends: "Deneme sureniz doldu." Mid-conversation, abruptly.

The dealer was in the middle of discussing a 50,000 TL outstanding invoice. They now have no context on the last response and no easy path to convert.

**Why it happens:**
Trial expiry is checked at message-dispatch time, not conversation-start time. The check is binary — expired = blocked. There's no warning period and no conversion flow embedded in the block message.

**How to avoid:**
1. **Warning before expiry:** At T-3 days, T-1 day, and T-0 (day of expiry), send proactive Telegram messages to company admin AND to active dealer conversations: "Deneme sureniz 3 gun icinde dolmaktadir. Devam etmek icin plani secin: [link]"
2. **Soft cutoff, not hard block:** When trial expires, don't immediately block. Allow the current conversation turn to complete. Set a `trial_soft_expired` flag that adds a notice to agent replies: "Not: Deneme sureniz dolmustur. Bu mesajdan sonra bot hizmeti duracaktir." Then block on the NEXT message.
3. **Convert inline:** Block message should include the conversion link: "Deneme sureniz doldu. Devam etmek icin: https://bayi-yonetimi.vercel.app/upgrade"
4. **Respect active conversations:** Never expire a session mid-tool-call. Only apply expiry check at the start of `dispatchAgentUpdate()`, not mid-execution.

```typescript
// Check expiry at start of dispatch — not mid-execution
const trialStatus = await checkTrialStatus(companyId)
if (trialStatus.expired && !trialStatus.graceMessageSent) {
  await sendTelegramMessage(chatId,
    `Deneme sureniz dolmustur. Ajanlar devre disi birakildi.\n\nDevam etmek icin: ${UPGRADE_URL}`,
    token
  )
  await markGraceMessageSent(companyId)
  return // stop here, do not run agent
}
```

**Warning signs:**
- No proactive warning messages before trial expiry
- Trial check happens inside the agent tool loop, not at dispatcher entry
- Block message has no conversion link or next step
- pg_cron trial expiry job runs at midnight without any grace messaging

**Phase to address:** Phase 3 of v4.0 (Trial Period Management) — warning cadence and graceful cutoff must be designed before trial feature is shipped.

---

### Pitfall 6: Wizard Delegates to Other Bots — Context Handoff Failure

**What goes wrong:**
The Kurulum Sihirbazi (Setup Wizard) is the 13th agent. Its job is to introduce each of the 12 operational agents and let the dealer "meet" each bot during setup. The wizard uses AgentBridge.callAgent() to hand off to, say, the Satis Temsilcisi: "Satin alma temsilcinizle tanistirayim: [delegates]."

Three failure modes:
1. **Context loss:** The sub-agent (Satis Temsilcisi) starts a fresh conversation with no context that it's in "introduction mode" during onboarding. It starts asking about orders. The dealer is confused — they don't have any orders yet, they're setting up.
2. **Conversation pollution:** AgentBridge.callAgent() creates a sub-agent with `telegramChatId: 0` to prevent double messages. But the sub-agent still writes to `agent_conversations` and `agent_messages` for the onboarding session. Now the dealer's Satis Temsilcisi has fake "introduction mode" messages in their real conversation history.
3. **Handoff order state:** The wizard tracks which agents have been introduced. This state is stored in the wizard's `agent_conversations` session. If the user drops out of Telegram and returns, the wizard must resume from the correct step. But the `agent_conversations` table only stores message history, not structured wizard state (which agents have been introduced, which data has been collected).

**Why it happens:**
The AgentBridge.callAgent() was designed for operational cross-agent calls (e.g., Distribution asking Warehouse about stock). It was not designed for "introduction mode" wizard delegation where the sub-agent needs special behavioral context and must not contaminate real conversation history.

**How to avoid:**
1. **Wizard-specific sub-agent mode:** Pass an `onboarding_mode: true` flag in the query to sub-agents during wizard delegation. Each agent's system prompt should check for this and respond in introduction mode: "Merhaba! Ben Satis Temsilcisi, satis siparislerinizi takip ederim..."
2. **Isolated onboarding conversations:** Wizard sub-agent calls during onboarding should write to a separate `onboarding_agent_introductions` table, not to the real `agent_conversations`. Real conversations should only be created AFTER onboarding commits.
3. **Structured wizard state in onboarding_sessions:** Store wizard progress as JSON, not as conversation messages:

```typescript
// onboarding_sessions.wizard_state
{
  "step": "introducing_muhasebeci",
  "agents_introduced": ["satis_temsilcisi", "depo_sorumlusu"],
  "agents_remaining": ["muhasebeci", "destek", ...],
  "company_data_collected": {
    "company_name": "ABC Ltd",
    "admin_email": "admin@abc.com",
    "dealer_count_estimate": 50
  }
}
```

4. **Resume from structured state, not message history:** When dealer returns after dropping out, wizard reads `wizard_state.step` and resumes from there, not by re-reading the last 50 messages.

**Warning signs:**
- Wizard delegates to sub-agents without passing `onboarding_mode` flag
- Sub-agent introductions written to same `agent_conversations` as production use
- Wizard state stored only in conversation history (unstructured)
- No resume logic when dealer returns after disconnection

**Phase to address:** Phase 1 of v4.0 (Kurulum Sihirbazi design) — wizard state management must be specified before any sub-agent delegation code is written.

---

### Pitfall 7: iyzico 3DS2 Webhook — Double Payment Processing

**What goes wrong:**
iyzico 3DS payment flow requires TWO server-side API calls: Init 3DS (get the HTML form) → [user completes OTP in browser] → Auth 3DS (finalize). The webhook fires after Auth 3DS succeeds. If your webhook endpoint is slow (>15s), iyzico retries it every 15 minutes for up to 3 attempts.

Failure mode: The webhook fires, your handler calls a billing activation function, but the response takes 18 seconds (Supabase cold start + agent_definitions update). iyzico gets no 200 response, retries 15 minutes later. Now your billing activation runs twice. Company has two active subscription records, billing is doubled, agent enable logic fires twice (race condition in UPDATE).

Additionally: iyzico explicitly states that "the majority of iyzico services have designed non-idempotent" architecture — they will NOT automatically prevent duplicate processing on your end.

**Why it happens:**
Developers write synchronous webhook handlers that do all the work (DB writes, email notifications, agent activation) before returning 200. The handler exceeds iyzico's timeout, triggering retries.

**How to avoid:**
1. **Immediate 200, async processing:** Receive webhook → validate `X-IYZ-SIGNATURE-V3` header (HMAC-SHA256) → write raw payload to `payment_webhook_events` table → return 200 immediately (< 1s). Background job processes the event.
2. **Idempotency key on webhook events:** Use `paymentId` as the idempotency key. Before processing any billing activation, check if `payment_webhook_events WHERE payment_id = ? AND processed_at IS NOT NULL` exists. If yes, skip and return.
3. **Signature validation is non-negotiable:** The `X-IYZ-SIGNATURE-V3` header must be verified BEFORE writing to the database. Parameter order for Direct format: `secretKey + iyziEventType + paymentId + paymentConversationId + status`. Hash with HMAC-SHA256, encode as hex.
4. **Timestamp replay prevention:** Reject webhooks where `timestamp` in payload is older than 5 minutes.

```typescript
// app/api/webhooks/iyzico/route.ts
export async function POST(req: Request) {
  const payload = await req.json()
  const signature = req.headers.get('X-IYZ-SIGNATURE-V3')

  // 1. Validate signature FIRST
  const expectedSig = computeIyzicoSignature(payload, process.env.IYZICO_SECRET_KEY!)
  if (!timingSafeEqual(signature, expectedSig)) {
    return new Response('Invalid signature', { status: 401 })
  }

  // 2. Idempotency check
  const { data: existing } = await supabase
    .from('payment_webhook_events')
    .select('id')
    .eq('payment_id', payload.paymentId)
    .eq('processed_at', null) // Already processed?
    .maybeSingle()

  if (existing?.processed_at) {
    return new Response('Already processed', { status: 200 }) // iyzico gets 200, stops retrying
  }

  // 3. Store raw event
  await supabase.from('payment_webhook_events').upsert({
    payment_id: payload.paymentId,
    event_type: payload.iyziEventType,
    raw_payload: payload,
    received_at: new Date(),
  })

  // 4. Return 200 immediately
  return new Response('OK', { status: 200 })
  // Background job picks up unprocessed events and runs billing activation
}
```

**Warning signs:**
- Webhook handler awaits `agent_definitions` updates before returning 200
- No `payment_webhook_events` table (no idempotency key store)
- Signature validation uses `===` instead of `crypto.timingSafeEqual()`
- Duplicate subscription records exist in DB (sign of double-processing)

**Phase to address:** Phase 2 of v4.0 (Billing Integration) — webhook idempotency design must precede all other billing logic.

---

### Pitfall 8: PayTR 3DS Redirect Flow — Missed Callback on Mobile Telegram

**What goes wrong:**
PayTR's 3DS flow redirects the user from your payment page to the bank's OTP page, then back to your callback URL. This is a standard browser redirect flow. But Turkish B2B users often initiate payment from the Telegram in-app browser (they click the upgrade link inside Telegram). Telegram's in-app browser has inconsistent behavior with 3DS redirects:

- The bank OTP page may open in the external browser (not Telegram's internal one)
- After OTP completion, the redirect goes to the system browser's session — not Telegram's
- Your callback URL may fire, but the user sees a blank page in Telegram's browser
- The payment actually succeeded, but the user thinks it failed (they never saw your success page)

Result: User tries to pay again → double charge attempt → bank fraud detection may flag the card.

**Why it happens:**
In-app browsers don't share session state with the external browser. The 3DS redirect chain breaks across browser contexts.

**How to avoid:**
1. **Always open payment links in external browser:** Use Telegram's `web_app` URL format or instruct users via bot message: "Odeme icin tarayicinizi acin: [link]" with explicit instruction not to use the in-app browser.
2. **Payment status polling separate from redirect:** Don't rely on redirect callback as the only success signal. After redirect callback fires, also listen for the webhook (separate server-side notification). Update subscription status from webhook, not from callback redirect.
3. **Optimistic callback with verification:** On the callback URL, show a "Odeme dogrulaniyor..." page that polls your backend for payment status confirmation (since webhook may arrive before or after redirect).
4. **Idempotent subscription activation:** Both the redirect callback AND the webhook handler trigger subscription activation, but idempotency checks prevent double activation.

**Warning signs:**
- Payment success depends solely on the 3DS redirect callback URL being loaded
- No backend webhook listener separate from the redirect callback
- No user instruction about using external browser for payment
- Mobile test plan doesn't include "pay via Telegram in-app browser" scenario

**Phase to address:** Phase 2 of v4.0 (Billing Integration) — mobile payment UX must be explicitly tested before launch.

---

### Pitfall 9: Agent Marketplace — Disabling Agent with In-Flight Conversation

**What goes wrong:**
Admin clicks "Devre Disi Bırak" (Disable) on the Muhasebeci agent in the marketplace. The toggle sends a request that updates `agent_definitions SET is_active = false`. Simultaneously, a dealer sent a message to the Muhasebeci 2 seconds ago, and the dispatcher's `after()` job is running. The dispatcher loads the system prompt from `agent_definitions` (reads `is_active = true` before the toggle fires), runs the full agent loop (30 seconds), and sends the reply. The agent was "disabled" but still responded.

The reverse: Admin enables a new agent. The `is_active` flag is set. But the dispatcher loads agent configs at the start of each call and caches nothing — so the next dealer message will correctly see the new agent. This direction is safe.

**Why it happens:**
There's no distributed lock or "in-flight conversation" awareness when the marketplace toggle is applied. The dispatcher and the admin panel UI operate on the same `is_active` flag without coordination.

**How to avoid:**
This is an acceptable eventual consistency trade-off with proper UX management:
1. **Accept the race window:** A disabled agent may respond to 1 more message (< 30s window). This is acceptable for a B2B SaaS context. Document this explicitly.
2. **No new conversations after disable:** The real enforcement is at conversation START, not mid-execution. The dispatcher checks `is_active` at the beginning of `dispatchAgentUpdate()`. Once the in-flight call completes, no new conversations start for that agent.
3. **Active conversation warning in marketplace UI:** Before disabling, check `agent_conversations` for active sessions (last_message < 5 minutes). If found, show: "Bu ajanin 2 aktif konusmasi var. Devre disi birakma 5 dakika icinde etkili olacak."
4. **For immediate disable (billing failure):** If disabling due to payment failure (not admin choice), use the grace period approach from Pitfall 4 — allow current conversation turn to complete, then block at next message.

```typescript
// marketplace toggle handler
async function disableAgent(companyId: string, agentRole: string) {
  // Check for active conversations (last message within 5 minutes)
  const { count } = await supabase
    .from('agent_conversations')
    .select('id', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('agent_role', agentRole)
    .eq('status', 'active')
    .gte('last_message_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

  // Disable the agent
  await supabase
    .from('agent_definitions')
    .update({ is_active: false })
    .eq('company_id', companyId)
    .eq('role', agentRole)

  return { disabled: true, active_conversations_at_time_of_disable: count ?? 0 }
}
```

**Warning signs:**
- Marketplace disable silently kills active conversations
- No check for active sessions before disable
- UI shows immediate "disabled" without explaining the 5-minute effective window
- Admin panel has no audit log of agent enable/disable actions

**Phase to address:** Phase 3 of v4.0 (Agent Marketplace UI) — active conversation check must be built into the toggle handler.

---

### Pitfall 10: Superadmin Panel Without Tenant Isolation Audit Trail

**What goes wrong:**
The superadmin panel can view all companies, switch between them, and edit their agent configurations. A superadmin accidentally edits Company B's agent definitions while thinking they were editing Company A's (wrong browser tab, same-looking UI). Or: superadmin queries are accidentally missing the `company_id` filter (forgetting to scope the service role client call), and UPDATE statements affect all companies' rows.

The existing `is_admin()` RLS function is company-scoped. The superadmin bypasses this entirely (uses service role key). There is no second line of defense.

**Why it happens:**
Service role client bypasses all RLS. Superadmin is the only role that uses it without being scoped to a company. Any fat-finger or missing `.eq('company_id', ...)` clause in superadmin server actions causes cross-tenant writes.

**How to avoid:**
1. **Mandatory company_id parameter in all superadmin server actions:** Every superadmin function signature requires `companyId: string` explicitly. No action may call `supabase.from('X').update()` without `.eq('company_id', companyId)`.
2. **Audit log for all superadmin write operations:**

```sql
CREATE TABLE superadmin_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id uuid REFERENCES auth.users(id),
  company_id    uuid REFERENCES companies(id),
  action        text NOT NULL,  -- 'update_agent', 'disable_company', 'view_data'
  table_name    text,
  record_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  created_at    timestamptz DEFAULT now()
);
```

3. **Superadmin UI shows active company context prominently:** Always show "Aktif Firma: [Company Name]" in the header. Never let the superadmin perform actions without selecting a company first.
4. **Soft-delete over hard-delete:** Superadmin operations on companies use `deleted_at = now()`, not `DELETE FROM`. Accidental deletes are recoverable.

**Warning signs:**
- Superadmin server actions have no `companyId` parameter (all companies scope)
- No audit log table for superadmin actions
- Superadmin panel doesn't visually emphasize which company is currently selected
- Hard-delete is used for company or agent disabling operations

**Phase to address:** Phase 0 of v4.0 (Superadmin Panel Foundation) — audit log and company context must be the FIRST thing built.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Write directly to `companies`/`users` from wizard tools | Simpler tool code | Orphan records on dropout, no rollback possible | Never |
| Use static/reusable deep link token | Simpler superadmin UI | Replay attacks, link sharing, multiple companies created | Never |
| Single `is_active` flag as both desired-state and billing-state | Simpler schema | Split-brain when billing and marketplace diverge | Never |
| Synchronous iyzico webhook handler | Simpler code | Double processing on retry, iyzico's 3 retries = 3x activation | Never |
| No grace period on payment failure | Simpler billing logic | Dealers get abrupt cutoff mid-conversation, churn spike | Never |
| Disable agent immediately without in-flight conversation check | Immediate effect | Mid-turn errors for dealers, confused UX | Never — always allow current turn to complete |
| Store wizard progress in conversation history only | No separate table needed | Cannot resume from dropout, cannot inspect wizard state | Prototyping only (1 sprint max) |
| Superadmin bypasses all audit logging | Faster dev | No recovery from accidental cross-tenant writes | Never — audit log must ship on day 1 |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| iyzico 3DS | Treating webhook as primary success signal; redirect callback as secondary | Both webhook AND callback should trigger status poll. Idempotency prevents double-activation. Webhook is authoritative; callback is UX convenience. |
| iyzico Webhook | Using deprecated `X-Iyz-Signature` or `X-Iyz-Signature-V2` headers for validation | Use `X-IYZ-SIGNATURE-V3` exclusively. Parameter concatenation order matters: `secretKey + iyziEventType + paymentId + paymentConversationId + status`. |
| iyzico Idempotency | Assuming iyzico prevents duplicate processing | iyzico explicitly documents that most services are non-idempotent. You MUST implement your own `paymentId`-keyed idempotency store. |
| PayTR 3DS | Assuming browser redirect callback reliably fires for mobile Telegram users | In-app browser 3DS redirect is unreliable. Always use server webhook as the authoritative payment confirmation. |
| Telegram Deep Link | 64-char token limit | SHA-256 hex digest = 64 chars, exactly fits. UUID v4 = 36 chars (safe). Do NOT use base64-encoded 256-bit values (43 chars + padding chars not allowed by Telegram). |
| Telegram Deep Link | `start` parameter visible in chat history as plain text | Don't put sensitive data in the token. Use the token only as an opaque lookup key for server-side invite record. Token hash is stored in DB, raw token only appears in the link. |
| Supabase + billing state sync | Relying on Supabase Realtime to propagate billing state changes to Telegram dispatcher | Telegram dispatcher is serverless (each call is stateless). Don't use Realtime — always read billing state from DB at the start of each `dispatchAgentUpdate()` call. |
| AgentBridge for wizard delegation | Passing normal business queries as wizard delegation | Wizard sub-agent calls must include `onboarding_mode: true` in the query. Sub-agents respond differently in onboarding mode (introduction, not operational). |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Checking `companies.subscription_status` on every webhook call without index | Dispatcher slows linearly as companies table grows | Add index: `CREATE INDEX idx_companies_status ON companies(id, subscription_status)` | At 50+ companies |
| Onboarding session table grows unbounded | Abandoned sessions accumulate; table scan for active session lookup slows | pg_cron daily cleanup: `DELETE FROM onboarding_sessions WHERE status = 'in_progress' AND expires_at < now()` | After 6 months of abandoned signups |
| All billing webhook events processed synchronously in route handler | Vercel function stays open waiting for DB writes + email sends | Queue raw webhook to DB, return 200, process async | Immediately — iyzico's 15s timeout will trigger retries on cold starts |
| Superadmin loads all companies in single query for dashboard | 10K companies = 10MB response, slow dashboard | Paginate: `LIMIT 50 OFFSET ?`, add search by company name | At 100+ companies |
| Trial expiry pg_cron job runs at midnight for all companies simultaneously | DB write spike at midnight as all trial updates run | Spread expiry checks: add `trial_check_hour` column to companies, distribute across 24 hours | At 200+ companies with concurrent trials |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Onboarding invite token stored in plaintext in DB | DB breach exposes all pending invites; attacker creates companies using stolen tokens | Store SHA-256 hash in DB; raw token only sent to superadmin's email. Lookup by hash. |
| Superadmin route without explicit superadmin role check | Any admin can access superadmin panel if they guess the URL | Middleware: check `users.role = 'superadmin'` for all `/superadmin/*` routes. Superadmin role is NEVER auto-assigned — only manually set in DB. |
| Billing webhook endpoint open to public without signature validation | Attacker sends fake webhook to activate subscription without paying | ALWAYS validate `X-IYZ-SIGNATURE-V3` before any DB write. Use `crypto.timingSafeEqual()` for comparison. |
| Trial period bypass via telegram_chat_id reuse | User creates new Telegram account, gets new chat_id, starts fresh trial | Bind trial to company email domain + phone verification, not just telegram_chat_id. One trial per company email domain. |
| Wizard onboarding session not rate-limited | Attacker floods `/start TOKEN` to spam onboarding wizard | Rate limit: max 10 `/start` commands per chat_id per hour in the Telegram webhook middleware. |
| Agent definitions editable via API without company_id scope | Admin from Company A edits Company B's agent_definitions via crafted API request | All `/api/agent-definitions/*` routes must extract `company_id` from authenticated session JWT, never from request body. |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Trial expiry message with no upgrade path | Dealer is blocked with no next step; churns | Always include upgrade URL in expiry messages: "Devam etmek: [link]" |
| Wizard asks all questions in one long session | User abandons midway; no save state | Save wizard progress after each question. On return, resume from last completed step. |
| Marketplace shows agent toggle without activation delay explanation | Admin toggles off agent, dealer immediately gets broken experience | Show: "Aktif konusmalar tamamlandıktan sonra (~5 dakika) devre disi kalir." |
| Payment failure email goes only to billing email on file | Admin doesn't check that email; agents disabled without warning | Also send Telegram message to company admin's linked chat_id: "Odeme basarisiz — X gun icerisinde lutfen guncelleyiniz." |
| Superadmin creates company but forgets to send invite link | Company created, admin notified by email that never arrives | Superadmin panel shows "Bekleyen Davetler" list. One-click resend. Invite status: Sent/Clicked/Completed. |
| Wizard introduces all 12 agents in one session | Overwhelming; user loses track of which bot does what | Wizard introduces max 3-4 agents per session. After completing, suggests: "Diger dijital calisanlarla tanismak ister misiniz?" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Onboarding Wizard:** Tool can collect company name → verify `onboarding_sessions` table is used, NOT direct `companies` INSERT. Run: `SELECT COUNT(*) FROM companies WHERE created_at > now() - interval '1 hour' AND id NOT IN (SELECT company_id FROM users)`  — should be 0.
- [ ] **Invite Token Security:** Superadmin generates link → verify token is stored as SHA-256 hash in DB (not plaintext). Verify link expires after 48h. Verify second click on same link returns "zaten kullanilmistir."
- [ ] **Billing State Authority:** Payment fails → disable webhook fires → verify ONLY `syncAgentStateFromBilling()` is called, NOT direct marketplace toggle. Verify `agent_definitions.is_active` matches billing subscription state.
- [ ] **Grace Period:** Simulate payment failure → verify agents remain active for 3 days. Verify admin receives warning email AND Telegram message. Verify agents disable after grace period ends.
- [ ] **Trial Expiry UX:** Set `trial_expires_at = now() + 30 minutes` → verify T-3 day, T-1 day, T-0 Telegram warnings fire. Verify cutoff sends upgrade link. Verify cutoff happens at message dispatch START, not mid-agent-loop.
- [ ] **iyzico Webhook Idempotency:** Send same webhook payload twice → verify billing activation fires exactly once. Verify `payment_webhook_events` has `processed_at` set on first processing.
- [ ] **PayTR Mobile:** Test 3DS flow from Telegram in-app browser on iOS and Android → verify subscription activates even if redirect callback never loads (webhook-only activation path).
- [ ] **Agent Disable Race:** Admin disables agent → simultaneously dealer sends message → verify dealer gets coherent response (in-flight completes), verify next dealer message gets "agent devre disi" response.
- [ ] **Superadmin Audit:** Superadmin updates Company A's agent definition → verify row appears in `superadmin_audit_log` with correct `company_id`, `old_value`, `new_value`.
- [ ] **Wizard Resume:** Dealer starts wizard, drops out at step 4, returns 2 days later → verify wizard resumes from step 4 using `wizard_state`, not from re-reading message history.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Orphan company records from partial onboarding | LOW — no live data | 1. Run `SELECT * FROM companies WHERE id NOT IN (SELECT DISTINCT company_id FROM users)`, 2. Manually delete orphan rows, 3. Add staging table to prevent recurrence |
| Deep link token shared publicly — multiple companies created | MEDIUM — data cleanup | 1. Identify all `companies` created with same `onboarding_invite_id`, 2. Keep the first (intended), 3. Delete subsequent orphans (verify no data), 4. Invalidate all tokens from that batch |
| Billing double-activation (iyzico retry caused 2x subscription) | MEDIUM — billing issue | 1. Check `payment_webhook_events` for duplicate `payment_id` with 2x `processed_at`, 2. Identify the duplicate subscription record, 3. Refund one period, 4. Add idempotency check immediately |
| Agent active after payment failure (no grace period implemented) | HIGH — revenue loss | 1. Run reconciliation query: `SELECT company_id FROM subscriptions WHERE status = 'past_due' AND agent_definitions.is_active = true`, 2. Notify companies, 3. Apply 24-hour emergency grace period, 4. Disable after grace |
| Trial expires during conversation — dealer churns | HIGH — trust damage | 1. No immediate recovery for churned dealer, 2. Superadmin can manually extend trial: `UPDATE companies SET trial_expires_at = now() + interval '7 days' WHERE id = ?`, 3. Send personal apology message |
| Superadmin accidentally updates wrong company's agents | MEDIUM — config corruption | 1. Check `superadmin_audit_log` for the erroneous update, 2. Read `old_value` from audit log, 3. Restore via direct DB update in SQL editor, 4. Notify affected company admin |

---

## Pitfall-to-Phase Mapping

How v4.0 roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Severity | Verification |
|---------|------------------|----------|--------------|
| Wizard partial DB setup — orphan records | Phase 1: Kurulum Sihirbazi | CRITICAL | No orphan companies after dropout test |
| Deep link token replay / sharing | Phase 0: Superadmin Panel | CRITICAL | Second click returns "zaten kullanilmistir" |
| Billing state vs. agent active state divergence | Phase 2: Billing Integration | CRITICAL | Payment failure → billing is sole source of is_active |
| Payment failure — abrupt agent disable | Phase 2: Billing Integration | HIGH | grace_period_ends_at exists; agents active during grace |
| Trial expiry — mid-conversation cutoff | Phase 3: Trial Management | HIGH | Cutoff fires at dispatch entry, includes upgrade link |
| Wizard sub-agent context handoff failure | Phase 1: Kurulum Sihirbazi | HIGH | wizard_state JSON, not conversation history |
| iyzico webhook double-processing | Phase 2: Billing Integration | HIGH | Same paymentId processed exactly once |
| PayTR 3DS mobile redirect failure | Phase 2: Billing Integration | HIGH | Subscription activates from webhook alone (no redirect) |
| Agent disabled with in-flight conversation | Phase 3: Agent Marketplace | MEDIUM | In-flight call completes; next message blocked |
| Superadmin cross-tenant writes | Phase 0: Superadmin Panel | CRITICAL | All writes appear in audit log with company_id |

---

## Sources

- [iyzico 3DS Implementation Docs — Official](https://docs.iyzico.com/en/payment-methods/api/3ds/3ds-implementation)
- [iyzico Webhook Docs — Official](https://docs.iyzico.com/en/advanced/webhook)
- [iyzico Idempotency Docs — Official](https://docs.iyzico.com/en/getting-started/preliminaries/idempotency)
- [Handling Payment Webhooks Reliably — Medium/Sohail](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5)
- [Telegram Bot Deep Linking — Official](https://core.telegram.org/bots/features#deep-linking)
- [Telegram Deep Links API Spec — Official](https://core.telegram.org/api/links)
- [How to Secure Telegram Bots — BAZU](https://bazucompany.com/blog/how-to-secure-telegram-bots-with-authentication-and-encryption-comprehensive-guide-for-businesses/)
- [The 14 Pains of Billing for AI Agents — Arnon Shimoni](https://arnon.dk/the-14-pains-of-billing-ai-agents/)
- [AI Agent Handoff: Why Context Breaks — XTrace](https://xtrace.ai/blog/ai-agent-context-handoff)
- [Why Multi-Agent LLM Systems Fail — Augment Code](https://www.augmentcode.com/guides/why-multi-agent-llm-systems-fail-and-how-to-fix-them)
- [Multi-Agent Orchestration Best Practices — Skywork](https://skywork.ai/blog/ai-agent-orchestration-best-practices-handoffs/)
- [Stripe Grace Period and Failed Payments — RevenueCat](https://www.revenuecat.com/docs/subscription-guidance/how-grace-periods-work)
- [Stripe Subscription Overview — Official](https://docs.stripe.com/billing/subscriptions/overview)
- [How to Handle Failed Subscription Payments in Stripe — Ben Foster](https://benfoster.io/blog/stripe-failed-payments-how-to/)
- [AI Agent Pricing Models 2026 — AIMultiple Research](https://research.aimultiple.com/ai-agent-pricing/)
- [Expire a Conversation — Microsoft Azure Bot Service](https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-howto-expire-conversation?view=azure-bot-service-4.0)
- [Webhook Security Best Practices — CatchHooks](https://www.catchhooks.com/blog/webhook-security-and-signature-verification)
- Existing codebase: `src/lib/agents/agent-bridge.ts`, `dispatcher.ts`, `conversation-manager.ts`, `types.ts` — analyzed for existing deadlock guards, async patterns, and company isolation

---
*Pitfalls research for: v4.0 Agent-Native SaaS Onboarding & Marketplace*
*Researched: 2026-03-05*
*Scope: Adding Kurulum Sihirbazi (13th agent), superadmin panel, per-agent billing, agent marketplace, trial periods, and Turkish payment provider integration to existing v3.0 multi-tenant + 12-agent system*
