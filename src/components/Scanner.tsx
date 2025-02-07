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
    onScan: (result: string) => void;
    isActive: boolean;
}

const SCAN_DELAY = 500;
const MAX_HISTORY_ITEMS = 5;

const isWeb = Platform.OS === 'web';

const Scanner: React.FC<ScannerProps> = ({ onClose, onScan, isActive }) => {
    const [hasPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [currentContainer, setCurrentContainer] = useState<Container | null>(null);
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [continuousMode, setContinuousMode] = useState(false);
    const [scanHistory, setScanHistory] = useState<string[]>([]);
    const [scanCount, setScanCount] = useState(0);
    const [processing, setProcessing] = useState(false);

    const handleQRCodeScanned = async ({ data }: { data: string }) => {
        if (!isActive || scanned) return;
        
        try {
            const parsedData = parseQRCode(data);
            if (parsedData) {
                setScanned(true);
                await haptics.triggerSuccess();
                onScan(data);
                
                // Réinitialiser l'état scanned après un délai
                setTimeout(() => {
                    setScanned(false);
                }, 1500);
            }
        } catch (error) {
            console.error('Erreur de scan:', error);
            await haptics.triggerError();
        }
    };

    if (!hasPermission) {
        return <Text>Demande d'autorisation de la caméra...</Text>;
    }
    if (hasPermission.status !== 'granted') {
        return <Text>Pas d'accès à la caméra</Text>;
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
                            onPress={() => {
                                setCurrentContainer(null);
                                setScanHistory([]);
                                setScanCount(0);
                                setProcessing(false);
                                setScanned(false);
                            }}
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
                onBarcodeScanned={scanned ? undefined : handleQRCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
                style={StyleSheet.absoluteFillObject}
            />

            {scanned && (
                <TouchableOpacity
                    style={styles.rescanButton}
                    onPress={() => setScanned(false)}
                >
                    <Text style={styles.rescanButtonText}>Scanner à nouveau</Text>
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
});

export default Scanner;
