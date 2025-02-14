import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { database, Category, Container } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { generateQRValue } from '../utils/qrCodeManager';
import { addItem } from '../store/itemsActions';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import type { MaterialIconName } from '../types/icons';

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
}

const INITIAL_STATE: ItemFormState = {
    name: '',
    description: '',
    purchasePrice: '',
    sellingPrice: '',
    status: 'available',
    photoUri: '',
    containerId: undefined,
    categoryId: undefined,
};

const ItemForm: React.FC<ItemFormProps> = ({ containers, categories, onSuccess, onCancel }) => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [item, setItem] = useState<ItemFormState>(INITIAL_STATE);

    const resetForm = useCallback(() => {
        setItem(INITIAL_STATE);
    }, []);

    useEffect(() => {
        return () => {
            resetForm();
        };
    }, [resetForm]);

    const handleSave = async () => {
        try {
            // Validation
            if (!item.name.trim()) {
                Alert.alert('Erreur', 'Le nom est requis');
                return;
            }

            const purchasePrice = parseFloat(item.purchasePrice);
            const sellingPrice = parseFloat(item.sellingPrice);
            
            if (isNaN(purchasePrice) || isNaN(sellingPrice)) {
                Alert.alert('Erreur', 'Les prix doivent être des nombres valides');
                return;
            }
            
            if (purchasePrice < 0 || sellingPrice < 0) {
                Alert.alert('Erreur', 'Les prix ne peuvent pas être négatifs');
                return;
            }

            if (!item.categoryId) {
                Alert.alert('Erreur', 'La catégorie est requise');
                return;
            }

            // Génération du QR code uniquement à la sauvegarde
            const qrCode = generateQRValue('ITEM');

            // Ajout dans la base de données
            const newItemId = await database.addItem({
                name: item.name.trim(),
                description: item.description.trim(),
                purchasePrice,
                sellingPrice,
                status: 'available',
                photoUri: item.photoUri,
                containerId: item.containerId,
                categoryId: item.categoryId,
                qrCode
            });

            // Création de l'objet complet pour Redux
            const newItem = {
                id: newItemId,
                name: item.name.trim(),
                description: item.description.trim(),
                purchasePrice,
                sellingPrice,
                status: 'available' as const,
                photoUri: item.photoUri,
                containerId: item.containerId,
                categoryId: item.categoryId,
                qrCode,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Mise à jour du store Redux avec l'action creator appropriée
            dispatch(addItem(newItem));

            // Invalider les requêtes pour forcer le rechargement
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });

            resetForm();
            triggerRefresh();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            Alert.alert('Erreur', 'Impossible de sauvegarder l\'article');
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setItem(prev => ({ ...prev, photoUri: result.assets[0].uri }));
            }
        } catch (error) {
            console.error('Erreur lors de la sélection de l\'image:', error);
            Alert.alert('Erreur', 'Impossible de charger l\'image');
        }
    };

    const handleContainerSelect = useCallback((containerId: number | undefined) => {
        if (containerId) {
            setItem(prev => ({ ...prev, containerId }));
        }
    }, []);

    const handleCategorySelect = useCallback((categoryId: number | undefined) => {
        if (categoryId) {
            setItem(prev => ({ ...prev, categoryId }));
        }
    }, []);

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvel Article</Text>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveText}>Enregistrer</Text>
                </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Informations générales</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nom de l'article"
                        value={item.name}
                        onChangeText={(text) => setItem(prev => ({ ...prev, name: text }))}
                        placeholderTextColor="#999"
                    />

                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Description de l'article"
                        value={item.description}
                        onChangeText={(text) => setItem(prev => ({ ...prev, description: text }))}
                        multiline
                        numberOfLines={4}
                        placeholderTextColor="#999"
                    />
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Prix</Text>
                    <View style={styles.priceContainer}>
                        <View style={styles.priceWrapper}>
                            <Text style={styles.priceLabel}>Prix d'achat</Text>
                            <TextInput
                                style={[styles.input, styles.priceInput]}
                                placeholder="0.00"
                                value={item.purchasePrice}
                                keyboardType="numeric"
                                onChangeText={(text) => setItem(prev => ({ ...prev, purchasePrice: text }))}
                                placeholderTextColor="#999"
                            />
                        </View>
                        <View style={styles.priceWrapper}>
                            <Text style={styles.priceLabel}>Prix de vente</Text>
                            <TextInput
                                style={[styles.input, styles.priceInput]}
                                placeholder="0.00"
                                value={item.sellingPrice}
                                keyboardType="numeric"
                                onChangeText={(text) => setItem(prev => ({ ...prev, sellingPrice: text }))}
                                placeholderTextColor="#999"
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Photo</Text>
                    <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                        {item.photoUri ? (
                            <Image source={{ uri: item.photoUri }} style={styles.image} />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <Text style={styles.imagePlaceholderText}>Ajouter une photo</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Emplacement</Text>
                    <View style={styles.optionsContainer}>
                        {containers.map((container) => (
                            <TouchableOpacity
                                key={container.id}
                                style={[
                                    styles.option,
                                    item.containerId === container.id && styles.optionSelected
                                ]}
                                onPress={() => handleContainerSelect(container.id)}
                            >
                                <Text style={[
                                    styles.optionText,
                                    item.containerId === container.id && styles.optionTextSelected
                                ]}>{container.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={[styles.formSection, styles.formSectionLast]}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <View style={styles.optionsContainer}>
                        {categories.map((category) => (
                            <TouchableOpacity
                                key={category.id}
                                style={[
                                    styles.option,
                                    item.categoryId === category.id && styles.optionSelected
                                ]}
                                onPress={() => handleCategorySelect(category.id)}
                            >
                                <MaterialIcons
                                    name={(category.icon as MaterialIconName) || 'folder'}
                                    size={20}
                                    color={item.categoryId === category.id ? '#fff' : '#666'}
                                    style={styles.categoryIcon}
                                />
                                <Text style={[
                                    styles.optionText,
                                    item.categoryId === category.id && styles.optionTextSelected
                                ]}>{category.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    formSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    formSectionLast: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000',
        marginBottom: 12,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#000',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        marginBottom: 12,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    priceContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    priceWrapper: {
        flex: 1,
    },
    priceLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    priceInput: {
        marginBottom: 0,
    },
    imageButton: {
        aspectRatio: 4/3,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e5e5e5',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePlaceholderText: {
        color: '#666',
        fontSize: 16,
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e5e5e5',
    },
    optionSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    optionText: {
        color: '#000',
        fontSize: 14,
    },
    optionTextSelected: {
        color: '#fff',
    },
    categoryIcon: {
        marginRight: 8,
    },
});

export default ItemForm;