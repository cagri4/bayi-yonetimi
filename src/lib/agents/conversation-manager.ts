/**
 * ConversationManager — DB-backed conversation history with rolling window and auto-summarization.
 *
 * Manages agent_conversations and agent_messages tables via the service role client.
 * Keeps at most ROLLING_WINDOW (50) messages per conversation; automatically summarizes
 * older messages using Haiku 4.5 when the count exceeds SUMMARIZE_THRESHOLD.
 */
import { createServiceClient } from '@/lib/supabase/service-client'
import type { Json } from '@/types/database.types'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

// ─── Rolling Window Constants ───────────────────────────────────────────────

/** Maximum messages loaded per conversation turn */
const ROLLING_WINDOW = 50

/** Trigger summarization when message count exceeds this value */
const SUMMARIZE_THRESHOLD = 50

/** Messages to keep (most recent) after summarization */
const KEEP_RECENT = 25

// ─── ConversationManager ────────────────────────────────────────────────────

/**
 * Manages agent conversation persistence and message history.
 *
 * Key behaviors:
 * - getOrCreateConversation: idempotent; returns existing active conversation or creates new
 * - getMessages: returns up to ROLLING_WINDOW messages, excluding system role (summaries)
 * - saveMessage: inserts user/assistant messages and triggers summarization when needed
 * - summarizeAndTruncate: calls Haiku 4.5 to summarize old messages, replaces them with summary
 * - getSummary: returns the most recent summary text for context injection
 */
export class ConversationManager {
  private readonly supabase = createServiceClient()
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  /**
   * Returns the active conversation ID for the given parameters, creating one if needed.
   * This is called once per incoming Telegram message to get/establish the conversation context.
   */
  async getOrCreateConversation(params: {
    companyId: string
    dealerId: string
    agentRole: string
    telegramChatId: number
  }): Promise<string> {
    const { companyId, dealerId, agentRole, telegramChatId } = params

    // Look for an existing active conversation
    const { data: existing, error: selectError } = await this.supabase
      .from('agent_conversations')
      .select('id')
      .eq('company_id', companyId)
      .eq('dealer_id', dealerId)
      .eq('agent_role', agentRole)
      .eq('telegram_chat_id', telegramChatId)
      .eq('status', 'active')
      .maybeSingle()

    if (selectError) {
      console.error('[conversation-manager] getOrCreateConversation select error:', selectError.message)
    }

    if (existing) {
      return existing.id
    }

    // Create a new conversation
    const { data: created, error: insertError } = await this.supabase
      .from('agent_conversations')
      .insert({
        company_id: companyId,
        dealer_id: dealerId,
        agent_role: agentRole,
        telegram_chat_id: telegramChatId,
        status: 'active',
      })
      .select('id')
      .single()

    if (insertError || !created) {
      throw new Error(
        `[conversation-manager] Failed to create conversation: ${insertError?.message ?? 'no data returned'}`
      )
    }

    return created.id
  }

  /**
   * Returns conversation history in MessageParam format for Claude API calls.
   * Loads the most recent ROLLING_WINDOW messages, excluding system-role messages
   * (those are summaries stored for context injection, not for passing to Claude directly).
   */
  async getMessages(conversationId: string): Promise<MessageParam[]> {
    const { data, error } = await this.supabase
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(ROLLING_WINDOW)

    if (error) {
      console.error('[conversation-manager] getMessages error:', error.message)
      return []
    }

    // Exclude 'system' role — summaries are injected separately into system prompt, not messages array
    return (data ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
  }

  /**
   * Saves a user or assistant message to the database.
   * After saving, checks total message count and triggers summarization if needed.
   */
  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase.from('agent_messages').insert({
      conversation_id: conversationId,
      role,
      content,
      metadata: (metadata ?? {}) as Json,
    })

    if (error) {
      console.error('[conversation-manager] saveMessage error:', error.message)
      return
    }

    // Check total message count; summarize if needed
    const { count, error: countError } = await this.supabase
      .from('agent_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)

    if (countError) {
      console.error('[conversation-manager] message count error:', countError.message)
      return
    }

    if ((count ?? 0) > SUMMARIZE_THRESHOLD) {
      await this.summarizeAndTruncate(conversationId)
    }
  }

  /**
   * Summarizes older messages using Claude Haiku 4.5 and replaces them with a summary marker.
   *
   * Strategy:
   * - Fetch all messages for the conversation
   * - Split: toSummarize = older messages, toKeep = most recent KEEP_RECENT
   * - Call Haiku 4.5 to produce a 3-5 sentence Turkish summary
   * - Delete summarized messages
   * - Insert a 'system' role summary message with the timestamp of the earliest deleted message
   * - Update the conversation's summary field
   *
   * Error handling: wraps in try/catch — failure logs but does NOT block the main flow.
   */
  private async summarizeAndTruncate(conversationId: string): Promise<void> {
    try {
      // Fetch all messages ordered chronologically
      const { data: allMessages, error: fetchError } = await this.supabase
        .from('agent_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (fetchError || !allMessages) {
        console.error('[conversation-manager] summarizeAndTruncate fetch error:', fetchError?.message)
        return
      }

      // Nothing to do if we're already within the window
      if (allMessages.length <= ROLLING_WINDOW) {
        return
      }

      const toSummarize = allMessages.slice(0, -KEEP_RECENT)
      const toKeep = allMessages.slice(-KEEP_RECENT)

      // Build conversation text for Haiku to summarize
      const conversationText = toSummarize
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')

      // Call Haiku 4.5 — cheapest model, used only for summarization
      const summaryResponse = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system:
          'Summarize the following conversation history concisely in 3-5 sentences. Focus on key decisions, requests, and outcomes. Respond in Turkish.',
        messages: [
          {
            role: 'user',
            content: conversationText,
          },
        ],
      })

      const summaryBlock = summaryResponse.content.find((b) => b.type === 'text')
      const summaryText = summaryBlock && summaryBlock.type === 'text' ? summaryBlock.text : ''

      // Delete the summarized messages
      const idsToDelete = toSummarize.map((m) => m.id)
      const { error: deleteError } = await this.supabase
        .from('agent_messages')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) {
        console.error('[conversation-manager] summarizeAndTruncate delete error:', deleteError.message)
        return
      }

      // Insert summary as a 'system' role message at the timestamp of the earliest deleted message
      const earliestTimestamp = toSummarize[0].created_at
      const { error: insertError } = await this.supabase.from('agent_messages').insert({
        conversation_id: conversationId,
        role: 'system',
        content: `[Konusma ozeti: ${summaryText}]`,
        created_at: earliestTimestamp,
      })

      if (insertError) {
        console.error('[conversation-manager] summarizeAndTruncate insert summary error:', insertError.message)
        return
      }

      // Update the conversation's summary field with the latest summary
      const { error: updateError } = await this.supabase
        .from('agent_conversations')
        .update({ summary: summaryText })
        .eq('id', conversationId)

      if (updateError) {
        console.error('[conversation-manager] summarizeAndTruncate update conversation error:', updateError.message)
      }

      console.log(
        `[conversation-manager] summarized ${toSummarize.length} messages, kept ${toKeep.length} recent messages`
      )
    } catch (err) {
      // Summarization failure must NOT block the conversation flow
      console.error('[conversation-manager] summarizeAndTruncate unexpected error:', err)
    }
  }

  /**
   * Returns the stored conversation summary, or null if no summarization has occurred.
   * Used by the dispatcher to prepend context from previous sessions.
   */
  async getSummary(conversationId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('agent_conversations')
      .select('summary')
      .eq('id', conversationId)
      .single()

    if (error) {
      console.error('[conversation-manager] getSummary error:', error.message)
      return null
    }

    return data?.summary ?? null
  }
}
