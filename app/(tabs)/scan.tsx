import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { useAppTheme } from '../../src/contexts/ThemeContext';
import { useCameraPermissions } from '../../src/hooks/useCameraPermissions';
import { useUserPermissions } from '../../src/hooks/useUserPermissions';
import { ScannerCamera, ScannerOverlay, PermissionRequest, ScannerHeader } from '../../src/components/scanner';
import { parseId } from '../../src/utils/identifierManager';
import { BarcodeScanningResult } from 'expo-camera';

// États de l'écran
type ScanScreenMode = 'scanner' | 'manual';

const ScanScreen = () => {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { activeTheme } = useAppTheme();
  const permissions = useCameraPermissions();
  const userPermissions = useUserPermissions();
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Vérifier les permissions
  useEffect(() => {
    if (!userPermissions.canUseScanner) {
      router.replace('/(tabs)/stock');
      return;
    }
  }, [userPermissions.canUseScanner, router]);
  
  // Si pas de permission, ne pas rendre le contenu
  if (!userPermissions.canUseScanner) {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: activeTheme.text.primary, fontSize: 16 }}>
          Accès non autorisé - Permission requise pour utiliser le scanner
        </Text>
      </View>
    );
  }
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Scanner');
  
  // État local
  const [mode, setMode] = useState<ScanScreenMode>('scanner');
  
  // ✅ HOOKS OPTIMISÉS - Charger TOUS les items et containers pour le scanner
  // useContainerPageData() force le chargement complet de tous les items (pas de limite à 50)
  const { items, containers, isLoading } = useContainerPageData();

  // Le workflow de scan est maintenant géré dans le composant ScannerNew
  
  // Gestionnaire de changement de mode (scanner/manuel)
  const handleBarcodeScanned = useCallback((scanningResult: BarcodeScanningResult) => {
    if (!isProcessing && scanningResult.data) {
      setScannedData(scanningResult.data);
    }
  }, [isProcessing]);

  // Affichage du chargement
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      {/* ✅ CORRECTION: Utiliser styles.container qui occupe tout l'espace (flex: 1) 
          au lieu de styles.scannerContainer qui limite à 70% de l'écran */}
      <View style={styles.container}>
        <Scanner
          onClose={() => router.back()}
          items={items}
          containers={containers}
        />
      </View>
    </ErrorBoundary>
  );
};

export default ScanScreen; 