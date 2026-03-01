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
import { createEgitimciHandlers } from './tools/egitimci-tools'
import { createSatisHandlers } from './tools/satis-tools'
import type { AgentContext, AgentRole } from './types'

// ─── Telegram Helper ─────────────────────────────────────────────────────────

/**
 * Sends a text message to a Telegram chat via the Bot API.
 * Accepts a token parameter so each bot uses its own bot token.
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

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      }
    )

    if (!response.ok) {
      const body = await response.text()
      console.error('[dispatcher] sendMessage API error:', response.status, body)
    }
  } catch (err) {
    console.error('[dispatcher] sendTelegramMessage fetch error:', err)
  }
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
    // Phase 10: egitimci and satis_temsilcisi use factory-built handler maps.
    // Other roles use inline placeholder handlers until their tools are implemented.

    const toolRegistry = new ToolRegistry()
    const tools = toolRegistry.getToolsWithCaching(role)

    let toolHandlers: Map<string, (input: Record<string, unknown>, context: AgentContext) => Promise<string>>

    if (role === 'egitimci') {
      toolHandlers = createEgitimciHandlers(supabase)
    } else if (role === 'satis_temsilcisi') {
      toolHandlers = createSatisHandlers(supabase)
    } else {
      // Fallback: placeholder handlers for unimplemented roles
      toolHandlers = new Map([
        ['echo', async (input: Record<string, unknown>) => String(input.message ?? '[Bos mesaj]')],
        ['get_current_time', async () => new Date().toISOString()],
        ['lookup_dealer', async (input: Record<string, unknown>, ctx: AgentContext) => {
          const targetDealerId = String(input.dealer_id ?? '')
          if (!targetDealerId) return '[Hata: dealer_id gerekli]'
          const { data, error } = await supabase
            .from('dealers')
            .select('id, company_name, email, phone, is_active')
            .eq('id', targetDealerId)
            .eq('company_id', ctx.companyId)
            .single()
          if (error || !data) return `[Bayi bulunamadi: ${targetDealerId}]`
          return JSON.stringify(data)
        }],
      ])
    }

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
