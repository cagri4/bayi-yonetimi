import { useEffect, useState, useCallback } from 'react'
import { View, FlatList, ActivityIndicator, Text, StyleSheet, RefreshControl } from 'react-native'
import { getProducts, getDealerProfile, Product } from '@/lib/queries'
import { ProductCard } from '@/components/ProductCard'
import { useSession } from '@/components/SessionProvider'

export default function CatalogScreen() {
  const { session } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dealerId, setDealerId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!session?.user?.id) return

    // Get dealer ID first
    const profile = await getDealerProfile(session.user.id)
    if (!profile?.id) {
      setLoading(false)
      return
    }
    setDealerId(profile.id)

    // Load products with dealer pricing
    const data = await getProducts(profile.id)
    setProducts(data)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const renderItem = useCallback(({ item }: { item: Product }) => (
    <ProductCard product={item} />
  ), [])

  const keyExtractor = useCallback((item: Product) => item.id, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (products.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Urun bulunamadi</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={styles.list}
      // FlatList optimization
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
    />
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  list: {
    paddingVertical: 8,
  },
})
