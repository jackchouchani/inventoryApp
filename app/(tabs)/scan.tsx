import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '../../src/components';

// Composants
import { Scanner } from '../../src/components/Scanner';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// Hooks et services
import { useInventoryData } from '../../src/hooks/useInventoryData';
import { useScannerWorkflow } from '../../src/hooks/useScannerWorkflow';

// Thème
import { theme } from '../../src/utils/theme';


// États de l'écran
type ScanScreenMode = 'scanner' | 'manual';

const ScanScreen: React.FC = () => {
  const router = useRouter();
  
  // État local
  const [mode, setMode] = useState<ScanScreenMode>('scanner');
  
  // Données d'inventaire
  const { data: inventoryData, isLoading, refetch } = useInventoryData({});
  const items = inventoryData?.items ?? [];
  const containers = inventoryData?.containers ?? [];

  // Utilisation du hook de workflow de scan
  const { handleScan, updateItemInDatabase, finalizeScan } = useScannerWorkflow(
    items,
    containers,
    refetch
  );
  
  // Gestionnaire de changement de mode (scanner/manuel)
  const handleModeChange = useCallback(() => {
    setMode(prev => (prev === 'manual' ? 'scanner' : 'manual'));
  }, []);

  // Affichage du chargement
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.modeButton}
              onPress={handleModeChange}
            >
              <Icon 
                name={mode === 'manual' ? "qr_code_scanner" : "edit"} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.modeButtonText}>
                {mode === 'manual' ? 'Mode Scanner' : 'Mode Manuel'}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>
              Scanner
            </Text>
            
            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => {
                // Fonctionnalité d'aide à implémenter
              }}
            >
              <Icon name="help_outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {mode === 'manual' ? (
            <View style={styles.manualContainer}>
              <View style={styles.manualContentWrapper}>
                <Icon name="construction" size={64} color="#ddd" style={styles.comingSoonIcon} />
                <Text style={styles.comingSoonText}>
                  Le mode manuel sera disponible prochainement.
                </Text>
                <Text style={styles.comingSoonSubtext}>
                  Cette fonctionnalité vous permettra d'assigner manuellement des articles à des containers.
                </Text>
                <TouchableOpacity
                  style={styles.switchToScannerButton}
                  onPress={handleModeChange}
                >
                  <Icon name="qr_code_scanner" size={24} color="#fff" />
                  <Text style={styles.switchToScannerText}>
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
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  modeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  helpButton: {
    padding: 8,
    borderRadius: 20,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  manualContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  manualContentWrapper: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  comingSoonIcon: {
    marginBottom: 20,
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
    textAlign: 'center',
    marginBottom: 10,
  },
  comingSoonSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    maxWidth: '80%',
  },
  switchToScannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  switchToScannerText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ScanScreen; 