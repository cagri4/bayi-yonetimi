/**
 * Agent Dispatcher — orchestrates the full agent conversation flow.
 *
 * Called from the Telegram webhook route via after(). Runs in background
 * after the HTTP 200 response has been sent to Telegram.
 *
 * Responsibilities:
 * 1. Extract the incoming message from the Telegram Update
 * 2. Resolve dealer identity via telegram_chat_id
 * 3. Determine agent role from company's agent_definitions
 * 4. Check token budget before running agent
 * 5. Load conversation history via ConversationManager
 * 6. Build and run AgentRunner with tool handlers
 * 7. Save agent reply and send it back to Telegram
 *
 * Error handling: all errors are caught; a Turkish fallback is sent to the user.
 * Uses process.env.TELEGRAM_BOT_TOKEN for Telegram API calls.
 */
import type { Update } from 'grammy/types'
import { createServiceClient } from '@/lib/supabase/service-client'
import { AgentRunner } from './agent-runner'
import { ConversationManager } from './conversation-manager'
import { TokenBudget } from './token-budget'
import { ToolRegistry } from './tool-registry'
import type { AgentContext, AgentRole } from './types'

// ─── Telegram Helper ─────────────────────────────────────────────────────────

/**
 * Sends a text message to a Telegram chat via the Bot API.
 * Uses process.env.TELEGRAM_BOT_TOKEN.
 * Logs errors but never throws — the caller continues regardless.
 */
async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('[dispatcher] TELEGRAM_BOT_TOKEN is not set — cannot send message')
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
          parse_mode: 'Markdown',
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
 */
export async function dispatchAgentUpdate(update: Update): Promise<void> {
  // Extract message — ignore non-text updates (edits, callbacks, media, etc.)
  const message = update.message
  if (!message || !message.text) {
    return
  }

  const chatId = message.chat.id
  const text = message.text
  const telegramUserId = message.from?.id

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
        'Bu bot\'u kullanmak icin hesabinizi baglayiniz. Bayi panelinizden Telegram entegrasyonunu tamamlayin.'
      )
      return
    }

    const dealerId = dealer.id
    const companyId = dealer.company_id

    // ── Step 2: Determine agent role ──────────────────────────────────────────
    // Look up active agent_definitions for this company.
    // Phase 9: single-bot setup — use the first active definition's role, or 'destek' fallback.
    // Phase 10+: each bot will map to a specific role via bot token or webhook URL.

    let role: AgentRole = 'destek' // fallback

    const { data: agentDefs, error: agentDefsError } = await supabase
      .from('agent_definitions')
      .select('role, system_prompt, model')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .limit(1)

    if (agentDefsError) {
      console.error('[dispatcher] agent_definitions lookup error:', agentDefsError.message)
    }

    let systemPrompt =
      'Sen bir bayi yardim asistanisin. Turkce cevap ver. Bayi sorularina yardimci ol.'

    if (agentDefs && agentDefs.length > 0) {
      const def = agentDefs[0]
      role = def.role as AgentRole
      systemPrompt = def.system_prompt
    }

    // ── Step 3: Check token budget ────────────────────────────────────────────

    const tokenBudget = new TokenBudget()
    const budgetCheck = await tokenBudget.checkBudget(dealerId)

    if (!budgetCheck.allowed) {
      await sendTelegramMessage(chatId, budgetCheck.reason ?? 'Gunluk limitinize ulastiniz.')
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

    // ── Step 5: Build tool handlers ───────────────────────────────────────────
    // Phase 9: placeholder tools wired to simple handlers.
    // Phase 10+: real tool implementations per role.

    const toolRegistry = new ToolRegistry()
    const tools = toolRegistry.getToolsWithCaching(role)

    const toolHandlers = new Map<
      string,
      (input: Record<string, unknown>, context: AgentContext) => Promise<string>
    >([
      // echo: returns the input message back
      [
        'echo',
        async (input: Record<string, unknown>) => {
          return String(input.message ?? '[Bos mesaj]')
        },
      ],

      // get_current_time: returns the current server time in ISO format
      [
        'get_current_time',
        async () => {
          return new Date().toISOString()
        },
      ],

      // lookup_dealer: queries dealer info scoped to this company
      [
        'lookup_dealer',
        async (input: Record<string, unknown>, context: AgentContext) => {
          const targetDealerId = String(input.dealer_id ?? '')
          if (!targetDealerId) {
            return '[Hata: dealer_id gerekli]'
          }

          const { data, error } = await supabase
            .from('dealers')
            .select('id, company_name, email, phone, is_active')
            .eq('id', targetDealerId)
            .eq('company_id', context.companyId)
            .single()

          if (error || !data) {
            return `[Bayi bulunamadi: ${targetDealerId}]`
          }

          return JSON.stringify(data)
        },
      ],
    ])

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

    // Retrieve the model from agent_definitions if available; ToolRegistry model is the fallback
    const model = toolRegistry.getModel(role)

    const runner = new AgentRunner(model, tools, toolHandlers)
    const reply = await runner.run(systemPrompt, messages, context)

    // ── Step 7: Save reply and send to Telegram ───────────────────────────────

    await conversationManager.saveMessage(conversationId, 'assistant', reply)

    await sendTelegramMessage(chatId, reply)

    console.log(
      `[dispatcher] completed: dealerId=${dealerId} role=${role} conversationId=${conversationId}`
    )
  } catch (err) {
    console.error('[dispatcher] error:', err)

    // Best-effort error notification to user — do not propagate throws
    try {
      await sendTelegramMessage(chatId, 'Bir hata olustu. Lutfen tekrar deneyin.')
    } catch (notifyErr) {
      console.error('[dispatcher] failed to send error notification:', notifyErr)
    }
  }
}
