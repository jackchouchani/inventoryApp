import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Alert, TouchableOpacity, Platform, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
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

interface ScannerProps {
    onClose: () => void;
    onScan: (result: { success: boolean; message: string; type?: 'container' | 'item'; data?: any }) => void;
    isActive: boolean;
}

const SCAN_DELAY = 500;
const MAX_HISTORY_ITEMS = 5;

const isWeb = Platform.OS === 'web';

export const Scanner: React.FC<ScannerProps> = ({ onClose, onScan, isActive }) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [currentContainer, setCurrentContainer] = useState<Container | null>(null);
    const [scanHistory, setScanHistory] = useState<Array<{ name: string; success: boolean }>>([]);
    const [scanMode, setScanMode] = useState<'container' | 'item'>('container');
    const [lastScanResult, setLastScanResult] = useState<{ success: boolean; message: string; type?: 'container' | 'item'; data?: any } | null>(null);
    const [fadeAnim] = useState(new Animated.Value(0));
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const { status } = await BarCodeScanner.requestPermissionsAsync();
                if (mounted) {
                    setHasPermission(status === 'granted');

                    if (status !== 'granted') {
                        handleScannerError(
                            new Error('Permission de caméra non accordée'),
                            'Scanner.requestPermissions'
                        );
                    }
                }
            } catch (error) {
                if (mounted) {
                    handleScannerError(
                        error as Error,
                        'Scanner.requestPermissions'
                    );
                    setHasPermission(false);
                }
            }
        })();

        // Cleanup function
        return () => {
            mounted = false;
            // Reset all states
            setScanned(false);
            setCurrentContainer(null);
            setScanHistory([]);
            setScanMode('container');
            setLastScanResult(null);
            // Stop any ongoing animations
            fadeAnim.setValue(0);
        };
    }, []);

    // Animation pour le feedback
    const animateFeedback = (success: boolean) => {
        fadeAnim.setValue(1);
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
        }).start();
    };

    const handleContainerScan = async (qrData: string) => {
        try {
            const container = await getContainerByQRCode(qrData);
            if (container) {
                setCurrentContainer(container);
                setScanMode('item');
                setLastScanResult({
                    success: true,
                    message: `Container "${container.name}" sélectionné`,
                    type: 'container',
                    data: container
                });
                await haptics.vibrate(haptics.SUCCESS_PATTERN);
                await sounds.playSuccessSound();
            } else {
                setLastScanResult({
                    success: false,
                    message: "QR code invalide ou container non trouvé",
                    type: 'container'
                });
                await haptics.vibrate(haptics.ERROR_PATTERN);
                await sounds.playErrorSound();
            }
        } catch (error) {
            setLastScanResult({
                success: false,
                message: "Erreur lors du scan du container",
                type: 'container'
            });
            await haptics.vibrate(haptics.ERROR_PATTERN);
            await sounds.playErrorSound();
        }
    };

    const handleItemScan = async (qrData: string) => {
        if (!currentContainer) return;

        try {
            const item = await getItemByQRCode(qrData);
            if (item) {
                // Mettre à jour l'item avec le nouveau container
                await updateItem(item.id!, {
                    ...item,
                    containerId: currentContainer.id,
                    updatedAt: new Date().toISOString()
                });

                setScanHistory(prev => [{
                    name: item.name,
                    success: true
                }, ...prev].slice(0, 5));

                setLastScanResult({
                    success: true,
                    message: `Article "${item.name}" assigné au container`,
                    type: 'item',
                    data: item
                });
                await haptics.vibrate(haptics.SUCCESS_PATTERN);
                await sounds.playSuccessSound();
                triggerRefresh();
            } else {
                setLastScanResult({
                    success: false,
                    message: "Article non trouvé",
                    type: 'item'
                });
                await haptics.vibrate(haptics.ERROR_PATTERN);
                await sounds.playErrorSound();
            }
        } catch (error) {
            setLastScanResult({
                success: false,
                message: "Erreur lors du scan de l'article",
                type: 'item'
            });
            await haptics.vibrate(haptics.ERROR_PATTERN);
            await sounds.playErrorSound();
        }
    };

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        try {
            if (!isActive) return;

            let scanData;
            try {
                scanData = JSON.parse(data);
            } catch {
                handleScannerError(
                    new Error('QR code invalide'),
                    'Scanner.handleBarCodeScanned'
                );
                onScan({ success: false, message: 'Format de QR code invalide' });
                return;
            }

            if (!scanData.type || !scanData.qrCode) {
                handleScannerError(
                    new Error('Données de QR code incomplètes'),
                    'Scanner.handleBarCodeScanned'
                );
                onScan({ success: false, message: 'Données de QR code incomplètes' });
                return;
            }

            onScan({
                success: true,
                message: 'Scan réussi',
                type: scanData.type,
                data: scanData
            });
        } catch (error) {
            handleScannerError(
                error as Error,
                'Scanner.handleBarCodeScanned'
            );
            onScan({ success: false, message: 'Erreur lors du scan' });
        }
    };

    const resetScanner = () => {
        setCurrentContainer(null);
        setScanHistory([]);
        setScanMode('container');
        setLastScanResult(null);
        setScanned(false);
    };

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>Demande d'accès à la caméra...</Text>
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>Pas d'accès à la caméra</Text>
                <TouchableOpacity onPress={onClose} style={styles.button}>
                    <Text style={styles.buttonText}>Fermer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.statusBar}>
                <View style={styles.containerInfo}>
                    <Text style={styles.containerText}>
                        {scanMode === 'container'
                            ? '📦 Scannez un container'
                            : `📱 Scanner des articles dans: ${currentContainer?.name}`}
                    </Text>
                    {currentContainer && (
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
                                    haptics.vibrate(haptics.SUCCESS_PATTERN);
                                    sounds.playSuccessSound();
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

            {/* Camera View */}
            <BarCodeScanner
                onBarCodeScanned={isActive ? handleBarCodeScanned : undefined}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Feedback Panel */}
            {lastScanResult && (
                <Animated.View
                    style={[
                        styles.feedbackPanel,
                        { opacity: fadeAnim },
                        lastScanResult.success ? styles.successFeedback : styles.errorFeedback
                    ]}
                >
                    <MaterialIcons
                        name={lastScanResult.success ? "check-circle" : "error"}
                        size={24}
                        color="#fff"
                    />
                    <Text style={styles.feedbackText}>{lastScanResult.message}</Text>
                </Animated.View>
            )}

            {/* Scan History */}
            {scanHistory.length > 0 && (
                <View style={styles.historyPanel}>
                    <Text style={styles.historyTitle}>
                        Derniers articles scannés:
                    </Text>
                    {scanHistory.map((item, index) => (
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

            {/* Scan Button */}
            {scanned && (
                <TouchableOpacity
                    style={styles.rescanButton}
                    onPress={() => setScanned(false)}
                >
                    <Text style={styles.rescanButtonText}>
                        Scanner {scanMode === 'container' ? 'un container' : 'un article'}
                    </Text>
                </TouchableOpacity>
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
        position: 'absolute',
        top: 40,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
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
});