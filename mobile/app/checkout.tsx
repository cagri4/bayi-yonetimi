import { useState } from 'react'
import {
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { Text, View } from '@/components/Themed'
import { createOrder, CartItem } from '@/lib/queries'

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ items?: string }>()
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Parse cart items from params
  const cartItems: CartItem[] = params.items ? JSON.parse(params.items) : []

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const handleSubmitOrder = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Hata', 'Sepetiniz bos')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await createOrder(cartItems, notes.trim() || undefined)

      if (result.success) {
        Alert.alert(
          'Basarili',
          `Siparisiniz olusturuldu.\nSiparis No: ${result.orderNumber}`,
          [
            {
              text: 'Tamam',
              onPress: () => {
                // Navigate to order detail
                router.replace(`/(tabs)/orders/${result.orderId}`)
              },
            },
          ]
        )
      } else {
        Alert.alert('Hata', result.message)
      }
    } catch (error) {
      Alert.alert('Hata', 'Siparis olusturulurken bir hata olustu')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (cartItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Sepetiniz bos</Text>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Kataloga Don</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Order Summary Header */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siparis Ozeti</Text>
          <Text style={styles.itemCount}>{cartItems.length} urun</Text>
        </View>

        {/* Cart Items */}
        <View style={styles.section}>
          {cartItems.map((item, index) => (
            <View key={item.productId} style={[
              styles.itemRow,
              index < cartItems.length - 1 && styles.itemRowBorder
            ]}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemCode}>{item.productCode}</Text>
                <Text style={styles.itemQuantity}>Adet: {item.quantity}</Text>
              </View>
              <View style={styles.itemPriceContainer}>
                <Text style={styles.itemPrice}>
                  {(item.price * item.quantity).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} TL
                </Text>
                <Text style={styles.unitPrice}>
                  {item.price.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} TL/adet
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Notes Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siparis Notu</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Siparisizle ilgili notlarinizi yazabilirsiniz..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Ara Toplam</Text>
            <Text style={styles.totalValue}>
              {subtotal.toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} TL
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.grandTotalLabel]}>Toplam</Text>
            <Text style={[styles.totalValue, styles.grandTotalValue]}>
              {subtotal.toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} TL
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmitOrder}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Siparisi Onayla</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  itemCount: {
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
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    backgroundColor: '#fff',
    color: '#000',
  },
  totalsSection: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
    backgroundColor: 'transparent',
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
  grandTotalLabel: {
    fontWeight: '600',
    color: '#000',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'transparent',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
})
