/**
 * Tahsilat Uzmani (Collections Specialist) agent tool definitions and handler implementations.
 * Phase 12 — Plan 02
 *
 * Tools:
 *   - get_overdue_payments (TU-01): Lists overdue receivables. CRITICAL: scoped via dealer join,
 *     NOT direct company_id filter on dealer_transactions (which has no company_id column).
 *   - send_reminder (TU-02): Sends payment reminder and logs to collection_activities.
 *   - log_collection_activity (TU-03): Logs any collection activity (call, visit, payment, note).
 *
 * INSERT operations use (supabase as any) pattern — collection_activities is a new table
 * not yet in Database type definitions; same pattern as Phase 10/11 write operations.
 *
 * Exports:
 *   - tahsilatUzmaniTools: Tool[] — array of exactly 3 tool definitions
 *   - createTahsilatUzmaniHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * get_overdue_payments tool (TU-01) — queries overdue receivables for company dealers.
 * CRITICAL: dealer_transactions has NO company_id column.
 * Must scope via dealer join: dealers.company_id → dealer_transactions.dealer_id.
 * Hallucination prevention: call this tool before stating any overdue amount.
 */
const getOverduePaymentsTool: Tool = {
  name: 'get_overdue_payments',
  description:
    'Vadesi gecmis alacaklari listeler. ONEMLI: Rakam soylemeden once bu araci cagir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maksimum kayit sayisi (varsayilan: 10)',
      },
    },
    required: [],
  },
}

/**
 * send_reminder tool (TU-02) — sends payment reminder and logs to collection_activities.
 * Requires dealer_id at minimum. Stores reminder record for audit trail.
 */
const sendReminderTool: Tool = {
  name: 'send_reminder',
  description:
    'Bayiye odeme hatirlatmasi gonderir ve collection_activities tablosuna kaydeder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dealer_id: {
        type: 'string',
        description: 'Bayi UUID',
      },
      amount_expected: {
        type: 'number',
        description: 'Beklenen odeme tutari',
      },
      due_date: {
        type: 'string',
        description: 'Vade tarihi (YYYY-MM-DD)',
      },
      notes: {
        type: 'string',
        description: 'Hatirlatma notu',
      },
    },
    required: ['dealer_id'],
  },
}

/**
 * log_collection_activity tool (TU-03) — records any collection activity.
 * Activity types: reminder_sent | call_made | visit | payment_received | note
 * Requires dealer_id and activity_type.
 */
const logCollectionActivityTool: Tool = {
  name: 'log_collection_activity',
  description:
    'Tahsilat aktivitesi kaydeder (arama, ziyaret, odeme alindi vb.).',
  input_schema: {
    type: 'object' as const,
    properties: {
      dealer_id: {
        type: 'string',
      },
      activity_type: {
        type: 'string',
        description: 'reminder_sent | call_made | visit | payment_received | note',
      },
      notes: {
        type: 'string',
      },
      amount_expected: {
        type: 'number',
      },
      due_date: {
        type: 'string',
        description: 'YYYY-MM-DD',
      },
    },
    required: ['dealer_id', 'activity_type'],
  },
}

/**
 * tahsilatUzmaniTools — exported array of exactly 3 tool definitions.
 * TU-02 and TU-03 are write operations (INSERT into collection_activities).
 * TU-01 is read-only (SELECT via dealer join).
 */
export const tahsilatUzmaniTools: Tool[] = [
  getOverduePaymentsTool,
  sendReminderTool,
  logCollectionActivityTool,
]

// ─── Internal helper interfaces ────────────────────────────────────────────

interface DealerIdRow {
  id: string
}

interface OverdueTransactionRow {
  id: string
  dealer_id: string
  amount: number
  due_date: string | null
  description: string | null
  reference_number: string | null
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createTahsilatUzmaniHandlers — factory that accepts a Supabase service-role client
 * and returns a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly to sync with TOOL_REGISTRY lookup.
 * Returns exactly 3 entries: 'get_overdue_payments', 'send_reminder', 'log_collection_activity'.
 *
 * IMPORTANT: collection_activities INSERT uses (supabase as any) — table not in DB types yet.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 3 handlers
 */
export function createTahsilatUzmaniHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  // ─── get_overdue_payments (TU-01) ─────────────────────────────────────────

  handlers.set('get_overdue_payments', async (input, context) => {
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 10

    // STEP 1: Scope via dealer join — dealer_transactions has NO company_id column.
    // Must first get dealer IDs that belong to this company.
    const { data: dealerRows, error: dealerError } = await supabase
      .from('dealers')
      .select('id')
      .eq('company_id', context.companyId)
      .eq('is_active', true)

    if (dealerError) {
      return `[Hata: Bayi sorgulama hatasi: ${dealerError.message}]`
    }

    if (!dealerRows || dealerRows.length === 0) {
      return JSON.stringify([])
    }

    const dealerIds = (dealerRows as DealerIdRow[]).map(d => d.id)

    // STEP 2: Query dealer_transactions WHERE dealer_id IN (dealerIds) AND due_date < today
    const today = new Date().toISOString().split('T')[0]

    const { data: transactions, error: txError } = await supabase
      .from('dealer_transactions')
      .select('id, dealer_id, amount, due_date, description, reference_number')
      .in('dealer_id', dealerIds)
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(limit)

    if (txError) {
      return `[Hata: ${txError.message}]`
    }
    if (!transactions || transactions.length === 0) {
      return JSON.stringify([])
    }

    return JSON.stringify(transactions as OverdueTransactionRow[])
  })

  // ─── send_reminder (TU-02) ────────────────────────────────────────────────

  handlers.set('send_reminder', async (input, context) => {
    if (!input.dealer_id) {
      return '[Hata: dealer_id gerekli]'
    }

    // INSERT into collection_activities — new table, use (supabase as any)
    const { error } = await (supabase as any)
      .from('collection_activities')
      .insert({
        company_id: context.companyId,
        dealer_id: String(input.dealer_id),
        activity_type: 'reminder_sent',
        notes: String(input.notes ?? 'Odeme hatirlatmasi gonderildi'),
        amount_expected: typeof input.amount_expected === 'number' ? input.amount_expected : null,
        due_date: typeof input.due_date === 'string' ? input.due_date : null,
      })

    if (error) {
      return `[Hata: ${error.message}]`
    }

    return `Hatirlatma kaydedildi. Bayi: ${String(input.dealer_id)}`
  })

  // ─── log_collection_activity (TU-03) ──────────────────────────────────────

  handlers.set('log_collection_activity', async (input, context) => {
    if (!input.dealer_id || !input.activity_type) {
      return '[Hata: dealer_id ve activity_type gerekli]'
    }

    // INSERT into collection_activities — new table, use (supabase as any)
    const { error } = await (supabase as any)
      .from('collection_activities')
      .insert({
        company_id: context.companyId,
        dealer_id: String(input.dealer_id),
        activity_type: String(input.activity_type),
        notes: typeof input.notes === 'string' ? input.notes : null,
        amount_expected: typeof input.amount_expected === 'number' ? input.amount_expected : null,
        due_date: typeof input.due_date === 'string' ? input.due_date : null,
      })

    if (error) {
      return `[Hata: ${error.message}]`
    }

    return `Aktivite kaydedildi: ${String(input.activity_type)}`
  })

  return handlers
}
