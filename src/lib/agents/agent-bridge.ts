/**
 * AgentBridge — cross-agent communication with deadlock protection.
 *
 * Provides:
 *   - checkDeadlock(): synchronous cycle + depth + tool-call-cap guard
 *   - logAgentCall(): audit trail written to agent_calls table
 *   - callAgent(): high-level orchestration placeholder (Phase 9)
 *   - getDealerInfo / getRecentOrders / getProductInfo: direct DB query
 *     helpers that satisfy cross-agent data needs without Claude invocations
 *
 * Security: every DB helper enforces .eq('company_id', companyId) because
 * the service role client bypasses RLS.
 */

import { createServiceClient } from '@/lib/supabase/service-client'
import { AgentRunner } from './agent-runner'
import { ToolRegistry } from './tool-registry'
import { buildHandlersForRole } from './handler-factory'
import { MAX_AGENT_DEPTH, MAX_TOOL_CALLS, AgentContext, AgentRole } from './types'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'

// ─── AgentCallContext ────────────────────────────────────────────────────────

/**
 * Carries cross-agent call tracking state through the call chain.
 * Populated by the caller before invoking AgentBridge.callAgent().
 */
export interface AgentCallContext {
  /** Chain of agent roles that led to this call: ['satis_temsilcisi', 'depo_sorumlusu', ...] */
  callStack: string[]
  /** Current recursion depth (starts at 0 for a top-level agent call) */
  depth: number
  /** Total cross-agent tool calls in this chain — enforces AI-08 cap */
  toolCallCount: number
  /** References agent_calls.id for the parent call (used for audit linkage) */
  parentCallId?: string
}

// ─── AgentBridge ────────────────────────────────────────────────────────────

export class AgentBridge {
  /**
   * Lazy singleton: created on first DB access, reused within the
   * same serverless instance lifetime.
   */
  private get supabase() {
    return createServiceClient()
  }

  // ── Deadlock Guard ─────────────────────────────────────────────────────────

  /**
   * Synchronous check — no I/O, only in-memory call stack inspection.
   *
   * Three rejection conditions (checked in order):
   *   1. Cycle: targetRole is already in the call stack.
   *   2. Depth: current depth has reached MAX_AGENT_DEPTH.
   *   3. Tool-call cap: toolCallCount has reached MAX_TOOL_CALLS.
   */
  checkDeadlock(
    targetRole: string,
    context: AgentCallContext,
  ): { allowed: boolean; reason?: string } {
    // 1. Cycle detection
    if (context.callStack.includes(targetRole)) {
      return {
        allowed: false,
        reason: `Dongu tespit edildi: ${context.callStack.join(' -> ')} -> ${targetRole}`,
      }
    }

    // 2. Depth limit
    if (context.depth >= MAX_AGENT_DEPTH) {
      return {
        allowed: false,
        reason: `Maksimum ajan derinligi (${MAX_AGENT_DEPTH}) asildi. Cagri zinciri: ${context.callStack.join(' -> ')}`,
      }
    }

    // 3. Total tool-call cap
    if (context.toolCallCount >= MAX_TOOL_CALLS) {
      return {
        allowed: false,
        reason: `Maksimum cross-agent tool call sayisina (${MAX_TOOL_CALLS}) ulasildi.`,
      }
    }

    return { allowed: true }
  }

  // ── Audit Logging ──────────────────────────────────────────────────────────

  /**
   * Writes a record to agent_calls for every cross-agent call attempt.
   * Returns the new row's id, or '' if the insert fails (never throws).
   */
  async logAgentCall(params: {
    callerRole: string
    calleeRole: string
    depth: number
    companyId: string
    conversationId: string
    success: boolean
    errorMessage?: string
  }): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('agent_calls')
        .insert({
          company_id: params.companyId,
          conversation_id: params.conversationId,
          caller_role: params.callerRole,
          callee_role: params.calleeRole,
          depth: params.depth,
          success: params.success,
          error_message: params.errorMessage ?? null,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[AgentBridge] logAgentCall insert failed:', error.message)
        return ''
      }

      return data?.id ?? ''
    } catch (err) {
      console.error('[AgentBridge] logAgentCall unexpected error:', err)
      return ''
    }
  }

  // ── High-Level Orchestration ───────────────────────────────────────────────

  /**
   * Orchestrates a cross-agent call with deadlock protection and audit logging.
   *
   * Phase 12: real AgentRunner invocation with extended callStack and depth+1.
   * Sub-agent context uses telegramChatId: 0 to prevent double Telegram messages.
   */
  async callAgent(
    targetRole: string,
    query: string,
    context: AgentCallContext & { companyId: string; conversationId: string; dealerId: string; agentRole: AgentRole; telegramChatId: number; callStack: string[]; depth: number },
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    // 1. Deadlock check (synchronous — fast path)
    const guard = this.checkDeadlock(targetRole, context)
    if (!guard.allowed) {
      const callerRole =
        context.callStack[context.callStack.length - 1] ?? 'unknown'

      await this.logAgentCall({
        callerRole,
        calleeRole: targetRole,
        depth: context.depth,
        companyId: context.companyId,
        conversationId: context.conversationId,
        success: false,
        errorMessage: guard.reason,
      })

      return { success: false, error: guard.reason }
    }

    // 2. Log the call attempt
    const callerRole =
      context.callStack[context.callStack.length - 1] ?? 'unknown'

    await this.logAgentCall({
      callerRole,
      calleeRole: targetRole,
      depth: context.depth,
      companyId: context.companyId,
      conversationId: context.conversationId,
      success: true,
    })

    try {
      // 3. Fetch target agent definition from DB
      const { data: agentDef } = await this.supabase
        .from('agent_definitions')
        .select('role, system_prompt, model')
        .eq('company_id', context.companyId)
        .eq('role', targetRole)
        .eq('is_active', true)
        .maybeSingle()

      if (!agentDef) {
        return { success: false, error: `[Ajan tanimlamasi bulunamadi: ${targetRole}]` }
      }

      // 4. Build synthetic AgentContext for the target agent
      // CRITICAL: telegramChatId = 0 prevents sub-agent from sending Telegram messages
      const targetContext: AgentContext = {
        companyId: context.companyId,
        dealerId: context.dealerId,
        conversationId: context.conversationId,
        agentRole: targetRole as AgentRole,
        telegramChatId: 0,
        callStack: [...context.callStack, targetRole],
        depth: context.depth + 1,
      }

      // 5. Get tools and handlers for the target role
      const toolRegistry = new ToolRegistry()
      const tools = toolRegistry.getToolsWithCaching(targetRole as AgentRole)
      const targetHandlers = buildHandlersForRole(targetRole, this.supabase)

      // 6. Run the target agent
      const runner = new AgentRunner(agentDef.model, tools, targetHandlers)
      const syntheticMessages: MessageParam[] = [{ role: 'user', content: query }]
      const result = await runner.run(agentDef.system_prompt, syntheticMessages, targetContext)

      return { success: true, result }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  // ── Direct DB Query Helpers ────────────────────────────────────────────────
  //
  // These methods satisfy cross-agent data lookups that do NOT require Claude
  // reasoning — a direct DB read is faster, cheaper, and safer than spinning
  // up a full agent loop.
  //
  // SECURITY: every query MUST include .eq('company_id', companyId) because
  // the service role client bypasses Row Level Security.

  /**
   * Returns basic dealer info scoped to the caller's company, or null if not found.
   */
  async getDealerInfo(
    dealerId: string,
    companyId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await this.supabase
        .from('dealers')
        .select('id, company_name, email, phone, address, is_active')
        .eq('id', dealerId)
        .eq('company_id', companyId)
        .single()

      if (error) {
        console.error('[AgentBridge] getDealerInfo failed:', error.message)
        return null
      }

      return data as Record<string, unknown>
    } catch (err) {
      console.error('[AgentBridge] getDealerInfo unexpected error:', err)
      return null
    }
  }

  /**
   * Returns recent orders for a dealer, scoped to the caller's company.
   * Defaults to the 5 most recent orders.
   */
  async getRecentOrders(
    dealerId: string,
    companyId: string,
    limit: number = 5,
  ): Promise<Record<string, unknown>[]> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select('id, order_number, status_id, total_amount, created_at')
        .eq('dealer_id', dealerId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('[AgentBridge] getRecentOrders failed:', error.message)
        return []
      }

      return (data ?? []) as Record<string, unknown>[]
    } catch (err) {
      console.error('[AgentBridge] getRecentOrders unexpected error:', err)
      return []
    }
  }

  /**
   * Returns product info scoped to the caller's company, or null if not found.
   */
  async getProductInfo(
    productId: string,
    companyId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('company_id', companyId)
        .single()

      if (error) {
        console.error('[AgentBridge] getProductInfo failed:', error.message)
        return null
      }

      return data as Record<string, unknown>
    } catch (err) {
      console.error('[AgentBridge] getProductInfo unexpected error:', err)
      return null
    }
  }
}
