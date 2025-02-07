import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Alert, TouchableOpacity, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { parseQRCode, QR_CODE_TYPES } from '../utils/qrCodeManager';
import { updateItem, getItemByQRCode, getContainerByQRCode } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as haptics from '../utils/vibrationManager';
import { Container } from '../database/types';

interface ScannerProps {
    onClose: () => void;
}

const SCAN_DELAY = 500;
const MAX_HISTORY_ITEMS = 5;

const isWeb = Platform.OS === 'web';

const Scanner: React.FC<ScannerProps> = ({ onClose }) => {
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [currentContainer, setCurrentContainer] = useState<Container | null>(null);
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [continuousMode, setContinuousMode] = useState(false);
    const [scanHistory, setScanHistory] = useState<string[]>([]);
    const [scanCount, setScanCount] = useState(0);
    const [processing, setProcessing] = useState(false);

    const signalSuccess = async () => {
        await haptics.triggerSuccess();
    };

    const signalError = async () => {
        await haptics.triggerError();
    };

    const resetScanner = () => {
        setCurrentContainer(null);
        setScanHistory([]);
        setScanCount(0);
        setProcessing(false);
        setScanned(false);
    };

    const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
        if (processing) return;
        setProcessing(true);

        try {
            const { type, uuid } = parseQRCode(data);

            if (type === 'CONTAINER') {
                const containerQRCode = `${QR_CODE_TYPES.CONTAINER}_${uuid}`;
                const container = await getContainerByQRCode(containerQRCode);
                
                if (!container) {
                    await signalError();
                    Alert.alert('Erreur', 'Container non trouvé');
                    setProcessing(false);
                    return;
                }

                setCurrentContainer(container);
                await signalSuccess();
                setProcessing(false);
                return;
            }

            if (type === 'ITEM') {
                if (!currentContainer) {
                    await signalError();
                    Alert.alert('Erreur', 'Veuillez d\'abord scanner un container');
                    setProcessing(false);
                    return;
                }

                const itemQRCode = `${QR_CODE_TYPES.ITEM}_${uuid}`;
                const item = await getItemByQRCode(itemQRCode);

                if (!item?.id) {
                    await signalError();
                    Alert.alert('Erreur', 'Article non trouvé');
                    setProcessing(false);
                    return;
                }

                await updateItem(item.id, { ...item, containerId: currentContainer.id });
                await signalSuccess();
                triggerRefresh();
                setScanHistory(prev => [item.name, ...prev.slice(0, MAX_HISTORY_ITEMS - 1)]);
                setScanCount(prev => prev + 1);

                if (continuousMode) {
                    setTimeout(() => {
                        setProcessing(false);
                        setScanned(false);
                    }, SCAN_DELAY);
                } else {
                    Alert.alert('Article assigné', 'Que souhaitez-vous faire ?', [
                        { text: 'Scanner un autre article', onPress: () => { setProcessing(false); setScanned(false); } },
                        { text: 'Scanner un autre container', onPress: resetScanner },
                        { text: 'Terminer', onPress: onClose }
                    ]);
                }
            }
        } catch (error) {
            console.error('Erreur lors du scan:', error);
            await signalError();
            Alert.alert('Erreur', 'Erreur lors du scan');
            setProcessing(false);
        }
    };

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    if (!permission) {
        return <Text>Chargement des permissions...</Text>;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text>Autorisation caméra requise</Text>
                <Button title="Autoriser" onPress={requestPermission} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.statusBar}>
                <View style={styles.containerInfo}>
                    <Text style={styles.containerText}>
                        {currentContainer 
                            ? `Container: ${currentContainer.name} (${scanCount} articles)` 
                            : 'Scannez un container'}
                    </Text>
                    {currentContainer && (
                        <TouchableOpacity 
                            style={styles.resetButton}
                            onPress={resetScanner}
                        >
                            <Text style={styles.resetButtonText}>Réinitialiser</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={[
                        styles.modeButton,
                        continuousMode && styles.modeButtonActive
                    ]}
                    onPress={() => setContinuousMode(!continuousMode)}>
                    <Text style={styles.buttonText}>
                        {continuousMode ? '⚡ Mode Rapide' : '🔍 Mode Manuel'}
                    </Text>
                </TouchableOpacity>
            </View>

            {scanHistory.length > 0 && (
                <View style={styles.historyPanel}>
                    <Text style={styles.historyTitle}>Articles scannés :</Text>
                    {scanHistory.map((itemName, index) => (
                        <Text key={index} style={styles.historyItem}>
                            • {itemName}
                        </Text>
                    ))}
                </View>
            )}

            <CameraView
                facing="back"
                onBarcodeScanned={scanned && !continuousMode ? undefined : handleBarcodeScanned}
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            />
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
        color: '#fff',
        fontSize: 14,
        marginVertical: 2,
    },
    buttonText: {
        color: 'white',
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
        backgroundColor: '#FF3B30',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        marginLeft: 10,
    },
    resetButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default Scanner;
