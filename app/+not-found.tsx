import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <MaterialIcons name="error-outline" size={64} color="#007AFF" />
      <Text style={styles.title}>Page introuvable</Text>
      <Text style={styles.message}>
        Désolé, la page que vous recherchez n'existe pas ou n'est plus disponible.
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(tabs)/stock')}
      >
        <MaterialIcons name="home" size={20} color="#007AFF" />
        <Text style={styles.buttonText}>Retourner à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 47 : 0,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1c1c1e',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 300,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
}); 