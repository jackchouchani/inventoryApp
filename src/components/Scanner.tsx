import React, { useState, useEffect, useCallback } from 'react';
import { 
    Text, 
    View, 
    StyleSheet, 
    TouchableOpacity, 
    Platform, 
    Dimensions,
    StatusBar,
    FlatList,
    Alert,
    ActivityIndicator,
    Linking
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { parseId } from '../utils/identifierManager';
import { database } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { MaterialIcons } from '@expo/vector-icons';
import * as haptics from '../utils/vibrationManager';
import * as sounds from '../utils/soundManager';
import type { Container } from '../database/database';
import type { Item } from '../types/item';
import { handleScannerError, ErrorDetails } from '../utils/errorHandler';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundary } from './ErrorBoundary';
import Reanimated, {
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
    useSharedValue,
    withSequence,
    Easing,
} from 'react-native-reanimated';

interface ScannerProps {
    onClose: () => void;
    onScan: (result: { success: boolean; message: string; type?: 'container' | 'item'; data?: any }) => void;
    isActive: boolean;
}

interface ScannedItem extends Item {
    scannedAt: number;
}

interface ScanState {
    mode: 'container' | 'item';
    currentContainer: Container | null;
    scannedItems: ScannedItem[];
    isScanning: boolean;
    pendingItem: Item | null;
    showConfirmation: boolean;
    error?: ErrorDetails;
}

const INITIAL_STATE: ScanState = {
    mode: 'container',
    currentContainer: null,
    scannedItems: [],
    isScanning: true,
    pendingItem: null,
    showConfirmation: false
};

const SCAN_DELAY = 1000;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCANNER_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;

const CAMERA_PERMISSION_KEY = '@app:camera_permission';

const AnimatedView = Reanimated.createAnimatedComponent(View);

export const Scanner: React.FC<ScannerProps> = ({ onClose, onScan, isActive }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [hasCheckedPermission, setHasCheckedPermission] = useState(false);
    const [scanState, setScanState] = useState<ScanState>(INITIAL_STATE);
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const queryClient = useQueryClient();
    const [lastScanTime, setLastScanTime] = useState(0);

    // Animations
    const scanLinePosition = useSharedValue(0);
    const scannerScale = useSharedValue(1);
    const overlayOpacity = useSharedValue(0);

    // Styles animés
    const scanLineStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: scanLinePosition.value * SCANNER_SIZE }],
        opacity: withSpring(isActive ? 1 : 0),
    }));

    const scannerContainerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scannerScale.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
        backgroundColor: 'rgba(0,0,0,0.3)',
    }));

    // Vérifier si l'autorisation a déjà été accordée
    useEffect(() => {
        const checkStoredPermission = async () => {
            try {
                // Si la permission est déjà accordée, pas besoin de vérifier AsyncStorage
                if (permission?.granted) {
                    setHasCheckedPermission(true);
                    return;
                }

                const storedPermission = await AsyncStorage.getItem(CAMERA_PERMISSION_KEY);
                
                // Si nous avons une permission stockée et que la permission actuelle n'est pas accordée
                if (storedPermission === 'granted' && !permission?.granted) {
                    const result = await requestPermission();
                    if (result.granted) {
                        await AsyncStorage.setItem(CAMERA_PERMISSION_KEY, 'granted');
                    } else {
                        // Si la permission a été révoquée, mettre à jour AsyncStorage
                        await AsyncStorage.removeItem(CAMERA_PERMISSION_KEY);
                    }
                }
                setHasCheckedPermission(true);
            } catch (error) {
                console.error('Erreur lors de la vérification des permissions:', error);
                setHasCheckedPermission(true);
            }
        };

        checkStoredPermission();
    }, [permission?.granted, requestPermission]);

    const handleRequestPermission = async () => {
        try {
            const result = await requestPermission();
            if (result.granted) {
                await AsyncStorage.setItem(CAMERA_PERMISSION_KEY, 'granted');
            } else {
                await AsyncStorage.removeItem(CAMERA_PERMISSION_KEY);
                Alert.alert(
                    'Permission requise',
                    'L\'accès à la caméra est nécessaire pour scanner les codes QR. Veuillez l\'autoriser dans les paramètres de votre appareil.',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        { 
                            text: 'Ouvrir les paramètres', 
                            onPress: () => {
                                Linking.openSettings();
                                onClose(); // Fermer le scanner quand on ouvre les paramètres
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Erreur lors de la demande de permission:', error);
            await AsyncStorage.removeItem(CAMERA_PERMISSION_KEY);
        }
    };

    const handleFeedback = useCallback(async (success: boolean) => {
        await haptics.vibrate(success ? haptics.SUCCESS_PATTERN : haptics.ERROR_PATTERN);
        await sounds.play(success ? 'success' : 'error');
    }, []);

    const handleScan = useCallback(async ({ data: scannedData, type: barcodeType }: BarcodeScanningResult) => {
        const now = Date.now();
        if (now - lastScanTime < SCAN_DELAY) {
            console.log('Scan trop rapide, ignoré');
            return;
        }
        setLastScanTime(now);

        if (!scanState.isScanning) return;

        try {
            // Vérifier le cache
            const cachedData = queryClient.getQueryData(['scan', scannedData]);
            if (cachedData) {
                console.log('Utilisation des données en cache pour:', scannedData);
                await handleFeedback(true);
                return cachedData;
            }

            // Parse l'identifiant
            const { type, value } = parseId(scannedData);
            if (!type || !value) {
                await handleFeedback(false);
                return;
            }

            // Vérifie le type de code-barres
            const isContainer = type === 'CONTAINER';
            const isItem = type === 'ITEM';
            const isQRCode = barcodeType === 'qr';
            const isDataMatrix = barcodeType === 'datamatrix';

            // Vérifie la correspondance entre le type d'identifiant et le type de code-barres
            if ((isContainer && !isQRCode) || (isItem && !isDataMatrix)) {
                console.log('Type de code-barres incorrect pour cet identifiant');
                await handleFeedback(false);
                return;
            }

            let result;

            // Mode container
            if (scanState.mode === 'container') {
                if (!isContainer) {
                    await handleFeedback(false);
                    return;
                }

                const container = await database.getContainerByQRCode(scannedData);
                if (container) {
                    setScanState(prev => ({
                        ...prev,
                        currentContainer: container,
                        isScanning: false,
                        showConfirmation: true
                    }));
                    await handleFeedback(true);
                    result = { type: 'container', data: container };
                } else {
                    await handleFeedback(false);
                }
            }

            // Mode article
            if (scanState.mode === 'item') {
                if (!isItem) {
                    await handleFeedback(false);
                    return;
                }

                const item = await database.getItemByQRCode(scannedData);
                if (item) {
                    const isAlreadyScanned = scanState.scannedItems.some(
                        scannedItem => scannedItem.id === item.id || scannedItem.qrCode === item.qrCode
                    );

                    if (isAlreadyScanned) {
                        console.log('Article déjà scanné:', item.name);
                        await handleFeedback(false);
                        return;
                    }

                    setScanState(prev => {
                        if (prev.scannedItems.some(si => si.id === item.id)) {
                            return prev;
                        }
                        return {
                            ...prev,
                            scannedItems: [
                                { ...item, scannedAt: Date.now() },
                                ...prev.scannedItems
                            ]
                        };
                    });
                    await handleFeedback(true);
                    result = { type: 'item', data: item };
                } else {
                    await handleFeedback(false);
                }
            }

            // Mettre en cache le résultat
            if (result) {
                queryClient.setQueryData(['scan', scannedData], result);
            }

            return result;
        } catch (error) {
            console.error('Erreur lors du scan:', error);
            await handleFeedback(false);
        }
    }, [scanState, lastScanTime, handleFeedback, queryClient]);

    const startScanningItems = async () => {
        if (!scanState.currentContainer) return;

        setScanState(prev => ({
            ...prev,
            mode: 'item',
            isScanning: true,
            showConfirmation: false,
            scannedItems: []
        }));

        onScan({
            success: true,
            message: `Container sélectionné: ${scanState.currentContainer.name}`,
            type: 'container',
            data: scanState.currentContainer
        });
    };

    const removeScannedItem = (itemId: number) => {
        setScanState(prev => ({
            ...prev,
            scannedItems: prev.scannedItems.filter(item => item.id !== itemId)
        }));
    };

    const handleFinishItemScanning = async () => {
        if (!scanState.currentContainer || scanState.scannedItems.length === 0) return;

        try {
            // Mettre à jour tous les articles scannés
            await Promise.all(
                scanState.scannedItems.map(item =>
                    database.updateItem(item.id!, {
                        containerId: scanState.currentContainer!.id
                    })
                )
            );

            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            triggerRefresh();

            // Réinitialiser le scanner pour un nouveau container
            setScanState(INITIAL_STATE);

            onScan({
                success: true,
                message: `${scanState.scannedItems.length} articles assignés au container ${scanState.currentContainer.name}`,
                type: 'item',
                data: {
                    container: scanState.currentContainer,
                    items: scanState.scannedItems
                }
            });
        } catch (error) {
            console.error('Erreur lors de la finalisation:', error);
            const errorDetails = handleScannerError(error instanceof Error ? error : new Error('Erreur inconnue'));
            setScanState(prev => ({
                ...prev,
                error: errorDetails
            }));
        }
    };

    const cancelContainerScan = () => {
        setScanState(INITIAL_STATE);
    };

    const resetScanner = () => {
        setScanState(INITIAL_STATE);
    };

    useEffect(() => {
        if (!isActive) {
            setScanState(prev => ({ ...prev, isScanning: false }));
        } else {
            setScanState(prev => ({ ...prev, isScanning: true }));
        }
    }, [isActive]);

    // Démarrer les animations
    useEffect(() => {
        if (isActive && scanState.isScanning) {
            // Animation de la ligne de scan
            scanLinePosition.value = withRepeat(
                withSequence(
                    withTiming(0, { duration: 0 }),
                    withTiming(1, {
                        duration: 2000,
                        easing: Easing.linear,
                    })
                ),
                -1
            );

            // Animation de pulsation du scanner
            scannerScale.value = withRepeat(
                withSequence(
                    withTiming(1.02, {
                        duration: 1000,
                        easing: Easing.ease,
                    }),
                    withTiming(1, {
                        duration: 1000,
                        easing: Easing.ease,
                    })
                ),
                -1
            );
        } else {
            scanLinePosition.value = withTiming(0);
            scannerScale.value = withTiming(1);
        }
    }, [isActive, scanState.isScanning]);

    if (!hasCheckedPermission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (!permission?.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>
                    Nous avons besoin de votre permission pour utiliser la caméra
                </Text>
                <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={handleRequestPermission}
                >
                    <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const renderScannedItem = ({ item }: { item: ScannedItem }) => (
        <View style={styles.scannedItem}>
            <View style={styles.scannedItemInfo}>
                <Text style={styles.scannedItemName}>{item.name}</Text>
                <View style={styles.scannedItemDetails}>
                    <Text style={styles.scannedItemPrice}>{item.sellingPrice} €</Text>
                    {item.containerId && item.containerId !== scanState.currentContainer?.id && (
                        <Text style={styles.containerChange}>
                            Changement de container
                        </Text>
                    )}
                </View>
            </View>
            <TouchableOpacity
                style={styles.removeItemButton}
                onPress={() => removeScannedItem(item.id!)}
            >
                <MaterialIcons name="close" size={20} color="#FF3B30" />
            </TouchableOpacity>
        </View>
    );

    return (
        <ErrorBoundary onReset={() => setScanState(INITIAL_STATE)}>
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <CameraView
                    style={StyleSheet.absoluteFill}
                    onBarcodeScanned={scanState.isScanning ? handleScan : undefined}
                    barcodeScannerSettings={{
                        barcodeTypes: scanState.mode === 'container' ? ['qr'] : ['qr', 'datamatrix'],
                    }}
                >
                    <AnimatedView style={[styles.overlay, overlayStyle]}>
                        <View style={styles.header}>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                            >
                                <MaterialIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                            
                            <View style={styles.modeIndicator}>
                                <MaterialIcons 
                                    name={scanState.mode === 'container' ? 'inbox' : 'shopping-bag'} 
                                    size={24} 
                                    color="#fff" 
                                />
                                <Text style={styles.modeText}>
                                    {scanState.mode === 'container' ? 'Scanner un container' : 'Scanner des articles'}
                                </Text>
                            </View>

                            {scanState.mode === 'item' && (
                                <TouchableOpacity
                                    style={styles.resetButton}
                                    onPress={resetScanner}
                                >
                                    <MaterialIcons name="refresh" size={24} color="#fff" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.scannerFrame}>
                            {scanState.isScanning ? (
                                <AnimatedView style={[styles.scannerContainer, scannerContainerStyle]}>
                                    <View style={styles.scanner}>
                                        <View style={styles.scannerCorner} />
                                        <View style={[styles.scannerCorner, styles.topRight]} />
                                        <View style={[styles.scannerCorner, styles.bottomLeft]} />
                                        <View style={[styles.scannerCorner, styles.bottomRight]} />
                                    </View>
                                    <AnimatedView style={[styles.scanLine, scanLineStyle]} />
                                </AnimatedView>
                            ) : (
                                <BlurView intensity={80} tint="dark" style={styles.confirmationWrapper}>
                                    <View style={styles.confirmationContainer}>
                                        {scanState.mode === 'container' && scanState.currentContainer && (
                                            <>
                                                <View style={styles.confirmationHeader}>
                                                    <MaterialIcons name="check-circle" size={40} color="#4CAF50" />
                                                    <Text style={styles.confirmationTitle}>
                                                        Container scanné avec succès
                                                    </Text>
                                                </View>
                                                <Text style={styles.confirmationText}>
                                                    {scanState.currentContainer.name}
                                                </Text>
                                                <View style={styles.buttonGroup}>
                                                    <TouchableOpacity
                                                        style={[styles.button, styles.cancelButton]}
                                                        onPress={cancelContainerScan}
                                                    >
                                                        <MaterialIcons name="close" size={20} color="#fff" />
                                                        <Text style={styles.buttonText}>Annuler</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.button, styles.confirmButton]}
                                                        onPress={startScanningItems}
                                                    >
                                                        <MaterialIcons name="qr-code-scanner" size={20} color="#fff" />
                                                        <Text style={styles.buttonText}>Scanner des articles</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </>
                                        )}
                                    </View>
                                </BlurView>
                            )}
                        </View>

                        {scanState.mode === 'item' && (
                            <View style={styles.footer}>
                                <View style={styles.containerInfo}>
                                    <Text style={styles.containerTitle}>
                                        Container : {scanState.currentContainer?.name}
                                    </Text>
                                    <Text style={styles.itemCount}>
                                        {scanState.scannedItems.length} articles scannés
                                    </Text>
                                </View>

                                <View style={styles.scannedItemsContainer}>
                                    <FlatList
                                        data={scanState.scannedItems}
                                        renderItem={renderScannedItem}
                                        keyExtractor={item => item.id!.toString()}
                                        style={styles.scannedItemsList}
                                    />

                                    {scanState.scannedItems.length > 0 && (
                                        <TouchableOpacity
                                            style={styles.finishButton}
                                            onPress={handleFinishItemScanning}
                                        >
                                            <MaterialIcons name="check" size={24} color="#fff" />
                                            <Text style={styles.finishButtonText}>
                                                Terminer et assigner les articles
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                    </AnimatedView>
                </CameraView>
            </View>
        </ErrorBoundary>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
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
        borderColor: '#007AFF',
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
        backgroundColor: '#007AFF',
    },
    footer: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        maxHeight: '50%',
    },
    containerInfo: {
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 15,
        borderRadius: 12,
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
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        overflow: 'hidden',
    },
    scannedItemsList: {
        flex: 1,
    },
    scannedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        marginVertical: 4,
        marginHorizontal: 8,
        borderRadius: 8,
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
    scannedItemDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    scannedItemPrice: {
        color: '#fff',
        fontSize: 14,
        opacity: 0.8,
    },
    containerChange: {
        color: '#FFA500',
        fontSize: 12,
        fontStyle: 'italic',
    },
    removeItemButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,59,48,0.2)',
    },
    finishButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4CAF50',
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
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    confirmButton: {
        backgroundColor: '#4CAF50',
        borderWidth: 1,
        borderColor: '#43A047',
    },
    cancelButton: {
        backgroundColor: '#F44336',
        borderWidth: 1,
        borderColor: '#E53935',
    },
    buttonGroup: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: 20,
        width: '100%',
        paddingHorizontal: 20,
    },
    permissionText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
    },
    permissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
});