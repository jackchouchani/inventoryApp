import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { SimpleBarcodeScanner } from '../../src/components/SimpleBarcodeScanner';

const SimpleBarcodeScanPage = () => {
  const router = useRouter();
  const [showScanner, setShowScanner] = React.useState(false);

  const handleCodeDetected = (code: string) => {
    console.log('Code détecté dans la page principale:', code);
    // Si vous voulez revenir à l'écran précédent après détection
    // setTimeout(() => {
    //   setShowScanner(false);
    //   router.back();
    // }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      {showScanner ? (
        <SimpleBarcodeScanner
          onClose={() => setShowScanner(false)}
          onCodeDetected={handleCodeDetected}
        />
      ) : (
        <View style={styles.startScreen}>
          <Text style={styles.title}>Test Scanner Simple</Text>
          <Text style={styles.description}>
            Ce scanner est conçu spécifiquement pour tester la détection des codes-barres
            Code128 pour les articles numériques.
          </Text>
          
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => setShowScanner(true)}
          >
            <Text style={styles.buttonText}>Lancer le scanner</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  startScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#666',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SimpleBarcodeScanPage; 