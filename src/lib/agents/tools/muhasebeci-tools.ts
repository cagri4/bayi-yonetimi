/**
 * Muhasebeci (Accountant) agent tool definitions and handler implementations.
 * Phase 11 — Plan 01
 *
 * MH-READ-ONLY ENFORCEMENT: This file contains ONLY SELECT-based tools and RPC calls.
 * No INSERT, UPDATE, or DELETE operations exist in this file — by design.
 * The Muhasebeci agent is a read-only financial agent.
 *
 * 5 tools: get_financials, get_payment_history, get_invoices, get_dealer_balance, export_report
 *
 * Handler factory receives a Supabase service-role client. Every handler receives
 * AgentContext for tenant isolation (dealerId on every dealer_transactions query).
 *
 * MH-06 HALLUCINATION PREVENTION:
 * Each tool description includes a Turkish instruction reminding Claude to call
 * the tool before stating any financial number. No financial number without a tool call.
 *
 * Exports:
 *   - muhasebeciTools: Tool[] — array of exactly 5 tool definitions
 *   - createMuhasebeciHandlers: factory function returning Map<string, HandlerFn>
 *   - getFinancialsTool — individually exported for GM reuse in Plan 03
 *   - getPaymentHistoryTool — individually exported for GM reuse in Plan 03
 *   - getInvoicesTool — individually exported for GM reuse in Plan 03
 *   - getDealerBalanceTool — individually exported for GM reuse in Plan 03
 *   - exportReportTool — individually exported for GM reuse in Plan 03
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * get_financials tool (MH-01) — queries dealer transaction history with JOIN on transaction_types.
 * Dealer-scoped: results filtered by context.dealerId on dealer_id column.
 * IMPORTANT: dealer_transactions has NO company_id column — use dealer_id only.
 * MH-06: Description includes hallucination prevention instruction.
 */
export const getFinancialsTool: Tool = {
  name: 'get_financials',
  description:
    'Bayinin cari hesap islemlerini getirir. Tarih araligi ve limit ile filtreleme yapilabilir. ' +
    'ONEMLI: Herhangi bir finansal rakam soylemeden once bu araci cagir. Tahmin yapma.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maksimum islem sayisi (varsayilan: 10, maksimum: 20)',
      },
      start_date: {
        type: 'string',
        description: 'Baslangic tarihi (ISO 8601 formati, ornek: 2026-01-01)',
      },
      end_date: {
        type: 'string',
        description: 'Bitis tarihi (ISO 8601 formati, ornek: 2026-12-31)',
      },
    },
    required: [],
  },
}

/**
 * get_payment_history tool (MH-02) — queries dealer payment and credit note transactions.
 * Filters by transaction_type code IN ('payment', 'credit_note') via JS post-query filter.
 * Dealer-scoped: results filtered by context.dealerId on dealer_id column.
 * MH-06: Description includes hallucination prevention instruction.
 */
export const getPaymentHistoryTool: Tool = {
  name: 'get_payment_history',
  description:
    'Bayinin odeme gecmisini ve alacak notlarini getirir. ' +
    'ONEMLI: Odeme bilgisi soylemeden once bu araci cagir. Tahmin yapma.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maksimum odeme kaydi sayisi (varsayilan: 10, maksimum: 20)',
      },
      start_date: {
        type: 'string',
        description: 'Baslangic tarihi (ISO 8601 formati)',
      },
      end_date: {
        type: 'string',
        description: 'Bitis tarihi (ISO 8601 formati)',
      },
    },
    required: [],
  },
}

/**
 * get_invoices tool (MH-03) — queries dealer_invoices scoped by dealer_id.
 * Returns metadata only (invoice_number, invoice_date, total_amount, file_name, created_at).
 * NO signed URL generation — Telegram is text-only; file download is web-only.
 * MH-06: Description includes hallucination prevention instruction.
 */
export const getInvoicesTool: Tool = {
  name: 'get_invoices',
  description:
    'Bayinin fatura listesini getirir (fatura numarasi, tarih, tutar, dosya adi). ' +
    'ONEMLI: Fatura bilgisi soylemeden once bu araci cagir. Tahmin yapma.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maksimum fatura sayisi (varsayilan: 10)',
      },
    },
    required: [],
  },
}

/**
 * get_dealer_balance tool (MH-04) — calls get_dealer_balance_breakdown RPC.
 * Uses context.dealerId as the parameter. No input required from Claude.
 * Returns total_debit, total_credit, net_balance with Turkish interpretation.
 * MH-06: Description explicitly prevents balance hallucination.
 */
export const getDealerBalanceTool: Tool = {
  name: 'get_dealer_balance',
  description:
    'Bayinin guncel bakiyesini getirir (toplam borc, toplam odeme, net bakiye). ' +
    'Bakiye bilgisi icin bu araci kullan. Tahmin yapma.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

/**
 * export_report tool (MH-05) — generates a plain-text formatted financial summary.
 * Fetches balance via RPC + recent transactions and formats as multi-line text.
 * Format is Telegram-compatible plain text — NOT CSV, NOT JSON.
 * Default date range: current month if start_date/end_date omitted.
 * MH-06: Description includes hallucination prevention instruction.
 */
export const exportReportTool: Tool = {
  name: 'export_report',
  description:
    'Belirtilen tarih araliginda finansal rapor olusturur (bakiye + islem ozeti). ' +
    'Tarih belirtilmezse mevcut ay kullanilir. ' +
    'ONEMLI: Rapor olusturmadan once bu araci cagir. Tahmin yapma.',
  input_schema: {
    type: 'object' as const,
    properties: {
      start_date: {
        type: 'string',
        description: 'Rapor baslangic tarihi (ISO 8601 formati, ornek: 2026-01-01)',
      },
      end_date: {
        type: 'string',
        description: 'Rapor bitis tarihi (ISO 8601 formati, ornek: 2026-01-31)',
      },
    },
    required: [],
  },
}

/**
 * muhasebeciTools — exported array of exactly 5 read-only tool definitions.
 * MH-READ-ONLY: No mutating tools exist in this array — only SELECT/RPC-based tools.
 */
export const muhasebeciTools: Tool[] = [
  getFinancialsTool,
  getPaymentHistoryTool,
  getInvoicesTool,
  getDealerBalanceTool,
  exportReportTool,
]

// ─── Internal Types ────────────────────────────────────────────────────────

interface TransactionRow {
  amount: number
  description: string | null
  reference_number: string | null
  transaction_date: string
  due_date: string | null
  transaction_type: {
    code: string
    name: string
    balance_effect: string
  } | null
}

interface InvoiceRow {
  id: string
  invoice_number: string
  invoice_date: string
  total_amount: number
  file_name: string | null
  created_at: string
}

interface BalanceResult {
  total_debit: number
  total_credit: number
  net_balance: number
}

// ─── Handler Implementations ───────────────────────────────────────────────

/**
 * Handles get_financials tool calls (MH-01).
 * - Queries dealer_transactions JOIN transaction_types scoped by dealer_id
 * - IMPORTANT: dealer_transactions has NO company_id column — only dealer_id
 * - Supports optional limit (max 20) and date range filtering
 */
async function handleGetFinancials(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const limit = typeof input['limit'] === 'number' ? Math.min(input['limit'], 20) : 10
  const startDate = typeof input['start_date'] === 'string' ? input['start_date'] : null
  const endDate = typeof input['end_date'] === 'string' ? input['end_date'] : null

  let query = supabase
    .from('dealer_transactions')
    .select('amount, description, reference_number, transaction_date, due_date, transaction_type:transaction_types(code, name, balance_effect)')
    .eq('dealer_id', context.dealerId)
    .order('transaction_date', { ascending: false })
    .limit(limit)

  if (startDate) {
    query = query.gte('transaction_date', startDate)
  }
  if (endDate) {
    query = query.lte('transaction_date', endDate)
  }

  const { data: transactions, error } = await query

  if (error) {
    return `[Hata: ${error.message}]`
  }
  if (!transactions || transactions.length === 0) {
    return '[Kayit bulunamadi]'
  }

  return JSON.stringify(transactions as unknown as TransactionRow[])
}

/**
 * Handles get_payment_history tool calls (MH-02).
 * - Queries dealer_transactions JOIN transaction_types scoped by dealer_id
 * - Filters post-query: only payment and credit_note transaction types
 * - IMPORTANT: dealer_transactions has NO company_id column — only dealer_id
 */
async function handleGetPaymentHistory(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  // Fetch more than limit to allow post-filter on payment/credit_note types
  const limit = typeof input['limit'] === 'number' ? Math.min(input['limit'], 20) : 10
  const startDate = typeof input['start_date'] === 'string' ? input['start_date'] : null
  const endDate = typeof input['end_date'] === 'string' ? input['end_date'] : null

  let query = supabase
    .from('dealer_transactions')
    .select('amount, description, reference_number, transaction_date, due_date, transaction_type:transaction_types(code, name, balance_effect)')
    .eq('dealer_id', context.dealerId)
    .order('transaction_date', { ascending: false })
    // Fetch extra records to allow filtering; actual limit enforced after
    .limit(limit * 5)

  if (startDate) {
    query = query.gte('transaction_date', startDate)
  }
  if (endDate) {
    query = query.lte('transaction_date', endDate)
  }

  const { data: transactions, error } = await query

  if (error) {
    return `[Hata: ${error.message}]`
  }
  if (!transactions || transactions.length === 0) {
    return '[Kayit bulunamadi]'
  }

  // Filter to payment and credit_note types only, then apply limit
  const paymentTypes = new Set(['payment', 'credit_note'])
  const filtered = (transactions as unknown as TransactionRow[])
    .filter((t) => t.transaction_type && paymentTypes.has(t.transaction_type.code))
    .slice(0, limit)

  if (filtered.length === 0) {
    return '[Odeme kaydi bulunamadi]'
  }

  return JSON.stringify(filtered)
}

/**
 * Handles get_invoices tool calls (MH-03).
 * - Queries dealer_invoices scoped by dealer_id
 * - Returns metadata only: NO signed URL generation (Telegram is text-only)
 * - Supports optional limit
 */
async function handleGetInvoices(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const limit = typeof input['limit'] === 'number' ? Math.min(input['limit'], 20) : 10

  const { data: invoices, error } = await supabase
    .from('dealer_invoices')
    .select('id, invoice_number, invoice_date, total_amount, file_name, created_at')
    .eq('dealer_id', context.dealerId)
    .order('invoice_date', { ascending: false })
    .limit(limit)

  if (error) {
    return `[Hata: ${error.message}]`
  }
  if (!invoices || invoices.length === 0) {
    return '[Kayit bulunamadi]'
  }

  return JSON.stringify(invoices as InvoiceRow[])
}

/**
 * Handles get_dealer_balance tool calls (MH-04).
 * - Calls get_dealer_balance_breakdown RPC with context.dealerId
 * - Returns total_debit, total_credit, net_balance with Turkish interpretation
 * - net_balance > 0 = dealer owes (Borc), < 0 = dealer is owed (Alacak), 0 = Sifir bakiye
 */
async function handleGetDealerBalance(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  // Suppress unused input warning
  void input

  const { data, error } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: context.dealerId })
    .single()

  if (error) {
    return `[Hata: ${error.message}]`
  }
  if (!data) {
    return '[Bakiye bilgisi bulunamadi]'
  }

  const balance = data as BalanceResult

  let interpretation: string
  if (balance.net_balance > 0) {
    interpretation = 'Borc (bayi borcu)'
  } else if (balance.net_balance < 0) {
    interpretation = 'Alacak (bayi alacagi)'
  } else {
    interpretation = 'Sifir bakiye'
  }

  return JSON.stringify({
    total_debit: balance.total_debit,
    total_credit: balance.total_credit,
    net_balance: balance.net_balance,
    interpretation,
  })
}

/**
 * Handles export_report tool calls (MH-05).
 * - Fetches balance via RPC and recent transactions within date range
 * - Formats as Telegram-compatible plain text with === FINANSAL RAPOR === header
 * - Defaults to current month if start_date/end_date omitted
 * - NOT CSV, NOT JSON — multi-line text output only
 */
async function handleExportReport(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  // Default to current month if dates omitted
  const now = new Date()
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const startDate = typeof input['start_date'] === 'string' ? input['start_date'] : defaultStart
  const endDate = typeof input['end_date'] === 'string' ? input['end_date'] : defaultEnd

  // Fetch balance via RPC
  const { data: balanceData, error: balanceError } = await (supabase as any)
    .rpc('get_dealer_balance_breakdown', { p_dealer_id: context.dealerId })
    .single()

  // Fetch transactions in date range
  const { data: transactions, error: txError } = await supabase
    .from('dealer_transactions')
    .select('amount, description, reference_number, transaction_date, transaction_type:transaction_types(code, name, balance_effect)')
    .eq('dealer_id', context.dealerId)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: false })
    .limit(20)

  const balance = balanceData as BalanceResult | null
  const txList = (transactions as unknown as TransactionRow[] | null) ?? []

  // Build plain-text report
  const lines: string[] = []
  lines.push('=== FINANSAL RAPOR ===')
  lines.push(`Donem: ${startDate} - ${endDate}`)
  lines.push('')

  if (!balanceError && balance) {
    lines.push('--- BAKIYE ---')
    lines.push(`Toplam Borc: ${balance.total_debit.toFixed(2)} TL`)
    lines.push(`Toplam Odeme: ${balance.total_credit.toFixed(2)} TL`)
    lines.push(`Net Bakiye: ${balance.net_balance.toFixed(2)} TL`)
    lines.push('')
  }

  if (txError || txList.length === 0) {
    lines.push('--- ISLEMLER ---')
    lines.push('Bu donemde islem bulunamadi.')
  } else {
    lines.push(`--- ISLEMLER (${txList.length} kayit) ---`)
    for (const tx of txList) {
      const effect = tx.transaction_type?.balance_effect === 'debit' ? 'Borc' : 'Odeme'
      const desc = tx.description ?? tx.reference_number ?? '-'
      lines.push(`${tx.transaction_date} | ${effect} | ${tx.amount.toFixed(2)} TL | ${desc}`)
    }
  }

  lines.push('')
  lines.push('=====================')

  return lines.join('\n')
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createMuhasebeciHandlers — factory that accepts a Supabase client and returns
 * a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly to sync with TOOL_REGISTRY lookup.
 * Returns exactly 5 entries: 'get_financials', 'get_payment_history', 'get_invoices',
 * 'get_dealer_balance', 'export_report'.
 *
 * All handlers are read-only (SELECT / RPC). No INSERT/UPDATE/DELETE in this factory.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 5 read-only handlers
 */
export function createMuhasebeciHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  handlers.set('get_financials', (input, context) =>
    handleGetFinancials(input, context, supabase),
  )

  handlers.set('get_payment_history', (input, context) =>
    handleGetPaymentHistory(input, context, supabase),
  )

  handlers.set('get_invoices', (input, context) =>
    handleGetInvoices(input, context, supabase),
  )

  handlers.set('get_dealer_balance', (input, context) =>
    handleGetDealerBalance(input, context, supabase),
  )

  handlers.set('export_report', (input, context) =>
    handleExportReport(input, context, supabase),
  )

  return handlers
}
