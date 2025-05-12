import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCANNER_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.6;

/**
 * Composant de test minimal pour le scan de codes-barres
 * Ce composant est spécialement conçu pour tester la reconnaissance des codes Code128
 */
export const BarcodeTestScanner: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCodes, setScannedCodes] = useState<Array<{code: string, type: string, time: Date}>>([]);
  const [isTesting, setIsTesting] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  
  useEffect(() => {
    // En cas de permission manquante, la demander
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Gestionnaire de scan très simple
  const handleBarcodeScan = useCallback(async (result: BarcodeScanningResult) => {
    const { data, type, cornerPoints } = result;
    
    // Ajouter le code à la liste
    setScannedCodes(prev => [
      { code: data, type, time: new Date() },
      ...prev
    ]);
    
    // Afficher un message pour indiquer qu'un code a été détecté
    console.log(`⭐ CODE DÉTECTÉ: ${data}, Type: ${type}`);
    console.log(`Points du code: ${JSON.stringify(cornerPoints)}`);
    
    // Vibration courte pour indiquer la détection (si disponible)
    if (Platform.OS !== 'web' && 'vibrate' in navigator) {
      navigator.vibrate(100);
    }
  }, []);

  // Si la permission n'est pas accordée, afficher un message
  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.titleText}>Permission de caméra requise</Text>
        <TouchableOpacity style={styles.button} onPress={() => requestPermission()}>
          <Text style={styles.buttonText}>Autoriser la caméra</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Fermer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titleText}>Test Scanner de Codes-barres</Text>
        <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.instructionText}>
        Placez un code-barres Code128 devant la caméra pour le tester
      </Text>
      
      {/* Zone de la caméra */}
      <View style={styles.cameraContainer}>
        {isTesting ? (
          <CameraView
            style={styles.camera}
            onCameraReady={() => {
              console.log("📷 Caméra prête pour le test!");
              setCameraReady(true);
            }}
            onMountError={(error) => {
              console.error("Erreur de montage de la caméra:", error);
              Alert.alert("Erreur", "Impossible d'initialiser la caméra");
              setIsTesting(false);
            }}
            onBarcodeScanned={handleBarcodeScan}
            barcodeScannerSettings={{
              barcodeTypes: ['code128'],
              // interval: 500, // Intervalle entre les scans (ms) - Non supporté par l'API
            }}
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
              {!cameraReady && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#ffffff" />
                  <Text style={styles.loadingText}>Initialisation de la caméra...</Text>
                </View>
              )}
            </View>
          </CameraView>
        ) : (
          <View style={[styles.camera, { backgroundColor: '#111' }]}>
            <Text style={styles.errorText}>Caméra désactivée</Text>
          </View>
        )}
      </View>
      
      {/* Contrôles de test */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isTesting ? styles.stopButton : styles.startButton]}
          onPress={() => setIsTesting(!isTesting)}
        >
          <Text style={styles.buttonText}>
            {isTesting ? "Arrêter le test" : "Démarrer le test"}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={() => setScannedCodes([])}
        >
          <Text style={styles.buttonText}>Effacer les résultats</Text>
        </TouchableOpacity>
      </View>
      
      {/* Résultats de scan */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>
          Codes détectés: {scannedCodes.length}
        </Text>
        
        <ScrollView style={styles.resultsList}>
          {scannedCodes.map((item, index) => (
            <View key={index} style={styles.resultItem}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultType}>{item.type}</Text>
                <Text style={styles.resultTime}>
                  {item.time.toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.resultCode}>{item.code}</Text>
            </View>
          ))}
          
          {scannedCodes.length === 0 && (
            <Text style={styles.noResultsText}>
              Aucun code détecté. Présentez un code-barres à la caméra.
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginTop: Platform.OS === 'ios' ? 40 : 0,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  closeIcon: {
    padding: 5,
  },
  instructionText: {
    fontSize: 14,
    color: '#ddd',
    textAlign: 'center',
    marginBottom: 15,
  },
  cameraContainer: {
    width: '100%',
    height: SCANNER_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
  },
  camera: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: SCANNER_SIZE * 0.8,
    height: SCANNER_SIZE * 0.3,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  clearButton: {
    backgroundColor: '#607D8B',
  },
  closeButton: {
    backgroundColor: '#F44336',
    marginTop: 10,
  },
  resultsContainer: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  resultType: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  resultTime: {
    color: '#aaa',
    fontSize: 12,
  },
  resultCode: {
    color: '#fff',
    fontSize: 16,
  },
  noResultsText: {
    color: '#aaa',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
}); 