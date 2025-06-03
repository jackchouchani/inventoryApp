import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';
import { useAppTheme } from '../../src/contexts/ThemeContext';

// Composants
import { Icon } from '../../src/components';
import { Scanner } from '../../src/components/Scanner';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// ✅ HOOKS OPTIMISÉS selon optimizations-hooks.mdc
import { useAllContainers } from '../../src/hooks/useOptimizedSelectors';
import { useItems } from '../../src/hooks/useItems';
import { useScannerWorkflow } from '../../src/hooks/useScannerWorkflow';

// États de l'écran
type ScanScreenMode = 'scanner' | 'manual';

const ScanScreen: React.FC = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Scanner');
  
  // État local
  const [mode, setMode] = useState<ScanScreenMode>('scanner');
  
  // ✅ HOOKS OPTIMISÉS - Utiliser les sélecteurs mémoïsés
  const { data: items = [], isLoading } = useItems();
  const containers = useAllContainers();

  // Utilisation du hook de workflow de scan
  const { handleScan, updateItemInDatabase, finalizeScan } = useScannerWorkflow(
    items,
    containers
  );
  
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.modeButton, { backgroundColor: activeTheme.primary }]}
            onPress={handleModeChange}
          >
            <Icon 
              name={mode === 'manual' ? "qr_code_scanner" : "edit"} 
              size={24} 
              color={activeTheme.text.onPrimary} 
            />
            <Text style={[styles.modeButtonText, { color: activeTheme.text.onPrimary }]}>
              {mode === 'manual' ? 'Mode Scanner' : 'Mode Manuel'}
            </Text>
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: activeTheme.text.primary }]}>
            Scanner
          </Text>
          
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => {
              // Fonctionnalité d'aide à implémenter
            }}
          >
            <Icon name="help_outline" size={24} color={activeTheme.primary} />
          </TouchableOpacity>
        </View>

        {mode === 'manual' ? (
          <View style={styles.manualContainer}>
            <View style={[styles.manualContentWrapper, { backgroundColor: activeTheme.surface }]}>
              <Icon name="construction" size={64} color={activeTheme.text.secondary} style={styles.comingSoonIcon} />
              <Text style={[styles.comingSoonText, { color: activeTheme.text.primary }]}>
                Le mode manuel sera disponible prochainement.
              </Text>
              <Text style={[styles.comingSoonSubtext, { color: activeTheme.text.secondary }]}>
                Cette fonctionnalité vous permettra d'assigner manuellement des articles à des containers.
              </Text>
              <TouchableOpacity
                style={[styles.switchToScannerButton, { backgroundColor: activeTheme.primary }]}
                onPress={handleModeChange}
              >
                <Icon name="qr_code_scanner" size={24} color={activeTheme.text.onPrimary} />
                <Text style={[styles.switchToScannerText, { color: activeTheme.text.onPrimary }]}>
                  Utiliser le scanner
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.scannerContainer}>
            <Scanner
              onClose={() => router.back()}
              onScan={handleScan}
              items={items}
              containers={containers}
              onUpdateItem={updateItemInDatabase}
              onFinishScan={finalizeScan}
            />
          </View>
        )}
      </View>
    </ErrorBoundary>
  );
};

export default ScanScreen; 