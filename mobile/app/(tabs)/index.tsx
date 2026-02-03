import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function CatalogScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Katalog</Text>
      <Text style={styles.subtitle}>Urunler burada listelenecek</Text>
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
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
});
