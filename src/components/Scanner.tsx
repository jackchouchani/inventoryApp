import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Alert, Vibration, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { parseQRCode, QR_CODE_TYPES } from '../utils/qrCodeManager';
import { updateItem, getItemByQRCode, getContainerByQRCode } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { MaterialIcons as Icon } from '@expo/vector-icons';

interface ScannerProps {
    onClose: () => void;
}

const VIBRATION_DURATION = 100;
const VIBRATION_ERROR_PATTERN = [100, 100, 100];
const SCAN_DELAY = 500;
const MAX_HISTORY_ITEMS = 5;

const Scanner: React.FC<ScannerProps> = ({ onClose }) => {
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [assignmentMode, setAssignmentMode] = useState(false);
    const [currentContainer, setCurrentContainer] = useState<string | null>(null);
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [continuousMode, setContinuousMode] = useState(false);
    const [scanHistory, setScanHistory] = useState<string[]>([]);
    const [scanCount, setScanCount] = useState(0);

    const signalSuccess = () => {
        Vibration.vibrate(VIBRATION_DURATION);
    };

    const signalError = () => {
        Vibration.vibrate(VIBRATION_ERROR_PATTERN);
    };

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    const processScan = async (type: string, uuid: string) => {
        if (!assignmentMode) {
            return handleContainerScan(type, uuid);
        }
        return handleItemScan(type, uuid);
    };

    const handleContainerScan = async (type: string, uuid: string) => {
        if (type === 'CONTAINER') {
            signalSuccess();
            setCurrentContainer(`${QR_CODE_TYPES.CONTAINER}_${uuid}`);
            setAssignmentMode(true);
            Alert.alert('Succès', 'Container sélectionné. Scannez les articles à assigner.');
        } else {
            signalError();
            Alert.alert('Erreur', 'Veuillez d\'abord scanner un container');
        }
    };

    const handleItemScan = async (type: string, uuid: string) => {
        if (type !== 'ITEM') {
            signalError();
            Alert.alert('Erreur', 'Veuillez scanner un article');
            return;
        }

        const qrCode = `${QR_CODE_TYPES.ITEM}_${uuid}`;
        const item = await getItemByQRCode(qrCode);
        if (!item?.id) {
            signalError();
            Alert.alert('Erreur', 'Article non trouvé');
            return;
        }

        const container = await getContainerByQRCode(currentContainer!);
        if (!container?.id) {
            signalError();
            Alert.alert('Erreur', 'Container non trouvé');
            return;
        }

        await updateItem(item.id, { ...item, containerId: undefined });
        signalSuccess();
        triggerRefresh();
        setScanHistory(prev => [qrCode, ...prev.slice(0, MAX_HISTORY_ITEMS - 1)]);
        setScanCount(prev => prev + 1);

        Alert.alert('Succès', 'Article assigné au container', [
            { text: 'OK', onPress: () => continuousMode && setScanned(false) }
        ]);
    };

    const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
        if (scanned && !continuousMode) return;

        try {
            const { type, uuid } = parseQRCode(data);

            if (!type || !uuid) {
                signalError();
                Alert.alert('Erreur', 'QR code invalide');
                return;
            }

            await processScan(type, uuid);

            if (continuousMode) {
                setTimeout(() => setScanned(false), SCAN_DELAY);
            } else {
                setScanned(true);
            }
        } catch (error) {
            console.error('Erreur lors du scan:', error);
            signalError();
            Alert.alert('Erreur', 'Impossible de traiter le QR code');
        }
    };

    const handleUndoScan = async (qrValue: string) => {
        try {
            const { type, uuid } = parseQRCode(qrValue);
            if (type === 'ITEM') {
                const item = await getItemByQRCode(qrValue);
                if (item?.id) {
                    await updateItem(item.id, { ...item, containerId: undefined });
                    setScanHistory(prev => prev.filter(i => i !== qrValue));
                    setScanCount(prev => prev - 1);
                    triggerRefresh();
                }
            }
        } catch (error) {
            console.error('Erreur lors de l\'annulation:', error);
        }
    };

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
                <Text style={styles.modeText}>
                    {assignmentMode ? `Mode Assignation - ${scanCount} articles` : 'Scannez un container'}
                </Text>
                <TouchableOpacity
                    style={styles.continuousButton}
                    onPress={() => setContinuousMode(!continuousMode)}>
                    <Text style={styles.buttonText}>
                        {continuousMode ? '⏺ Scan continu' : '⏹ Scan continu'}
                    </Text>
                </TouchableOpacity>
            </View>

            {scanHistory.length > 0 && (
                <View style={styles.historyPanel}>
                    <Text style={styles.historyTitle}>Derniers scans :</Text>
                    {scanHistory.map((item, index) => (
                        <View key={index} style={styles.historyItem}>
                            <Text numberOfLines={1} style={styles.historyText}>
                                {item}
                            </Text>
                            <TouchableOpacity
                                onPress={() => handleUndoScan(item)}>
                                <Icon name="undo" size={16} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            <CameraView
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            />

            <View style={styles.footer}>
                {assignmentMode && (
                    <Button
                        title="Terminer l'assignation"
                        onPress={() => {
                            setAssignmentMode(false);
                            setCurrentContainer(null);
                        }}
                    />
                )}
                <Button title="Fermer" onPress={onClose} />
            </View>
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
    },
    continuousButton: {
        backgroundColor: '#4CAF50',
        padding: 8,
        borderRadius: 5,
    },
    historyPanel: {
        position: 'absolute',
        bottom: 80,
        left: 15,
        right: 15,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 8,
        padding: 10,
    },
    historyTitle: {
        fontWeight: 'bold',
        marginBottom: 5,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    historyText: {
        flex: 1,
        marginRight: 10,
    },
    buttonText: {
        color: 'white',
    },
});

export default Scanner;
