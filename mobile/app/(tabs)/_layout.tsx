import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { Pressable, Alert } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useSession } from '@/components/SessionProvider';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { signOut } = useSession();

  const handleSignOut = () => {
    Alert.alert(
      'Cikis Yap',
      'Hesabinizdan cikis yapmak istediginize emin misiniz?',
      [
        { text: 'Iptal', style: 'cancel' },
        { text: 'Cikis Yap', onPress: signOut, style: 'destructive' },
      ]
    );
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Katalog',
          tabBarIcon: ({ color }) => <TabBarIcon name="th-large" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Siparislerim',
          tabBarIcon: ({ color }) => <TabBarIcon name="list-alt" color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          headerRight: () => (
            <Pressable onPress={handleSignOut}>
              {({ pressed }) => (
                <FontAwesome
                  name="sign-out"
                  size={22}
                  color={Colors[colorScheme ?? 'light'].text}
                  style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                />
              )}
            </Pressable>
          ),
        }}
      />
    </Tabs>
  );
}
