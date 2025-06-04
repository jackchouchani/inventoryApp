import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { CameraView, BarcodeScanningResult } from 'expo-camera';
import { Icon } from '../Icon';
import { useAppTheme } from '../../contexts/ThemeContext';
import QrScanner from 'qr-scanner';

interface WebCameraProps {
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onCameraReady: () => void;
}

const WebCamera: React.FC<WebCameraProps> = React.memo(({ onBarcodeScanned, onCameraReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { activeTheme } = useAppTheme();
  
  console.log("[WebCamera] Composant monté/mis à jour");

  useEffect(() => {
    let mounted = true;
    let initializationTimeout: NodeJS.Timeout;

    const initializeScanner = async () => {
      if (!videoRef.current || qrScannerRef.current) {
        console.log("[WebCamera] Arrêt initialisation - videoRef:", !!videoRef.current, "qrScannerRef:", !!qrScannerRef.current);
        return;
      }

      try {
        console.log("[WebCamera] Démarrage initialisation du scanner QR...");
        
        // Vérifier si on est en HTTPS ou localhost
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
        if (!isSecure) {
          throw new Error('HTTPS est requis pour l\'accès à la caméra. Veuillez utiliser: npx expo start --web --https');
        }
        
        // Créer une instance de QrScanner
        const qrScanner = new QrScanner(
          videoRef.current,
          (result) => {
            console.log("[WebCamera] Code QR détecté:", result.data);
            // Convertir le résultat de qr-scanner au format attendu par expo-camera
            const barcodeScanResult = {
              type: 'qr',
              data: result.data,
              raw: result.data,
              bounds: {
                origin: { x: 0, y: 0 },
                size: { width: 0, height: 0 }
              }
            } as BarcodeScanningResult;
            
            console.log("[WebCamera] Appel de onBarcodeScanned avec:", barcodeScanResult);
            onBarcodeScanned(barcodeScanResult);
          },
          {
            onDecodeError: () => {
              // Ne pas logger tous les erreurs de décodage car c'est normal
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment'
          }
        );

        qrScannerRef.current = qrScanner;

        // Démarrer le scanner avec un délai pour éviter les conflits
        await new Promise(resolve => setTimeout(resolve, 100));
        await qrScanner.start();
        
        if (mounted) {
          console.log("[WebCamera] Scanner QR démarré avec succès!");
          setIsReady(true);
          setError(null);
          console.log("[WebCamera] Appel de onCameraReady...");
          onCameraReady();
        }

      } catch (error) {
        console.error('[WebCamera] Erreur lors de l\'initialisation du scanner:', error);
        if (mounted) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage?.includes('HTTPS')) {
            setError('HTTPS requis. Démarrez avec: npx expo start --web --https');
          } else {
            setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
          }
        }
      }
    };

    // Délai pour éviter les initialisations multiples rapides
    initializationTimeout = setTimeout(() => {
      if (mounted) {
        console.log("[WebCamera] Appel de initializeScanner après délai de 200ms");
        initializeScanner();
      }
    }, 200);

    return () => {
      mounted = false;
      clearTimeout(initializationTimeout);
      
      if (qrScannerRef.current) {
        console.log("Arrêt du scanner QR...");
        try {
          qrScannerRef.current.stop();
          qrScannerRef.current.destroy();
        } catch (e) {
          console.log("Nettoyage du scanner (normal)");
        }
        qrScannerRef.current = null;
      }
    };
  }, []); // Dépendances vides pour éviter les re-rendus

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: activeTheme.primary }]}
          onPress={() => {
            setError(null);
            window.location.reload();
          }}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {Platform.OS === 'web' && (
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      )}
      {!isReady && !error && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>
            Initialisation du scanner QR...
          </Text>
          <Text style={styles.loadingSubtext}>
            Veuillez autoriser l'accès à la caméra
          </Text>
        </View>
      )}
    </View>
  );
});

interface ScannerCameraProps {
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onCameraReady: () => void;
  isActive: boolean;
}

export const ScannerCamera: React.FC<ScannerCameraProps> = React.memo(({
  onBarcodeScanned,
  onCameraReady,
  isActive
}) => {
  if (Platform.OS === 'web') {
    return (
      <WebCamera 
        onBarcodeScanned={onBarcodeScanned}
        onCameraReady={onCameraReady}
      />
    );
  }

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      onBarcodeScanned={isActive ? onBarcodeScanned : undefined}
      barcodeScannerSettings={{
        barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_e', 'itf14', 'datamatrix', 'codabar', 'pdf417'],
      }}
      onCameraReady={onCameraReady}
    />
  );
});

const styles = StyleSheet.create({
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default ScannerCamera; 