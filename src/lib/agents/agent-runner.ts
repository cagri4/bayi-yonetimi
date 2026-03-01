/**
 * AgentRunner — drives the Claude tool-use loop for all agent roles.
 * Manages multi-turn tool calling, prompt caching, and token budget recording.
 *
 * AI-10: Applies prompt caching on system prompt (ephemeral cache_control)
 *        and on the last tool definition (via applyPromptCaching).
 */
import Anthropic from '@anthropic-ai/sdk'
import type {
  MessageParam,
  Tool,
  ContentBlock,
  ToolUseBlock,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages'
import { AgentContext, TokenUsageRecord, MAX_ITERATIONS } from './types'
import { TokenBudget } from './token-budget'
import { applyPromptCaching } from './tool-registry'

// ─── AgentRunner ────────────────────────────────────────────────────────────

/**
 * Drives the Claude tool-use loop for a specific agent role.
 *
 * Lifecycle per run():
 * 1. Apply prompt caching to tools (AI-10)
 * 2. Call Claude with caching on system prompt
 * 3. Record token usage to TokenBudget
 * 4. If stop_reason === 'tool_use': dispatch handlers, continue loop
 * 5. If stop_reason === 'end_turn': extract and return text response
 * 6. If max iterations reached: return Turkish fallback message
 */
export class AgentRunner {
  private readonly client: Anthropic
  private readonly tokenBudget: TokenBudget

  constructor(
    private readonly model: string,
    private readonly tools: Tool[],
    private readonly toolHandlers: Map<
      string,
      (input: Record<string, unknown>, context: AgentContext) => Promise<string>
    >
  ) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
    this.tokenBudget = new TokenBudget()
  }

  /**
   * Runs the Claude tool-use loop for a given conversation turn.
   *
   * @param systemPrompt - The agent's role-specific system prompt (gets ephemeral cache_control)
   * @param messages - Conversation history (from ConversationManager)
   * @param context - AgentContext for company/dealer scoping and call stack tracking
   * @returns The final text response from Claude, or Turkish fallback on iteration cap
   */
  async run(
    systemPrompt: string,
    messages: MessageParam[],
    context: AgentContext
  ): Promise<string> {
    // Clone to avoid mutating caller's array
    const workingMessages = [...messages]

    // Apply prompt caching to tool definitions (AI-10: last tool gets ephemeral breakpoint)
    const cachedTools = applyPromptCaching(this.tools)

    let iterations = 0

    while (iterations < MAX_ITERATIONS) {
      iterations++

      // Call Claude with system prompt caching and tool definitions
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            // AI-10: Cache the system prompt — repeated invocations with same system prompt
            // will get cache hits, reducing cost significantly for long conversations
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: cachedTools,
        messages: workingMessages,
      })

      // Record token usage after every API call (even mid-loop)
      const usage = response.usage
      const tokenRecord: TokenUsageRecord = {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      }
      await this.tokenBudget.recordUsage(context.dealerId, tokenRecord)

      // Handle end_turn — extract text and return
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(
          (block: ContentBlock) => block.type === 'text'
        )
        if (textBlock && textBlock.type === 'text') {
          return textBlock.text
        }
        return ''
      }

      // Handle tool_use — dispatch all tool calls, then continue loop
      if (response.stop_reason === 'tool_use') {
        // Push assistant turn with all content blocks (including tool_use)
        workingMessages.push({
          role: 'assistant',
          content: response.content,
        })

        // Build tool_result blocks for all tool_use blocks in response
        const toolResults: ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue

          const toolUseBlock = block as ToolUseBlock
          const handler = this.toolHandlers.get(toolUseBlock.name)

          let resultContent: string

          if (!handler) {
            resultContent = `[Hata: '${toolUseBlock.name}' araci bulunamadi.]`
          } else {
            try {
              resultContent = await handler(
                toolUseBlock.input as Record<string, unknown>,
                context
              )
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              resultContent = `[Hata: ${message}]`
            }
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: resultContent,
          })
        }

        // Push all tool results as a user turn
        workingMessages.push({
          role: 'user',
          content: toolResults,
        })

        continue
      }

      // Any other stop reason (max_tokens, stop_sequence, etc.) — exit loop
      break
    }

    // Turkish fallback message when iteration cap is reached
    return '[Maksimum islem adimina ulasildi. Lutfen tekrar deneyin.]'
  }
}
