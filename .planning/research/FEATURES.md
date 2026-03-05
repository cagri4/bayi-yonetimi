# Feature Research: v4.0 - Agent-Native SaaS Onboarding & Marketplace

**Domain:** B2B Dealer Management SaaS — Conversational Onboarding + Per-Agent Billing + Agent Marketplace
**Project:** Bayi Yonetimi v4.0
**Researched:** 2026-03-05
**Confidence:** MEDIUM-HIGH

---

## Context

This research covers **only the new features** for v4.0. The existing system (v3.0) already has:
- 38 web routes (dealer + admin panels)
- 12 AI agents on Telegram (all infrastructure live)
- Multi-tenant architecture (company_id RLS isolation)
- AgentRunner, ToolRegistry, AgentBridge, ConversationManager
- Per-dealer token budget tracking

The v4.0 question: how do agent-native SaaS platforms handle onboarding, billing, and agent team management?

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for v4.0 to feel complete. Missing these = product feels broken or unprofessional.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Superadmin: Create company** | Platform operator needs to provision tenants without touching DB | LOW | companies table (already exists) |
| **Superadmin: Generate onboarding link** | Every agent-native SaaS must have a unique entry point per tenant (Slack, Intercom all do this) | LOW | Invite token / magic link pattern |
| **Kurulum Sihirbazi: Greeting + purpose explanation** | First message sets expectations; users who don't understand the bot abandon immediately | LOW | New 13th agent bot registration |
| **Kurulum Sihirbazi: Collect company info conversationally** | Progressive disclosure (one question at a time) is the established onboarding pattern — confirmed by Landbot, Voiceflow research | MEDIUM | Wizard state machine + DB writes |
| **Kurulum Sihirbazi: Auto-populate DB from collected data** | The payoff of conversational onboarding is zero manual setup — users expect automation | MEDIUM | Server Action per data type collected |
| **Kurulum Sihirbazi: Confirmation summary before save** | Users must review collected data before it writes to DB — prevents trust-breaking errors | LOW | Structured confirmation message |
| **Trial period: All agents active by default** | "Try before you buy" is universal SaaS practice; all features on during trial is the benchmark | LOW | company.trial_ends_at column |
| **Trial end: Clear notification via Telegram** | Users must know when trial expires — absence of notification is a UX failure | LOW | Cron job + Telegram send |
| **Trial end: Graceful degradation, not hard cutoff** | Industry standard: warn 7 days, 3 days, 1 day before cutoff (not a sudden lock) | LOW | Countdown notification sequence |
| **Per-agent toggle: Activate / deactivate** | Zendesk charges per active agent; the toggle is the billing unit — users need control over their cost | MEDIUM | agent_subscriptions table + webhook gate |
| **Dijital Ekibim page: List all 12 agents with status** | Marketplace browsing is the standard pattern (Moveworks, Oracle Fusion, Slack App Directory) | MEDIUM | Web page + company agent config |
| **Monthly cost calculator** | Users must see cost before committing — predictability reduces churn (per Chargebee research) | LOW | Real-time sum of active agent prices |
| **Superadmin: View all companies + trial status** | Platform operator needs visibility to manage sales pipeline; no visibility = flying blind | MEDIUM | Superadmin-scoped DB queries |

### Differentiators (Competitive Advantage)

Features that make this product distinctly better than "just giving access to 12 bots."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sequential agent introductions during onboarding** | Each agent introduces itself and demonstrates its capability during setup — not a list of features, but a live demo. No known competitor does this for Telegram-based agents. | HIGH | AgentBridge task-dispatch mode; each agent runs a scripted intro conversation |
| **Wizard collects domain-specific data via the expert agent** | When Muhasebeci introduces itself, it asks for financial chart-of-accounts data. When Depo Sorumlusu introduces itself, it asks for warehouse locations. Data collected by the right agent feels contextually intelligent. | HIGH | 12 data collection flows; each agent has a "setup mode" |
| **"Digital team" mental model** | Framing agents as employees you hire/fire (not features you toggle) increases perceived value and justifies per-agent pricing. Research confirms this framing is the emerging standard for AI agent SaaS (Chargebee 2026 Playbook). | LOW | Copy/UX decision, not engineering |
| **Usage stats per agent in marketplace** | Show message count, tasks completed, last active — demonstrates ROI for each agent individually. Gives data-driven reason to keep or cancel an agent. | MEDIUM | Aggregation query from agent_conversations |
| **Trial progress indicator** | "Day 7 of 14 — 3 agents not yet activated" — proactive nudge during trial to maximize activation. Research shows every 10% activation improvement drives 6-10% higher conversion. | MEDIUM | Daily cron check + Telegram message |
| **Onboarding completion celebration** | When all setup steps done, bot sends a "your digital team is ready" message with full team roster and what each member does — emotional payoff moment that anchors the product positively | LOW | Trigger after wizard state machine completes |
| **Superadmin: One-click trial extension** | When a prospect needs more time, operator can extend without code. Increases conversion for high-value prospects. | LOW | Update trial_ends_at field + notify user |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Better Approach |
|---------|---------------|-----------------|-----------------|
| **Payment gateway integration (Stripe/iyzico) in v4.0** | Feels necessary for "real" billing | Stripe/iyzico integration is a separate milestone; mixing billing infrastructure with onboarding UX delays shipping and adds compliance scope | Track subscription state in DB; payment collection stays manual (invoice/EFT) as it was in v1-v3; automate in v5.0 |
| **Per-agent usage-based pricing (pay per message)** | Seems fair and scalable | Unpredictability kills B2B adoption — Turkish SME customers (bayiler) cannot budget for variable costs; per-Chargebee research, usage-based models require buyers to "translate usage to ROI themselves" which creates friction | Fixed monthly fee per agent (flat rate) is the right model at this scale |
| **Outcome-based pricing (pay per resolved issue)** | Intercom Fin does this ($0.99/resolution) | Requires sophisticated resolution-detection logic; at v4.0 scale (small Turkish distributor companies), this is over-engineered | Reserve for v5.0+ when agent performance data is available |
| **Self-service tenant signup (Ali registers himself)** | Feels like growth-hacking | At this market stage (Turkish SMB, relationship-driven sales), cold self-signup has poor conversion; superadmin-provisioned + personal onboarding link outperforms self-serve for B2B | Superadmin creates company, generates personal invite link, hands to Ali manually (or via WhatsApp message) |
| **Onboarding all 12 agents in sequence in one session** | Comprehensive = thorough | A 12-step sequential intro with 12 agents collecting data is a 45-60 minute session — users will drop off. Research: time-to-first-value under 10 minutes = top quartile conversion | Group agents into 3-4 themed steps; defer secondary agents to "meet the rest of the team" async messages after setup |
| **Real-time billing webhook to lock agents on non-payment** | Necessary for production billing | Agent locking on non-payment requires Stripe webhook infra, retry logic, and customer support workflows; this is v5.0 territory | Manual flag in DB (is_paid boolean); superadmin sets it when payment confirmed |
| **Full agent customization per company during onboarding** | Enterprise feature | Adds complexity to both wizard and agent definitions; per-role prompts are already parameterized — company context is injected from DB | Company context (name, dealers, products) auto-injects from DB post-onboarding; no custom prompt UI needed in v4.0 |

---

## Feature Dependencies

```
[Superadmin: Create Company]
    └──requires──> [companies table with trial_ends_at, onboarding_token columns]
                       └──enables──> [Onboarding Link Generation]
                                         └──enables──> [Kurulum Sihirbazi access]

[Kurulum Sihirbazi: Wizard State Machine]
    └──requires──> [13th bot registered with BotFather + webhook configured]
    └──requires──> [Onboarding token validation (links user Telegram ID to company)]
    └──enables──> [Agent Introductions (sequential)]
    └──enables──> [DB auto-population]
    └──enables──> [Onboarding Completion trigger]

[Agent Introductions (sequential)]
    └──requires──> [AgentBridge task-dispatch mode (already built)]
    └──requires──> [Each agent has a setup/intro data collection flow]

[Trial Period]
    └──requires──> [trial_ends_at column on companies table]
    └──requires──> [agent_subscriptions table with is_active per company+agent]
    └──enables──> [Trial countdown notifications (cron)]
    └──enables──> [Trial end: graceful degradation]

[Dijital Ekibim Marketplace Page]
    └──requires──> [agent_subscriptions table]
    └──requires──> [Toggle activate/deactivate server action]
    └──requires──> [Monthly cost calculation (sum of active agent prices)]
    └──enhances──> [Usage stats per agent (from agent_conversations)]

[Per-agent billing toggle]
    └──requires──> [agent_subscriptions table]
    └──requires──> [Telegram webhook gate: check is_active before routing message]
    └──depends-on──> [Trial period (all active during trial, toggles apply after)]

[Trial end notification sequence]
    └──requires──> [Vercel Cron job (already established pattern)]
    └──requires──> [Telegram send capability (already built)]
    └──requires──> [trial_ends_at + days_remaining calculation]

[Superadmin: All companies view]
    └──requires──> [Superadmin role (MT-05, already exists)]
    └──requires──> [companies table + trial_ends_at + active agent count]
```

### Dependency Notes

- **Onboarding token** is the critical new primitive: a short-lived token stored on the company record that links an anonymous Telegram user (Ali) to a specific company during /start. Without it, the wizard cannot know which company is onboarding.
- **agent_subscriptions table** is the single source of truth for billing state. The webhook routing layer must check `is_active` before invoking AgentRunner. This gate is the billing enforcement mechanism.
- **13th bot (Kurulum Sihirbazi)** is architecturally independent from the 12 existing agent bots — it has its own webhook route, its own conversation state, and dispatches TO the other agents rather than running alongside them.
- **Trial period is a special state** where all agent_subscriptions have `is_active = true` and `is_trial = true`. After trial ends, only explicitly activated subscriptions remain active.

---

## MVP Definition

### Launch With (v4.0 — this milestone)

These are the minimum features to make v4.0 meaningful. Every item below is required for the milestone narrative ("platformu agent-native SaaS'a donustur") to be true.

- [ ] **Superadmin: Create company + generate onboarding link** — without this, no new tenant can start
- [ ] **Kurulum Sihirbazi bot** — 13th bot registered, /start validates token, links Telegram ID to company
- [ ] **Wizard state machine** — collects company name, admin name, dealer count, product categories, business type; writes to DB
- [ ] **Agent introduction sequence** — Sihirbaz introduces at minimum 3-4 key agents (Satis, Muhasebe, Depo, Genel Mudur); each agent says hello and demonstrates one capability
- [ ] **DB auto-population** — wizard completion writes collected data to relevant tables (company profile, initial settings)
- [ ] **Trial period: 14 days, all agents active** — trial_ends_at = now + 14 days, all agent_subscriptions is_active = true
- [ ] **Trial countdown notifications** — Day 7 and Day 1 before expiry, Telegram message to company admin
- [ ] **agent_subscriptions table** — one row per company per agent; is_active, monthly_price, is_trial columns
- [ ] **Dijital Ekibim page** — web page listing all 12 agents with activate/deactivate toggle and monthly cost calculator
- [ ] **Webhook gate** — before invoking AgentRunner, check agent_subscriptions.is_active for that company+agent pair
- [ ] **Superadmin: Companies dashboard** — list all companies, trial status, days remaining, active agent count

### Add After Validation (v4.x)

Features to add once the core onboarding and billing flow is validated with at least 2-3 real tenants.

- [ ] **Full 12-agent introduction sequence** — expand from 4 intro agents to all 12 during onboarding
- [ ] **Domain-specific data collection per agent** — each agent collects its own setup data (currently: just company profile)
- [ ] **Usage stats in Dijital Ekibim** — message count, tasks completed, last active per agent
- [ ] **Trial extension via superadmin** — one-click extend trial_ends_at by 7 or 14 days
- [ ] **Onboarding resumption** — if wizard is interrupted, /start resumes from last completed step

### Future Consideration (v5.0+)

- [ ] **Payment gateway (Stripe/iyzico)** — automated billing; premature for v4.0
- [ ] **Self-service signup** — unblocks growth at scale; not the right model for Turkish SMB market yet
- [ ] **Outcome-based pricing** — requires agent performance data that won't exist until 6+ months of usage
- [ ] **Agent customization UI** — per-company prompt tuning; after product-market fit is established
- [ ] **WhatsApp channel for onboarding** — Telegram-first; WhatsApp requires separate Business API approval in Turkey

---

## Feature Prioritization Matrix

### Area 1: Superadmin Panel

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Create company | HIGH | LOW | P1 |
| Generate onboarding link (token) | HIGH | LOW | P1 |
| Companies dashboard (list + trial status) | HIGH | MEDIUM | P1 |
| Trial extension (one-click) | MEDIUM | LOW | P2 |
| Revenue view (MRR per company) | LOW | LOW | P3 |

### Area 2: Kurulum Sihirbazi (13th Bot)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| /start with token validation | HIGH | LOW | P1 |
| Collect company profile data conversationally | HIGH | MEDIUM | P1 |
| Write collected data to DB | HIGH | MEDIUM | P1 |
| Introduce 4 key agents with mini-demos | HIGH | HIGH | P1 |
| Confirmation summary before save | MEDIUM | LOW | P1 |
| Onboarding completion celebration message | MEDIUM | LOW | P2 |
| Introduce all 12 agents | MEDIUM | HIGH | P2 |
| Resumption from interrupted state | LOW | MEDIUM | P3 |

### Area 3: Trial Period + Billing

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| agent_subscriptions table | HIGH | LOW | P1 |
| Trial period (14-day all-active) | HIGH | LOW | P1 |
| Webhook gate (is_active check) | HIGH | LOW | P1 |
| Trial countdown notification (Day 7 + Day 1) | HIGH | LOW | P1 |
| Trial end: graceful degradation message | HIGH | LOW | P1 |
| Monthly cost calculator (live sum) | MEDIUM | LOW | P1 |

### Area 4: Agent Marketplace (Dijital Ekibim)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Agent list with status (active/inactive/trial) | HIGH | MEDIUM | P1 |
| Activate/deactivate toggle | HIGH | MEDIUM | P1 |
| Monthly cost display per agent | HIGH | LOW | P1 |
| Total monthly cost calculator | HIGH | LOW | P1 |
| Usage stats per agent | MEDIUM | MEDIUM | P2 |
| Agent description / what-it-does card | MEDIUM | LOW | P1 |

---

## Competitor / Pattern Analysis

| Pattern | Who Does It | How They Do It | Our Approach |
|---------|-------------|----------------|--------------|
| Conversational onboarding bot | Intercom (Fin setup), Drift, Landbot | Multi-step wizard via chat interface collecting company info before product access | Telegram bot (Kurulum Sihirbazi); already our channel; no new infrastructure |
| Per-agent subscription | Zendesk ($5-70/agent/month active), Intercom ($29+/agent seat) | Billing per active support agent; deactivate unused agents to reduce bill | Flat monthly fee per AI agent; toggle in web panel; manual payment confirmation in v4.0 |
| Agent marketplace / "hire" model | Moveworks marketplace, Oracle Fusion AI marketplace, CrewAI | Browse catalog of agents, install/uninstall; subscription activates | "Dijital Ekibim" page; 12 fixed agents (not open catalog yet); activate/deactivate per company |
| Trial → conversion | Intercom (14-day), Linear (14-day), Notion (7-day free) | Time-based trial, all features active; countdown notifications; payment capture at trial end | 14-day trial per company; all 12 agents active; Day 7 + Day 1 Telegram reminders |
| Time-to-first-value | Slack (message in <2 min), Linear (first issue in <5 min) | Eliminate friction to core action; guided to "aha moment" | Wizard completes in 1 session (~15-20 min); agents usable immediately after; "aha moment" = first agent interaction |
| Sequential feature intro | Duolingo (one lesson at a time), Notion (guided tour) | Introduce capabilities progressively; don't overwhelm with full feature set | Sequential agent intros in wizard; not all 12 at once; 4 key agents first |

---

## Critical Implementation Notes (For Phase Authors)

### Onboarding Token Design

The onboarding link must encode a short-lived, single-use token. Recommended pattern:
```
https://t.me/KurulumSihirbazBot?start=TOKEN
```
Where TOKEN is a UUID stored in `companies.onboarding_token` with `onboarding_token_expires_at`. When Ali clicks the link, Telegram sends `/start TOKEN` to the bot. The wizard validates the token, links `ali_telegram_id` to the company record, and marks the token consumed.

**Do not use company_id directly in the link** — this exposes internal IDs and allows guessing other companies.

### Wizard State Machine

The wizard needs persistent state (Ali can close Telegram and return). State must be stored in DB, not in-memory. Recommended: a `wizard_sessions` table with:
- `company_id`
- `telegram_user_id`
- `current_step` (enum: greeting, collect_company_name, collect_admin_name, introduce_agents, confirmation, complete)
- `collected_data` (JSONB)
- `created_at`, `expires_at`

### Per-Agent Pricing Principles (Research-Derived)

Based on Chargebee 2026 Playbook and industry analysis:
1. **Flat fee per agent per month** — not usage-based; Turkish B2B customers need budget predictability
2. **Agent tiers are fine** — not all agents need to cost the same (e.g., Genel Mudur Danismani > Egitimci)
3. **Trial must be 14 days, not 30** — research shows 7-14 day trials convert 71% better than 30-day; urgency drives action
4. **Notification timing** — Day 7 (halfway), Day 3, Day 1; not just at expiry

### Webhook Gate Architecture

The agent routing layer (currently: webhook receives message → AgentRunner) needs one new check:

```typescript
// Before AgentRunner invocation:
const subscription = await db
  .from('agent_subscriptions')
  .select('is_active')
  .eq('company_id', context.companyId)
  .eq('agent_id', agentId)
  .single()

if (!subscription.is_active) {
  await sendTelegram(chatId, 'Bu dijital calisan aktif degil. Dijital Ekibim sayfasinden aktif edebilirsiniz.')
  return
}
```

This is the single enforcement point for the entire billing model.

### Agent Marketplace "Mental Model" Copy

Research confirms: framing agents as "digital employees" rather than "features" increases perceived value and reduces churn. Copy recommendations:
- Page title: "Dijital Ekibim" (not "Ajan Ayarlari")
- CTA: "Ise Al" (not "Aktif Et")
- Cancellation: "Cikart" (not "Deaktive Et")
- Cost line: "Aylik maas: X TL" (not "Ucret: X TL/ay")

---

## Sources

- [Chargebee: Selling Intelligence — The 2026 Playbook For Pricing AI Agents](https://www.chargebee.com/blog/pricing-ai-agents-playbook/) — per-agent pricing models, flat vs usage-based tradeoffs
- [1Capture: Free Trial Conversion Benchmarks 2025](https://www.1capture.io/blog/free-trial-conversion-benchmarks-2025) — trial length, time-to-value, conversion rates (HIGH confidence, quantitative data)
- [Voiceflow: Build an AI Onboarding Bot for Your SaaS App](https://www.voiceflow.com/blog/saas-onboarding-chatbot) — onboarding flow phases, milestone mapping, activation patterns
- [EMA.ai: 8 AI Agent Pricing Models](https://www.ema.ai/additional-blogs/addition-blogs/ai-agents-pricing-strategies-models-guide) — per-agent vs usage-based vs outcome-based
- [Alguna Blog: Top solutions for agentic monetization in B2B SaaS 2025](https://blog.alguna.com/agentic-monetization-b2b-saas/) — real-time metering, per-agent billing mechanics
- [AIMultiple: From Traditional SaaS Pricing to AI Agent Seats in 2026](https://research.aimultiple.com/ai-agent-pricing/) — shift from per-seat to per-agent model rationale
- [GitHub: telegram-onboarding-kit](https://github.com/Easterok/telegram-onboarding-kit) — Telegram onboarding pattern reference
- [FutureForce: Future of AI Agent Marketplaces 2025-2030](https://futureforce.ai/content/future-of-ai-agent-marketplaces/) — marketplace "hire/fire" language and app-store analogy
- [Intercom Fin Pricing](https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-resolutions) — per-resolution model (outcome-based reference, noted as anti-feature for v4.0)
- [Botable: How Onboarding Chatbots Enhance User Experience](https://www.botable.ai/blog/onboarding-chatbots) — progressive disclosure, one-question-at-a-time principle

---

*Feature research for: v4.0 Agent-Native SaaS Onboarding & Marketplace*
*Researched: 2026-03-05*
*Confidence: MEDIUM-HIGH — core patterns (trial, per-agent billing, conversational onboarding) verified across multiple sources; Turkish market specifics (flat fee preference, relationship-driven sales) are reasoned extrapolations from B2B SMB research, LOW confidence*
