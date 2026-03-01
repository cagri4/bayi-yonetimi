import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx' // ONLY imported here — server-side only. Never import xlsx in client components.
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get dealer
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id, company_name')
    .eq('user_id', user.id)
    .single()

  if (!dealer) {
    return NextResponse.json({ error: 'Dealer not found' }, { status: 404 })
  }

  const dealerData = dealer as { id: string; company_name: string }

  // Fetch last 24 months from dealer_spending_summary materialized view
  const { data: rows } = await supabase
    .from('dealer_spending_summary')
    .select('month, total_debit, total_credit, net_balance')
    .eq('dealer_id', dealerData.id)
    .order('month', { ascending: false })

  // Map rows to Turkish column headers
  const wsData = (rows || []).map((r: any) => ({
    'Ay': r.month,
    'Toplam Borc (TL)': Number(r.total_debit ?? 0).toFixed(2),
    'Toplam Alacak (TL)': Number(r.total_credit ?? 0).toFixed(2),
    'Net Bakiye (TL)': Number(r.net_balance ?? 0).toFixed(2),
  }))

  // Build workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(wsData)

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Ay
    { wch: 22 }, // Toplam Borc
    { wch: 22 }, // Toplam Alacak
    { wch: 20 }, // Net Bakiye
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Harcama Analizi')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fileName = `harcama-analizi-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
