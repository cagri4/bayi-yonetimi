/**
 * Daily Briefing Cron Route — GET /api/cron/daily-briefing
 *
 * Fires daily at 08:00 UTC via Vercel Cron (configured in vercel.json).
 * Sends proactive Telegram briefings for active agents.
 *
 * Phase 12 (AO-03): Implements Tahsilat Uzmani daily overdue payment briefing.
 *
 * Security: Requires Authorization: Bearer {CRON_SECRET} header.
 * Vercel automatically sends this header when calling cron routes.
 *
 * Multi-tenant: loops all companies with active agent_definitions + enrolled dealers.
 */
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service-client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  // 1. Auth check — CRON_SECRET must match
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  let briefingsSent = 0

  try {
    // 2. Find all companies that have tahsilat_uzmani agent active
    const tahsilatToken = process.env.TELEGRAM_BOT_TOKEN_TAHSILAT_UZMANI
    if (tahsilatToken) {
      // 2a. Get all companies with active tahsilat_uzmani agent
      const { data: agentDefs } = await supabase
        .from('agent_definitions')
        .select('company_id')
        .eq('role', 'tahsilat_uzmani')
        .eq('is_active', true)

      for (const agentDef of agentDefs ?? []) {
        const companyId = agentDef.company_id

        // 2b. Get dealers for this company with telegram_chat_id set (enrolled dealers)
        const { data: dealers } = await supabase
          .from('dealers')
          .select('id, telegram_chat_id')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .not('telegram_chat_id', 'is', null)

        if (!dealers || dealers.length === 0) continue

        // 2c. Get all dealer IDs for this company to scope dealer_transactions
        const { data: allDealers } = await supabase
          .from('dealers')
          .select('id')
          .eq('company_id', companyId)
          .eq('is_active', true)

        const dealerIds = (allDealers ?? []).map(d => d.id)

        if (dealerIds.length === 0) continue

        // 2d. Count overdue transactions for this company
        // dealer_transactions has no company_id — scope via dealer_id IN (...)
        const today = new Date().toISOString().split('T')[0]
        const { data: overdueData } = await supabase
          .from('dealer_transactions')
          .select('amount')
          .in('dealer_id', dealerIds)
          .lt('due_date', today)

        const overdueCount = overdueData?.length ?? 0
        const overdueTotal = (overdueData ?? []).reduce(
          (sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0),
          0
        )

        // 2e. Send briefing to each enrolled dealer
        const briefingText = overdueCount > 0
          ? `Gunluk Tahsilat Brifing: Vadesi gecmis ${overdueCount} alacak kaydedildi. Toplam tutar: ${overdueTotal.toLocaleString('tr-TR')} TL. Detaylar icin bot ile konusin.`
          : `Gunluk Tahsilat Brifing: Vadesi gecmis alacak bulunamadi. Iyi gunler!`

        for (const dealer of dealers) {
          if (!dealer.telegram_chat_id) continue

          try {
            const response = await fetch(
              `https://api.telegram.org/bot${tahsilatToken}/sendMessage`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: dealer.telegram_chat_id,
                  text: briefingText,
                }),
              }
            )
            if (response.ok) {
              briefingsSent++
            } else {
              const body = await response.text()
              console.error('[cron/daily-briefing] sendMessage error:', response.status, body)
            }
          } catch (err) {
            console.error('[cron/daily-briefing] sendMessage fetch error:', err)
          }
        }
      }
    } else {
      console.log('[cron/daily-briefing] TELEGRAM_BOT_TOKEN_TAHSILAT_UZMANI not configured — skipping tahsilat briefing')
    }
  } catch (err) {
    console.error('[cron/daily-briefing] error:', err)
  }

  return Response.json({ success: true, briefingsSent })
}
