import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import { database, Category, Container } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { generateId } from '../utils/identifierManager';
import { addItem } from '../store/itemsActions';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import type { MaterialIconName } from '../types/icons';
import { photoService } from '../services/photoService';
import { ImagePicker } from './ImagePicker';
import * as Sentry from '@sentry/react-native';
import AdaptiveImage from './AdaptiveImage';

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
    photo_storage_url?: string;
    containerId?: number | null;
    categoryId?: number | null;
}

const INITIAL_STATE: ItemFormState = {
    name: '',
    description: '',
    purchasePrice: '',
    sellingPrice: '',
    status: 'available',
    photo_storage_url: undefined,
    containerId: null,
    categoryId: null,
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

            // Upload de la photo si présente
            let photoUrl: string | undefined = undefined;
            if (item.photo_storage_url) {
                try {
                    photoUrl = await photoService.uploadPhoto(item.photo_storage_url);
                } catch (error) {
                    console.error('Erreur lors de l\'upload de la photo:', error);
                    const continueWithoutPhoto = await new Promise((resolve) => {
                        Alert.alert(
                            'Erreur',
                            'Impossible d\'uploader la photo. Voulez-vous continuer sans photo ?',
                            [
                                { text: 'Non', onPress: () => resolve(false) },
                                { text: 'Oui', onPress: () => resolve(true) }
                            ]
                        );
                    });
                    
                    if (!continueWithoutPhoto) {
                        return;
                    }
                }
            }

            // Génération du QR code uniquement à la sauvegarde
            const qrCode = generateId('ITEM');

            // Ajout dans la base de données
            const newItemId = await database.addItem({
                name: item.name.trim(),
                description: item.description.trim(),
                purchasePrice,
                sellingPrice,
                status: 'available',
                photo_storage_url: photoUrl,
                containerId: item.containerId || null,
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
                photo_storage_url: photoUrl,
                containerId: item.containerId || null,
                categoryId: item.categoryId,
                qrCode,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Mise à jour du store Redux
            dispatch(addItem(newItem));

            // Invalider les requêtes
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

    const handleImageSelected = (uri: string) => {
        setItem(prev => ({ ...prev, photo_storage_url: uri }));
    };

    const handleImageError = (error: string) => {
        Sentry.captureException(new Error(error), {
            tags: { context: 'item_form_image_picker' }
        });
        Alert.alert('Erreur', error);
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
                    <View style={styles.imageContainer}>
                        {item.photo_storage_url ? (
                            <View style={styles.imageWrapper}>
                                <AdaptiveImage
                                    uri={item.photo_storage_url}
                                    style={styles.image}
                                    resizeMode="cover"
                                    placeholder={
                                        <View style={styles.placeholderContainer}>
                                            <MaterialIcons name="image" size={24} color="#ccc" />
                                        </View>
                                    }
                                />
                                <TouchableOpacity 
                                    style={styles.deletePhotoButton}
                                    onPress={() => setItem(prev => ({ ...prev, photo_storage_url: undefined }))}
                                >
                                    <MaterialIcons name="delete" size={24} color="#FF3B30" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <ImagePicker
                                onImageSelected={handleImageSelected}
                                onError={handleImageError}
                            />
                        )}
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Emplacement</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
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
                                    <MaterialIcons
                                        name="inbox"
                                        size={20}
                                        color={item.containerId === container.id ? '#fff' : '#666'}
                                        style={styles.containerIcon}
                                    />
                                    <Text style={[
                                        styles.optionText,
                                        item.containerId === container.id && styles.optionTextSelected
                                    ]}>{container.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                <View style={[styles.formSection, styles.formSectionLast]}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
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
                    </ScrollView>
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
    imageContainer: {
        marginTop: 8,
    },
    imageWrapper: {
        aspectRatio: 4/3,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    deletePhotoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 20,
        padding: 8,
        zIndex: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    optionsScrollView: {
        marginBottom: 0,
    },
    optionsContainer: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
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
        fontSize: 14,
        color: '#333',
    },
    optionTextSelected: {
        color: '#fff',
        fontWeight: '500',
    },
    categoryIcon: {
        marginRight: 8,
    },
    containerIcon: {
        marginRight: 8,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default ItemForm;