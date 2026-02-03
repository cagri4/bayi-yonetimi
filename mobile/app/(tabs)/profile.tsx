import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useSession } from '@/components/SessionProvider';

export default function ProfileScreen() {
  const { session } = useSession();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.email}>{session?.user?.email}</Text>
      <Text style={styles.subtitle}>Profil bilgileriniz burada gorunecek</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  email: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
});
