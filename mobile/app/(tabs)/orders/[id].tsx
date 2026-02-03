import { useEffect, useState, useCallback } from 'react'
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'

import { Text, View } from '@/components/Themed'
import { getOrder, getOrderStatusHistory, Order, OrderStatusHistoryItem } from '@/lib/queries'

// Status badge colors
const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#f3f4f6', text: '#4b5563' },
  confirmed: { bg: '#dbeafe', text: '#1d4ed8' },
  preparing: { bg: '#fef3c7', text: '#b45309' },
  shipped: { bg: '#e0e7ff', text: '#4338ca' },
  delivered: { bg: '#d1fae5', text: '#059669' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
}

// Timeline dot colors
const timelineColors: Record<string, string> = {
  pending: '#9ca3af',
  confirmed: '#3b82f6',
  preparing: '#f59e0b',
  shipped: '#6366f1',
  delivered: '#10b981',
  cancelled: '#ef4444',
}

function OrderStatusBadge({ status }: { status: { code: string; name: string } }) {
  const colors = statusColors[status.code] || { bg: '#f3f4f6', text: '#4b5563' }

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{status.name}</Text>
    </View>
  )
}

function StatusTimeline({ history }: { history: OrderStatusHistoryItem[] }) {
  return (
    <View style={styles.timeline}>
      {history.map((item, index) => {
        const isLast = index === history.length - 1
        const dotColor = timelineColors[item.status.code] || '#9ca3af'
        const date = new Date(item.created_at)
        const formattedDate = date.toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <View key={item.id} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
              {!isLast && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStatus}>{item.status.name}</Text>
              <Text style={styles.timelineDate}>{formattedDate}</Text>
              {item.notes && (
                <Text style={styles.timelineNotes}>{item.notes}</Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [history, setHistory] = useState<OrderStatusHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadOrderData = useCallback(async () => {
    if (!id) return

    try {
      const [orderData, historyData] = await Promise.all([
        getOrder(id),
        getOrderStatusHistory(id),
      ])
      setOrder(orderData)
      setHistory(historyData)
    } catch (error) {
      console.error('Error loading order:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    loadOrderData()
  }, [loadOrderData])

  // Reload when screen comes into focus (e.g., for realtime status updates)
  useFocusEffect(
    useCallback(() => {
      loadOrderData()
    }, [loadOrderData])
  )

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadOrderData()
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Siparis bulunamadi</Text>
      </View>
    )
  }

  const createdDate = new Date(order.created_at)
  const formattedCreatedDate = createdDate.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Order Header */}
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <OrderStatusBadge status={order.status} />
        </View>
        <Text style={styles.orderDate}>Siparis Tarihi: {formattedCreatedDate}</Text>
      </View>

      {/* Order Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Urunler</Text>
        {order.items?.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.itemRow,
              index < (order.items?.length || 0) - 1 && styles.itemRowBorder
            ]}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemCode}>{item.product_code}</Text>
              <Text style={styles.itemQuantity}>Adet: {item.quantity}</Text>
            </View>
            <View style={styles.itemPriceContainer}>
              <Text style={styles.itemPrice}>
                {item.total_price.toLocaleString('tr-TR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} TL
              </Text>
              <Text style={styles.unitPrice}>
                {item.unit_price.toLocaleString('tr-TR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} TL/adet
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Order Total */}
      <View style={styles.section}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Ara Toplam</Text>
          <Text style={styles.totalValue}>
            {order.subtotal.toLocaleString('tr-TR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} TL
          </Text>
        </View>
        {order.discount_amount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Indirim</Text>
            <Text style={[styles.totalValue, styles.discountValue]}>
              -{order.discount_amount.toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} TL
            </Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={[styles.totalLabel, styles.grandTotalLabel]}>Toplam</Text>
          <Text style={[styles.totalValue, styles.grandTotalValue]}>
            {order.total_amount.toLocaleString('tr-TR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} TL
          </Text>
        </View>
      </View>

      {/* Order Notes */}
      {order.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siparis Notu</Text>
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      )}

      {/* Status Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Siparis Durumu</Text>
        <StatusTimeline history={history} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  itemInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemCode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#333',
  },
  itemPriceContainer: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  unitPrice: {
    fontSize: 12,
    color: '#666',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  discountValue: {
    color: '#059669',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontWeight: '600',
    color: '#000',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  timeline: {
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 60,
    backgroundColor: 'transparent',
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  timelineStatus: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  timelineNotes: {
    fontSize: 13,
    color: '#333',
    fontStyle: 'italic',
  },
})
