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
        containerId?: number;
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
        purchasePrice: item.purchasePrice.toString(),
        sellingPrice: item.sellingPrice.toString(),
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
                            <Text style={styles.cancelButtonText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>Mettre à jour</Text>
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
        backgroundColor: 'white',
        marginTop: 50,
        marginHorizontal: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
        marginBottom: 10,
        borderRadius: 5,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#ff3b30',
        padding: 15,
        borderRadius: 5,
        marginRight: 10,
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 5,
    },
    cancelButtonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    saveButtonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    priceContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    priceInput: {
        flex: 1,
    },
    imageButton: {
        alignItems: 'center',
        padding: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        marginVertical: 10,
    },
    image: {
        width: 200,
        height: 150,
        resizeMode: 'contain',
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginVertical: 10,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    option: {
        padding: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
    },
    optionSelected: {
        backgroundColor: '#e3e3e3',
    },
    qrCodeContainer: {
        alignItems: 'center',
        marginVertical: 15,
    },
}); 