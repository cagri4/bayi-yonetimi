import { TouchableOpacity, Text, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useCartStore } from '@/lib/cart'
import { router } from 'expo-router'

export function CartButton() {
  const itemCount = useCartStore((state) => state.getItemCount())

  return (
    <TouchableOpacity style={styles.button} onPress={() => router.push('/cart')}>
      <Ionicons name="cart-outline" size={24} color="#000" />
      {itemCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    marginRight: 16,
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -8,
    backgroundColor: '#f00',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
})
