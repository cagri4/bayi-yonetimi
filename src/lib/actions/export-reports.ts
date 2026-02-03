'use server'

import { stringify } from 'csv-stringify/sync'
import { getTopProducts, getDealerPerformance, getSalesReport } from '@/lib/queries/reports'

/**
 * Export sales report as CSV with Turkish headers
 */
export async function exportSalesReportCSV(
  periodType: 'daily' | 'weekly' | 'monthly',
  startDate: string,
  endDate: string
): Promise<string> {
  const data = await getSalesReport(startDate, endDate, periodType)

  const rows = data.map((row) => ({
    Donem: row.period,
    Siparis_Sayisi: row.order_count,
    Toplam_Satis: row.total_sales,
    Ortalama_Siparis: row.avg_order_value,
  }))

  return stringify(rows, {
    header: true,
    columns: ['Donem', 'Siparis_Sayisi', 'Toplam_Satis', 'Ortalama_Siparis'],
  })
}

/**
 * Export top products report as CSV with Turkish headers
 */
export async function exportTopProductsCSV(
  startDate: string,
  endDate: string
): Promise<string> {
  // No limit for export - get all products
  const data = await getTopProducts(startDate, endDate, 1000)

  const rows = data.map((row) => ({
    Urun_Adi: row.product_name,
    SKU: row.sku,
    Siparis_Sayisi: row.order_count,
    Toplam_Adet: row.total_quantity,
    Toplam_Ciro: row.total_revenue,
  }))

  return stringify(rows, {
    header: true,
    columns: ['Urun_Adi', 'SKU', 'Siparis_Sayisi', 'Toplam_Adet', 'Toplam_Ciro'],
  })
}

/**
 * Export dealer performance report as CSV with Turkish headers
 */
export async function exportDealerPerformanceCSV(
  startDate: string,
  endDate: string
): Promise<string> {
  const data = await getDealerPerformance(startDate, endDate)

  const rows = data.map((row) => ({
    Bayi_Adi: row.company_name,
    Siparis_Sayisi: row.order_count,
    Toplam_Satis: row.total_sales,
    Ortalama_Siparis: row.avg_order_value,
    Siralama: row.sales_rank,
    Yuzde: row.sales_percentage,
  }))

  return stringify(rows, {
    header: true,
    columns: ['Bayi_Adi', 'Siparis_Sayisi', 'Toplam_Satis', 'Ortalama_Siparis', 'Siralama', 'Yuzde'],
  })
}
