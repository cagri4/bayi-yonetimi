import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Product } from '@/lib/queries'
import { useCartStore } from '@/lib/cart'
import { router } from 'expo-router'

type Props = {
  product: Product
}

export function ProductCard({ product }: Props) {
  const addItem = useCartStore((state) => state.addItem)

  const handlePress = () => {
    router.push(`/catalog/${product.id}`)
  }

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unitPrice: product.dealer_price || product.base_price,
      imageUrl: product.image_url,
    })
  }

  const price = product.dealer_price || product.base_price
  const hasDiscount = product.dealer_price && product.dealer_price < product.base_price

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>Gorsel Yok</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.sku}>{product.sku}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price.toLocaleString('tr-TR')} TL</Text>
          {hasDiscount && (
            <Text style={styles.originalPrice}>
              {product.base_price.toLocaleString('tr-TR')} TL
            </Text>
          )}
        </View>
        <Text style={styles.stock}>
          {product.stock_quantity > 0 ? `Stok: ${product.stock_quantity}` : 'Stokta Yok'}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.addButton, product.stock_quantity === 0 && styles.addButtonDisabled]}
        onPress={handleAddToCart}
        disabled={product.stock_quantity === 0}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 10,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  sku: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  stock: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
})
