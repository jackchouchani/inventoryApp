import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, Alert, TouchableOpacity, Platform, Animated } from 'react-native';
import { CameraView, useCameraPermissions, CameraType, BarcodeScanningResult } from 'expo-camera';
import { Audio } from 'expo-av';
import { parseQRCode, QR_CODE_TYPES } from '../utils/qrCodeManager';
import { updateItem, getItemByQRCode, getContainerByQRCode } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { MaterialIcons } from '@expo/vector-icons';
import * as haptics from '../utils/vibrationManager';
import * as sounds from '../utils/soundManager';
import { Container, Item } from '../database/types';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { handleScannerError } from '../utils/errorHandler';
import { useQueryClient } from '@tanstack/react-query';

interface ScannerProps {
    onClose: () => void;
    onScan: (result: { success: boolean; message: string; type?: 'container' | 'item'; data?: any }) => void;
    isActive: boolean;
}

interface ScanState {
    mode: 'container' | 'item';
    currentContainer: Container | null;
    history: Array<{ name: string; success: boolean }>;
    lastResult: { success: boolean; message: string; type?: 'container' | 'item'; data?: any } | null;
}

const INITIAL_STATE: ScanState = {
    mode: 'container',
    currentContainer: null,
    history: [],
    lastResult: null
};

const SCAN_DELAY = 500;
const MAX_HISTORY_ITEMS = 5;

const isWeb = Platform.OS === 'web';

export const Scanner: React.FC<ScannerProps> = ({ onClose, onScan, isActive }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanState, setScanState] = useState<ScanState>(INITIAL_STATE);
    const [fadeAnim] = useState(new Animated.Value(0));
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const queryClient = useQueryClient();

    const resetScanner = useCallback(() => {
        setScanState(INITIAL_STATE);
    }, []);

    const handleFeedback = useCallback(async (success: boolean) => {
        // Animation
        fadeAnim.setValue(1);
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
        }).start();

        // Haptic feedback
        await haptics.vibrate(success ? haptics.SUCCESS_PATTERN : haptics.ERROR_PATTERN);
        // Sound feedback
        await sounds.play(success ? 'success' : 'error');
    }, [fadeAnim]);

    const updateScanState = useCallback((updates: Partial<ScanState> | ((prev: ScanState) => Partial<ScanState>)) => {
        setScanState(prev => ({
            ...prev,
            ...(typeof updates === 'function' ? updates(prev) : updates)
        }));
    }, []);

    const handleContainerScan = useCallback(async (qrData: string) => {
        try {
            const container = await getContainerByQRCode(qrData);
            if (container) {
                updateScanState({
                    mode: 'item',
                    currentContainer: container,
                    lastResult: {
                        success: true,
                        message: `Container "${container.name}" sélectionné`,
                        type: 'container',
                        data: container
                    }
                });
                await handleFeedback(true);
            } else {
                updateScanState({
                    lastResult: {
                        success: false,
                        message: "QR code invalide ou container non trouvé",
                        type: 'container'
                    }
                });
                await handleFeedback(false);
            }
        } catch (error) {
            handleScannerError(error as Error, 'Scanner.handleContainerScan');
            updateScanState({
                lastResult: {
                    success: false,
                    message: "Erreur lors du scan du container",
                    type: 'container'
                }
            });
            await handleFeedback(false);
        }
    }, [handleFeedback, updateScanState]);

    const handleItemScan = useCallback(async (qrData: string) => {
        if (!scanState.currentContainer) return;

        try {
            const item = await getItemByQRCode(qrData);
            if (item) {
                const updateData = {
                    ...item,
                    containerId: scanState.currentContainer.id,
                    updatedAt: new Date().toISOString()
                };

                await updateItem(item.id!, updateData);
                
                // Mise à jour optimiste de l'historique
                updateScanState(prev => ({
                    ...prev,
                    history: [{ name: item.name, success: true }, ...prev.history].slice(0, 5),
                    lastResult: {
                        success: true,
                        message: `Article "${item.name}" assigné au container`,
                        type: 'item',
                        data: item
                    }
                }));

                // Invalider les requêtes pour forcer le rechargement
                queryClient.invalidateQueries({ queryKey: ['items'] });
                queryClient.invalidateQueries({ queryKey: ['inventory'] });
                
                await handleFeedback(true);
                triggerRefresh();
            } else {
                updateScanState(prev => ({
                    ...prev,
                    lastResult: {
                        success: false,
                        message: "Article non trouvé",
                        type: 'item'
                    }
                }));
                await handleFeedback(false);
            }
        } catch (error) {
            handleScannerError(error as Error, 'Scanner.handleItemScan');
            updateScanState(prev => ({
                ...prev,
                lastResult: {
                    success: false,
                    message: "Erreur lors du scan de l'article",
                    type: 'item'
                }
            }));
            await handleFeedback(false);
        }
    }, [scanState.currentContainer, handleFeedback, updateScanState, queryClient, triggerRefresh]);

    const handleBarCodeScanned = useCallback(async ({ type, data }: { type: string; data: string }) => {
        if (!isActive) return;

        try {
            const scanData = JSON.parse(data);
            if (!scanData.type || !scanData.qrCode) {
                throw new Error('Données de QR code invalides ou incomplètes');
            }

            if (scanState.mode === 'container') {
                await handleContainerScan(data);
            } else {
                await handleItemScan(data);
            }

            onScan({
                success: true,
                message: 'Scan réussi',
                type: scanData.type,
                data: scanData
            });
        } catch (error) {
            handleScannerError(error as Error, 'Scanner.handleBarCodeScanned');
            onScan({ success: false, message: 'Erreur lors du scan' });
        }
    }, [isActive, scanState.mode, handleContainerScan, handleItemScan, onScan]);

    useEffect(() => {
        if (!isActive) {
            resetScanner();
            return;
        }

        const checkPermissions = async () => {
            try {
                await requestPermission();
            } catch (error) {
                handleScannerError(error as Error, 'Scanner.checkPermissions');
            }
        };

        checkPermissions();
    }, [isActive, resetScanner, requestPermission]);

    if (!permission?.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>
                    {permission === null ? 'Demande d\'accès à la caméra...' : 'Pas d\'accès à la caméra'}
                </Text>
                {permission?.granted === false && (
                    <TouchableOpacity onPress={onClose} style={styles.button}>
                        <Text style={styles.buttonText}>Fermer</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.statusBar}>
                <View style={styles.containerInfo}>
                    <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => {
                            resetScanner();
                            onClose();
                        }}
                    >
                        <MaterialIcons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.containerText}>
                        {scanState.mode === 'container'
                            ? '📦 Scannez un container'
                            : `📱 Scanner des articles dans: ${scanState.currentContainer?.name}`}
                    </Text>
                    {scanState.currentContainer && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={styles.resetButton}
                                onPress={resetScanner}
                            >
                                <MaterialIcons name="refresh" size={20} color="#fff" />
                                <Text style={styles.buttonText}>Nouveau container</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.validateButton}
                                onPress={() => {
                                    handleFeedback(true);
                                    resetScanner();
                                }}
                            >
                                <MaterialIcons name="check" size={20} color="#fff" />
                                <Text style={styles.buttonText}>Valider</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {isActive && permission?.granted && (
                <CameraView
                    key={isActive ? 'active' : 'inactive'}
                    style={[StyleSheet.absoluteFillObject, styles.camera]}
                    facing="back"
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={handleBarCodeScanned}
                />
            )}

            {scanState.lastResult && (
                <Animated.View
                    style={[
                        styles.feedbackPanel,
                        { opacity: fadeAnim },
                        scanState.lastResult.success ? styles.successFeedback : styles.errorFeedback
                    ]}
                >
                    <MaterialIcons
                        name={scanState.lastResult.success ? "check-circle" : "error"}
                        size={24}
                        color="#fff"
                    />
                    <Text style={styles.feedbackText}>{scanState.lastResult.message}</Text>
                </Animated.View>
            )}

            {scanState.history.length > 0 && (
                <View style={styles.historyPanel}>
                    <Text style={styles.historyTitle}>
                        Derniers articles scannés:
                    </Text>
                    {scanState.history.map((item, index) => (
                        <View key={index} style={styles.historyItem}>
                            <MaterialIcons
                                name={item.success ? "check-circle" : "error"}
                                size={16}
                                color={item.success ? "#4CAF50" : "#FF3B30"}
                            />
                            <Text style={styles.historyItemText}>{item.name}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 15,
        zIndex: 1,
    },
    modeText: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 15,
    },
    statusBar: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 2,
        elevation: 2,
    },
    modeButton: {
        backgroundColor: '#4CAF50',
        padding: 8,
        borderRadius: 5,
    },
    modeButtonActive: {
        backgroundColor: '#2E7D32',
    },
    historyPanel: {
        position: 'absolute',
        bottom: 80,
        left: 15,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 8,
        padding: 15,
    },
    historyTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginVertical: 4,
    },
    historyItemText: {
        color: '#fff',
        fontSize: 14,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    containerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    containerText: {
        color: '#fff',
        fontSize: 16,
    },
    resetButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    validateButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#4CAF50',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    rescanButton: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 10,
    },
    rescanButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    errorText: {
        color: '#fff',
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 10,
    },
    permissionButtonText: {
        color: '#fff',
    },
    feedbackPanel: {
        position: 'absolute',
        top: 120,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 10,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    successFeedback: {
        backgroundColor: 'rgba(76,175,80,0.9)',
    },
    errorFeedback: {
        backgroundColor: 'rgba(255,59,48,0.9)',
    },
    feedbackText: {
        color: '#fff',
        fontSize: 16,
        flex: 1,
    },
    actionButtons: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    text: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 40,
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        margin: 20,
    },
    closeButton: {
        padding: 8,
        marginRight: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 20,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanArea: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: 'transparent',
    },
    camera: {
        backgroundColor: 'transparent',
    },
});