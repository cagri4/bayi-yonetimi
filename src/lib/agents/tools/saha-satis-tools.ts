/**
 * Saha Satis Sorumlusu (Field Sales) agent tool definitions and handler implementations.
 * Phase 12 — Plan 03
 *
 * 2 tools: plan_visit, log_visit
 *
 * Handler factory receives a Supabase service-role client. Every handler receives
 * AgentContext for tenant isolation (companyId on every dealer_visits INSERT).
 *
 * Both tools write to dealer_visits using (supabase as any) pattern —
 * dealer_visits is not in auto-generated Database types so type assertion is required.
 *
 * Exports:
 *   - sahaSatisTools: Tool[] — array of exactly 2 tool definitions
 *   - createSahaSatisHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * plan_visit tool (SS-01) — inserts a planned visit record into dealer_visits.
 * Uses (supabase as any) because dealer_visits is not in auto-generated DB types.
 */
const planVisitTool: Tool = {
  name: 'plan_visit',
  description: 'Bayi ziyareti planlar ve dealer_visits tablosuna kaydeder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dealer_id: {
        type: 'string',
        description: 'Ziyaret edilecek bayi UUID',
      },
      planned_date: {
        type: 'string',
        description: 'Planlanan ziyaret tarihi (YYYY-MM-DD)',
      },
      visit_type: {
        type: 'string',
        description: 'routine | sales | complaint | delivery (varsayilan: routine)',
      },
      notes: {
        type: 'string',
        description: 'Ziyaret notlari',
      },
    },
    required: ['dealer_id', 'planned_date'],
  },
}

/**
 * log_visit tool (SS-02) — inserts an actual completed visit record into dealer_visits.
 * Includes actual_date and outcome fields to record visit results.
 * Uses (supabase as any) because dealer_visits is not in auto-generated DB types.
 */
const logVisitTool: Tool = {
  name: 'log_visit',
  description:
    'Gerceklesen bayi ziyaretini kaydeder. Ziyaret tarihi, sonucu ve notlari iceren gercek ziyaret kaydi olusturur.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dealer_id: {
        type: 'string',
        description: 'Ziyaret edilen bayi UUID',
      },
      actual_date: {
        type: 'string',
        description: 'Gercek ziyaret tarihi (YYYY-MM-DD)',
      },
      outcome: {
        type: 'string',
        description: 'Ziyaret sonucu (ornek: siparis alindi, sikayet cozuldu)',
      },
      notes: {
        type: 'string',
        description: 'Ziyaret notlari',
      },
      visit_type: {
        type: 'string',
        description: 'routine | sales | complaint | delivery',
      },
    },
    required: ['dealer_id', 'actual_date'],
  },
}

/**
 * sahaSatisTools — exported array of exactly 2 tool definitions.
 * plan_visit (SS-01) and log_visit (SS-02).
 */
export const sahaSatisTools: Tool[] = [planVisitTool, logVisitTool]

// ─── Handler Implementations ───────────────────────────────────────────────

/**
 * Handles plan_visit tool calls (SS-01).
 * - Validates dealer_id and planned_date presence
 * - INSERTs into dealer_visits using (supabase as any) — table not in DB types
 * - Scoped by context.companyId for tenant isolation
 */
async function handlePlanVisit(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  if (!input['dealer_id'] || typeof input['dealer_id'] !== 'string') {
    return '[Hata: dealer_id zorunludur]'
  }
  if (!input['planned_date'] || typeof input['planned_date'] !== 'string') {
    return '[Hata: planned_date zorunludur]'
  }

  const dealerId = String(input['dealer_id'])
  const plannedDate = String(input['planned_date'])
  const visitType = typeof input['visit_type'] === 'string' ? input['visit_type'] : 'routine'
  const notes = typeof input['notes'] === 'string' ? input['notes'] : null

  const { error } = await (supabase as any)
    .from('dealer_visits')
    .insert({
      company_id: context.companyId,
      dealer_id: dealerId,
      planned_date: plannedDate,
      visit_type: visitType,
      notes: notes,
    })

  if (error) {
    return '[Hata: ' + error.message + ']'
  }

  return `Ziyaret planlandi: ${dealerId} - ${plannedDate}`
}

/**
 * Handles log_visit tool calls (SS-02).
 * - Validates dealer_id and actual_date presence
 * - INSERTs into dealer_visits with actual_date and outcome using (supabase as any)
 * - planned_date is set to actual_date (visit already happened)
 * - Scoped by context.companyId for tenant isolation
 */
async function handleLogVisit(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  if (!input['dealer_id'] || typeof input['dealer_id'] !== 'string') {
    return '[Hata: dealer_id zorunludur]'
  }
  if (!input['actual_date'] || typeof input['actual_date'] !== 'string') {
    return '[Hata: actual_date zorunludur]'
  }

  const dealerId = String(input['dealer_id'])
  const actualDate = String(input['actual_date'])
  const visitType = typeof input['visit_type'] === 'string' ? input['visit_type'] : 'routine'
  const outcome = typeof input['outcome'] === 'string' ? input['outcome'] : null
  const notes = typeof input['notes'] === 'string' ? input['notes'] : null

  const { error } = await (supabase as any)
    .from('dealer_visits')
    .insert({
      company_id: context.companyId,
      dealer_id: dealerId,
      planned_date: actualDate,
      actual_date: actualDate,
      visit_type: visitType,
      outcome: outcome,
      notes: notes,
    })

  if (error) {
    return '[Hata: ' + error.message + ']'
  }

  return `Ziyaret kaydedildi: ${dealerId} - ${actualDate}` + (outcome ? ' - ' + outcome : '')
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createSahaSatisHandlers — factory that accepts a Supabase client and returns
 * a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly to sync with TOOL_REGISTRY lookup.
 * Returns exactly 2 entries: 'plan_visit', 'log_visit'.
 *
 * Both handlers INSERT into dealer_visits using (supabase as any) type assertion.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 2 write handlers
 */
export function createSahaSatisHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  handlers.set('plan_visit', (input, context) => handlePlanVisit(input, context, supabase))

  handlers.set('log_visit', (input, context) => handleLogVisit(input, context, supabase))

  return handlers
}
