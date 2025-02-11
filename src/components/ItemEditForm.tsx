import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { updateItem, Category, Container } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { QRCodeGenerator } from './QRCodeGenerator';

interface ItemEditFormProps {
    item: {
        id?: number;
        name: string;
        description?: string;
        purchasePrice: number;
        sellingPrice: number;
        status: 'available' | 'sold';
        photoUri?: string;
        containerId?: number | null;
        categoryId?: number;
        qrCode: string;
    };
    containers: Container[];
    categories: Category[];
    onSuccess?: () => void;
    onCancel?: () => void;
}

export const ItemEditForm: React.FC<ItemEditFormProps> = ({ item, containers, categories, onSuccess, onCancel }) => {
    const dispatch = useDispatch();
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [editedItem, setEditedItem] = useState({
        ...item,
        purchasePrice: item.purchasePrice?.toString() || '0',
        sellingPrice: item.sellingPrice?.toString() || '0',
    });

    const handleSave = async () => {
        try {
            if (!item.id) {
                Alert.alert('Erreur', 'ID de l\'article manquant');
                return;
            }

            // Validation
            if (!editedItem.name.trim()) {
                Alert.alert('Erreur', 'Le nom est requis');
                return;
            }
            if (!editedItem.purchasePrice || !editedItem.sellingPrice) {
                Alert.alert('Erreur', 'Les prix sont requis');
                return;
            }

            // Mise à jour dans la base de données
            await updateItem(item.id, {
                ...editedItem,
                purchasePrice: parseFloat(editedItem.purchasePrice),
                sellingPrice: parseFloat(editedItem.sellingPrice),
            });

            // Mise à jour du store Redux
            dispatch({
                type: 'items/updateItem',
                payload: {
                    ...editedItem,
                    purchasePrice: parseFloat(editedItem.purchasePrice),
                    sellingPrice: parseFloat(editedItem.sellingPrice),
                    updatedAt: new Date().toISOString()
                }
            });

            triggerRefresh();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Erreur lors de la mise à jour:', error);
            Alert.alert('Erreur', 'Impossible de mettre à jour l\'article');
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
            setEditedItem(prev => ({ ...prev, photoUri: result.assets[0].uri }));
        }
    };

    return (
        <View style={styles.modalContainer}>
            <View style={styles.container}>
                <ScrollView 
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={true}
                    bounces={false}
                >
                    <View style={styles.contentContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Nom de l'article"
                            value={editedItem.name}
                            onChangeText={(text) => setEditedItem(prev => ({ ...prev, name: text }))}
                        />

                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Description de l'article"
                            value={editedItem.description}
                            onChangeText={(text) => setEditedItem(prev => ({ ...prev, description: text }))}
                            multiline
                            numberOfLines={4}
                        />

                        <View style={styles.priceContainer}>
                            <TextInput
                                style={[styles.input, styles.priceInput]}
                                placeholder="Prix d'achat"
                                value={editedItem.purchasePrice}
                                keyboardType="numeric"
                                onChangeText={(text) => setEditedItem(prev => ({ ...prev, purchasePrice: text }))}
                            />
                            <TextInput
                                style={[styles.input, styles.priceInput]}
                                placeholder="Prix de vente"
                                value={editedItem.sellingPrice}
                                keyboardType="numeric"
                                onChangeText={(text) => setEditedItem(prev => ({ ...prev, sellingPrice: text }))}
                            />
                        </View>

                        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                            {editedItem.photoUri ? (
                                <Image source={{ uri: editedItem.photoUri }} style={styles.image} />
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
                                        editedItem.containerId === container.id && styles.optionSelected
                                    ]}
                                    onPress={() => setEditedItem(prev => ({ 
                                        ...prev, 
                                        containerId: container.id ?? prev.containerId 
                                    }))}
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
                                        editedItem.categoryId === category.id && styles.optionSelected
                                    ]}
                                    onPress={() => setEditedItem(prev => ({
                                        ...prev,
                                        categoryId: category.id ?? prev.categoryId
                                    }))}
                                >
                                    <Text>{category.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.qrCodeContainer}>
                            <Text style={styles.label}>QR Code</Text>
                            <QRCodeGenerator value={editedItem.qrCode} size={150} />
                        </View>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                                <Text style={styles.buttonText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.buttonText}>Mettre à jour</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 16,
    },
    container: {
        maxHeight: '80%',
        width: '100%',
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
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