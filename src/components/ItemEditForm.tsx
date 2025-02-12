import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { updateItem, deleteItem, Category, Container } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { QRCodeGenerator } from './QRCodeGenerator';
import { MaterialIcons } from '@expo/vector-icons';

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

            // Validation des prix
            const purchasePrice = parseFloat(editedItem.purchasePrice);
            const sellingPrice = parseFloat(editedItem.sellingPrice);

            if (isNaN(purchasePrice) || isNaN(sellingPrice)) {
                Alert.alert('Erreur', 'Les prix doivent être des nombres valides');
                return;
            }

            // Mise à jour dans la base de données
            await updateItem(item.id, {
                ...editedItem,
                purchasePrice,
                sellingPrice,
                updatedAt: new Date().toISOString()
            });

            // Mise à jour du store Redux
            dispatch({
                type: 'items/updateItem',
                payload: {
                    ...editedItem,
                    id: item.id,
                    purchasePrice,
                    sellingPrice,
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

    const handleDelete = async () => {
        if (!item.id) return;

        Alert.alert(
            'Confirmation',
            'Êtes-vous sûr de vouloir supprimer cet article ?',
            [
                {
                    text: 'Annuler',
                    style: 'cancel'
                },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Mise à jour optimiste du store Redux
                            dispatch({
                                type: 'items/removeItem',
                                payload: item.id
                            });

                            try {
                                // Mise à jour de la base de données
                                await deleteItem(item.id!);
                                triggerRefresh();
                                if (onSuccess) onSuccess();
                            } catch (error) {
                                // En cas d'erreur, on remet l'item dans le store
                                dispatch({
                                    type: 'items/addItem',
                                    payload: item
                                });
                                console.error('Erreur lors de la suppression:', error);
                                Alert.alert('Erreur', 'Impossible de supprimer l\'article');
                            }
                        } catch (error) {
                            console.error('Erreur:', error);
                            Alert.alert('Erreur', 'Une erreur est survenue');
                        }
                    }
                }
            ]
        );
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
            <ScrollView style={styles.container}>
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
                        <View style={styles.priceInputWrapper}>
                            <Text style={styles.priceLabel}>Prix d'achat (€)</Text>
                            <TextInput
                                style={[styles.input, styles.priceInput]}
                                placeholder="0.00"
                                value={editedItem.purchasePrice}
                                keyboardType="decimal-pad"
                                onChangeText={(text) => {
                                    const cleanText = text.replace(',', '.');
                                    if (cleanText === '' || /^\d*\.?\d*$/.test(cleanText)) {
                                        setEditedItem(prev => ({ ...prev, purchasePrice: cleanText }));
                                    }
                                }}
                            />
                        </View>
                        <View style={styles.priceInputWrapper}>
                            <Text style={styles.priceLabel}>Prix de vente (€)</Text>
                            <TextInput
                                style={[styles.input, styles.priceInput]}
                                placeholder="0.00"
                                value={editedItem.sellingPrice}
                                keyboardType="decimal-pad"
                                onChangeText={(text) => {
                                    const cleanText = text.replace(',', '.');
                                    if (cleanText === '' || /^\d*\.?\d*$/.test(cleanText)) {
                                        setEditedItem(prev => ({ ...prev, sellingPrice: cleanText }));
                                    }
                                }}
                            />
                        </View>
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
                        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                            <MaterialIcons name="delete" size={20} color="#fff" />
                            <Text style={styles.buttonText}>Supprimer</Text>
                        </TouchableOpacity>
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
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Exemple de style
    },
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    contentContainer: {
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
        flexDirection: 'column',
        gap: 12,
        marginBottom: 16,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    priceInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 10,
    },
    priceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        width: '40%',
    },
    priceInput: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 6,
        padding: 8,
        textAlign: 'right',
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
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
        flexDirection: 'row',
        justifyContent: 'center',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#8E8E93',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    deleteButton: {
        flex: 1,
        backgroundColor: '#FF3B30',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});