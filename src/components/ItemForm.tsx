import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { addItem, Category, Container } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { QRCodeGenerator } from './QRCodeGenerator';
import { generateQRValue } from '../utils/qrCodeManager';

interface ItemFormProps {
    containers: Container[];
    categories: Category[];
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface ItemFormState {
    name: string;
    description: string;
    purchasePrice: string;
    sellingPrice: string;
    status: 'available' | 'sold';
    photoUri: string;
    containerId?: number;
    categoryId?: number;
    qrCode: string;
}

const ItemForm: React.FC<ItemFormProps> = ({ containers, categories, onSuccess, onCancel }) => {
    const dispatch = useDispatch();
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [item, setItem] = useState<ItemFormState>({
        name: '',
        description: '',
        purchasePrice: '',
        sellingPrice: '',
        status: 'available',
        photoUri: '',
        containerId: undefined,
        categoryId: undefined,
        qrCode: generateQRValue('ITEM')
    });

    const handleSave = async () => {
        try {
            // Validation
            if (!item.name.trim()) {
                Alert.alert('Erreur', 'Le nom est requis');
                return;
            }
            if (!item.purchasePrice || !item.sellingPrice) {
                Alert.alert('Erreur', 'Les prix sont requis');
                return;
            }
            if (!item.categoryId) {
                Alert.alert('Erreur', 'La catégorie est requise');
                return;
            }

            // Ajout dans la base de données
            const newItemId = await addItem({
                name: item.name.trim(),
                description: item.description,
                purchasePrice: parseFloat(item.purchasePrice),
                sellingPrice: parseFloat(item.sellingPrice),
                status: 'available',
                photoUri: item.photoUri,
                containerId: item.containerId || undefined,
                categoryId: item.categoryId,
                qrCode: item.qrCode
            });

            // Mise à jour du store Redux
            dispatch({
                type: 'items/addItem',
                payload: {
                    id: newItemId,
                    ...item,
                    purchasePrice: parseFloat(item.purchasePrice),
                    sellingPrice: parseFloat(item.sellingPrice),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            });

            // Reset du formulaire et refresh
            setItem({
                name: '',
                description: '',
                purchasePrice: '',
                sellingPrice: '',
                status: 'available',
                photoUri: '',
                containerId: undefined,
                categoryId: undefined,
                qrCode: generateQRValue('ITEM')
            });
            
            triggerRefresh();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            Alert.alert('Erreur', 'Impossible de sauvegarder l\'article');
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled && result.assets[0]) {
            setItem(prev => ({ ...prev, photoUri: result.assets[0].uri }));
        }
    };

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <TouchableOpacity onPress={onCancel}>
                    <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Nouvel Article</Text>
                <TouchableOpacity onPress={handleSave}>
                    <Text style={styles.saveText}>Enregistrer</Text>
                </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                <TextInput
                    style={styles.input}
                    placeholder="Nom de l'article"
                    value={item.name}
                    onChangeText={(text) => setItem(prev => ({ ...prev, name: text }))}
                />

                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description de l'article"
                    value={item.description}
                    onChangeText={(text) => setItem(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={4}
                />

                <View style={styles.priceContainer}>
                    <TextInput
                        style={[styles.input, styles.priceInput]}
                        placeholder="Prix d'achat"
                        value={item.purchasePrice}
                        keyboardType="numeric"
                        onChangeText={(text) => setItem(prev => ({ ...prev, purchasePrice: text }))}
                    />
                    <TextInput
                        style={[styles.input, styles.priceInput]}
                        placeholder="Prix de vente"
                        value={item.sellingPrice}
                        keyboardType="numeric"
                        onChangeText={(text) => setItem(prev => ({ ...prev, sellingPrice: text }))}
                    />
                </View>

                <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                    {item.photoUri ? (
                        <Image source={{ uri: item.photoUri }} style={styles.image} />
                    ) : (
                        <Text>Sélectionner une image</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.label}>Container</Text>
                <View style={styles.optionsContainer}>
                    {containers.map((container) => (
                        <TouchableOpacity
                            key={container.id}
                            style={[
                                styles.option,
                                item.containerId === container.id && styles.optionSelected
                            ]}
                            onPress={() => setItem(prev => ({ ...prev, containerId: container.id }))}
                        >
                            <Text>{container.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Catégorie</Text>
                <View style={styles.optionsContainer}>
                    {categories.map((category) => (
                        <TouchableOpacity
                            key={category.id}
                            style={[
                                styles.option,
                                item.categoryId === category.id && styles.optionSelected
                            ]}
                            onPress={() => setItem(prev => ({ ...prev, categoryId: category.id }))}
                        >
                            <Text>{category.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.qrCodeContainer}>
                    <Text style={styles.label}>QR Code</Text>
                    <QRCodeGenerator value={item.qrCode} size={150} />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e5e5',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    cancelText: {
        color: '#007AFF',
        fontSize: 17,
    },
    saveText: {
        color: '#007AFF',
        fontSize: 17,
        fontWeight: '600',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        fontSize: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    priceContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    priceInput: {
        flex: 1,
        maxWidth: '48%',
    },
    imageButton: {
        backgroundColor: '#fff',
        borderRadius: 12,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#000',
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    option: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    optionSelected: {
        backgroundColor: '#007AFF',
    },
    optionText: {
        color: '#000',
        fontSize: 14,
    },
    optionTextSelected: {
        color: '#fff',
    },
    qrCodeContainer: {
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginVertical: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#FF3B30',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ItemForm;