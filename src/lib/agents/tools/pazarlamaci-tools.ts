/**
 * Pazarlamaci (Marketing) agent tool definitions and handler implementations.
 * Phase 12 — Plan 03
 *
 * 3 tools: analyze_campaigns, segment_dealers, suggest_campaign
 *
 * Handler factory receives a Supabase service-role client. Every handler receives
 * AgentContext for tenant isolation (companyId on every query).
 *
 * PZ-03 ADVISORY-ONLY ENFORCEMENT: suggest_campaign makes NO database writes.
 * It returns a formatted recommendation string based on inputs only.
 *
 * Exports:
 *   - pazarlamaciTools: Tool[] — array of exactly 3 tool definitions
 *   - createPazarlamaciHandlers: factory function returning Map<string, HandlerFn>
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from '../types'

// ─── Handler Type ──────────────────────────────────────────────────────────

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

// ─── Tool Definitions ──────────────────────────────────────────────────────

/**
 * analyze_campaigns tool (PZ-01) — queries campaigns and order counts for the company.
 * Aggregates order counts and amounts per campaign period.
 * All queries scoped by company_id.
 */
const analyzeCampaignsTool: Tool = {
  name: 'analyze_campaigns',
  description:
    'Aktif ve gecmis kampanyalari analiz eder. Siparis sayisi ve ciro bilgisi ile kampanya etkinligini degerlendirir.',
  input_schema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Analiz edilecek kampanya sayisi (varsayilan: 5)',
      },
    },
    required: [],
  },
}

/**
 * segment_dealers tool (PZ-02) — groups dealers by order volume and recency.
 * Segments: yuksek (high > 10000 TL), orta (medium 1000-10000), dusuk (low < 1000), aktif degil (inactive).
 * Analysis period configurable via period_days parameter.
 */
const segmentDealersTool: Tool = {
  name: 'segment_dealers',
  description:
    'Bayileri siparis hacmi ve aktivitelerine gore segmentlere ayirir (yuksek, orta, dusuk, aktif degil).',
  input_schema: {
    type: 'object' as const,
    properties: {
      period_days: {
        type: 'number',
        description: 'Analiz donemi gun sayisi (varsayilan: 90)',
      },
    },
    required: [],
  },
}

/**
 * suggest_campaign tool (PZ-03) — advisory-only campaign recommendation.
 * NO database writes — returns a formatted Turkish suggestion string only.
 * Based on target_segment and campaign_type inputs.
 */
const suggestCampaignTool: Tool = {
  name: 'suggest_campaign',
  description:
    'Mevcut kampanya ve segment verilerine dayanarak yeni kampanya onerisi sunar. Sadece danismanlik — veritabanina yazmaz.',
  input_schema: {
    type: 'object' as const,
    properties: {
      target_segment: {
        type: 'string',
        description: 'Hedef segment (yuksek | orta | dusuk | hepsi)',
      },
      campaign_type: {
        type: 'string',
        description: 'Kampanya turu onerisi (indirim | sadakat | yeni_urun)',
      },
    },
    required: [],
  },
}

/**
 * pazarlamaciTools — exported array of exactly 3 tool definitions.
 * analyze_campaigns (PZ-01), segment_dealers (PZ-02), suggest_campaign (PZ-03).
 * PZ-03 is advisory-only — no DB writes in its handler.
 */
export const pazarlamaciTools: Tool[] = [analyzeCampaignsTool, segmentDealersTool, suggestCampaignTool]

// ─── Internal Types ────────────────────────────────────────────────────────

interface CampaignRow {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  is_active: boolean
}

interface OrderRow {
  dealer_id: string
  total_amount: number
}

interface DealerRow {
  id: string
}

// ─── Handler Implementations ───────────────────────────────────────────────

/**
 * Handles analyze_campaigns tool calls (PZ-01).
 * - Queries campaigns WHERE company_id = context.companyId ordered by created_at DESC
 * - Also queries total order count for the company
 * - Returns JSON with campaigns and total_orders_in_period
 */
async function handleAnalyzeCampaigns(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const limit = typeof input['limit'] === 'number' ? input['limit'] : 5

  const { data: campaigns, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, description, start_date, end_date, is_active')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (campaignError) {
    return `[Hata: ${campaignError.message}]`
  }

  const campaignData = (campaigns as unknown as CampaignRow[] | null) ?? []

  // Get total order count for the company
  const { count: orderCount, error: orderError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', context.companyId)

  const totalOrders = orderError ? null : orderCount

  return JSON.stringify({
    campaigns: campaignData,
    total_orders_in_period: totalOrders,
  })
}

/**
 * Handles segment_dealers tool calls (PZ-02).
 * - Queries orders for the company within the analysis period (period_days)
 * - Groups by dealer_id in JavaScript, calculates total_amount per dealer
 * - Segments: yuksek (> 10000), orta (1000-10000), dusuk (< 1000)
 * - Queries all dealers to find those with 0 orders (aktif degil)
 * - Returns JSON with segment counts and sample dealer IDs per segment
 */
async function handleSegmentDealers(
  input: Record<string, unknown>,
  context: AgentContext,
  supabase: SupabaseClient<Database>,
): Promise<string> {
  const periodDays = typeof input['period_days'] === 'number' ? input['period_days'] : 90
  const sinceDate = new Date(Date.now() - periodDays * 86400000).toISOString()

  // Query orders within the analysis period for this company
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('dealer_id, total_amount')
    .eq('company_id', context.companyId)
    .gte('created_at', sinceDate)

  if (orderError) {
    return `[Hata: ${orderError.message}]`
  }

  // Group by dealer_id and sum total_amount
  const dealerTotals = new Map<string, number>()
  for (const order of (orders as OrderRow[] | null) ?? []) {
    const current = dealerTotals.get(order.dealer_id) ?? 0
    dealerTotals.set(order.dealer_id, current + (order.total_amount ?? 0))
  }

  // Segment dealers by order volume
  const segments: Record<string, string[]> = {
    yuksek: [],
    orta: [],
    dusuk: [],
  }

  for (const [dealerId, total] of dealerTotals) {
    if (total > 10000) {
      segments['yuksek'].push(dealerId)
    } else if (total >= 1000) {
      segments['orta'].push(dealerId)
    } else {
      segments['dusuk'].push(dealerId)
    }
  }

  // Query all dealers to find inactive ones (0 orders in period)
  const { data: allDealers, error: dealerError } = await supabase
    .from('dealers')
    .select('id')
    .eq('company_id', context.companyId)
    .eq('is_active', true)

  const activeDealerIds = new Set(dealerTotals.keys())
  const inactiveDealers: string[] = []

  if (!dealerError && allDealers) {
    for (const dealer of allDealers as DealerRow[]) {
      if (!activeDealerIds.has(dealer.id)) {
        inactiveDealers.push(dealer.id)
      }
    }
  }

  return JSON.stringify({
    period_days: periodDays,
    segments: {
      yuksek: {
        count: segments['yuksek'].length,
        sample_dealer_ids: segments['yuksek'].slice(0, 5),
        threshold: '> 10000 TL',
      },
      orta: {
        count: segments['orta'].length,
        sample_dealer_ids: segments['orta'].slice(0, 5),
        threshold: '1000 - 10000 TL',
      },
      dusuk: {
        count: segments['dusuk'].length,
        sample_dealer_ids: segments['dusuk'].slice(0, 5),
        threshold: '< 1000 TL',
      },
      aktif_degil: {
        count: inactiveDealers.length,
        sample_dealer_ids: inactiveDealers.slice(0, 5),
        threshold: 'Son ' + periodDays + ' gunde siparis yok',
      },
    },
  })
}

/**
 * Handles suggest_campaign tool calls (PZ-03).
 * PZ-03 ADVISORY-ONLY: NO database reads or writes.
 * Returns a formatted Turkish campaign suggestion string based on inputs only.
 */
async function handleSuggestCampaign(
  input: Record<string, unknown>,
  _context: AgentContext,
): Promise<string> {
  const targetSegment =
    typeof input['target_segment'] === 'string' ? input['target_segment'] : 'hepsi'
  const campaignType =
    typeof input['campaign_type'] === 'string' ? input['campaign_type'] : 'indirim'

  return (
    `Kampanya Onerisi: ${targetSegment} segmentine yonelik ${campaignType} kampanyasi. ` +
    `Onerilen sure: 2 hafta. ` +
    `Beklenen etki: Siparis sayisinda %10-20 artis.`
  )
}

// ─── Handler Factory ───────────────────────────────────────────────────────

/**
 * createPazarlamaciHandlers — factory that accepts a Supabase client and returns
 * a Map of handler functions keyed by tool name.
 *
 * Handler names MUST match tool names exactly to sync with TOOL_REGISTRY lookup.
 * Returns exactly 3 entries: 'analyze_campaigns', 'segment_dealers', 'suggest_campaign'.
 *
 * All read handlers scoped by context.companyId for tenant isolation.
 * suggest_campaign is advisory-only: NO DB reads or writes.
 *
 * @param supabase - Service role Supabase client for bypassing RLS
 * @returns Map<string, HandlerFn> with 3 handlers (2 read, 1 advisory)
 */
export function createPazarlamaciHandlers(
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  const handlers = new Map<string, HandlerFn>()

  handlers.set('analyze_campaigns', (input, context) =>
    handleAnalyzeCampaigns(input, context, supabase),
  )

  handlers.set('segment_dealers', (input, context) =>
    handleSegmentDealers(input, context, supabase),
  )

  // suggest_campaign is advisory-only — no supabase calls
  handlers.set('suggest_campaign', (input, context) => handleSuggestCampaign(input, context))

  return handlers
}
