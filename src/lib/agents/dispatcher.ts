/**
 * Agent Dispatcher — orchestrates the full agent conversation flow.
 *
 * Called from the Telegram webhook route via after(). Runs in background
 * after the HTTP 200 response has been sent to Telegram.
 *
 * Responsibilities:
 * 1. Extract the incoming message from the Telegram Update
 * 2. Resolve dealer identity via telegram_chat_id
 * 3. Determine agent role (from forcedRole or agent_definitions query)
 * 4. Check token budget before running agent
 * 5. Load conversation history via ConversationManager
 * 6. Build and run AgentRunner with role-specific tool handlers
 * 7. Save agent reply and send it back to Telegram
 *
 * Error handling: all errors are caught; a Turkish fallback is sent to the user.
 * Each webhook route passes its own bot token so replies go through the correct bot.
 */
import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
import { AgentRunner } from './agent-runner'
import { ConversationManager } from './conversation-manager'
import { TokenBudget } from './token-budget'
import { ToolRegistry } from './tool-registry'
import { buildHandlersForRole } from './handler-factory'
import type { AgentContext, AgentRole } from './types'

// ─── Telegram Helper ─────────────────────────────────────────────────────────

/**
 * Attempts a single Telegram sendMessage API call.
 * Returns the HTTP response, or throws on network error.
 */
async function attemptTelegramSend(
  chatId: number,
  text: string,
  token: string
): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

/**
 * Sends a text message to a Telegram chat with exponential backoff retry.
 *
 * Retry policy:
 * - Max 3 retries (4 total attempts)
 * - Exponential backoff: 1s, 2s, 4s between attempts
 * - 4xx errors (except 429 rate limit) are NOT retried — permanent failures
 * - 429 respects Telegram's Retry-After header when present
 * - Network errors are retried with backoff
 *
 * Runs inside after() — retries do NOT block the webhook 200 response.
 *
 * @param chatId - Telegram chat ID to send message to
 * @param text - Message text to send
 * @param token - Bot token for the sending bot
 * @param maxRetries - Maximum number of retries (default 3)
 * @param baseDelayMs - Base delay in ms for backoff calculation (default 1000)
 * @returns true if message was sent successfully, false otherwise
 */
async function sendWithRetry(
  chatId: number,
  text: string,
  token: string,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await attemptTelegramSend(chatId, text, token)

      if (response.ok) return true

      // Don't retry on 4xx client errors (bad request, unauthorized, etc.)
      // except 429 (rate limited by Telegram)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error(`[telegram] Non-retryable error ${response.status} for chat ${chatId}`)
        return false
      }

      // For 429, use Telegram's Retry-After header if available
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : baseDelayMs * Math.pow(2, attempt)
        if (attempt < maxRetries) {
          console.warn(
            `[telegram] Rate limited (429), retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`
          )
          await new Promise((r) => setTimeout(r, waitMs))
          continue
        }
        console.error(`[telegram] Rate limited (429) — exhausted all ${maxRetries + 1} attempts for chat ${chatId}`)
        return false
      }

      // 5xx server errors — retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) // 1s, 2s, 4s
        console.warn(
          `[telegram] Attempt ${attempt + 1} failed (${response.status}), retrying in ${delay}ms`
        )
        await new Promise((r) => setTimeout(r, delay))
      } else {
        const body = await response.text()
        console.error(
          `[telegram] All ${maxRetries + 1} attempts failed for chat ${chatId} — status: ${response.status}, body: ${body}`
        )
      }
    } catch (error) {
      // Network errors — retry with exponential backoff
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.warn(
          `[telegram] Attempt ${attempt + 1} failed (network error), retrying in ${delay}ms`
        )
        await new Promise((r) => setTimeout(r, delay))
      } else {
        console.error(
          `[telegram] All ${maxRetries + 1} attempts failed for chat ${chatId}`,
          error
        )
      }
    }
  }
  return false
}

/**
 * Sends a text message to a Telegram chat via the Bot API.
 * Accepts a token parameter so each bot uses its own bot token.
 * Retries up to 3 times with exponential backoff on transient failures.
 * Logs errors but never throws — the caller continues regardless.
 *
 * Note: parse_mode is intentionally omitted to avoid Telegram 400 errors
 * caused by Claude's unbalanced markdown output (Pitfall 6).
 */
async function sendTelegramMessage(chatId: number, text: string, token: string): Promise<void> {
  if (!token) {
    console.error('[dispatcher] No bot token provided — cannot send message')
    return
  }

  await sendWithRetry(chatId, text, token)
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

/**
 * Orchestrates the full agent pipeline for a single Telegram Update.
 *
 * Called from the webhook route's after() callback. Has up to 300 seconds
 * on Vercel Fluid Compute to complete.
 *
 * @param update - The Telegram Update object parsed from the webhook request body
 * @param forcedRole - When set, skips role detection from agent_definitions and
 *   uses this role directly. Each dedicated webhook route passes its role here.
 *   When absent, the original behavior is preserved: first active agent_definition
 *   for the company determines the role (Phase 9 fallback).
 * @param botToken - The bot token used to send replies back via Telegram API.
 *   Each dedicated webhook route passes its own token. Falls back to
 *   process.env.TELEGRAM_BOT_TOKEN if not provided (backward compatibility).
 */
export async function dispatchAgentUpdate(
  update: Update,
  forcedRole?: AgentRole,
  botToken?: string
): Promise<void> {
  // Extract message — ignore non-text updates (edits, callbacks, media, etc.)
  const message = update.message
  if (!message || !message.text) {
    return
  }

  const chatId = message.chat.id
  const text = message.text
  const telegramUserId = message.from?.id

  // Resolve the bot token: prefer the passed-in token, fall back to env var
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN || ''
  if (!token) {
    console.error('[dispatcher] No bot token provided — cannot send replies')
    return
  }

  // Log for observability
  console.log(
    `[dispatcher] incoming message from chatId=${chatId} telegramUserId=${telegramUserId ?? 'unknown'}`
  )

  try {
    const supabase = createServiceClient()

    // ── Step 1: Resolve dealer identity ──────────────────────────────────────

    const { data: dealer, error: dealerError } = await supabase
      .from('dealers')
      .select('id, company_id, company_name')
      .eq('telegram_chat_id', chatId)
      .eq('is_active', true)
      .maybeSingle()

    if (dealerError) {
      console.error('[dispatcher] dealer lookup error:', dealerError.message)
    }

    if (!dealer) {
      // Unregistered chat — prompt the user to link their account
      await sendTelegramMessage(
        chatId,
        'Bu bot\'u kullanmak icin hesabinizi baglayiniz. Bayi panelinizden Telegram entegrasyonunu tamamlayin.',
        token
      )
      return
    }

    const dealerId = dealer.id
    const companyId = dealer.company_id

    // ── Step 2: Determine agent role ──────────────────────────────────────────
    // If forcedRole is provided (dedicated webhook routes), use it directly.
    // Otherwise query agent_definitions for role detection (Phase 9 single-bot behavior).

    let role: AgentRole = forcedRole || 'destek'

    const { data: agentDefs, error: agentDefsError } = await supabase
      .from('agent_definitions')
      .select('role, system_prompt, model')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('role', role)
      .limit(1)

    if (agentDefsError) {
      console.error('[dispatcher] agent_definitions lookup error:', agentDefsError.message)
    }

    let systemPrompt =
      'Sen bir bayi yardim asistanisin. Turkce cevap ver. Bayi sorularina yardimci ol.'

    if (agentDefs && agentDefs.length > 0) {
      const def = agentDefs[0]
      if (!forcedRole) role = def.role as AgentRole
      systemPrompt = def.system_prompt
    }

    // ── Step 3: Check token budget ────────────────────────────────────────────

    const tokenBudget = new TokenBudget()
    const budgetCheck = await tokenBudget.checkBudget(dealerId)

    if (!budgetCheck.allowed) {
      await sendTelegramMessage(chatId, budgetCheck.reason ?? 'Gunluk limitinize ulastiniz.', token)
      return
    }

    // ── Step 4: Load conversation history ─────────────────────────────────────

    const conversationManager = new ConversationManager()

    const conversationId = await conversationManager.getOrCreateConversation({
      companyId,
      dealerId,
      agentRole: role,
      telegramChatId: chatId,
    })

    // Save the incoming user message before loading history
    await conversationManager.saveMessage(conversationId, 'user', text)

    // Load message history (rolling 50, excludes system summaries)
    const messages = await conversationManager.getMessages(conversationId)

    // ── Step 5: Build tool handlers per role ───────────────────────────────────
    // Phase 12: all roles use buildHandlersForRole from handler-factory (single source of truth).

    const toolRegistry = new ToolRegistry()
    const tools = toolRegistry.getToolsWithCaching(role)

    const toolHandlers = buildHandlersForRole(role, supabase)

    // ── Step 6: Build AgentContext and run AgentRunner ────────────────────────

    const context: AgentContext = {
      companyId,
      dealerId,
      conversationId,
      agentRole: role,
      telegramChatId: chatId,
      callStack: [role],
      depth: 0,
    }

    // Retrieve the model from ToolRegistry (AGENT_MODELS map)
    const model = toolRegistry.getModel(role)

    const runner = new AgentRunner(model, tools, toolHandlers)
    const reply = await runner.run(systemPrompt, messages, context)

    // ── Step 7: Save reply and send to Telegram ───────────────────────────────

    await conversationManager.saveMessage(conversationId, 'assistant', reply)

    await sendTelegramMessage(chatId, reply, token)

    console.log(
      `[dispatcher] completed: dealerId=${dealerId} role=${role} conversationId=${conversationId}`
    )
  } catch (err) {
    console.error('[dispatcher] error:', err)

    // Best-effort error notification to user — do not propagate throws
    try {
      await sendTelegramMessage(chatId, 'Bir hata olustu. Lutfen tekrar deneyin.', token)
    } catch (notifyErr) {
      console.error('[dispatcher] failed to send error notification:', notifyErr)
    }
  }
}
