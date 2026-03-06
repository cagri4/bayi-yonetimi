/**
 * Kurulum Sihirbazi — Wizard Dispatcher
 *
 * Main entry point for processing Telegram updates received by the sihirbaz webhook route.
 * Called inside the after() callback so it runs after the 200 response is sent to Telegram.
 *
 * Dispatch flow:
 * 1. Extract message text from update (ignore non-text updates silently)
 * 2. Load or create wizard session from invite token or existing chat_id
 * 3. Handle terminal states (null session, completed, expired) without calling handleStep
 * 4. Delegate to handleStep for active sessions
 *
 * Phase 16: WizardOrchestrator FSM — full conversational onboarding.
 */

import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
import { loadOrCreateSession } from './session'
import { handleStep } from './steps'
import { sendTelegramMessage } from '@/lib/telegram/send'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_SIHIRBAZ || ''

/**
 * Processes a single Telegram update from the sihirbaz bot.
 * Returns void — all responses are sent via Telegram API directly.
 */
export async function dispatchSihirbazUpdate(update: Update): Promise<void> {
  // Ignore non-message updates (callback queries, inline queries, edited messages, etc.)
  const message = update.message
  if (!message || !message.text) {
    return
  }

  const chatId = message.chat.id
  const text = message.text.trim()

  const supabase = createServiceClient()

  try {
    // Load or create wizard session from token (/start) or chat_id (ongoing session)
    const session = await loadOrCreateSession(supabase, chatId, text)

    // No session — either invalid/expired invite token, or non-/start with no active session
    if (session === null) {
      if (text.startsWith('/start')) {
        // /start with invalid or expired token
        await sendTelegramMessage(
          chatId,
          'Bu davet linki artik gecerli degil. Lutfen yetkilinizden yeni bir davet linki isteyin.',
          BOT_TOKEN
        )
      } else {
        // Non-/start message from unknown user with no active session
        await sendTelegramMessage(
          chatId,
          'Merhaba! Sisteme kayit olmak icin bir davet linkine ihtiyaciniz var. Lutfen firma yetkilinize basvurun.',
          BOT_TOKEN
        )
      }
      return
    }

    // Terminal state: completed — do not advance the FSM
    if (session.status === 'completed') {
      await sendTelegramMessage(
        chatId,
        'Kurulum zaten tamamlandi. Web panelinize giris yapabilirsiniz.',
        BOT_TOKEN
      )
      return
    }

    // Terminal state: expired — do not advance the FSM
    if (session.status === 'expired') {
      await sendTelegramMessage(
        chatId,
        'Bu kurulum sureci sona erdi. Yeni bir davet linki icin yetkilinize basvurun.',
        BOT_TOKEN
      )
      return
    }

    // Active session — delegate to step handler
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
