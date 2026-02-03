import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { useCartStore, CartItem } from '@/lib/cart'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

export default function CartScreen() {
  const { items, updateQuantity, removeItem, getTotal } = useCartStore()

  const handleCheckout = () => {
    // Navigate to order confirmation (will be implemented in 03-05)
    router.push('/checkout')
  }

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={styles.item}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.productName}</Text>
        <Text style={styles.sku}>{item.sku}</Text>
        <Text style={styles.price}>{item.unitPrice.toLocaleString('tr-TR')} TL</Text>
      </View>
      <View style={styles.quantity}>
        <TouchableOpacity
          onPress={() => updateQuantity(item.productId, item.quantity - 1)}
          style={styles.qtyButton}
        >
          <Ionicons name="remove" size={20} color="#000" />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity
          onPress={() => updateQuantity(item.productId, item.quantity + 1)}
          style={styles.qtyButton}
        >
          <Ionicons name="add" size={20} color="#000" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => removeItem(item.productId)}>
        <Ionicons name="trash-outline" size={20} color="#f00" />
      </TouchableOpacity>
    </View>
  )

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="cart-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>Sepetiniz bos</Text>
        <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/')}>
          <Text style={styles.browseButtonText}>Urunlere Goz At</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.list}
      />
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Toplam:</Text>
          <Text style={styles.totalValue}>{getTotal().toLocaleString('tr-TR')} TL</Text>
        </View>
        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutButtonText}>Siparis Ver</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16 },
  item: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  image: { width: 60, height: 60, borderRadius: 8 },
  placeholder: { backgroundColor: '#f0f0f0' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 14, fontWeight: '600' },
  sku: { fontSize: 12, color: '#666' },
  price: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  quantity: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  qtyButton: { padding: 8 },
  qtyText: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', marginTop: 16 },
  browseButton: { marginTop: 16, padding: 12, backgroundColor: '#000', borderRadius: 8 },
  browseButtonText: { color: '#fff', fontWeight: '600' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  totalLabel: { fontSize: 18 },
  totalValue: { fontSize: 18, fontWeight: 'bold' },
  checkoutButton: { backgroundColor: '#000', borderRadius: 8, padding: 16, alignItems: 'center' },
  checkoutButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
