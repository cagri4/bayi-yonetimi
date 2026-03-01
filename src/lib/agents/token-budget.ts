/**
 * TokenBudget — per-dealer daily token limit enforcement.
 * Enforces 50K soft / 100K hard daily token limits using the daily_token_usage table.
 * Uses atomic RPC increment to prevent race conditions on concurrent requests.
 */
import { createServiceClient } from '@/lib/supabase/service-client'
import { SOFT_TOKEN_LIMIT, HARD_TOKEN_LIMIT, TokenUsageRecord } from './types'

export class TokenBudget {
  private readonly supabase = createServiceClient()

  /**
   * Checks whether the dealer is within daily token budget.
   * Returns allowed:false with Turkish error message when hard limit is reached.
   * Logs a console warning when soft limit is exceeded.
   */
  async checkBudget(
    dealerId: string
  ): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await this.supabase
      .from('daily_token_usage')
      .select('tokens_used')
      .eq('dealer_id', dealerId)
      .eq('date', today)
      .maybeSingle()

    if (error) {
      console.error(`[token-budget] checkBudget error for dealer=${dealerId}:`, error.message)
      // On DB error, allow the request to proceed — fail open to avoid blocking dealers
      return { allowed: true, remaining: HARD_TOKEN_LIMIT }
    }

    const used = data?.tokens_used ?? 0

    if (used >= HARD_TOKEN_LIMIT) {
      return {
        allowed: false,
        remaining: 0,
        reason:
          'Gunluk token limitinize ulastiniz (100.000 token). Yarin tekrar deneyin.',
      }
    }

    if (used >= SOFT_TOKEN_LIMIT) {
      console.warn(
        `[token-budget] dealer=${dealerId} exceeded soft limit: used=${used}/${SOFT_TOKEN_LIMIT}`
      )
    }

    return {
      allowed: true,
      remaining: HARD_TOKEN_LIMIT - used,
    }
  }

  /**
   * Records token usage for a dealer after a Claude API response.
   * Uses atomic RPC to increment the daily usage counter without race conditions.
   * Logs all four token categories for cost observability.
   */
  async recordUsage(dealerId: string, usage: TokenUsageRecord): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)
    const totalTokens =
      usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens

    const { error } = await this.supabase.rpc('increment_daily_token_usage', {
      p_dealer_id: dealerId,
      p_date: today,
      p_tokens: totalTokens,
    })

    if (error) {
      console.error(
        `[token-budget] recordUsage error for dealer=${dealerId}:`,
        error.message
      )
    }

    console.log(
      `[token-budget] dealer=${dealerId} tokens=${totalTokens}` +
        ` (in=${usage.inputTokens} out=${usage.outputTokens}` +
        ` cache_r=${usage.cacheReadTokens} cache_w=${usage.cacheWriteTokens})`
    )
  }

  /**
   * Returns today's total tokens used for a dealer.
   * Returns 0 if no record exists yet.
   */
  async getUsage(dealerId: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await this.supabase
      .from('daily_token_usage')
      .select('tokens_used')
      .eq('dealer_id', dealerId)
      .eq('date', today)
      .maybeSingle()

    if (error) {
      console.error(`[token-budget] getUsage error for dealer=${dealerId}:`, error.message)
      return 0
    }

    return data?.tokens_used ?? 0
  }
}
