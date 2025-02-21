import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import { database, Category, Container } from '../database/database';
import { QRCodeGenerator } from './QRCodeGenerator';
import { MaterialIcons } from '@expo/vector-icons';
import { deleteItem, updateItem } from '../store/itemsActions';
import { useQueryClient } from '@tanstack/react-query';
import type { MaterialIconName } from '../types/icons';
import type { Item, ItemUpdate } from '../types/item';
import { ImagePicker } from './ImagePicker';
import AdaptiveImage from './AdaptiveImage';
import { validatePrice, validateItemName } from '../utils/validation';
import { handleError } from '../utils/errorHandler';
import { checkPhotoPermissions } from '../utils/permissions';
import { usePhoto } from '../hooks/usePhoto';

interface ItemEditFormProps {
    item: Item;
    categories: Category[];
    containers: Container[];
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface EditedItemForm {
    name: string;
    description?: string;
    purchasePrice: string;
    sellingPrice: string;
    status: 'available' | 'sold';
    photo_storage_url?: string;
    containerId?: number | null;
    categoryId?: number;
    qrCode: string;
}

// Composant mémorisé pour l'option de container
const ContainerOption = memo(({ 
    container, 
    isSelected, 
    onSelect 
}: { 
    container: Container; 
    isSelected: boolean; 
    onSelect: () => void;
}) => (
    <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={onSelect}
    >
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {container.name}
        </Text>
    </TouchableOpacity>
));

// Composant mémorisé pour l'option de catégorie
const CategoryOption = memo(({ 
    category, 
    isSelected, 
    onSelect 
}: { 
    category: Category; 
    isSelected: boolean; 
    onSelect: () => void;
}) => (
    <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={onSelect}
    >
        <MaterialIcons
            name={(category.icon as MaterialIconName) || 'folder'}
            size={20}
            color={isSelected ? '#fff' : '#666'}
            style={styles.categoryIcon}
        />
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {category.name}
        </Text>
    </TouchableOpacity>
));

const arePropsEqual = (prevProps: ItemEditFormProps, nextProps: ItemEditFormProps) => {
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.updatedAt === nextProps.item.updatedAt &&
        prevProps.categories.length === nextProps.categories.length &&
        prevProps.containers.length === nextProps.containers.length
    );
};

export const ItemEditForm: React.FC<ItemEditFormProps> = memo(({ item, containers, categories, onSuccess, onCancel }) => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { uploadPhoto, deletePhoto, validatePhoto } = usePhoto();

    // Ajout de logs de débogage
    useEffect(() => {
        console.log('Containers reçus:', containers);
        console.log('Categories reçues:', categories);
    }, [containers, categories]);

    const [editedItem, setEditedItem] = useState<EditedItemForm>({
        name: item.name,
        description: item.description,
        purchasePrice: item.purchasePrice.toString(),
        sellingPrice: item.sellingPrice.toString(),
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.containerId,
        categoryId: item.categoryId,
        qrCode: item.qrCode
    });

    const initialFormState = useMemo(() => ({
        name: item.name,
        description: item.description,
        purchasePrice: item.purchasePrice.toString(),
        sellingPrice: item.sellingPrice.toString(),
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.containerId,
        categoryId: item.categoryId,
        qrCode: item.qrCode
    }), [item]);

    useEffect(() => {
        setEditedItem(initialFormState);
    }, [initialFormState]);

    const handlePriceChange = useCallback((field: 'purchasePrice' | 'sellingPrice', text: string) => {
        const cleanText = text.replace(',', '.');
        if (cleanText === '' || /^\d*\.?\d*$/.test(cleanText)) {
            setEditedItem(prev => ({ ...prev, [field]: cleanText }));
        }
    }, []);

    const validateForm = useCallback((): boolean => {
        try {
            if (!validateItemName(editedItem.name)) {
                Alert.alert('Erreur', 'Le nom de l\'article est invalide');
                return false;
            }

            const purchasePrice = parseFloat(editedItem.purchasePrice);
            const sellingPrice = parseFloat(editedItem.sellingPrice);

            if (!validatePrice(purchasePrice) || !validatePrice(sellingPrice)) {
                Alert.alert('Erreur', 'Les prix doivent être des nombres valides');
                return false;
            }

            if (sellingPrice < purchasePrice) {
                Alert.alert('Attention', 'Le prix de vente est inférieur au prix d\'achat');
                return false;
            }

            return true;
        } catch (error) {
            handleError(error, 'Erreur de validation du formulaire', {
                source: 'item_edit_form_validation',
                message: `Erreur lors de la validation de l'article ${item.id}`
            });
            return false;
        }
    }, [editedItem, item.id]);

    const handlePhotoUpload = async (uri: string) => {
        try {
            if (!await validatePhoto(uri)) {
                Alert.alert('Erreur', 'Photo invalide');
                return;
            }
            const photoUrl = await uploadPhoto(uri);
            setEditedItem(prev => ({ ...prev, photo_storage_url: photoUrl }));
        } catch (error) {
            handleError(error, 'Erreur lors de la sauvegarde', {
                source: 'item_edit_form_save',
                message: `Erreur lors de la mise à jour de l'article ${item.id}`
            });
            Alert.alert('Erreur', 'Impossible de mettre à jour l\'article');
        }
    };

    const handleSubmit = useCallback(async () => {
        try {
            if (!validateForm()) {
                return;
            }

            if (!item.id) {
                throw new Error('ID de l\'article manquant');
            }

            if (item.photo_storage_url && item.photo_storage_url !== editedItem.photo_storage_url) {
                await deletePhoto(item.photo_storage_url);
            }

            const purchasePrice = parseFloat(editedItem.purchasePrice);
            const sellingPrice = parseFloat(editedItem.sellingPrice);

            const itemToUpdate: ItemUpdate = {
                name: editedItem.name,
                description: editedItem.description,
                purchasePrice,
                sellingPrice,
                status: editedItem.status,
                photo_storage_url: editedItem.photo_storage_url,
                containerId: editedItem.containerId,
                categoryId: editedItem.categoryId,
                qrCode: editedItem.qrCode
            };

            try {
                await database.updateItem(item.id, itemToUpdate);
                
                const updatedItem: Item = {
                    ...item,
                    ...itemToUpdate,
                    updatedAt: new Date().toISOString()
                };
                
                dispatch(updateItem(updatedItem));
                queryClient.invalidateQueries({ queryKey: ['items'] });
                queryClient.invalidateQueries({ queryKey: ['inventory'] });

                if (onSuccess) onSuccess();
            } catch (error) {
                handleError(error, 'Erreur lors de la mise à jour', {
                    source: 'item_edit_form_update',
                    message: `Échec de la mise à jour de l'article ${item.id}`,
                    showAlert: true
                });
            }
        } catch (error) {
            handleError(error, 'Erreur lors de la mise à jour', {
                source: 'item_edit_form_update',
                message: `Erreur générale lors de la mise à jour de l'article ${item.id}`,
                showAlert: true
            });
        }
    }, [editedItem, item.id, validateForm, uploadPhoto, deletePhoto, dispatch, onSuccess, queryClient]);

    const handleDelete = useCallback(async () => {
        if (!item.id) return;

        const confirmDelete = async () => {
            try {
                const itemId = item.id as number;
                
                // Suppression optimiste
                dispatch(deleteItem(itemId));
                
                try {
                    await database.deleteItem(itemId);
                    queryClient.invalidateQueries({ queryKey: ['items'] });
                    queryClient.invalidateQueries({ queryKey: ['inventory'] });
                    if (onCancel) onCancel();
                } catch (error) {
                    // Rollback en cas d'erreur
                    dispatch(updateItem(item));
                    handleError(error, 'Erreur lors de la suppression', {
                        source: 'item_edit_form_delete',
                        message: `Échec de la suppression de l'article ${item.id}`,
                        showAlert: true
                    });
                }
            } catch (error) {
                handleError(error, 'Erreur lors de la suppression', {
                    source: 'item_edit_form_delete',
                    message: `Erreur générale lors de la suppression de l'article ${item.id}`,
                    showAlert: true
                });
            }
        };

        Alert.alert(
            'Confirmation de suppression',
            'Êtes-vous sûr de vouloir supprimer cet article ?',
            [
                {
                    text: 'Annuler',
                    style: 'cancel'
                },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: confirmDelete
                }
            ]
        );
    }, [item, dispatch, queryClient, onCancel]);

    const handleImageSelected = useCallback(async (uri: string) => {
        try {
            const hasPermissions = await checkPhotoPermissions();
            if (!hasPermissions) {
                Alert.alert('Erreur', 'Permission d\'accès aux photos refusée');
                return;
            }

            await handlePhotoUpload(uri);
        } catch (error) {
            handleError(error, 'Erreur lors de la sélection de la photo', {
                source: 'item_edit_form_image',
                message: `Échec de la sélection de la photo pour l'article ${item.id}`,
                showAlert: true
            });
        }
    }, [item.id, handlePhotoUpload]);

    const handlePhotoDelete = useCallback(async () => {
        try {
            if (item.photo_storage_url) {
                await deletePhoto(item.photo_storage_url);
            }
            setEditedItem(prev => ({ ...prev, photo_storage_url: undefined }));
        } catch (error) {
            handleError(error, 'Erreur lors de la suppression de la photo', {
                source: 'item_edit_form_image',
                message: `Échec de la suppression de la photo de l'article ${item.id}`,
                showAlert: true
            });
        }
    }, [item.id, deletePhoto]);

    return (
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
                            onChangeText={(text) => handlePriceChange('purchasePrice', text)}
                        />
                    </View>
                    <View style={styles.priceInputWrapper}>
                        <Text style={styles.priceLabel}>Prix de vente (€)</Text>
                        <TextInput
                            style={[styles.input, styles.priceInput]}
                            placeholder="0.00"
                            value={editedItem.sellingPrice}
                            keyboardType="decimal-pad"
                            onChangeText={(text) => handlePriceChange('sellingPrice', text)}
                        />
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Photo</Text>
                    <View style={styles.imageContainer}>
                        {editedItem.photo_storage_url ? (
                            <View style={styles.imageWrapper}>
                                <AdaptiveImage 
                                    uri={editedItem.photo_storage_url}
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
                                    onPress={handlePhotoDelete}
                                >
                                    <MaterialIcons name="delete" size={24} color="#FF3B30" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <ImagePicker
                                onImageSelected={handleImageSelected}
                                onError={(error) => handleError(error, 'Erreur du sélecteur d\'images', {
                                    source: 'item_edit_form_image_picker',
                                    message: `Erreur lors de la sélection d'image pour l'article ${item.id}`
                                })}
                            />
                        )}
                    </View>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Container</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
                        <View style={styles.optionsContainer}>
                            {containers && containers.length > 0 ? (
                                containers.map((container) => (
                                    <ContainerOption
                                        key={container.id}
                                        container={container}
                                        isSelected={editedItem.containerId === container.id}
                                        onSelect={() => setEditedItem(prev => ({
                                            ...prev,
                                            containerId: container.id
                                        }))}
                                    />
                                ))
                            ) : (
                                <Text style={styles.noDataText}>Aucun container disponible</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
                        <View style={styles.optionsContainer}>
                            {categories && categories.length > 0 ? (
                                categories.map((category) => (
                                    <CategoryOption
                                        key={category.id}
                                        category={category}
                                        isSelected={editedItem.categoryId === category.id}
                                        onSelect={() => setEditedItem(prev => ({
                                            ...prev,
                                            categoryId: category.id
                                        }))}
                                    />
                                ))
                            ) : (
                                <Text style={styles.noDataText}>Aucune catégorie disponible</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.qrCodeContainer}>
                    <Text style={styles.sectionTitle}>QR Code</Text>
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
                    <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
                        <Text style={styles.buttonText}>Mettre à jour</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}, arePropsEqual);

const styles = StyleSheet.create({
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
        resizeMode: 'cover',
    },
    sectionContainer: {
        marginBottom: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
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
    noDataText: {
        color: '#666',
        fontStyle: 'italic',
        padding: 8,
    },
    formSection: {
        marginBottom: 16,
    },
    deletePhotoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        padding: 8,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});