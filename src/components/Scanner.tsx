import React, { useState, useEffect, useCallback } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Platform, 
  Animated,
  Dimensions,
  StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Audio } from 'expo-av';
import { parseQRCode } from '../utils/qrCodeManager';
import { database } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { MaterialIcons } from '@expo/vector-icons';
import * as haptics from '../utils/vibrationManager';
import * as sounds from '../utils/soundManager';
import type { Container } from '../database/database';
import { handleScannerError } from '../utils/errorHandler';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';

interface ScannerProps {
    onClose: () => void;
    onScan: (result: { success: boolean; message: string; type?: 'container' | 'item'; data?: any }) => void;
    isActive: boolean;
}

interface ScanState {
    mode: 'container' | 'item';
    currentContainer: Container | null;
    history: Array<{ name: string; success: boolean; timestamp: number }>;
    lastResult: { success: boolean; message: string; type?: 'container' | 'item'; data?: any } | null;
    isScanning: boolean;
    pendingItem: any | null;
    showConfirmation: boolean;
}

const INITIAL_STATE: ScanState = {
    mode: 'container',
    currentContainer: null,
    history: [],
    lastResult: null,
    isScanning: true,
    pendingItem: null,
    showConfirmation: false
};

const SCAN_DELAY = 500;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCANNER_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.7;

export const Scanner: React.FC<ScannerProps> = ({ onClose, onScan, isActive }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanState, setScanState] = useState<ScanState>(INITIAL_STATE);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [overlayAnim] = useState(new Animated.Value(0));
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const queryClient = useQueryClient();
    const [lastScanTime, setLastScanTime] = useState(0);

    const resetScanner = useCallback(() => {
        setScanState(INITIAL_STATE);
        Animated.timing(overlayAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [overlayAnim]);

    const handleFeedback = useCallback(async (success: boolean) => {
        // Animation
        fadeAnim.setValue(1);
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
        }).start();

        // Overlay animation
        Animated.sequence([
            Animated.timing(overlayAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(overlayAnim, {
                toValue: 0,
                duration: 200,
                delay: 1000,
                useNativeDriver: true,
            })
        ]).start();

        await haptics.vibrate(success ? haptics.SUCCESS_PATTERN : haptics.ERROR_PATTERN);
        await sounds.play(success ? 'success' : 'error');
    }, [fadeAnim, overlayAnim]);

    const handleScan = useCallback(async ({ data: qrData }: BarcodeScanningResult) => {
        const now = Date.now();
        if (now - lastScanTime < SCAN_DELAY) return;
        setLastScanTime(now);

        if (!scanState.isScanning || scanState.showConfirmation) return;

        try {
            console.log('Mode actuel:', scanState.mode);
            console.log('QR code scanné:', qrData);
            console.log('État complet du scanner:', scanState);

            // Vérifier le format du QR code
            if (!qrData.startsWith('CONT_') && !qrData.startsWith('ART_')) {
                console.warn('Format de QR code non reconnu:', qrData);
                await handleFeedback(false);
                return;
            }

            const isContainer = qrData.startsWith('CONT_');
            const isItem = qrData.startsWith('ART_');

            // Mode container : on ne peut scanner que des containers
            if (scanState.mode === 'container') {
                if (!isContainer) {
                    console.warn('Veuillez scanner un QR code de container');
                    await handleFeedback(false);
                    return;
                }

                const container = await database.getContainerByQRCode(qrData);
                if (container) {
                    console.log('Container trouvé, passage en mode item');
                    setScanState(prev => {
                        const newState = {
                            ...prev,
                            mode: 'item' as const,
                            currentContainer: container,
                            isScanning: false,
                            showConfirmation: true,
                            history: [
                                { name: container.name, success: true, timestamp: Date.now() }
                            ]
                        };
                        console.log('Nouveau state après scan container:', newState);
                        return newState;
                    });
                    await handleFeedback(true);
                } else {
                    console.warn('Container non trouvé:', qrData);
                    await handleFeedback(false);
                }
                return;
            }

            // Mode article : on ne peut scanner que des articles
            if (scanState.mode === 'item') {
                console.log('En mode item, scan d\'article');
                if (!isItem) {
                    console.warn('Veuillez scanner un QR code d\'article');
                    await handleFeedback(false);
                    return;
                }

                const item = await database.getItemByQRCode(qrData);
                if (item) {
                    console.log('Article trouvé:', item.name);
                    setScanState(prev => ({
                        ...prev,
                        pendingItem: item,
                        isScanning: false,
                        showConfirmation: true,
                        history: [
                            { name: item.name, success: true, timestamp: Date.now() },
                            ...prev.history
                        ]
                    }));
                    await handleFeedback(true);
                } else {
                    console.warn('Article non trouvé:', qrData);
                    await handleFeedback(false);
                }
            }
        } catch (error) {
            console.error('Erreur lors du scan:', error);
            await handleFeedback(false);
        }
    }, [scanState, lastScanTime, handleFeedback]);

    const handleConfirmItem = async () => {
        if (!scanState.pendingItem || !scanState.currentContainer) return;

        try {
            const updateData = {
                ...scanState.pendingItem,
                containerId: scanState.currentContainer.id,
                updatedAt: new Date().toISOString()
            };

            await database.updateItem(scanState.pendingItem.id!, updateData);
            
            setScanState(prev => ({
                ...prev,
                history: [
                    { name: scanState.pendingItem!.name, success: true, timestamp: Date.now() },
                    ...prev.history
                ].slice(0, 5),
                pendingItem: null,
                showConfirmation: false,
                isScanning: true
            }));

            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            
            triggerRefresh();
            onScan({ 
                success: true, 
                message: `Article assigné: ${scanState.pendingItem.name}`, 
                type: 'item', 
                data: scanState.pendingItem 
            });
        } catch (error) {
            console.error('Erreur lors de l\'ajout de l\'article:', error);
            handleScannerError(error as Error, 'Scanner.handleConfirmItem');
        }
    };

    const handleCancelItem = () => {
        setScanState(prev => ({
            ...prev,
            pendingItem: null,
            showConfirmation: false,
            isScanning: true
        }));
    };

    const startScanningItems = () => {
        console.log('Démarrage du scan d\'articles...');
        setScanState(prev => {
            const newState = {
                ...prev,
                mode: 'item' as const,
                isScanning: true,
                showConfirmation: false,
                history: []
            };
            console.log('Nouveau state après passage en mode item:', newState);
            return newState;
        });

        // Attendre que le state soit mis à jour avant d'appeler onScan
        setTimeout(() => {
            console.log('État actuel après changement de mode:', scanState);
            onScan({ 
                success: true, 
                message: `Container sélectionné: ${scanState.currentContainer?.name}`, 
                type: 'container', 
                data: scanState.currentContainer 
            });
        }, 0);
    };

    const cancelContainerScan = () => {
        setScanState(INITIAL_STATE);
    };

    useEffect(() => {
        if (!isActive) {
            setScanState(prev => ({ ...prev, isScanning: false }));
        } else {
            setScanState(prev => ({ ...prev, isScanning: true }));
        }
    }, [isActive]);

    if (!permission?.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>
                    Nous avons besoin de votre permission pour utiliser la caméra
                </Text>
                <TouchableOpacity
                    style={styles.permissionButton}
                    onPress={requestPermission}
                >
                    <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            <CameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={handleScan}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            >
                <View style={styles.overlay}>
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
                            <View style={styles.scannerContainer}>
                                <View style={styles.scanner} />
                                <Animated.View 
                                    style={[
                                        styles.scanLine,
                                        {
                                            transform: [{
                                                translateY: overlayAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0, SCANNER_SIZE]
                                                })
                                            }]
                                        }
                                    ]} 
                                />
                            </View>
                        ) : (
                            <View style={styles.confirmationContainer}>
                                {scanState.mode === 'container' && scanState.currentContainer && (
                                    <>
                                        <Text style={styles.confirmationTitle}>
                                            Container sélectionné
                                        </Text>
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
                                                <MaterialIcons name="check" size={20} color="#fff" />
                                                <Text style={styles.buttonText}>Scanner des articles</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}

                                {scanState.mode === 'item' && scanState.showConfirmation && scanState.pendingItem && (
                                    <>
                                        <Text style={styles.confirmationTitle}>
                                            Ajouter l'article ?
                                        </Text>
                                        <Text style={styles.confirmationText}>
                                            {scanState.pendingItem.name}
                                        </Text>
                                        <View style={styles.buttonGroup}>
                                            <TouchableOpacity
                                                style={[styles.button, styles.cancelButton]}
                                                onPress={handleCancelItem}
                                            >
                                                <MaterialIcons name="close" size={20} color="#fff" />
                                                <Text style={styles.buttonText}>Annuler</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.button, styles.confirmButton]}
                                                onPress={handleConfirmItem}
                                            >
                                                <MaterialIcons name="check" size={20} color="#fff" />
                                                <Text style={styles.buttonText}>Confirmer</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={[styles.footer, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                        {scanState.mode === 'item' && scanState.currentContainer && (
                            <View style={styles.containerInfo}>
                                <Text style={styles.containerTitle}>
                                    Container sélectionné: {scanState.currentContainer.name}
                                </Text>
                                <Text style={styles.containerSubtitle}>
                                    {scanState.isScanning ? 'Scannez les articles à ajouter' : 'Confirmez l\'ajout de l\'article'}
                                </Text>
                            </View>
                        )}

                        {scanState.history.length > 0 && (
                            <View style={styles.historyContainer}>
                                {scanState.history.map((item, index) => (
                                    <Animated.View 
                                        key={index}
                                        style={[
                                            styles.historyItem,
                                            {
                                                opacity: fadeAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0.5, 1]
                                                })
                                            }
                                        ]}
                                    >
                                        <MaterialIcons
                                            name={item.success ? 'check-circle' : 'error'}
                                            size={20}
                                            color={item.success ? '#4CAF50' : '#F44336'}
                                        />
                                        <Text style={styles.historyText}>{item.name}</Text>
                                    </Animated.View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </CameraView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
    },
    closeButton: {
        padding: 8,
    },
    resetButton: {
        padding: 8,
    },
    modeIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 20,
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
    },
    containerInfo: {
        alignItems: 'center',
        marginBottom: 20,
    },
    containerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    containerSubtitle: {
        color: '#fff',
        fontSize: 14,
        opacity: 0.8,
    },
    historyContainer: {
        gap: 10,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 10,
        borderRadius: 8,
        gap: 8,
    },
    historyText: {
        color: '#fff',
        fontSize: 14,
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
    confirmationContainer: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        width: '90%',
        maxWidth: 400,
    },
    confirmationTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    confirmationText: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 20,
        textAlign: 'center',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
        minWidth: 120,
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    confirmButton: {
        backgroundColor: '#4CAF50',
    },
    cancelButton: {
        backgroundColor: '#F44336',
    },
    buttonGroup: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: 20,
        width: '100%',
        paddingHorizontal: 20,
    },
});