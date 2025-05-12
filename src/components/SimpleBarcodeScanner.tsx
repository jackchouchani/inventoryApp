import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult, BarcodeType } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

/**
 * Scanner minimaliste pour la détection de codes-barres Code128
 * Optimisé pour les articles avec codes numériques
 */
export const SimpleBarcodeScanner: React.FC<{
  onClose: () => void;
  onCodeDetected?: (code: string) => void;
}> = ({ onClose, onCodeDetected }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCodes, setScannedCodes] = useState<Array<{
    code: string;
    type: string;
    timestamp: number;
  }>>([]);
  const [lastScanTime, setLastScanTime] = useState(0);
  
  // Gérer la détection de code-barres de manière très simple
  const handleBarcodeScan = useCallback(
    (result: BarcodeScanningResult) => {
      const now = Date.now();
      const { data, type } = result;
      
      // Éviter les scans trop rapprochés (300ms minimum)
      if (now - lastScanTime < 300) {
        return;
      }
      
      // Mémoriser le code scanné
      setScannedCodes((prev) => [
        { code: data, type, timestamp: now },
        ...prev.slice(0, 19), // Garder seulement les 20 derniers codes
      ]);
      
      // Mettre à jour le moment du dernier scan
      setLastScanTime(now);
      
      // Si la fonction de callback est fournie, l'appeler
      if (onCodeDetected) {
        onCodeDetected(data);
      }
      
      // Log pour le débogage
      console.log(`Code détecté: ${data}, Type: ${type}`);
      
      // Pour les codes numériques (nos articles), afficher une alerte
      if (/^\d+$/.test(data)) {
        Alert.alert(
          "Code article détecté!",
          `Code: ${data}\nType: ${type}`
        );
      }
    },
    [lastScanTime, onCodeDetected]
  );
  
  // Si les permissions ne sont pas accordées, afficher un bouton pour les demander
  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Permission de caméra requise</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => requestPermission()}
        >
          <Text style={styles.buttonText}>Autoriser la caméra</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permissionButton, styles.closeButton]}
          onPress={onClose}
        >
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scanner Code128</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{
            barcodeTypes: ['code128', 'qr', 'ean13', 'ean8'] as BarcodeType[],
          }}
          onBarcodeScanned={handleBarcodeScan}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <Text style={styles.scanText}>
                Positionnez le code-barres dans cette zone
              </Text>
              {/* Guide visuel pour le scan */}
              <View style={styles.scanFrame} />
            </View>
          </View>
        </CameraView>
      </View>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          {Platform.OS === 'web' 
            ? "Conseils pour scanner sur le web" 
            : "Comment scanner un code-barres"}
        </Text>
        <Text style={styles.infoText}>
          {Platform.OS === 'web'
            ? "• Tenez le code-barres bien droit et centré\n• Approchez-le suffisamment\n• Assurez un bon éclairage\n• Évitez les reflets"
            : "• Approchez le code-barres de la caméra\n• Assurez-vous qu'il soit bien éclairé\n• Maintenez l'appareil stable"}
        </Text>
      </View>
      
      <ScrollView style={styles.codesList}>
        <Text style={styles.codesTitle}>Codes détectés ({scannedCodes.length})</Text>
        {scannedCodes.map((scan, index) => (
          <View key={index} style={styles.codeItem}>
            <Text style={styles.codeValue}>{scan.code}</Text>
            <Text style={styles.codeType}>{scan.type}</Text>
          </View>
        ))}
        {scannedCodes.length === 0 && (
          <Text style={styles.noCodesText}>
            Aucun code scanné. Présentez un code-barres à la caméra.
          </Text>
        )}
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.clearButton}
        onPress={() => setScannedCodes([])}
      >
        <Text style={styles.buttonText}>Effacer les résultats</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    backgroundColor: '#1e1e1e',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  cameraContainer: {
    height: width * 0.8,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanArea: {
    width: '80%',
    height: '50%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  scanFrame: {
    width: '100%',
    height: 100,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 8,
  },
  infoBox: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    margin: 10,
    borderRadius: 8,
  },
  infoTitle: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  infoText: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  codesList: {
    flex: 1,
    padding: 10,
  },
  codesTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  codeItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  codeValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  codeType: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  noCodesText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  clearButton: {
    backgroundColor: '#333',
    padding: 12,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
}); 