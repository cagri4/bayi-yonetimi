import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { SessionProvider, useSession } from '@/components/SessionProvider';
import {
  registerForPushNotificationsAsync,
  savePushTokenToDatabase,
  setupNotificationResponseListener,
  setupNotificationReceivedListener,
  getLastNotificationResponse,
} from '@/lib/notifications';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SessionProvider>
      <RootLayoutNav />
    </SessionProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useSession();
  const notificationListenerRef = useRef<(() => void) | null>(null);
  const responseListenerRef = useRef<(() => void) | null>(null);

  // Register for push notifications when user is logged in
  useEffect(() => {
    if (!session) {
      // Clean up listeners when logged out
      if (notificationListenerRef.current) {
        notificationListenerRef.current();
        notificationListenerRef.current = null;
      }
      if (responseListenerRef.current) {
        responseListenerRef.current();
        responseListenerRef.current = null;
      }
      return;
    }

    // Register for push notifications
    const registerPushNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await savePushTokenToDatabase(token);
      }
    };

    registerPushNotifications();

    // Set up notification listeners
    notificationListenerRef.current = setupNotificationReceivedListener();
    responseListenerRef.current = setupNotificationResponseListener();

    // Check if app was opened from a notification
    const checkInitialNotification = async () => {
      const response = await getLastNotificationResponse();
      if (response) {
        const data = response.notification.request.content.data;
        // Navigation will be handled by the response listener
        console.log('App opened from notification:', data);
      }
    };

    checkInitialNotification();

    // Cleanup on unmount
    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current();
      }
    };
  }, [session]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="(auth)" />
        ) : (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="checkout" options={{ headerShown: true, title: 'Siparis Onayi' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true }} />
          </>
        )}
      </Stack>
    </ThemeProvider>
  );
}
