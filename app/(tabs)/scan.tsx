import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';
import { useAppTheme } from '../../src/contexts/ThemeContext';

// Composants
import { Icon } from '../../src/components';
import { ScannerNew as Scanner } from '../../src/components/ScannerNew';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// ✅ HOOKS OPTIMISÉS selon optimizations-hooks.mdc
// ⚠️ CORRECTION CRITIQUE: Utiliser useContainerPageData() au lieu de useItems() + useAllContainers()
// pour charger TOUS les items (pas seulement les 50 premiers) nécessaires au scanner
import { useContainerPageData } from '../../src/hooks/useOptimizedSelectors';

// États de l'écran
type ScanScreenMode = 'scanner' | 'manual';

const ScanScreen: React.FC = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Scanner');
  
  // État local
  const [mode, setMode] = useState<ScanScreenMode>('scanner');
  
  // ✅ HOOKS OPTIMISÉS - Charger TOUS les items et containers pour le scanner
  // useContainerPageData() force le chargement complet de tous les items (pas de limite à 50)
  const { items, containers, isLoading } = useContainerPageData();

  // Le workflow de scan est maintenant géré dans le composant ScannerNew
  
  // Gestionnaire de changement de mode (scanner/manuel)
  const handleModeChange = useCallback(() => {
    setMode(prev => (prev === 'manual' ? 'scanner' : 'manual'));
  }, []);

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