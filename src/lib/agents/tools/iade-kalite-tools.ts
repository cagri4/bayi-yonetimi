/**
 * Iade Kalite Sorumlusu (Returns/Quality) agent tool definitions and handler implementations.
 * Phase 12 — Plan 04
 *
 * IK-01 TWO-TURN CONFIRMATION: manage_return checks input.confirmed flag.
 * Without confirmed=true the tool returns a summary and asks for confirmation.
 * Only after confirmed=true does it perform the DB INSERT.
 *
 * IK-02 READ/WRITE: track_complaint queries existing complaints (list mode)
 * or inserts a new one (create mode). Mode is inferred from input.description presence.
 *
 * 2 tools: manage_return (write+confirm), track_complaint (read/write)
 *
 * All DB writes use (supabase as any) pattern for Phase 12 tables not yet in
 * generated Database types (return_requests, quality_complaints).
 *
 * Exports:
 *   - iadeKaliteTools: Tool[] — array of exactly 2 tool definitions
 *   - createIadeKaliteHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * manage_return tool (IK-01) — inserts into return_requests table.
 * TWO-TURN CONFIRMATION PATTERN: confirmed=false (default) shows summary only.
 * confirmed=true triggers the INSERT. Prevents accidental return creation.
 */
const manageReturnTool: Tool = {
  name: 'manage_return',
  description:
    'Iade talebini kaydeder veya gunceller. ONEMLI: Once kullanicidan onay al, sonra confirmed=true ile cagir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dealer_id: {
        type: 'string',
        description: 'Bayi UUID',
      },
      order_id: {
        type: 'string',
        description: 'Siparis UUID (opsiyonel)',
      },
      reason: {
        type: 'string',
        description: 'Iade nedeni',
      },
      items: {
        type: 'array',
        description: 'Iade edilecek kalemler',
        items: { type: 'object' },
      },
      confirmed: {
        type: 'boolean',
        description: 'true ise iade olusturulur',
      },
    },
    required: ['dealer_id', 'reason'],
  },
}

/**
 * track_complaint tool (IK-02) — queries or inserts quality_complaints.
 * List mode: triggered when description is absent — returns existing complaints.
 * Create mode: triggered when description is present — inserts new complaint.
 */
const trackComplaintTool: Tool = {
  name: 'track_complaint',
  description: 'Kalite sikayetini kaydeder veya mevcut sikayetleri sorgular.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dealer_id: {
        type: 'string',
        description: 'Bayi UUID (sorgu veya kayit icin)',
      },
      complaint_type: {
        type: 'string',
        description: 'product_quality | delivery | packaging | other',
      },
      description: {
        type: 'string',
        description: 'Sikayet aciklamasi (kayit icin zorunlu)',
      },
      action: {
        type: 'string',
        description: 'list | create (varsayilan: list eger description yoksa, create eger description varsa)',
      },
    },
    required: ['dealer_id'],
  },
}

/**
 * iadeKaliteTools — exported array of exactly 2 tool definitions.
 * IK-01 (manage_return) is write with two-turn confirmation.
 * IK-02 (track_complaint) is read/write depending on input.
 */
export const iadeKaliteTools: Tool[] = [manageReturnTool, trackComplaintTool]

// ─── Internal Types ────────────────────────────────────────────────────────

interface ReturnItem {
  product_id?: string
  quantity?: number
  [key: string]: unknown
}

interface ComplaintRow {
  id: string
  company_id: string
  dealer_id: string
  complaint_type: string
  description: string
  status: string
  created_at: string
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createIadeKaliteHandlers — factory that accepts a Supabase service-role client
 * and returns a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly.
 * Returns exactly 2 entries: 'manage_return', 'track_complaint'.
 *
 * manage_return uses two-turn confirmation via input.confirmed flag.
 * track_complaint auto-detects mode from input.description presence.
 * All INSERT operations use (supabase as any) for Phase 12 tables.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 2 handlers
 */
export function createIadeKaliteHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  // ─── manage_return (IK-01) — TWO-TURN WRITE ──────────────────────────────

  handlers.set('manage_return', async (input, context) => {
    const confirmed = input.confirmed === true
    const reason = String(input.reason ?? '')
    const dealerId = String(input.dealer_id ?? '')
    const items: ReturnItem[] = Array.isArray(input.items) ? input.items : []

    // Guard: required fields
    if (!dealerId) {
      return '[Hata: Bayi ID bos olamaz]'
    }
    if (!reason) {
      return '[Hata: Iade nedeni belirtilmemis]'
    }

    // First turn: show summary, ask for confirmation
    if (!confirmed) {
      return (
        'Iade ozeti:\n' +
        `Neden: ${reason}\n` +
        `Bayi: ${dealerId}\n` +
        (typeof input.order_id === 'string' ? `Siparis: ${input.order_id}\n` : '') +
        `Kalemler: ${JSON.stringify(items)}\n` +
        '\nOnaylamak icin: confirmed=true ile tekrar cagirin.'
      )
    }

    // Second turn: create the return request
    const { data, error } = await (supabase as any)
      .from('return_requests')
      .insert({
        company_id: context.companyId,
        dealer_id: dealerId,
        order_id: typeof input.order_id === 'string' ? input.order_id : null,
        reason: reason,
        status: 'pending',
        items: items,
      })
      .select('id')
      .single()

    if (error) {
      return `[Hata: ${error.message}]`
    }

    return `Iade talebi olusturuldu. ID: ${data.id}`
  })

  // ─── track_complaint (IK-02) — READ/WRITE ────────────────────────────────

  handlers.set('track_complaint', async (input, context) => {
    const dealerId = String(input.dealer_id ?? '')

    if (!dealerId) {
      return '[Hata: Bayi ID bos olamaz]'
    }

    if (typeof input.description === 'string' && input.description.length > 0) {
      // Create mode: insert new quality complaint
      const complaintType = typeof input.complaint_type === 'string' ? input.complaint_type : 'other'

      const { error } = await (supabase as any)
        .from('quality_complaints')
        .insert({
          company_id: context.companyId,
          dealer_id: dealerId,
          complaint_type: complaintType,
          description: input.description,
          status: 'open',
        })

      if (error) {
        return `[Hata: ${error.message}]`
      }

      return 'Sikayet kaydedildi.'
    } else {
      // List mode: query existing complaints for this dealer
      const { data, error } = await (supabase as any)
        .from('quality_complaints')
        .select('*')
        .eq('company_id', context.companyId)
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        return `[Hata: ${error.message}]`
      }

      const complaints = (data ?? []) as ComplaintRow[]

      if (complaints.length === 0) {
        return '[Sikayet kaydi bulunamadi]'
      }

      return JSON.stringify(complaints)
    }
  })

  return handlers
}
