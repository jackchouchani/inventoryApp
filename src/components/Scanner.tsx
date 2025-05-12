import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    View, 
  Text,
    StyleSheet, 
    TouchableOpacity, 
    StatusBar,
  Dimensions,
  ActivityIndicator,
    FlatList,
  Platform,
    Alert,
    Linking
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import Reanimated, {
    useAnimatedStyle,
    withRepeat,
  withSequence,
    withTiming,
    useSharedValue,
    Easing,
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { theme } from '../utils/theme';
import { parseId } from '../utils/identifierManager';
import { Container } from '../types/container';
import { Item } from '../types/item';

// Types
export type ScanMode = 'container' | 'items';

// Interface pour les éléments scannés
interface ScannedItem extends Item {
    scannedAt: number;
}

// Types pour les résultats de scan
export interface ScanResult {
  success: boolean;
  message: string;
  type?: 'container' | 'item';
  data?: any;
}

// Constantes
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCANNER_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;
const CAMERA_PERMISSION_KEY = '@app:camera_permission';
const SCAN_DELAY = 1000; // Délai entre les scans pour éviter les scans multiples
const SCAN_SUCCESS_ANIMATION_DURATION = 1500; // Durée de l'animation de succès
const MAX_RECENT_SCANS = 20; // Maximum d'éléments récents à afficher

// Interface des props du composant
interface ScannerProps {
  onClose: () => void;
  onScan: (scannedData: string) => Promise<ScanResult | null>;
  items: Item[];
  containers: Container[];
  onUpdateItem: (item: Item) => Promise<void>;
  onFinishScan: (container: Container, items: Item[]) => Promise<void>;
}

// Machine à états finis pour le workflow de scan
type ScannerState = 
  | { status: 'initializing' }
  | { status: 'ready'; mode: ScanMode }
  | { status: 'container_confirmation'; container: Container }
  | { status: 'scanning_items'; container: Container; items: ScannedItem[] }
  | { status: 'processing'; container: Container; items: ScannedItem[]; progress: number }
  | { status: 'success'; container: Container; items: ScannedItem[] }
  | { status: 'error'; message: string };

// Composants animés
const AnimatedView = Reanimated.createAnimatedComponent(View);
const AnimatedBlurView = Reanimated.createAnimatedComponent(BlurView);

export const Scanner: React.FC<ScannerProps> = ({
  onClose,
  onScan,
  items,
  containers,
  onUpdateItem,
  onFinishScan
}) => {
  // État de la machine à états
  const [scannerState, setScannerState] = useState<ScannerState>({ status: 'initializing' });
  
  // Références pour éviter les problèmes de fermeture (closure)
  const scannerStateRef = useRef<ScannerState>({ status: 'initializing' });
  
  // États pour la caméra et les permissions
    const [permission, requestPermission] = useCameraPermissions();
    const [hasCheckedPermission, setHasCheckedPermission] = useState(false);
    const [lastScanTime, setLastScanTime] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // Refs et gestion d'état interne
  const scanActive = useRef(true);
  const lastScannedCode = useRef<string | null>(null);
  
  // Valeurs animées
    const scanLinePosition = useSharedValue(0);
    const scannerScale = useSharedValue(1);
  const overlayOpacity = useSharedValue(0.7);
  const successAnimation = useSharedValue(0);
  const listHeight = useSharedValue(0);
  const processingProgress = useSharedValue(0);
  const finalSuccessScale = useSharedValue(1);
  const finalSuccessRotate = useSharedValue(0);

    // Styles animés
    const scanLineStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: scanLinePosition.value * SCANNER_SIZE }],
    opacity: scanActive.current ? 1 : 0,
    }));

    const scannerContainerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scannerScale.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
  }));
  
  const successStyle = useAnimatedStyle(() => ({
    opacity: successAnimation.value,
    transform: [
      { scale: interpolate(successAnimation.value, [0, 0.5, 1], [0.8, 1.2, 1], Extrapolate.CLAMP) }
    ]
  }));
  
  const progressStyle = useAnimatedStyle(() => ({
    width: `${processingProgress.value * 100}%`,
  }));
  
  const itemListStyle = useAnimatedStyle(() => ({
    height: withTiming(listHeight.value, { duration: 300 }),
    opacity: withTiming(listHeight.value > 0 ? 1 : 0, { duration: 200 })
  }));

  // Animation pour le succès final
  const finalSuccessStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: finalSuccessScale.value },
      { rotate: `${finalSuccessRotate.value * 360}deg` }
    ]
  }));
  
  // Fonction pour mettre à jour l'état de manière synchrone
  const updateScannerState = useCallback((newState: ScannerState | ((prev: ScannerState) => ScannerState)) => {
    if (typeof newState === 'function') {
      const updatedState = newState(scannerStateRef.current);
      console.log(`Mise à jour de l'état (fonction): ${scannerStateRef.current.status} -> ${updatedState.status}`);
      scannerStateRef.current = updatedState;
      setScannerState(updatedState);
    } else {
      console.log(`Mise à jour de l'état: ${scannerStateRef.current.status} -> ${newState.status}`);
      scannerStateRef.current = newState;
      setScannerState(newState);
    }
  }, []);
  
  // Effet pour l'animation de la ligne de scan
  useEffect(() => {
    if (scannerState.status === 'ready' || scannerState.status === 'scanning_items') {
      scanActive.current = true;
      
      // Animation de la ligne de scan
      scanLinePosition.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 2000, easing: Easing.linear })
        ),
        -1
      );
      
      // Animation de pulsation légère du scanner
      scannerScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1000, easing: Easing.ease }),
          withTiming(1, { duration: 1000, easing: Easing.ease })
        ),
        -1
      );
    } else {
      scanActive.current = false;
      scanLinePosition.value = withTiming(0);
      scannerScale.value = withTiming(1);
    }
  }, [scannerState.status]);
  
  // Effet pour mettre à jour la hauteur de la liste d'éléments
  useEffect(() => {
    if (scannerState.status === 'scanning_items') {
      const itemCount = scannerState.items.length;
      listHeight.value = Math.min(itemCount * 60, SCREEN_HEIGHT * 0.3);
    } else {
      listHeight.value = 0;
    }
  }, [scannerState]);
  
  // Effet pour mettre à jour la progression lors du traitement
  useEffect(() => {
    if (scannerState.status === 'processing') {
      processingProgress.value = withTiming(scannerState.progress, { duration: 300 });
    } else {
      processingProgress.value = 0;
    }
  }, [scannerState]);

  // Vérification des permissions de caméra
    useEffect(() => {
        const checkStoredPermission = async () => {
            try {
        console.log("Vérification des permissions de caméra...");
                if (permission?.granted) {
          console.log("Permission de caméra déjà accordée, passage à l'état ready");
                    setHasCheckedPermission(true);
          // Utiliser updateScannerState au lieu de setScannerState
          updateScannerState({ status: 'ready', mode: 'container' });
                    return;
                }

                const storedPermission = await AsyncStorage.getItem(CAMERA_PERMISSION_KEY);
        console.log(`Permission stockée: ${storedPermission}`);
                
                if (storedPermission === 'granted' && !permission?.granted) {
          console.log("Demande de permission de caméra");
                    const result = await requestPermission();
                    if (result.granted) {
            console.log("Permission accordée, passage à l'état ready");
                        await AsyncStorage.setItem(CAMERA_PERMISSION_KEY, 'granted');
            // Utiliser updateScannerState au lieu de setScannerState
            updateScannerState({ status: 'ready', mode: 'container' });
                    } else {
            console.log("Permission refusée");
                        await AsyncStorage.removeItem(CAMERA_PERMISSION_KEY);
                    }
        } else {
          console.log("Aucune permission stockée, attente de demande utilisateur");
                }
                setHasCheckedPermission(true);
            } catch (error) {
                console.error('Erreur lors de la vérification des permissions:', error);
                setHasCheckedPermission(true);
            }
        };

        checkStoredPermission();
  }, [permission?.granted, requestPermission, updateScannerState]);

  // Effet pour synchroniser l'état de la caméra avec l'état du scanner
  useEffect(() => {
    console.log(`État actuel du scanner: ${scannerState.status} (ref: ${scannerStateRef.current.status})`);
    
    // Si la caméra est prête mais que l'état est toujours "initializing"
    if (isCameraReady && scannerStateRef.current.status === 'initializing' && permission?.granted) {
      console.log("Caméra prête, initialisation du scanner avec délai de sécurité...");
      
      // Ajout d'un délai de sécurité pour l'initialisation
      const timer = setTimeout(() => {
        console.log("Délai d'initialisation terminé, passage à l'état ready");
        updateScannerState({ status: 'ready', mode: 'container' });
      }, 1000); // Délai de 1 seconde pour s'assurer que tout est bien initialisé
      
      return () => clearTimeout(timer);
    }
  }, [isCameraReady, scannerState.status, permission?.granted, updateScannerState]);

  // Demander la permission d'utiliser la caméra
    const handleRequestPermission = async () => {
        try {
      console.log("Demande de permission de caméra initiée par l'utilisateur");
            const result = await requestPermission();
            if (result.granted) {
        console.log("Permission accordée par l'utilisateur, initialisation du scanner...");
                await AsyncStorage.setItem(CAMERA_PERMISSION_KEY, 'granted');
        
        // Utiliser un délai avant de passer à ready pour éviter les problèmes d'initialisation
        setTimeout(() => {
          console.log("Initialisation après permission terminée, passage à l'état ready");
          updateScannerState({ status: 'ready', mode: 'container' });
        }, 1000);
            } else {
                await AsyncStorage.removeItem(CAMERA_PERMISSION_KEY);
        
        // Proposer d'ouvrir les paramètres
        if (Platform.OS === 'ios') {
                Alert.alert(
                    'Permission requise',
                    'L\'accès à la caméra est nécessaire pour scanner les codes QR. Veuillez l\'autoriser dans les paramètres de votre appareil.',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        { 
                            text: 'Ouvrir les paramètres', 
                            onPress: () => {
                                Linking.openSettings();
                  onClose();
                            }
                        }
                    ]
                );
        } else {
          Alert.alert(
            'Permission requise',
            'L\'accès à la caméra est nécessaire pour scanner les codes QR.',
            [
              { text: 'OK', onPress: onClose }
            ]
          );
        }
            }
        } catch (error) {
            console.error('Erreur lors de la demande de permission:', error);
            await AsyncStorage.removeItem(CAMERA_PERMISSION_KEY);
        }
    };

  // Traiter un code QR scanné
  const handleBarcodeScan = useCallback(async (result: BarcodeScanningResult) => {
    console.log("Scanner: handleBarcodeScan appelé", result.type);
    let { data: scannedData } = result;
    
    // Format potentiellement non standard, normalisation automatique
    if (scannedData && typeof scannedData === 'string') {
      if (!scannedData.startsWith('ART_') && !scannedData.startsWith('CONT_')) {
        // Déterminer le type en cherchant des indices dans la chaîne
        if (scannedData.toLowerCase().includes('cont')) {
          console.log(`Format QR corrigé: ${scannedData} -> CONT_${scannedData}`);
          scannedData = `CONT_${scannedData}`;
        } else {
          console.log(`Format QR corrigé: ${scannedData} -> ART_${scannedData}`);
          scannedData = `ART_${scannedData}`;
        }
      }
    }
    
    // Vérifications de sécurité pour éviter les scans redondants
    const currentStatus = scannerStateRef.current.status;
    if (currentStatus !== 'ready' && currentStatus !== 'scanning_items') {
      return; // État non compatible avec le scan
    }
    
    const now = Date.now();
    if (now - lastScanTime < SCAN_DELAY) {
      return; // Trop rapide entre deux scans
    }
    
    if (scannedData === lastScannedCode.current) {
      return; // Même code que précédemment
    }

    console.log(`Traitement du QR code: ${scannedData}`);
    setLastScanTime(now);
    lastScannedCode.current = scannedData;
    
    try {
      // Traiter le résultat du scan avec la fonction passée en props
      console.log(`Appel de la fonction onScan avec: ${scannedData}`);
      const scanResult = await onScan(scannedData);
      
      if (!scanResult || !scanResult.success) {
        console.log(`Scan échoué ou non reconnu: ${scanResult ? scanResult.message : 'Résultat null'}`);
                return;
            }

      console.log(`Scan réussi! Type: ${scanResult.type}, Message: ${scanResult.message}`);
      
      // Animation de succès
      successAnimation.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 200 })
      );
      
      // Traiter le résultat en fonction du type de scan et de l'état actuel
      if (currentStatus === 'ready' && scanResult.type === 'container') {
        // Transition vers l'état de confirmation du container
        const container = scanResult.data as Container;
        console.log(`Container scanné: ${container.name} (ID: ${container.id})`);
        
        // Utiliser updateScannerState au lieu de setScannerState
        updateScannerState({ 
          status: 'container_confirmation', 
          container 
        });
      } 
      else if (currentStatus === 'scanning_items' && scanResult.type === 'item') {
        // Ajouter l'élément scanné à la liste
        const item = scanResult.data as Item;
        console.log(`Article scanné: ${item.name} (ID: ${item.id})`);
        
        // S'assurer que nous sommes bien dans l'état scanning_items
        if (scannerStateRef.current.status === 'scanning_items') {
          const scanningState = scannerStateRef.current as { 
            status: 'scanning_items'; 
            container: Container; 
            items: ScannedItem[] 
          };
          
          // Vérifier si l'élément est déjà dans la liste
          const isAlreadyScanned = scanningState.items.some(
            (scannedItem) => scannedItem.id === item.id
                    );

                    if (isAlreadyScanned) {
            console.log(`Article déjà scanné: ${item.name} (ID: ${item.id})`);
            Alert.alert('Information', 'Cet article a déjà été scanné');
                        return;
                    }

          console.log(`Ajout de l'article: ${item.name} (ID: ${item.id}) à la liste`);
          // Créer un nouvel état avec l'article ajouté
          updateScannerState({ 
            status: 'scanning_items',
            container: scanningState.container,
            items: [
                                { ...item, scannedAt: Date.now() },
              ...scanningState.items
            ]
          });
        }
      }
        } catch (error) {
      console.error('Erreur lors du scan:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors du traitement du code QR.');
    }
  }, [lastScanTime, onScan, updateScannerState]);

  // Confirmer la sélection du container et passer au scan des articles
  const handleConfirmContainer = useCallback(() => {
    if (scannerStateRef.current.status !== 'container_confirmation') return;
    
    console.log("Confirmation du container, passage à scanning_items");
    // Utiliser updateScannerState au lieu de setScannerState
    updateScannerState({ 
      status: 'scanning_items', 
      container: scannerStateRef.current.container,
      items: []
    });
  }, [updateScannerState]);

  // Annuler la sélection du container et revenir au scan de container
  const handleCancelContainer = useCallback(() => {
    if (scannerStateRef.current.status !== 'container_confirmation') return;
    
    console.log("Annulation du container, retour à ready");
    // Utiliser updateScannerState au lieu de setScannerState
    updateScannerState({ status: 'ready', mode: 'container' });
    lastScannedCode.current = null;
  }, [updateScannerState]);

  // Retirer un élément de la liste des articles scannés
  const handleRemoveItem = useCallback((itemId: number) => {
    updateScannerState((prev: ScannerState) => {
      if (prev.status !== 'scanning_items') return prev;
      
      return {
            ...prev,
        items: prev.items.filter((item: Item) => item.id !== itemId)
      };
    });
  }, [updateScannerState]);

  // Finaliser le processus de scan et enregistrer les modifications
  const handleFinalizeScan = useCallback(async () => {
    if (scannerStateRef.current.status !== 'scanning_items' || scannerStateRef.current.items.length === 0) return;
    
    try {
      const { container, items } = scannerStateRef.current;
      
      // Passer à l'état de traitement
      // Utiliser updateScannerState au lieu de setScannerState
      updateScannerState({ 
        status: 'processing', 
        container, 
        items,
        progress: 0
      });
      
      // Simuler une progression du traitement
      for (let i = 0; i < items.length; i++) {
        // Mettre à jour la progression
        updateScannerState((prev: ScannerState) => {
          if (prev.status !== 'processing') return prev;
          return { ...prev, progress: (i + 1) / items.length };
        });
        
        // Attendre un peu pour simuler le traitement
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Appeler la fonction de finalisation passée en props
      await onFinishScan(container, items);
      
      // Animation de succès finale
      finalSuccessScale.value = withSequence(
        withTiming(1.5, { duration: 300 }),
        withTiming(1, { duration: 300 })
      );
      finalSuccessRotate.value = withTiming(1, { duration: 600 });
      
      // Passer à l'état de succès
      // Utiliser updateScannerState au lieu de setScannerState
      updateScannerState({ 
        status: 'success', 
        container, 
        items 
      });
      
      // Attendre un moment puis revenir à l'état initial
      setTimeout(() => {
        updateScannerState({ status: 'ready', mode: 'container' });
        lastScannedCode.current = null;
      }, 2000);
      
    } catch (error) {
      console.error('Erreur lors de la finalisation:', error);
      // Utiliser updateScannerState au lieu de setScannerState
      updateScannerState({ status: 'error', message: 'Erreur lors de la finalisation du scan' });
      
      setTimeout(() => {
        updateScannerState({ status: 'ready', mode: 'container' });
      }, 3000);
    }
  }, [scannerStateRef, onFinishScan, updateScannerState]);

  // Rendu du contenu en fonction de l'état
  const renderContent = () => {
    if (!hasCheckedPermission) {
        return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.statusText}>Initialisation de la caméra...</Text>
            </View>
        );
    }

    if (!permission?.granted) {
        return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="camera-alt" size={64} color={theme.colors.primary} style={styles.icon} />
                <Text style={styles.permissionText}>
                    Nous avons besoin de votre permission pour utiliser la caméra
                </Text>
                <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={handleRequestPermission}
                >
                    <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
                </TouchableOpacity>
          <TouchableOpacity
            style={[styles.permissionButton, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.permissionButtonText}>Annuler</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Mode spécial pour la disposition en deux colonnes quand on scanne des articles
    if (scannerStateRef.current.status === 'scanning_items') {
      const scanningState = scannerStateRef.current as { 
        status: 'scanning_items'; 
        container: Container; 
        items: ScannedItem[] 
      };
      
      return (
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={handleBarcodeScan}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_e', 'itf14', 'datamatrix', 'codabar', 'pdf417'],
            }}
            onCameraReady={() => {
              console.log("Caméra prête!");
              setIsCameraReady(true);
            }}
          >
            <AnimatedView style={[styles.overlay, overlayStyle]}>
              {/* En-tête avec bouton de fermeture et indicateur de mode */}
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  disabled={scannerStateRef.current.status !== 'scanning_items'}
                >
                  <MaterialIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={styles.modeIndicator}>
                  <MaterialIcons name="shopping-bag" size={24} color="#fff" />
                  <Text style={styles.modeText}>Scanner des articles</Text>
                </View>

                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => updateScannerState({ status: 'ready', mode: 'container' })}
                >
                  <MaterialIcons name="refresh" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Contenu principal avec disposition en deux colonnes */}
              <View style={styles.splitContainer}>
                {/* Colonne de gauche : scanner */}
                <View style={styles.scannerColumn}>
                  <AnimatedView style={[styles.scannerContainerSplit, scannerContainerStyle]}>
                    <View style={styles.scanner}>
                      <View style={styles.scannerCorner} />
                      <View style={[styles.scannerCorner, styles.topRight]} />
                      <View style={[styles.scannerCorner, styles.bottomLeft]} />
                      <View style={[styles.scannerCorner, styles.bottomRight]} />
                    </View>
                    <AnimatedView style={[styles.scanLine, scanLineStyle]} />
                    
                    <AnimatedView style={[styles.successOverlay, successStyle]}>
                      <MaterialIcons name="check-circle" size={80} color="#4CAF50" />
                    </AnimatedView>
                  </AnimatedView>

                  {/* Informations sur le container en cours */}
                  <View style={styles.containerInfoSplit}>
                    <Text style={styles.containerTitle}>
                      Container : {scanningState.container.name}
                    </Text>
                    <Text style={styles.itemCount}>
                      {scanningState.items.length} articles scannés
                    </Text>
                  </View>
                </View>
                
                {/* Colonne de droite : liste des articles */}
                <View style={styles.listColumn}>
                  <View style={styles.listHeader}>
                    <MaterialIcons name="format-list-bulleted" size={20} color="#fff" />
                    <Text style={styles.listHeaderText}>
                      Articles scannés
                    </Text>
                  </View>
                  
                  {scanningState.items.length > 0 ? (
                    <FlatList
                      data={scanningState.items}
                      renderItem={({ item }) => (
        <View style={styles.scannedItem}>
            <View style={styles.scannedItemInfo}>
                <Text style={styles.scannedItemName}>{item.name}</Text>
                            <Text style={styles.scannedItemPrice}>
                              {item.sellingPrice ? `${item.sellingPrice} €` : ''}
                              <Text style={styles.scannedItemTime}>
                                {' '}- Scanné il y a {Math.floor((Date.now() - item.scannedAt) / 1000)}s
                        </Text>
                            </Text>
            </View>
            <TouchableOpacity
                style={styles.removeItemButton}
                            onPress={() => {
                              Alert.alert(
                                'Retirer l\'article',
                                `Êtes-vous sûr de vouloir retirer "${item.name}" de la liste?`,
                                [
                                  { text: 'Annuler', style: 'cancel' },
                                  { text: 'Retirer', style: 'destructive', onPress: () => handleRemoveItem(item.id!) }
                                ]
                              );
                            }}
            >
                <MaterialIcons name="close" size={20} color="#FF3B30" />
            </TouchableOpacity>
                        </View>
                      )}
                      keyExtractor={item => item.id!.toString()}
                      style={styles.scannedItemsList}
                      ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                      showsVerticalScrollIndicator={false}
                    />
                  ) : (
                    <View style={styles.emptyState}>
                      <MaterialIcons name="info" size={40} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.emptyStateText}>
                        Scannez des articles pour les ajouter au container
                      </Text>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={styles.finishButton}
                    onPress={handleFinalizeScan}
                    disabled={scanningState.items.length === 0}
                  >
                    <MaterialIcons name="check" size={24} color="#fff" />
                    <Text style={styles.finishButtonText}>
                      Terminer et assigner les articles
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </AnimatedView>
          </CameraView>
        </View>
    );
    }

    // Mode standard pour les autres états
    return (
      <View style={StyleSheet.absoluteFill}>
                <CameraView
                    style={StyleSheet.absoluteFill}
          onBarcodeScanned={handleBarcodeScan}
                    barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_e', 'itf14', 'datamatrix', 'codabar', 'pdf417'],
          }}
          onCameraReady={() => {
            console.log("Caméra prête!");
            setIsCameraReady(true);
                    }}
                >
                    <AnimatedView style={[styles.overlay, overlayStyle]}>
            {/* En-tête avec bouton de fermeture et indicateur de mode */}
                        <View style={styles.header}>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                disabled={scannerState.status !== 'ready' && scannerState.status !== 'scanning_items' && scannerState.status !== 'error'}
                            >
                                <MaterialIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                            
                            <View style={styles.modeIndicator}>
                                <MaterialIcons 
                  name={scannerState.status === 'ready' || scannerState.status === 'container_confirmation' ? 'inbox' : 'shopping-bag'} 
                                    size={24} 
                                    color="#fff" 
                                />
                                <Text style={styles.modeText}>
                  {scannerState.status === 'initializing' ? 'Initialisation...' :
                   scannerState.status === 'ready' ? 'Scanner un container' : 
                   scannerState.status === 'container_confirmation' ? 'Confirmer le container' :
                   scannerState.status === 'processing' ? 'Traitement en cours...' :
                   scannerState.status === 'success' ? 'Opération réussie !' :
                   'Erreur'}
                                </Text>
                            </View>

              {scannerState.status === 'scanning_items' && (
                                <TouchableOpacity
                                    style={styles.resetButton}
                  onPress={() => updateScannerState({ status: 'ready', mode: 'container' })}
                                >
                                    <MaterialIcons name="refresh" size={24} color="#fff" />
                                </TouchableOpacity>
                            )}
                        </View>

            {/* Message d'initialisation en cours */}
            {(scannerState.status === 'initializing' || !isCameraReady) && (
              <View style={styles.initializingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.initializingText}>
                  Initialisation du scanner...
                </Text>
                <Text style={styles.initializingSubtext}>
                  {!permission?.granted 
                    ? "En attente d'autorisation de la caméra" 
                    : !isCameraReady 
                      ? "Préparation de la caméra..." 
                      : "Finalisation de l'initialisation..."}
                </Text>
                <Text style={styles.initializingDebug}>
                  État: {scannerState.status} | Caméra: {isCameraReady ? "Prête" : "En préparation"}
                </Text>
              </View>
            )}

            {/* Zone centrale pour le scan */}
            {scannerState.status !== 'initializing' && isCameraReady && (
                        <View style={styles.scannerFrame}>
                {(scannerState.status === 'ready' || scannerState.status === 'scanning_items') && (
                                <AnimatedView style={[styles.scannerContainer, scannerContainerStyle]}>
                                    <View style={styles.scanner}>
                                        <View style={styles.scannerCorner} />
                                        <View style={[styles.scannerCorner, styles.topRight]} />
                                        <View style={[styles.scannerCorner, styles.bottomLeft]} />
                                        <View style={[styles.scannerCorner, styles.bottomRight]} />
                                    </View>
                                    <AnimatedView style={[styles.scanLine, scanLineStyle]} />
                    
                    {/* Animation de succès de scan */}
                    <AnimatedView style={[styles.successOverlay, successStyle]}>
                      <MaterialIcons name="check-circle" size={80} color="#4CAF50" />
                                </AnimatedView>
                  </AnimatedView>
                )}
                
                {/* Dialogue de confirmation du container */}
                {scannerState.status === 'container_confirmation' && (
                                <BlurView intensity={80} tint="dark" style={styles.confirmationWrapper}>
                                    <View style={styles.confirmationContainer}>
                                                <View style={styles.confirmationHeader}>
                                                    <MaterialIcons name="check-circle" size={40} color="#4CAF50" />
                                                    <Text style={styles.confirmationTitle}>
                                                        Container scanné avec succès
                                                    </Text>
                                                </View>
                                                <Text style={styles.confirmationText}>
                        {scannerState.container.name}
                                                </Text>
                                                <View style={styles.buttonGroup}>
                                                    <TouchableOpacity
                                                        style={[styles.button, styles.cancelButton]}
                          onPress={handleCancelContainer}
                                                    >
                                                        <MaterialIcons name="close" size={20} color="#fff" />
                                                        <Text style={styles.buttonText}>Annuler</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.button, styles.confirmButton]}
                          onPress={handleConfirmContainer}
                                                    >
                                                        <MaterialIcons name="qr-code-scanner" size={20} color="#fff" />
                                                        <Text style={styles.buttonText}>Scanner des articles</Text>
                                                    </TouchableOpacity>
                                                </View>
                                    </View>
                                </BlurView>
                            )}
                
                {/* Écran de traitement */}
                {scannerState.status === 'processing' && (
                  <BlurView intensity={80} tint="dark" style={styles.confirmationWrapper}>
                    <View style={styles.confirmationContainer}>
                      <View style={styles.confirmationHeader}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={styles.confirmationTitle}>
                          Traitement en cours...
                                    </Text>
                                </View>

                      <View style={styles.progressBarContainer}>
                        <AnimatedView style={[styles.progressBar, progressStyle]} />
                      </View>
                      
                      <Text style={styles.progressText}>
                        {Math.round(scannerState.progress * 100)}%
                                            </Text>
                    </View>
                  </BlurView>
                )}
                
                {/* Écran de succès */}
                {scannerState.status === 'success' && (
                  <BlurView intensity={80} tint="dark" style={styles.confirmationWrapper}>
                    <View style={styles.confirmationContainer}>
                      <View style={styles.confirmationHeader}>
                        <AnimatedView style={finalSuccessStyle}>
                          <MaterialIcons name="check-circle" size={60} color="#4CAF50" />
                        </AnimatedView>
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
                        <MaterialIcons name="error" size={60} color="#FF3B30" />
                        <Text style={styles.confirmationTitle}>
                          Une erreur est survenue
                        </Text>
                      </View>
                      <Text style={styles.confirmationText}>
                        {scannerState.message}
                      </Text>
                    </View>
                  </BlurView>
                )}
                            </View>
                        )}
                    </AnimatedView>
                </CameraView>
            </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderContent()}
    </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  icon: {
    marginBottom: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  permissionButton: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 12,
    width: '80%',
    marginVertical: 10,
    elevation: 2,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.error,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
    },
    closeButton: {
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 30,
    },
    resetButton: {
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 30,
    },
    modeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 12,
        borderRadius: 25,
        gap: 8,
    },
    modeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    scannerFrame: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerContainer: {
        width: SCANNER_SIZE,
        height: SCANNER_SIZE,
        position: 'relative',
    },
    scanner: {
        width: '100%',
        height: '100%',
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 20,
        position: 'relative',
    },
    scannerCorner: {
        position: 'absolute',
        width: 20,
        height: 20,
    borderColor: theme.colors.primary,
        borderWidth: 3,
    },
    topRight: {
        top: -2,
        right: -2,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
        borderTopRightRadius: 20,
    },
    bottomLeft: {
        bottom: -2,
        left: -2,
        borderRightWidth: 0,
        borderTopWidth: 0,
        borderBottomLeftRadius: 20,
    },
    bottomRight: {
        bottom: -2,
        right: -2,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderBottomRightRadius: 20,
    },
    scanLine: {
        position: 'absolute',
        left: 0,
        width: '100%',
        height: 2,
    backgroundColor: theme.colors.primary,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    containerInfo: {
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 15,
        borderRadius: 12,
    },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  listHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.8,
    },
    containerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    itemCount: {
        color: '#fff',
        fontSize: 14,
        opacity: 0.8,
    },
    scannedItemsContainer: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        overflow: 'hidden',
    },
    scannedItemsList: {
    maxHeight: SCREEN_HEIGHT * 0.3,
    },
    scannedItem: {
        flexDirection: 'row',
        alignItems: 'center',
    justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        marginVertical: 4,
        marginHorizontal: 8,
        borderRadius: 8,
    },
  itemSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 2,
    marginHorizontal: 12,
    },
    scannedItemInfo: {
        flex: 1,
        marginRight: 12,
    },
    scannedItemName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    scannedItemPrice: {
        color: '#fff',
        fontSize: 14,
        opacity: 0.8,
    },
  scannedItemTime: {
        fontSize: 12,
    opacity: 0.7,
    },
    removeItemButton: {
    padding: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,59,48,0.2)',
    },
    finishButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    backgroundColor: theme.colors.success,
        padding: 16,
        margin: 12,
        borderRadius: 12,
        gap: 8,
    },
    finishButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmationWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmationContainer: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        width: '90%',
        maxWidth: 400,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    confirmationHeader: {
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    confirmationTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    confirmationText: {
        color: '#fff',
        fontSize: 18,
        marginBottom: 24,
        textAlign: 'center',
    },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 20,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        minWidth: 140,
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    confirmButton: {
    backgroundColor: theme.colors.success,
        borderWidth: 1,
        borderColor: '#43A047',
    },
  progressBarContainer: {
        width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginVertical: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.success,
  },
  progressText: {
        color: '#fff',
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 10,
  },
  emptyState: {
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        textAlign: 'center',
    marginTop: 10,
  },
  initializingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
  initializingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  initializingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginBottom: 12,
  },
  initializingDebug: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  // Styles pour la disposition en deux colonnes
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scannerColumn: {
    width: '48%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 10,
  },
  listColumn: {
    width: '48%',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  scannerContainerSplit: {
    width: SCANNER_SIZE * 0.8,
    height: SCANNER_SIZE * 0.8,
    position: 'relative',
        marginBottom: 20,
    },
  containerInfoSplit: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 15,
    borderRadius: 12,
    width: '100%',
    maxWidth: 250,
    },
  buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
});