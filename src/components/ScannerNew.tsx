import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Platform, Alert, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated from 'react-native-reanimated';
import { BarcodeScanningResult } from 'expo-camera';

import { Icon } from './Icon';
import { ConfirmationDialog } from './ConfirmationDialog';
import ScannerCamera from './scanner/ScannerCamera';
import ScannedItemsList from './scanner/ScannedItemsList';

import { useAppTheme } from '../contexts/ThemeContext';
import StyleFactory from '../styles/StyleFactory';

import { useScannerStateMachine } from '../hooks/useScannerStateMachine';
import { useScannerAnimations } from '../hooks/useScannerAnimations';
import { useCameraPermissions } from '../hooks/useCameraPermissions';
import { useScannerWorkflow } from '../hooks/useScannerWorkflow';

import { Container } from '../types/container';
import { Item } from '../types/item';

const AnimatedView = Reanimated.createAnimatedComponent(View);

const SCAN_DELAY = 1000; // Délai entre les scans pour éviter les scans multiples

interface ScannerProps {
  onClose: () => void;
  items: Item[];
  containers: Container[];
}

export const ScannerNew: React.FC<ScannerProps> = ({
  onClose,
  items,
  containers
}) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Scanner');
  const insets = useSafeAreaInsets();

  // Hooks personnalisés
  const { scannerState, actions } = useScannerStateMachine();
  const animations = useScannerAnimations(scannerState);
  const permissions = useCameraPermissions();
  const { handleScan, finalizeScan, getContainerItemCount, clearContainerItems } = useScannerWorkflow(items, containers);

  // États locaux
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const [clearDialogVisible, setClearDialogVisible] = useState(false);
  const [containerToClear, setContainerToClear] = useState<Container | null>(null);
  const [screenData, setScreenData] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height, isTablet: width > 768 };
  });

  // Refs
  const lastScannedCode = useRef<string | null>(null);
  const scannerStateRef = useRef(scannerState);

  // Synchroniser la ref avec l'état React
  useEffect(() => {
    scannerStateRef.current = scannerState;
  }, [scannerState]);

  // Écouter les changements de taille d'écran
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData({
        width: window.width,
        height: window.height,
        isTablet: window.width > 768
      });
    });

    return () => subscription?.remove?.();
  }, []);

  // Synchroniser l'état de la caméra avec l'état du scanner
  useEffect(() => {
    console.log('[ScannerNew] État synchronisation:', {
      isCameraReady,
      'permissions.isGranted': permissions.isGranted,
      'scannerState.status': scannerState.status,
      platform: Platform.OS
    });
    
    const shouldInitialize = Platform.OS === 'web' 
      ? isCameraReady && permissions.isGranted
      : isCameraReady && permissions.isGranted;
      
    console.log('[ScannerNew] shouldInitialize:', shouldInitialize);
      
    if (shouldInitialize && scannerState.status === 'initializing') {
      console.log('[ScannerNew] Passage à ready dans 500ms...');
      const timer = setTimeout(() => {
        console.log('[ScannerNew] Changement d\'état vers ready');
        actions.goToReady();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isCameraReady, permissions.isGranted, scannerState.status, actions]);

  // Gestion du scan des codes-barres
  const handleBarcodeScan = useCallback(async (result: BarcodeScanningResult) => {
    console.log("[ScannerNew] handleBarcodeScan appelé avec:", result);
    let { data: scannedData } = result;
    
    // Normalisation du format QR
    if (scannedData && typeof scannedData === 'string') {
      if (!scannedData.startsWith('ART_') && !scannedData.startsWith('CONT_')) {
        if (scannedData.toLowerCase().includes('cont')) {
          scannedData = `CONT_${scannedData}`;
        } else {
          scannedData = `ART_${scannedData}`;
        }
      }
    }
    
    // Vérifications de sécurité pour éviter les scans redondants
    const currentStatus = scannerStateRef.current.status; // ← Utiliser la ref pour l'état le plus récent
    console.log("[ScannerNew] Vérifications - currentStatus:", currentStatus);
    console.log("[ScannerNew] État React vs Ref - React:", scannerState.status, "Ref:", scannerStateRef.current.status);
    if (currentStatus !== 'ready' && currentStatus !== 'scanning_items') {
      console.log("[ScannerNew] Arrêt - status non compatible:", currentStatus);
      return;
    }
    
    const now = Date.now();
    const timeSinceLastScan = now - lastScanTime;
    console.log("[ScannerNew] Vérifications temps - timeSinceLastScan:", timeSinceLastScan, "SCAN_DELAY:", SCAN_DELAY);
    console.log("[ScannerNew] Vérifications code - scannedData:", scannedData, "lastScannedCode:", lastScannedCode.current);
    
    if (timeSinceLastScan < SCAN_DELAY) {
      console.log("[ScannerNew] Arrêt - scan trop rapide");
      return;
    }
    
    if (scannedData === lastScannedCode.current) {
      console.log("[ScannerNew] Arrêt - même code que précédemment");
      return;
    }

    console.log("[ScannerNew] Vérifications passées, traitement du scan");
    setLastScanTime(now);
    lastScannedCode.current = scannedData;
    
    try {
      console.log("[ScannerNew] Appel de handleScan avec:", scannedData);
      const scanResult = await handleScan(scannedData);
      console.log("[ScannerNew] Résultat de handleScan:", scanResult);
      
      if (!scanResult?.success) {
        console.log("[ScannerNew] Scan non réussi, arrêt");
        return;
      }
      
      // Animation de succès simplifiée
      animations.triggerSuccessAnimation();
      
      // Traiter le résultat selon le type
      if (currentStatus === 'ready' && scanResult.type === 'container') {
        const container = scanResult.data as Container;
        actions.goToContainerConfirmation(container);
      } 
      else if (currentStatus === 'scanning_items' && scanResult.type === 'item') {
        const item = scanResult.data as Item;
        
        // Vérifier si l'item est déjà scanné
        if (scannerStateRef.current.status === 'scanning_items') {
          const isAlreadyScanned = scannerStateRef.current.items.some(
            (scannedItem) => scannedItem.id === item.id
          );
          
          if (isAlreadyScanned) {
            Alert.alert('Information', 'Cet article a déjà été scanné');
            return;
          }
          
          actions.addScannedItem(item);
        }
      }
    } catch (error) {
      console.error('Erreur lors du scan:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors du traitement du code QR.');
    }
  }, [lastScanTime, handleScan, actions, animations]); // ← Retirer scannerState des dépendances car on utilise la ref

  // Actions des containers
  const handleConfirmContainer = useCallback(() => {
    if (scannerState.status === 'container_confirmation') {
      actions.goToScanningItems(scannerState.container);
    }
  }, [scannerState, actions]);

  const handleCancelContainer = useCallback(() => {
    lastScannedCode.current = null;
    actions.goToReady();
  }, [actions]);

  const handleRequestClearContainer = useCallback(() => {
    if (scannerState.status === 'container_confirmation') {
      setContainerToClear(scannerState.container);
      setClearDialogVisible(true);
    }
  }, [scannerState]);

  const handleConfirmClearContainer = useCallback(async () => {
    if (!containerToClear) return;
    
    try {
      await clearContainerItems(containerToClear.id);
      setClearDialogVisible(false);
      setContainerToClear(null);
      actions.goToScanningItems(containerToClear);
    } catch (error) {
      console.error('Erreur lors du vidage du container:', error);
      Alert.alert('Erreur', 'Impossible de vider le container. Veuillez réessayer.');
    }
  }, [containerToClear, clearContainerItems, actions]);

  const handleCancelClearContainer = useCallback(() => {
    setClearDialogVisible(false);
    setContainerToClear(null);
  }, []);

  // Actions des items
  const handleRemoveItem = useCallback((itemId: number) => {
    actions.removeScannedItem(itemId);
  }, [actions]);

  const handleFinalizeScan = useCallback(async () => {
    if (scannerState.status !== 'scanning_items' || scannerState.items.length === 0) return;
    
    try {
      const { container, items } = scannerState;
      
      actions.goToProcessing();
      
      // Simuler une progression simplifiée
      for (let i = 0; i < items.length; i++) {
        actions.updateProgress((i + 1) / items.length);
        await new Promise(resolve => setTimeout(resolve, 50)); // Réduit de 100ms à 50ms
      }
      
      await finalizeScan(container, items);
      
      actions.goToSuccess();
      
      // Retour à l'état initial après succès (réduit de 2000ms à 1500ms)
      setTimeout(() => {
        actions.goToReady();
        lastScannedCode.current = null;
      }, 1500);
      
    } catch (error) {
      console.error('Erreur lors de la finalisation:', error);
      actions.goToError('Erreur lors de la finalisation du scan');
      
      setTimeout(() => {
        actions.goToReady();
      }, 3000);
    }
  }, [scannerState, actions, finalizeScan]); // Retirer animations

  // Reset du scanner
  const handleReset = useCallback(() => {
    lastScannedCode.current = null;
    actions.reset();
  }, [actions]);

  // Rendu des différents états
  const renderInitializing = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={activeTheme.primary} />
      <Text style={styles.loadingText}>Initialisation de la caméra...</Text>
      <Text style={styles.loadingSubtext}>
        {permissions.isLoading 
          ? "Vérification des permissions..." 
          : !permissions.isGranted 
            ? "En attente d'autorisation de la caméra" 
            : "Finalisation de l'initialisation..."}
      </Text>
    </View>
  );

  const renderPermissionNeeded = () => (
    <View style={styles.permissionContainer}>
      <Icon name="camera_alt" size={64} color={activeTheme.primary} style={styles.permissionIcon} />
      <Text style={styles.permissionTitle}>Autorisation requise</Text>
      <Text style={styles.permissionText}>
        {permissions.error || "Nous avons besoin de votre permission pour utiliser la caméra"}
      </Text>
      {permissions.instructions && (
        <Text style={styles.permissionText}>{permissions.instructions}</Text>
      )}
      <TouchableOpacity
        style={styles.permissionButton}
        onPress={permissions.requestPermission}
        disabled={permissions.isLoading}
      >
        {permissions.isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.permissionButton, styles.cancelButton]}
        onPress={onClose}
      >
        <Text style={styles.permissionButtonText}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );

  const renderScannerOverlay = () => {
    const isScanning = scannerState.status === 'ready' || scannerState.status === 'scanning_items';
    const { isTablet } = screenData;
    const useHorizontalLayout = isTablet && scannerState.status === 'scanning_items';
    
    return (
      <View style={StyleSheet.absoluteFill}>
        {/* Header compact - PLUS DE PADDING EXCESSIF */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          paddingTop: Platform.OS === 'ios' ? 48 : 12, // Réduit le padding top
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}>
          <TouchableOpacity
            style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16 }}
            onPress={onClose}
          >
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 16,
            gap: 6,
          }}>
            <Icon 
              name={scannerState.status === 'ready' ? 'inbox' : 'shopping_bag'}
              size={18} 
              color="#fff" 
            />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              {scannerState.status === 'ready' ? 'Scanner container' : 'Scanner articles'}
            </Text>
          </View>

          {scannerState.status === 'scanning_items' && (
            <TouchableOpacity
              style={{ padding: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16 }}
              onPress={handleReset}
            >
              <Icon name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Contenu principal - OCCUPE TOUT L'ESPACE RESTANT */}
        <View style={{
          flex: 1,
          flexDirection: useHorizontalLayout ? 'row' : 'column',
        }}>
          
          {/* Zone scanner - RÉDUITE POUR DONNER PLUS DE PLACE À LA LISTE */}
          <View style={{
            flex: useHorizontalLayout ? 1 : 1, // ✅ RÉDUIT de 1 à 0.6 pour laisser plus de place à la liste
            // justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            paddingHorizontal: 12, // ✅ RÉDUIT de 16 à 12
            paddingVertical: 1,    // ✅ RÉDUIT de 8 à 6
          }}>
            {isScanning && (
              <View style={{
                width: '90%',        // ✅ RÉDUIT de 95% à 90%
                height: '80%',       // ✅ RÉDUIT de 85% à 75%
                position: 'relative',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {/* Cadre de scan */}
                <View style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 16,    // ✅ RÉDUIT de 20 à 16
                  borderWidth: 2,
                  borderColor: 'rgba(255,255,255,0.8)',
                  position: 'relative',
                }}>
                  <View style={[styles.scannerCorner, styles.topLeft]} />
                  <View style={[styles.scannerCorner, styles.topRight]} />
                  <View style={[styles.scannerCorner, styles.bottomLeft]} />
                  <View style={[styles.scannerCorner, styles.bottomRight]} />
                </View>

                {/* Animation de succès simplifiée */}
                <AnimatedView style={[
                  animations.successStyle,
                  {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(76,175,80,0.3)',
                    borderRadius: 16,    // ✅ RÉDUIT de 20 à 16
                  }
                ]}>
                  <Icon name="check_circle" size={50} color="#4CAF50" /> {/* ✅ RÉDUIT de 60 à 50 */}
                </AnimatedView>
              </View>
            )}
            
            {/* Instructions en overlay - COMPACT */}
            <View style={{
              position: 'absolute',
              bottom: 12,            // ✅ RÉDUIT de 16 à 12
              left: 12,              // ✅ RÉDUIT de 16 à 12
              right: 12,             // ✅ RÉDUIT de 16 à 12
              backgroundColor: 'rgba(0,0,0,0.7)',
              paddingHorizontal: 12, // ✅ RÉDUIT de 16 à 12
              paddingVertical: 6,    // ✅ RÉDUIT de 8 à 6
              borderRadius: 6,       // ✅ RÉDUIT de 8 à 6
              alignItems: 'center',
            }}>
              <Text style={{
                color: '#fff',
                fontSize: 13,          // ✅ RÉDUIT de 14 à 13
                textAlign: 'center',
                fontWeight: '500',
              }}>
                Pointez la caméra vers un code QR
              </Text>
            </View>
          </View>

          {/* Zone informations et liste - OPTIMISÉ */}
          {scannerState.status === 'scanning_items' && (
            <View style={{
              flex: useHorizontalLayout ? 1 : 0.75, // ✅ AUGMENTÉ de 0.7 à 0.75 pour plus de place à la liste
              backgroundColor: 'rgba(0,0,0,0.4)',
              padding: 10, // ✅ RÉDUIT de 12 à 10
              // ✅ CORRECTION: Ajouter padding bottom pour éviter que le bouton soit caché par la tab bar
              paddingBottom: Math.max(10, insets.bottom + 50), // ✅ RÉDUIT de 60 à 50
            }}>
              {/* ✅ INFO CONTAINER - ULTRA COMPACT SUR UNE LIGNE */}
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 12, // ✅ RÉDUIT padding
                paddingVertical: 8,    // ✅ RÉDUIT de 12 à 8
                borderRadius: 8,       // ✅ RÉDUIT de 12 à 8
                marginBottom: 8,       // ✅ RÉDUIT de 12 à 8
                flexDirection: 'row',  // ✅ LIGNE UNIQUE
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Text style={{
                  color: '#fff',
                  fontSize: 14,          // ✅ RÉDUIT de 16 à 14
                  fontWeight: 'bold',
                }} numberOfLines={1}>
                  {scannerState.container.name}
                </Text>
                <Text style={{
                  color: '#fff',
                  fontSize: 12,          // ✅ RÉDUIT de 13 à 12
                  opacity: 0.8,
                  fontWeight: '500',
                }}>
                  {scannerState.items.length} article{scannerState.items.length > 1 ? 's' : ''}
                </Text>
              </View>

              {/* Liste des articles - PREND PLUS D'ESPACE */}
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 10,      // ✅ RÉDUIT de 12 à 10
                marginBottom: 6,       // ✅ RÉDUIT de 8 à 6
                minHeight: 120,        // ✅ AUGMENTÉ de 100 à 120 pour plus d'articles visibles
              }}>
                <ScannedItemsList
                  items={scannerState.items}
                  onRemoveItem={handleRemoveItem}
                />
              </View>

              {/* ✅ BOUTON DE VALIDATION - COMPACT */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: scannerState.items.length === 0 ? 'rgba(76,175,80,0.5)' : '#4CAF50',
                  paddingVertical: 14,   // ✅ RÉDUIT de 14 à 10
                  paddingHorizontal: 16, // ✅ RÉDUIT de 20 à 16
                  borderRadius: 8,       // ✅ RÉDUIT de 12 à 8
                  marginHorizontal: 4,
                  marginBottom: 8,       // ✅ RÉDUIT de 8 à 6
                  gap: 6,                // ✅ RÉDUIT de 8 à 6
                  // ✅ SHADOW réduite
                  shadowColor: '#4CAF50',
                  shadowOffset: { width: 0, height: 1 },  // ✅ RÉDUIT
                  shadowOpacity: scannerState.items.length === 0 ? 0.2 : 0.4,  // ✅ RÉDUIT
                  shadowRadius: 2,       // ✅ RÉDUIT de 4 à 2
                  elevation: scannerState.items.length === 0 ? 1 : 3,  // ✅ RÉDUIT
                  // ✅ Border réduite
                  borderWidth: 1,        // ✅ RÉDUIT de 2 à 1
                  borderColor: scannerState.items.length === 0 ? 'rgba(76,175,80,0.3)' : '#4CAF50',
                }}
                onPress={handleFinalizeScan}
                disabled={scannerState.items.length === 0}
                activeOpacity={0.8}
              >
                <Icon 
                  name="check" 
                  size={18}              // ✅ RÉDUIT de 22 à 18
                  color="#fff" 
                />
                <Text style={{
                  color: '#fff',
                  fontSize: 14,          // ✅ RÉDUIT de 16 à 14
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  {scannerState.items.length === 0 
                    ? 'Scannez des articles' 
                    : `Assigner ${scannerState.items.length} article${scannerState.items.length > 1 ? 's' : ''}`
                  }
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderConfirmationDialogs = () => (
    <>
      {/* Confirmation du container */}
      {scannerState.status === 'container_confirmation' && (
        <BlurView intensity={80} tint="dark" style={styles.confirmationWrapper}>
          <View style={styles.confirmationContainer}>
            <View style={styles.confirmationHeader}>
              <View style={styles.confirmationIcon}>
                <Icon name="check_circle" size={40} color="#4CAF50" />
              </View>
              <Text style={styles.confirmationTitle}>
                Container scanné avec succès
              </Text>
            </View>
            
            <Text style={styles.confirmationText}>
              {scannerState.container.name}
            </Text>
            
            {(() => {
              const itemCount = getContainerItemCount(scannerState.container.id);
              return (
                <Text style={styles.confirmationSubtext}>
                  {itemCount > 0 
                    ? `Ce container contient actuellement ${itemCount} article${itemCount > 1 ? 's' : ''}`
                    : 'Ce container est vide'
                  }
                </Text>
              );
            })()}
            
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleCancelContainer}
              >
                <Icon name="close" size={20} color="#fff" />
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Annuler</Text>
              </TouchableOpacity>
              
              {(() => {
                const itemCount = getContainerItemCount(scannerState.container.id);
                return itemCount > 0 ? (
                  <TouchableOpacity
                    style={[styles.button, styles.buttonWarning]}
                    onPress={handleRequestClearContainer}
                  >
                    <Icon name="clear_all" size={20} color="#fff" />
                    <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Vider</Text>
                  </TouchableOpacity>
                ) : null;
              })()}
              
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleConfirmContainer}
              >
                <Icon name="qr_code_scanner" size={20} color="#fff" />
                <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Scanner</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      )}

      {/* Écran de traitement - SIMPLIFIÉ */}
      {scannerState.status === 'processing' && (
        <BlurView intensity={80} tint="dark" style={styles.confirmationWrapper}>
          <View style={styles.confirmationContainer}>
            <View style={styles.confirmationHeader}>
              <ActivityIndicator size="large" color={activeTheme.primary} />
              <Text style={styles.confirmationTitle}>
                Traitement en cours...
              </Text>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${Math.round(scannerState.progress * 100)}%` }]} />
            </View>
            
            <Text style={styles.progressText}>
              {Math.round(scannerState.progress * 100)}%
            </Text>
            <Text style={styles.progressSubtext}>
              Assignation des articles au container
            </Text>
          </View>
        </BlurView>
      )}

      {/* Écran de succès - SIMPLIFIÉ */}
      {scannerState.status === 'success' && (
        <BlurView intensity={80} tint="dark" style={styles.confirmationWrapper}>
          <View style={styles.confirmationContainer}>
            <View style={styles.confirmationHeader}>
              <Icon name="check_circle" size={60} color="#4CAF50" />
              <Text style={styles.confirmationTitle}>
                Opération réussie !
              </Text>
            </View>
            <Text style={styles.confirmationText}>
              Les articles ont été assignés au container {scannerState.container.name}
            </Text>
          </View>
        </BlurView>
      )}

      {/* Écran d'erreur */}
      {scannerState.status === 'error' && (
        <BlurView intensity={80} tint="dark" style={styles.confirmationWrapper}>
          <View style={styles.confirmationContainer}>
            <View style={styles.confirmationHeader}>
              <View style={styles.errorIcon}>
                <Icon name="error" size={60} color="#FF3B30" />
              </View>
              <Text style={styles.errorTitle}>
                Une erreur est survenue
              </Text>
            </View>
            <Text style={styles.errorText}>
              {scannerState.message}
            </Text>
          </View>
        </BlurView>
      )}
    </>
  );

  // Rendu principal selon l'état
  const renderContent = () => {
    // Si pas de permissions, afficher l'écran de permissions
    if (!permissions.isGranted && !permissions.isLoading) {
      return renderPermissionNeeded();
    }

    // Si permissions en cours de chargement sans être accordées, afficher le chargement
    if (permissions.isLoading && !permissions.isGranted) {
      return renderInitializing();
    }

    // Dès que les permissions sont accordées, rendre la caméra (même en initializing)
    // Cela permet à la caméra de s'initialiser et de déclencher onCameraReady
    return (
      <View style={StyleSheet.absoluteFill}>
        <ScannerCamera
          onBarcodeScanned={handleBarcodeScan}
          onCameraReady={() => {
            console.log('[ScannerNew] onCameraReady appelé!');
            setIsCameraReady(true);
          }}
          isActive={scannerState.status === 'ready' || scannerState.status === 'scanning_items'}
        />
        
        {/* Afficher l'overlay d'initialisation par-dessus la caméra si nécessaire */}
        {(permissions.isLoading || scannerState.status === 'initializing') && (
          <View style={StyleSheet.absoluteFill}>
            {renderInitializing()}
          </View>
        )}
        
        {/* Overlay normal du scanner quand prêt */}
        {scannerState.status !== 'initializing' && renderScannerOverlay()}
        
        {/* Dialogues de confirmation */}
        {renderConfirmationDialogs()}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderContent()}
      
      <ConfirmationDialog
        visible={clearDialogVisible}
        title="Vider le container"
        message={`Êtes-vous sûr de vouloir vider le container "${containerToClear?.name}" ? Cette action retirera ${containerToClear ? getContainerItemCount(containerToClear.id) : 0} article${containerToClear && getContainerItemCount(containerToClear.id) > 1 ? 's' : ''} du container.`}
        confirmText="Vider"
        cancelText="Annuler"
        confirmButtonStyle="destructive"
        onConfirm={handleConfirmClearContainer}
        onCancel={handleCancelClearContainer}
      />
    </View>
  );
};

export default ScannerNew; 