import { Stack } from 'expo-router'

export default function OrdersLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Siparislerim',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Siparis Detayi',
        }}
      />
    </Stack>
  )
}
