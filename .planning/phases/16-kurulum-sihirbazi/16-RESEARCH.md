# Phase 16: Kurulum Sihirbazi - Research

**Researched:** 2026-03-06
**Domain:** Telegram bot FSM wizard conversation flow, step-based state persistence, token validation, DB-backed session management
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KS-01 | Firma sahibi davet linkine tikladiginda Telegram'da Kurulum Sihirbazi botu acilir | Deep link format already established (Phase 15): `https://t.me/{username}?start={token}`. User clicks link → Telegram opens bot → bot receives Update with `message.text = "/start {token}"`. The webhook route skeleton exists at `/api/telegram/sihirbaz/route.ts`. |
| KS-02 | Sihirbaz davet tokenini dogrular (tek kullanimlik, suresi gecmemis) ve Telegram chat_id'yi firmaya baglar | Token validation flow: extract raw token from `/start {token}`, SHA-256 hash it, query `onboarding_invites` WHERE `token_hash = hash AND used_at IS NULL AND expires_at > NOW()`. Mark `used_at = NOW()` on first use. Link `telegram_chat_id` to `onboarding_sessions`. |
| KS-03 | Sihirbaz firma bilgilerini conversational olarak toplar (firma adi, sektor, urun sayisi, bayi sayisi, beklentiler) | Step-based FSM: 5 collection steps (step 1-5). Each step sends a question, saves the answer to `onboarding_sessions.collected_data` JSONB, increments `step`. On next message, resume from current step. |
| KS-04 | Sihirbaz 12 dijital calisani sirayla tanitir (her biri icin kisa Turkce aciklama — canli demo yok) | Steps 6-17: one step per agent, send description message, wait for acknowledgment (any text/button press). Or: send all 12 in a single multi-message batch (step 6 covers all intros), then proceed to confirmation (step 7). The success criterion says "sequential order before asking for setup confirmation" — could be single large message or 12 sequential sends. |
| KS-07 | Sihirbaz durumu onboarding_sessions tablosunda tutar (kullanici Telegram'i kapatip acsa bile devam edebilir) | `onboarding_sessions` table already exists with `step` INTEGER, `collected_data` JSONB, `status`, `telegram_chat_id`, and `deep_link_token`. Session lookup by `telegram_chat_id` (after first contact) or by `deep_link_token` (from /start command). Service role UPDATE for each step transition. |

</phase_requirements>

---

## Summary

Phase 16 implements the full Telegram wizard conversation flow inside the existing `sihirbaz/route.ts` skeleton. The infrastructure is complete from Phase 15: the `onboarding_sessions` table stores FSM state, `onboarding_invites` holds SHA-256 hashed tokens, the `provision_company` RPC atomically creates tenants, and `sendTelegramMessage()` exists as a reusable utility. This phase is purely about the **conversation orchestration logic** — no new database tables, no new npm packages, no new API routes are required.

The wizard follows a linear step machine with 7 distinct phases: (0) token validation, (1-5) data collection, (6) agent introductions, (7) confirmation, and (8) provisioning + completion. The `step` integer in `onboarding_sessions` drives the FSM. Each incoming Telegram message is dispatched to `dispatchSihirbazUpdate()` which loads the session by `telegram_chat_id`, reads `step`, and calls the appropriate handler. Resume-after-disconnect is automatic: if the user sends any message to the bot, the session is looked up and the flow continues from where it left off.

The critical design decision is whether the 12 agent introductions are sent as a single multi-part message or as 12 sequential "wait for acknowledgment" steps. The success criterion says "introduces all 12 dijital calisanlar by name with a short Turkish description for each, in sequential order, before asking for setup confirmation." A single large message (or two messages if over Telegram's 4096-char limit) satisfies this — the wizard does not need to wait for acknowledgment after each individual agent description. This simplifies the FSM considerably: step 6 = send all 12 intros, step 7 = send confirmation prompt.

**Primary recommendation:** Implement a pure hand-rolled step dispatcher (`dispatchSihirbazUpdate`) without grammy's conversation plugin. The grammY conversations plugin uses a replay-based engine that is explicitly not recommended for serverless environments due to race condition risks. The project's existing pattern (raw `Update` type from `grammy/types`, direct Telegram Bot API calls via `sendTelegramMessage()`) is the right approach.

---

## Standard Stack

### Core (no new npm packages required)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `grammy/types` | ^1.41.0 | `Update` type for webhook payload parsing | Already installed — used by all 12 agent routes and sihirbaz skeleton |
| `@supabase/supabase-js` | 2.91+ | Service role client for session reads/writes and invite validation | Already installed — project standard |
| `crypto` (Node.js built-in) | Node 20 | SHA-256 hash of raw token for validation lookup | Already used in Phase 15 for token generation |
| `src/lib/telegram/send.ts` | (internal) | `sendTelegramMessage()` for all bot replies | Built in Phase 15 — standalone utility |
| `src/lib/actions/superadmin.ts` | (internal) | `createCompany()` action for final provisioning | Built in Phase 15 — call from wizard completion step |

### No New Libraries Needed
The wizard is a pure TypeScript state machine reading and writing to the existing `onboarding_sessions` table. All required utilities (token sending, DB client, token hashing) are already in the codebase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled step dispatcher | grammY conversations plugin | grammY conversations plugin uses replay engine — explicitly NOT recommended for serverless (race conditions per official docs). Hand-rolled is simpler, predictable, and matches existing agent pattern. |
| Hand-rolled step dispatcher | Telegraf scenes/stages | Telegraf is a different framework from grammy; mixing frameworks is unnecessary. Telegraf scenes also have serverless caveats. |
| Single multi-message agent intro (step 6) | 12 individual ack steps (steps 6-17) | 12-step approach requires more session writes and a more complex FSM. Single step is simpler and still satisfies success criterion "introduces all 12 in sequential order." |
| Direct provision_company RPC call | calling createCompany Server Action | Cannot call Server Actions from the wizard's after() callback directly (Server Actions are form-bound). Call the RPC and auth.admin.createUser directly using the same pattern as createCompany, or extract shared business logic. |

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       └── telegram/
│           └── sihirbaz/
│               └── route.ts           # Existing skeleton — replace stub with dispatchSihirbazUpdate()
├── lib/
│   └── sihirbaz/
│       ├── dispatcher.ts              # dispatchSihirbazUpdate() — main entry point from route
│       ├── session.ts                 # Session load/create/update helpers (DB layer)
│       ├── steps.ts                   # Step handler functions (one per wizard step)
│       └── agents.ts                  # The 12 dijital calisanlar descriptions in Turkish
```

### Pattern 1: Step-Based FSM Dispatcher
**What:** The core wizard loop. Load session by chat_id, dispatch to step handler, save state.
**When to use:** Called from the `after()` callback in `sihirbaz/route.ts`.

```typescript
// src/lib/sihirbaz/dispatcher.ts
import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
import { loadOrCreateSession, updateSession } from './session'
import { handleStep } from './steps'
import { sendTelegramMessage } from '@/lib/telegram/send'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_SIHIRBAZ || ''

export async function dispatchSihirbazUpdate(update: Update): Promise<void> {
  // Only handle text messages (ignore photos, stickers, edits)
  const message = update.message
  if (!message?.text) return

  const chatId = message.chat.id
  const text = message.text.trim()

  const supabase = createServiceClient()

  try {
    // Load existing session OR handle /start with token
    const session = await loadOrCreateSession(supabase, chatId, text)

    if (!session) {
      // /start with invalid/expired token — or non-/start message with no session
      if (text.startsWith('/start')) {
        await sendTelegramMessage(
          chatId,
          'Bu davet linki artik gecerli degil.',
          BOT_TOKEN
        )
      }
      return
    }

    // Dispatch to the appropriate step handler
    await handleStep(supabase, session, chatId, text, BOT_TOKEN)
  } catch (err) {
    console.error('[sihirbaz] dispatch error:', err)
    await sendTelegramMessage(
      chatId,
      'Bir hata olustu. Lutfen tekrar deneyin.',
      BOT_TOKEN
    )
  }
}
```

### Pattern 2: Session Load / Create
**What:** On `/start {token}`: validate token, create session. On any other message: look up existing session by chat_id.
**When to use:** First thing in `dispatchSihirbazUpdate()`.

```typescript
// src/lib/sihirbaz/session.ts

import { SupabaseClient } from '@supabase/supabase-js'

export type WizardSession = {
  id: string
  company_id: string | null
  deep_link_token: string
  telegram_chat_id: number | null
  status: 'pending' | 'in_progress' | 'completed' | 'expired'
  collected_data: Record<string, unknown>
  step: number
}

export async function loadOrCreateSession(
  supabase: SupabaseClient,
  chatId: number,
  text: string
): Promise<WizardSession | null> {
  // Case 1: /start command with token — validate and create/update session
  if (text.startsWith('/start ')) {
    const rawToken = text.slice('/start '.length).trim()
    if (!rawToken) return null

    // SHA-256 hash the raw token to look up in onboarding_invites
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(rawToken)
    )
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Validate invite — must be unused and not expired
    const { data: invite } = await (supabase as any)
      .from('onboarding_invites')
      .select('id, company_id, expires_at, used_at, token_hash')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
      return null  // Invalid, used, or expired
    }

    // Check for existing session for this token (resume case)
    const { data: existingSession } = await supabase
      .from('onboarding_sessions')
      .select('*')
      .eq('deep_link_token', rawToken)
      .maybeSingle()

    if (existingSession) {
      // Update chat_id if not set (user restarted bot on new device)
      if (!existingSession.telegram_chat_id) {
        await supabase
          .from('onboarding_sessions')
          .update({ telegram_chat_id: chatId })
          .eq('id', existingSession.id)
      }
      return existingSession as WizardSession
    }

    // Create new session — token is valid, create session linked to company
    const { data: newSession } = await supabase
      .from('onboarding_sessions')
      .insert({
        company_id: invite.company_id,
        deep_link_token: rawToken,
        telegram_chat_id: chatId,
        status: 'in_progress',
        collected_data: {},
        step: 0,
      })
      .select()
      .single()

    // NOTE: Do NOT mark invite as used_at here — mark it at step 0 completion
    // (or mark immediately depending on design decision — see Open Questions)

    return newSession as WizardSession
  }

  // Case 2: Any other message — look up existing session by chat_id
  const { data: session } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return session as WizardSession | null
}

export async function updateSession(
  supabase: SupabaseClient,
  sessionId: string,
  patch: {
    step?: number
    collected_data?: Record<string, unknown>
    status?: 'in_progress' | 'completed' | 'expired'
    company_id?: string
    telegram_chat_id?: number
  }
): Promise<void> {
  await supabase
    .from('onboarding_sessions')
    .update(patch)
    .eq('id', sessionId)
}
```

### Pattern 3: Step Handler Dispatch
**What:** Each wizard step is a function that (1) validates/stores user input, (2) sends the next prompt, (3) advances the step counter.
**When to use:** Called from `dispatchSihirbazUpdate` after session is loaded.

```typescript
// src/lib/sihirbaz/steps.ts

// Step definitions:
// Step 0:  /start received — validate token, send welcome greeting
// Step 1:  Ask for firma adi, receive answer
// Step 2:  Ask for sektor, receive answer
// Step 3:  Ask for urun sayisi, receive answer
// Step 4:  Ask for bayi sayisi, receive answer
// Step 5:  Ask for beklentiler, receive answer
// Step 6:  Send all 12 agent introductions, ask for confirmation
// Step 7:  Receive confirmation (e.g. "Evet"), call provision_company, send completion
// Step 8+: Completed — ignore further messages (send "Kurulum tamamlandi" reminder)

import { SupabaseClient } from '@supabase/supabase-js'
import type { WizardSession } from './session'
import { updateSession } from './session'
import { AGENT_DESCRIPTIONS } from './agents'
import { sendTelegramMessage } from '@/lib/telegram/send'
import { createServiceClient } from '@/lib/supabase/service-client'

export async function handleStep(
  supabase: SupabaseClient,
  session: WizardSession,
  chatId: number,
  text: string,
  botToken: string
): Promise<void> {
  switch (session.step) {
    case 0:
      // Welcome — just received /start, session is new
      await sendTelegramMessage(
        chatId,
        'Hosgeldiniz! Ben Kurulum Sihirbazinim. Size sisteminizi kurmada yardimci olacagim.\n\nOnce birkaç bilgiye ihtiyacim var.\n\nFirmanizin adi nedir?',
        botToken
      )
      await updateSession(supabase, session.id, { step: 1 })
      break

    case 1:
      // Received firma adi
      await updateSession(supabase, session.id, {
        collected_data: { ...session.collected_data, firma_adi: text },
        step: 2,
      })
      await sendTelegramMessage(chatId, 'Hangi sektorde faaliyet gosteriyorsunuz? (Ornek: Gida, Tekstil, Elektronik)', botToken)
      break

    case 2:
      // Received sektor
      await updateSession(supabase, session.id, {
        collected_data: { ...session.collected_data, sektor: text },
        step: 3,
      })
      await sendTelegramMessage(chatId, 'Kac cesit urun satiyorsunuz? (Yaklasik sayi)', botToken)
      break

    // ... cases 3, 4, 5 follow same pattern

    case 6:
      // Send all 12 agent introductions
      const introText = AGENT_DESCRIPTIONS
        .map((a, i) => `${i + 1}. *${a.name}*\n${a.description}`)
        .join('\n\n')
      await sendTelegramMessage(
        chatId,
        `Sisteminizdeki 12 Dijital Calisaniniz:\n\n${introText}`,
        botToken
      )
      await sendTelegramMessage(
        chatId,
        'Kurulumu baslatmak istiyor musunuz? (Evet / Hayir)',
        botToken
      )
      await updateSession(supabase, session.id, { step: 7 })
      break

    case 7:
      // Confirmation step
      const confirmed = text.toLowerCase().includes('evet') || text === '1'
      if (!confirmed) {
        await sendTelegramMessage(chatId, 'Anlasildı. Kurulumu iptal ettiniz. Yeniden baslamak icin davet linkine tiklayin.', botToken)
        await updateSession(supabase, session.id, { status: 'expired' })
        return
      }
      // Proceed to provisioning — call provision logic
      await runProvisioning(supabase, session, chatId, botToken)
      break

    default:
      if (session.status === 'completed') {
        await sendTelegramMessage(chatId, 'Kurulum zaten tamamlandi. Web panelinize giris yapabilirsiniz.', botToken)
      }
      break
  }
}
```

### Pattern 4: Provisioning from Wizard (step 7 → completion)
**What:** After user confirms, the wizard must create the company (auth user + RPC + send credentials).
**Critical insight:** The company was already created by the superadmin in Phase 15! The `onboarding_sessions.company_id` is already set when the session is created (from the invite's `company_id`). The admin auth user was created by the superadmin's `createCompany` action and the temp password was shown to the superadmin.

**Re-reading the requirements:** KS-05 says "Sihirbaz toplanan bilgilerle sistemi tek atomik islemde kurar (company + users + agent_definitions + subscription)" — BUT KS-05 is already marked DONE from Phase 15. The `provision_company` RPC was already called when the superadmin created the company via the web UI.

**Therefore:** The wizard's "provisioning" step is NOT creating a new company. The company already exists. The wizard's final step is:
1. Update `onboarding_sessions.collected_data` with all collected info (firma_adi, sektor, urun_sayisi, bayi_sayisi, beklentiler)
2. Update the company record's `settings` with collected data (optional enhancement)
3. Send the completion message with web panel URL and temp password (KS-06)
4. Mark session as `completed`

**The temp password and web panel URL problem:** The wizard cannot retrieve the temp password because it was generated ephemerally by `createCompany` and never stored in the DB (only shown once in the superadmin UI). This is a design gap that must be resolved. See Open Questions.

```typescript
// runProvisioning is really runCompletion for the wizard
async function runProvisioning(
  supabase: SupabaseClient,
  session: WizardSession,
  chatId: number,
  botToken: string
): Promise<void> {
  // The company already exists (company_id is on the session)
  // Collected data is in session.collected_data

  // Update company settings with collected data (optional)
  if (session.company_id) {
    await supabase
      .from('companies')
      .update({
        settings: {
          sektor: session.collected_data.sektor,
          urun_sayisi: session.collected_data.urun_sayisi,
          bayi_sayisi: session.collected_data.bayi_sayisi,
          beklentiler: session.collected_data.beklentiler,
          onboarding_completed_at: new Date().toISOString(),
        },
      })
      .eq('id', session.company_id)
  }

  // Mark session as completed
  await updateSession(supabase, session.id, { status: 'completed' })

  // KS-06: Send web panel URL + temp password
  const webPanelUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bayi-yonetimi.vercel.app'
  // NOTE: temp password must be retrievable — see Open Questions for solution

  await sendTelegramMessage(
    chatId,
    `Kurulum tamamlandi! \n\nWeb panelinize giris yapin:\n${webPanelUrl}\n\nGecici sifreniz: [bkz. Open Questions]\n\nIlk giriste sifreyi degistirmenizi oneririz.`,
    botToken
  )
}
```

### Pattern 5: Agent Introductions Data File
**What:** The 12 dijital calisanlar with Turkish names and descriptions.
**When to use:** Referenced in step 6 handler.

```typescript
// src/lib/sihirbaz/agents.ts

export const AGENT_DESCRIPTIONS: { name: string; description: string; role: string }[] = [
  {
    role: 'egitimci',
    name: 'Egitimci',
    description: 'Bayilerinize urun bilgisi ve satis teknikleri konusunda anlik egitim verir.',
  },
  {
    role: 'satis_temsilcisi',
    name: 'Satis Temsilcisi',
    description: 'Bayi siparislerini alir, urun onerilerinde bulunur ve kampanyalari duyurur.',
  },
  {
    role: 'muhasebeci',
    name: 'Muhasebeci',
    description: 'Bakiye sorgulama, fatura takibi ve borc durumu konularinda bilgi verir.',
  },
  {
    role: 'depo_sorumlusu',
    name: 'Depo Sorumlusu',
    description: 'Stok durumunu gercek zamanli olarak bildirir ve stok uyarilarini iletir.',
  },
  {
    role: 'genel_mudur_danismani',
    name: 'Genel Mudur Danismani',
    description: 'Firma yoneticilerine ozet raporlar ve stratejik oneriler sunar.',
  },
  {
    role: 'tahsilat_uzmani',
    name: 'Tahsilat Uzmani',
    description: 'Vadesi gelen odemeler icin bayileri bilgilendirir ve tahsilat surecini takip eder.',
  },
  {
    role: 'dagitim_koordinatoru',
    name: 'Dagitim Koordinatoru',
    description: 'Teslimat planlama, rota optimizasyonu ve dagitim takibini yonetir.',
  },
  {
    role: 'saha_satis',
    name: 'Saha Satis Temsilcisi',
    description: 'Saha ekibinin ziyaret planlamasina ve musteri gorusmelerine destek olur.',
  },
  {
    role: 'pazarlamaci',
    name: 'Pazarlamaci',
    description: 'Kampanya hazirlar, bayi segmentasyonu yapar ve promosyon bildirimlerini gonderir.',
  },
  {
    role: 'urun_yoneticisi',
    name: 'Urun Yoneticisi',
    description: 'Urun katalogunu gunceller, fiyat listelerini duzenler ve yeni urun tanıtımı yapar.',
  },
  {
    role: 'satin_alma',
    name: 'Satin Alma Uzmani',
    description: 'Tedarikci siparislerini koordine eder ve optimal satin alma miktarlarini hesaplar.',
  },
  {
    role: 'iade_kalite',
    name: 'Iade ve Kalite Sorumlusu',
    description: 'Iade taleplerini alir, kalite sikavetlerini kayıt altına alir ve cozum surecini takip eder.',
  },
]
```

**Note:** These descriptions are placeholders. The actual Turkish copy for each agent should be reviewed for accuracy. The requirement says "kisa Turkce aciklama" — one sentence each is sufficient.

### Pattern 6: Updating sihirbaz/route.ts to Call Dispatcher
**What:** Replace the Phase 15 stub in the `after()` callback with a call to `dispatchSihirbazUpdate()`.
**When to use:** After `dispatchSihirbazUpdate` is implemented.

```typescript
// src/app/api/telegram/sihirbaz/route.ts — updated after() callback
import { dispatchSihirbazUpdate } from '@/lib/sihirbaz/dispatcher'

after(async () => {
  try {
    await dispatchSihirbazUpdate(update)
  } catch (err) {
    console.error('[telegram/sihirbaz] dispatch error:', err)
  }
})
```

### Anti-Patterns to Avoid
- **Using grammY conversations plugin:** The replay engine is not safe for serverless. Use hand-rolled step dispatch.
- **Loading session by token hash on every message:** Token hash lookup is expensive and only needed on `/start`. After first contact, look up session by `telegram_chat_id`.
- **Calling createCompany Server Action from the wizard:** Server Actions are form-bound and cannot be called from non-form contexts. Extract the provisioning logic into a shared utility or call the RPC and auth API directly.
- **Sending all 12 agent messages in separate Telegram API calls from a loop without checking Telegram rate limits:** Telegram allows ~30 messages/second per bot. 12 messages in rapid succession is fine but should still be sent with brief pauses or combined into 2-3 messages if the full text exceeds 4096 chars.
- **Not checking Telegram 4096-char message limit:** If the combined agent intro text exceeds 4096 characters, split into 2 messages. Telegram silently truncates or returns an error on oversized messages.
- **Storing the raw token in onboarding_sessions.deep_link_token:** Wait — the schema uses `deep_link_token TEXT NOT NULL UNIQUE` as the raw token (not the hash). The hash is what's stored in `onboarding_invites.token_hash`. The session table stores the raw token for resume lookup. This is consistent with the Phase 15 design.
- **Marking invite as used_at before creating session:** Race condition risk. Mark `used_at = NOW()` when session is created (or when step 0 completes), not when the invite is first queried.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram message sending | Custom fetch wrapper with retry | `src/lib/telegram/send.ts` (already exists) | Built in Phase 15 — simple and correct |
| Token hashing | Custom crypto wrapper | `crypto.subtle.digest('SHA-256', ...)` + Web Crypto API (same as Phase 15 token generation) | Consistent with how tokens were generated |
| Session persistence | In-memory map or custom DB adapter | `onboarding_sessions` table via service role supabase-js | Table exists with all needed columns including `step`, `collected_data`, `status` |
| Company provisioning | Direct table inserts | Already done by Phase 15's `provision_company` RPC — company exists when wizard runs | KS-05 is already DONE |
| State machine framework | Install XState or similar | Plain switch/case on `session.step` | Overkill for a linear 8-step wizard; switch/case is readable and testable |

**Key insight:** The DB already has the perfect schema for this wizard. The `onboarding_sessions` table was designed specifically for this FSM. Use it as-is.

---

## Common Pitfalls

### Pitfall 1: Temp Password Not Stored — KS-06 Cannot Be Fulfilled As Designed
**What goes wrong:** KS-06 requires the wizard to send the temp password to the company owner via Telegram after confirmation. However, Phase 15's `createCompany` Server Action generates the temp password ephemerally and only shows it in the superadmin UI — it is never stored in the database (by design, for security).
**Why it happens:** The original Phase 15 design assumed KS-06 would be handled when the wizard completes — but the wizard runs after the superadmin has already set up the company, and the temp password is no longer accessible.
**How to avoid:** Two options:
  1. **(Recommended)** Store the hashed temp password in `onboarding_sessions.collected_data` when the invite is created by the superadmin. The superadmin copies the password from the UI, but the wizard can display a stored version. Since the password is temporary and the user will change it on first login, storing it in collected_data is acceptable.
  2. **Alternative:** Generate a NEW password for the company owner when the wizard completes, using `auth.admin.updateUserById()` to update the existing auth user's password. The wizard knows `company_id → users.id` via the DB.

  Option 2 is cleanest — the wizard generates a fresh temp password at completion, updates the auth user, and sends it in the completion message. This avoids any password storage concern.
**Warning signs:** Completion message cannot include a password — user can't log in to the web panel.

### Pitfall 2: Telegram 4096-Character Message Limit
**What goes wrong:** The combined text of all 12 agent descriptions may exceed Telegram's 4096-character limit for a single message. Sending oversized text returns a 400 error from Telegram.
**Why it happens:** 12 agents × ~100 chars each = ~1200 chars, plus headers and formatting. Unlikely to exceed 4096 in plain text, but with emoji or markdown it can grow.
**How to avoid:** Measure the combined string length before sending. If > 3800 chars (safety margin), split into two messages. Or always send as 2 messages (6 agents each).
**Warning signs:** `sendTelegramMessage` returns `false` with a 400 error status for the agent intro step.

### Pitfall 3: Session Lookup Race Condition on /start
**What goes wrong:** A user clicks the deep link twice in quick succession. Two concurrent webhook requests both try to create a new `onboarding_sessions` row for the same token. The second insert fails with a UNIQUE constraint violation on `deep_link_token`.
**Why it happens:** The `onboarding_sessions` table has `UNIQUE` on `deep_link_token`. The insert-if-not-exists pattern is not atomic without a DB-level lock.
**How to avoid:** Use `INSERT ... ON CONFLICT (deep_link_token) DO NOTHING` with a follow-up SELECT, or use `maybeSingle()` with error handling for `23505`. The idempotency table (`processed_telegram_updates`) already deduplicates at the webhook level — duplicate update_id returns 200 immediately without reaching the dispatcher.
**Warning signs:** Rare duplicate session creation errors in logs. The idempotency check in the route should prevent this in practice, but the insert should still handle it defensively.

### Pitfall 4: /start Message Parsing Edge Cases
**What goes wrong:** The Telegram update text for a deep link click is `/start {token}` with a space. If the bot username is included (group chats), it's `/start@BotUsername {token}`. The token extraction logic must handle both.
**Why it happens:** Telegram sends `/start@BotUsername` prefix in group chats.
**How to avoid:** The wizard is private-chat only (user clicks a personal invite link). Deep links always open in private chat. Group invite links use `?startgroup=` not `?start=`. Safe to parse `/start ` prefix only in private chats. But defensively: `text.split(' ')[1]` handles both `/start TOKEN` and any edge case.
**Warning signs:** Token extraction returns undefined for some users.

### Pitfall 5: Completed Session Receives /start Again
**What goes wrong:** After completion, if the superadmin sends the same invite link to the user again (e.g., for support), the user clicks it and the wizard restarts but the session shows `status: completed`.
**Why it happens:** `loadOrCreateSession` finds existing session with same token — it's completed, so the bot should not restart the wizard.
**How to avoid:** In `loadOrCreateSession`, if existing session is `completed`, return a special indicator (or null) and send "Kurulum tamamlandi" message in dispatcher. The invite's `used_at` should be set at session creation, preventing new sessions from being created for the same token.
**Warning signs:** User who completed onboarding is asked for firma adi again.

### Pitfall 6: collected_data JSONB Merge Pattern
**What goes wrong:** Each step does `{ ...session.collected_data, new_key: value }` spread to update collected_data. If the session was loaded with stale data between two rapid messages, a spread overwrites a previous step's data.
**Why it happens:** After() calls are sequential (not parallel) for the same chat_id because Telegram sends updates sequentially and the idempotency table prevents duplicates. In practice, spread overwrites are not an issue.
**How to avoid:** Use Postgres's JSONB merge operator at the DB level instead: `jsonb_set()` or `UPDATE ... SET collected_data = collected_data || '{"key": "value"}'::jsonb`. This avoids the full read-modify-write cycle.
**Warning signs:** Rare data loss when two messages arrive very quickly (uncommon with human users, impossible with Telegram's sequential delivery).

---

## Code Examples

Verified patterns from existing codebase:

### Token Extraction from /start Message
```typescript
// Source: Telegram Bot API docs — deep link delivers "/start {token}" as message text
// Source: sihirbaz/route.ts — update.message?.text extraction pattern

const message = update.message
if (!message?.text) return

const text = message.text.trim()
// Extract token: "/start abc123" → "abc123"
const startToken = text.startsWith('/start ') ? text.slice('/start '.length).trim() : null
```

### SHA-256 Token Validation (matching Phase 15 generation)
```typescript
// Source: src/lib/actions/superadmin.ts — identical hash algorithm to token generation
// Must produce identical hash to match stored token_hash in onboarding_invites

const hashBuffer = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(rawToken)
)
const tokenHash = Array.from(new Uint8Array(hashBuffer))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('')
```

### Session Update with Step Advance
```typescript
// Source: database.types.ts — OnboardingSessionUpdate type
// Service role bypasses RLS — no auth context needed

const supabase = createServiceClient()
await supabase
  .from('onboarding_sessions')
  .update({
    step: session.step + 1,
    collected_data: { ...session.collected_data, firma_adi: text },
  })
  .eq('id', session.id)
```

### Generating and Setting a New Temp Password at Wizard Completion
```typescript
// Source: src/lib/actions/superadmin.ts — auth.admin.updateUserById pattern
// Called at step 7 (confirmation) — generates a fresh password for the owner

const serviceClient = createServiceClient()
const newTempPassword = crypto.randomUUID().slice(0, 12)

// Look up the company's admin user ID
const { data: adminUser } = await serviceClient
  .from('users')
  .select('id')
  .eq('company_id', session.company_id)
  .eq('role', 'admin')
  .single()

if (adminUser) {
  await serviceClient.auth.admin.updateUserById(adminUser.id, {
    password: newTempPassword,
  })
}

// Now send temp password in completion message
await sendTelegramMessage(chatId, `Gecici sifreniz: ${newTempPassword}`, botToken)
```

### onboarding_invites used_at Mark
```typescript
// Mark invite as used when session is created (prevents double-use even if idempotency dedup fails)
await (supabase as any)
  .from('onboarding_invites')
  .update({ used_at: new Date().toISOString() })
  .eq('token_hash', tokenHash)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| grammY conversations plugin for wizard flows | Hand-rolled step dispatch with DB-backed session | Current recommendation (grammY docs warn against serverless) | Simpler, no replay engine, works perfectly in after() context |
| Storing full conversation history for wizard | Storing only collected_data + step integer | This phase | Wizard doesn't need Claude — collected_data is all that's needed |

**Deprecated/outdated:**
- `useFormState` (React): replaced by `useActionState` in React 19 — already addressed in Phase 15
- grammY conversations plugin in serverless: officially not recommended — hand-rolled dispatcher is the correct approach

---

## Open Questions

1. **Temp Password for KS-06 Completion Message**
   - What we know: `createCompany` generates temp password ephemerally, shows it in superadmin UI, never stores it in DB. The wizard cannot retrieve it.
   - What's unclear: Should the wizard regenerate a new temp password (using `auth.admin.updateUserById`) or should Phase 15's design be retroactively changed to store a hashed/encrypted temp password?
   - Recommendation: **Generate a fresh temp password at wizard completion step.** Call `auth.admin.updateUserById(adminUserId, { password: newTempPassword })`. This is clean, secure, and doesn't require changing Phase 15. The admin user's password simply gets replaced with a new temp password at wizard completion. Plan task must handle the case where `company_id` is null on session (shouldn't happen if session was created from invite, but defensive check needed).

2. **When to Mark invite.used_at**
   - What we know: If `used_at` is marked when the invite is first validated (session creation), a second `/start` click with the same token finds `used_at IS NOT NULL` and returns "gecerli degil". This is the correct single-use behavior.
   - What's unclear: If the user exits the bot immediately after `/start` (before completing step 0), and then clicks the link again — they should be able to resume. But with `used_at` marked, the invite validation returns null.
   - Recommendation: **Mark `used_at` when session is created** (not when /start is processed). On a subsequent `/start` with the same token: the session lookup by `deep_link_token` finds the existing session and resumes it — the invite validation path is only taken when no existing session exists for that token. Implement `loadOrCreateSession` to check for existing session BEFORE checking used_at on invite.

3. **Agent Introduction Format — Single Message vs Multiple**
   - What we know: 12 agents × ~80-100 chars each = ~1000-1200 chars in plain text. Well under 4096.
   - What's unclear: Should each agent get its own Telegram message (12 API calls) or all in one?
   - Recommendation: **Single message** for the full list, with a follow-up message asking for confirmation. This is simpler and less likely to trigger Telegram rate limits. If the text grows, split at 6+6. The success criterion says "sequential order" not "12 separate messages."

4. **collected_data Schema for Provisioning**
   - What we know: The wizard collects firma_adi, sektor, urun_sayisi, bayi_sayisi, beklentiler. The company already exists (created by superadmin). `sektor` is currently only stored in the audit log (not in the companies table — the companies table has no `sektor` column).
   - What's unclear: Should the wizard update the company's `settings` JSONB with the collected data (sektor, etc.)?
   - Recommendation: **Yes — update companies.settings with collected_data at wizard completion.** This makes the collected information accessible from the web panel later. Schema: `settings = { sektor, urun_sayisi, bayi_sayisi, beklentiler, onboarding_completed_at }`.

---

## Sources

### Primary (HIGH confidence)
- `/home/cagr/Masaüstü/bayi-yönetimi/supabase/migrations/012_v4_schema_foundation.sql` — `onboarding_sessions` and `onboarding_invites` table schemas (confirmed columns: `step`, `collected_data`, `status`, `deep_link_token`, `telegram_chat_id`, `company_id`)
- `/home/cagr/Masaüstü/bayi-yönetimi/supabase/migrations/013_provision_company_rpc.sql` — confirmed `provision_company` RPC signature and that `p_sektor` is accepted but not stored in companies table
- `/home/cagr/Masaüstü/bayi-yönetimi/src/types/database.types.ts` — confirmed `onboarding_sessions` Row/Insert/Update types, `OnboardingSession` export alias
- `/home/cagr/Masaüstü/bayi-yönetimi/src/lib/actions/superadmin.ts` — createCompany pattern, token generation (SHA-256), generateInviteTokenAndLink helper
- `/home/cagr/Masaüstü/bayi-yönetimi/src/lib/telegram/send.ts` — sendTelegramMessage signature `(chatId: number, text: string, botToken: string) => Promise<boolean>`
- `/home/cagr/Masaüstü/bayi-yönetimi/src/app/api/telegram/sihirbaz/route.ts` — confirmed webhook skeleton with after() + idempotency pattern ready for dispatchSihirbazUpdate()
- `/home/cagr/Masaüstü/bayi-yönetimi/src/lib/agents/dispatcher.ts` — confirmed Update extraction pattern: `update.message?.text`, `message.chat.id`, `message.from?.id`
- `/home/cagr/Masaüstü/bayi-yönetimi/node_modules/@grammyjs/types/update.d.ts` — confirmed `Update.message` type is `Message & Update.NonChannel` with `text?: string` field
- `/home/cagr/Masaüstü/bayi-yönetimi/package.json` — confirmed `grammy: ^1.41.0` already installed
- https://core.telegram.org/bots/features#deep-linking — confirmed `/start {token}` format, 64-char limit, private chat only
- https://grammy.dev/plugins/conversations — confirmed conversations plugin is not recommended for serverless (replay engine + race conditions)

### Secondary (MEDIUM confidence)
- https://grammy.dev/hosting/vercel — grammY on serverless/Vercel context, webhook compatibility

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries needed, all verified in package.json and existing codebase
- Architecture (FSM design): HIGH — onboarding_sessions table design directly maps to step machine; dispatcher pattern verified against existing agent dispatcher
- Temp password gap (KS-06): HIGH (gap identified) / MEDIUM (recommended solution) — the gap is confirmed; `auth.admin.updateUserById` solution is reasonable but not tested in this codebase
- Agent descriptions: LOW — Turkish copy placeholder only; actual content needs business review
- Pitfalls: HIGH — derived from existing codebase patterns and confirmed schema constraints

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable — Telegram Bot API, supabase-js, Next.js patterns)
