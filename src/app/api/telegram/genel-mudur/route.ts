/**
 * Telegram Webhook Route — /api/telegram/genel-mudur
 *
 * Dedicated webhook for the Genel Mudur Danismani (Executive Advisor) agent bot.
 * Identical protocol to the base /api/telegram route with two differences:
 * 1. Uses TELEGRAM_BOT_TOKEN_GENEL_MUDUR env var for the Genel Mudur Danismani bot
 * 2. Passes 'genel_mudur_danismani' as forcedRole — no agent_definitions role lookup needed
 *
 * Note: URL path uses shortened kebab-case (genel-mudur) but the role enum is full
 * (genel_mudur_danismani) — this is intentional; full role names are reserved for
 * DB/code while URL paths are kept concise.
 *
 * Protocol:
 * 1. Parse incoming Update from Telegram
 * 2. Check idempotency via processed_telegram_updates (UNIQUE on update_id)
 * 3. Register background dispatch via after() — runs AFTER 200 response is sent
 * 4. Return HTTP 200 immediately so Telegram stops retrying
 *
 * GM-04: Cross-domain analysis using Sonnet 4.6 for complex reasoning.
 * AI-04: Immediate 200 response + after() background processing (Fluid Compute)
 * AI-05: Idempotency via processed_telegram_updates UNIQUE constraint (error code 23505)
 */
import { after } from 'next/server'
import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
import { dispatchAgentUpdate } from '@/lib/agents/dispatcher'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  // Step 1: Parse request body as Update
  let update: Update
  try {
    update = (await request.json()) as Update
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Step 2: Idempotency check — insert into processed_telegram_updates
  // This INSERT runs synchronously before the response is sent.
  // On duplicate update_id (23505 unique_violation), silently return 200 to stop Telegram retries.
  const supabase = createServiceClient()
  const { error: idempotencyError } = await supabase
    .from('processed_telegram_updates')
    .insert({ update_id: update.update_id })

  if (idempotencyError) {
    if (idempotencyError.code === '23505') {
      // Duplicate update — already processed, silently acknowledge
      return new Response('OK', { status: 200 })
    }
    // Other DB error — log but still return 200 to prevent Telegram retry storm
    console.error('[telegram/genel-mudur] idempotency insert error:', idempotencyError)
  }

  // Step 3: Schedule background dispatch via after()
  // dispatchAgentUpdate runs AFTER the 200 response is sent to Telegram.
  // forcedRole='genel_mudur_danismani' routes to Genel Mudur tool set without agent_definitions lookup.
  // Note: URL uses shortened kebab-case (genel-mudur); role enum is full (genel_mudur_danismani).
  const botToken = process.env.TELEGRAM_BOT_TOKEN_GENEL_MUDUR || ''

  after(async () => {
    try {
      await dispatchAgentUpdate(update, 'genel_mudur_danismani', botToken)
    } catch (err) {
      console.error('[telegram/genel-mudur] dispatch error:', err)
    }
  })

  // Step 4: Return 200 immediately — Telegram requires fast acknowledgment
  return new Response('OK', { status: 200 })
}
