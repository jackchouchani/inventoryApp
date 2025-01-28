import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button, Alert, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { parseQRCode, QR_CODE_TYPES } from '../utils/qrCodeManager';
import { updateItem, getItemByQRCode, getContainerByQRCode } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';

interface ScannerProps {
  onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onClose }) => {
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [assignmentMode, setAssignmentMode] = useState(false);
    const [currentContainer, setCurrentContainer] = useState<string | null>(null);
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);

    const signalSuccess = () => {
        Vibration.vibrate(100); // vibration courte
    };

    const signalError = () => {
        Vibration.vibrate([100, 100, 100]); // trois vibrations courtes
    };

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
        if (scanned) return;
        setScanned(true);

        try {
            const { type, uuid } = parseQRCode(data);
            
            if (!type || !uuid) {
                signalError();
                Alert.alert('Erreur', 'QR code invalide');
                return;
            }

            if (!assignmentMode) {
                if (type === 'CONTAINER') {
                    signalSuccess();
                    setCurrentContainer(data);
                    setAssignmentMode(true);
                    Alert.alert('Succès', 'Container sélectionné. Scannez les articles à assigner.');
                } else {
                    signalError();
                    Alert.alert('Erreur', 'Veuillez d\'abord scanner un container');
                }
            } else {
                if (type === 'ITEM') {
                    const item = await getItemByQRCode(`${QR_CODE_TYPES.ITEM}_${uuid}`);
                    if (!item || !item.id) {
                        signalError();
                        Alert.alert('Erreur', 'Article non trouvé');
                        return;
                    }
                    const container = await getContainerByQRCode(currentContainer!);
                    if (!container || !container.id) {
                        signalError();
                        Alert.alert('Erreur', 'Container non trouvé');
                        return;
                    }
                    await updateItem(item.id, { ...item, containerId: container.id });
                    signalSuccess();
                    Alert.alert('Succès', 'Article assigné au container');
                    triggerRefresh();
                } else {
                    signalError();
                    Alert.alert('Erreur', 'Veuillez scanner un article');
                }
            }
        } catch (error) {
            console.error('Erreur lors du scan:', error);
            signalError();
            Alert.alert('Erreur', 'Impossible de traiter le QR code');
        }

        setTimeout(() => setScanned(false), 1000);
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
            <View style={styles.header}>
                <Text style={styles.modeText}>
                    {assignmentMode 
                        ? 'Mode Assignation - Scannez les articles'
                        : 'Scannez un container pour commencer'}
                </Text>
            </View>

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
    }
});

export default Scanner;
