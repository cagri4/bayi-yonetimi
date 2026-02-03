import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { supabase } from './supabase'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Register for push notifications and get the Expo push token.
 * Returns the token string or null if registration failed.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device')
    return null
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permissions not granted')
    return null
  }

  try {
    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const response = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    })
    token = response.data
    console.log('Expo Push Token:', token)
  } catch (error) {
    console.error('Error getting push token:', error)
    return null
  }

  // Android-specific notification channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Siparis Bildirimleri',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
      sound: 'default',
    })
  }

  return token
}

/**
 * Save the push token to the database for the current user.
 */
export async function savePushTokenToDatabase(token: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('No user found when saving push token')
      return false
    }

    const { error } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', user.id)

    if (error) {
      console.error('Error saving push token:', error)
      return false
    }

    console.log('Push token saved to database')
    return true
  } catch (error) {
    console.error('Error saving push token:', error)
    return false
  }
}

/**
 * Set up notification response listener for handling notification taps.
 * Returns a cleanup function to remove the listener.
 */
export function setupNotificationResponseListener(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data

      // Navigate to order detail if order_id is present
      if (data?.order_id) {
        router.push(`/(tabs)/orders/${data.order_id}`)
      }
    }
  )

  return () => subscription.remove()
}

/**
 * Set up notification received listener for handling notifications while app is open.
 * Returns a cleanup function to remove the listener.
 */
export function setupNotificationReceivedListener(): () => void {
  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received:', notification.request.content)
    }
  )

  return () => subscription.remove()
}

/**
 * Get the last notification response (for when app is opened from notification).
 */
export async function getLastNotificationResponse() {
  return await Notifications.getLastNotificationResponseAsync()
}

/**
 * Schedule a local notification (for testing purposes).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: null, // Send immediately
  })

  return identifier
}
