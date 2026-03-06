/**
 * Telegram Webhook Route — /api/telegram/sihirbaz
 *
 * Dedicated webhook for the Kurulum Sihirbazi (Setup Wizard) bot.
 * This is NOT an AI agent — it is a conversational onboarding wizard.
 *
 * Phase 15: Route skeleton with idempotency — logs receipt only.
 * Phase 16: WizardOrchestrator FSM — full conversational onboarding.
 *
 * Protocol (identical to all 12 agent routes):
 * 1. Parse incoming Update from Telegram
 * 2. Check idempotency via processed_telegram_updates (UNIQUE on update_id)
 * 3. Register background processing via after() — runs AFTER 200 response
 * 4. Return HTTP 200 immediately so Telegram stops retrying
 */
import { after } from 'next/server'
import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
import { dispatchSihirbazUpdate } from '@/lib/sihirbaz/dispatcher'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let update: Update
  try {
    update = (await request.json()) as Update
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const supabase = createServiceClient()
  const { error: idempotencyError } = await supabase
    .from('processed_telegram_updates')
    .insert({ update_id: update.update_id })

  if (idempotencyError) {
    if (idempotencyError.code === '23505') {
      return new Response('OK', { status: 200 })
    }
    console.error('[telegram/sihirbaz] idempotency insert error:', idempotencyError)
  }

  after(async () => {
    try {
      await dispatchSihirbazUpdate(update)
    } catch (err) {
      console.error('[telegram/sihirbaz] dispatch error:', err)
    }
  })

  return new Response('OK', { status: 200 })
}
