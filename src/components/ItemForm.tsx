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

const ItemForm: React.FC<ItemFormProps> = ({ containers, categories, onSuccess }) => {
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
        <ScrollView style={styles.container}>
            <View style={styles.contentContainer}>
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

                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Sauvegarder</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40, // Pour assurer de l'espace en bas
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
        marginBottom: 10,
        borderRadius: 5,
    },
    priceContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    priceInput: {
        flex: 1,
    },
    imageButton: {
        height: 200,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        borderRadius: 5,
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: 5,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 15,
    },
    option: {
        padding: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
    },
    optionSelected: {
        backgroundColor: '#e3e3e3',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    qrCodeContainer: {
        alignItems: 'center',
        marginVertical: 15,
        padding: 10,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
});

export default ItemForm;