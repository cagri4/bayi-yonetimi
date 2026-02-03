import { useEffect, useState, useCallback } from 'react'
import {
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'

import { Text, View } from '@/components/Themed'
import { getDealerOrders, Order } from '@/lib/queries'

// Status badge colors
const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#f3f4f6', text: '#4b5563' },
  confirmed: { bg: '#dbeafe', text: '#1d4ed8' },
  preparing: { bg: '#fef3c7', text: '#b45309' },
  shipped: { bg: '#e0e7ff', text: '#4338ca' },
  delivered: { bg: '#d1fae5', text: '#059669' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
}

function OrderStatusBadge({ status }: { status: { code: string; name: string } }) {
  const colors = statusColors[status.code] || { bg: '#f3f4f6', text: '#4b5563' }

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{status.name}</Text>
    </View>
  )
}

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const createdDate = new Date(order.created_at)
  const formattedDate = createdDate.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>{order.order_number}</Text>
        <OrderStatusBadge status={order.status} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.orderDate}>{formattedDate}</Text>
        <Text style={styles.orderTotal}>
          {order.total_amount.toLocaleString('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} TL
        </Text>
      </View>
    </Pressable>
  )
}

export default function OrdersListScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadOrders = useCallback(async () => {
    try {
      const data = await getDealerOrders()
      setOrders(data)
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Load orders on initial mount
  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Reload orders when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadOrders()
    }, [loadOrders])
  )

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadOrders()
  }

  const handleOrderPress = (orderId: string) => {
    router.push(`/(tabs)/orders/${orderId}`)
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (orders.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Henuz siparisiniz yok</Text>
        <Text style={styles.emptySubtext}>Katalogdan urun ekleyerek siparis olusturabilirsiniz</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => handleOrderPress(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  separator: {
    height: 12,
    backgroundColor: 'transparent',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
})
