import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, ActivityIndicator, Image } from 'react-native';
import { useDispatch } from 'react-redux';
import { database, Category, Container } from '../database/database';
import { MaterialIcons } from '@expo/vector-icons';
import { deleteItem, updateItem } from '../store/itemsActions';
import { useQueryClient } from '@tanstack/react-query';
import type { MaterialIconName } from '../types/icons';
import type { Item, ItemUpdate } from '../types/item';
import AdaptiveImage from './AdaptiveImage';
import { validatePrice, validateItemName } from '../utils/validation';
import { handleError } from '../utils/errorHandler';
import { checkPhotoPermissions } from '../utils/permissions';
import { usePhoto } from '../hooks/usePhoto';
import ConfirmationDialog from './ConfirmationDialog';
import { useRouter } from 'expo-router';
import { theme } from '../utils/theme';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import * as ExpoImagePicker from 'expo-image-picker';

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
    photo_storage_url?: string | null;
    containerId?: number | null;
    categoryId?: number;
}

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
            {container.name}#{container.number}
        </Text>
    </TouchableOpacity>
));

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

const ContainerList = memo(({ 
    containers, 
    selectedId, 
    onSelect,
    onAddNew 
}: { 
    containers: Container[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
    onAddNew: () => void;
}) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
        <View style={styles.optionsContainer}>
            {containers.map((container) => (
                <ContainerOption
                    key={container.id}
                    container={container}
                    isSelected={selectedId === container.id}
                    onSelect={() => onSelect(container.id)}
                />
            ))}
            <TouchableOpacity
                style={styles.addNewOption}
                onPress={onAddNew}
            >
                <MaterialIcons
                    name="add-circle"
                    size={20}
                    color="#007AFF"
                    style={styles.addIcon}
                />
                <Text style={styles.addNewText}>Ajouter un container</Text>
            </TouchableOpacity>
        </View>
    </ScrollView>
));

const CategoryList = memo(({ 
    categories, 
    selectedId, 
    onSelect,
    onAddNew 
}: { 
    categories: Category[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
    onAddNew: () => void;
}) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScrollView}>
        <View style={styles.optionsContainer}>
            {categories.map((category) => (
                <CategoryOption
                    key={category.id}
                    category={category}
                    isSelected={selectedId === category.id}
                    onSelect={() => onSelect(category.id)}
                />
            ))}
            <TouchableOpacity
                style={styles.addNewOption}
                onPress={onAddNew}
            >
                <MaterialIcons
                    name="add-circle"
                    size={20}
                    color="#007AFF"
                    style={styles.addIcon}
                />
                <Text style={styles.addNewText}>Ajouter une catégorie</Text>
            </TouchableOpacity>
        </View>
    </ScrollView>
));

const arePropsEqual = (prevProps: ItemEditFormProps, nextProps: ItemEditFormProps) => {
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.updatedAt === nextProps.item.updatedAt &&
        prevProps.categories.length === nextProps.categories.length &&
        prevProps.containers.length === nextProps.containers.length
    );
};

export const ItemEditForm = memo(({ item, containers: propContainers, categories: propCategories, onSuccess, onCancel }) => {
    const containers = Array.isArray(propContainers) ? propContainers : [];
    const categories = Array.isArray(propCategories) ? propCategories : [];

    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { uploadPhoto, deletePhoto, loadImage, state: photoHookState, validatePhoto } = usePhoto();

    const router = useRouter();

    const [localImageUri, setLocalImageUri] = useState<string | null>(null);
    const [localImageNeedsUpload, setLocalImageNeedsUpload] = useState(false);

    const [editedItem, setEditedItem] = useState<EditedItemForm>({
        name: item.name,
        description: item.description || '',
        purchasePrice: (typeof item.purchasePrice === 'number' && !isNaN(item.purchasePrice)) ? item.purchasePrice.toString() : '0',
        sellingPrice: (typeof item.sellingPrice === 'number' && !isNaN(item.sellingPrice)) ? item.sellingPrice.toString() : '0',
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.containerId,
        categoryId: item.categoryId
    });

    const initialItemState = useMemo(() => ({
        name: item.name,
        description: item.description || '',
        purchasePrice: (typeof item.purchasePrice === 'number' && !isNaN(item.purchasePrice)) ? item.purchasePrice.toString() : '0',
        sellingPrice: (typeof item.sellingPrice === 'number' && !isNaN(item.sellingPrice)) ? item.sellingPrice.toString() : '0',
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.containerId,
        categoryId: item.categoryId
    }), [item]);

    const [confirmDialog, setConfirmDialog] = useState<{
        visible: boolean;
        itemId: number | null;
    }>({
        visible: false,
        itemId: null
    });

    useEffect(() => {
        console.log("[ItemEditForm] useEffect - Initializing form with item:", item.id);
        setEditedItem(initialItemState);
        setLocalImageUri(null);
        setLocalImageNeedsUpload(false);

        if (item.photo_storage_url && typeof item.photo_storage_url === 'string') {
            console.log("[ItemEditForm] useEffect - Loading initial image from R2:", item.photo_storage_url);
            loadImage(item.photo_storage_url);
        } else {
             console.log("[ItemEditForm] useEffect - No initial image to load or photo_storage_url is null.");
        }

        return () => {
             console.log("[ItemEditForm] useEffect - Cleanup");
        };

    }, [initialItemState, item.photo_storage_url, item.id, loadImage]);

    const hasFormChanged = useMemo(() => {
        const fieldsChanged =
             editedItem.name !== initialItemState.name ||
             editedItem.description !== initialItemState.description ||
             editedItem.purchasePrice !== initialItemState.purchasePrice ||
             editedItem.sellingPrice !== initialItemState.sellingPrice ||
             editedItem.status !== initialItemState.status ||
             editedItem.containerId !== initialItemState.containerId ||
             editedItem.categoryId !== initialItemState.categoryId;

         const photoChanged =
             localImageNeedsUpload ||
             editedItem.photo_storage_url !== initialItemState.photo_storage_url;

         return fieldsChanged || photoChanged;
    }, [editedItem, initialItemState, localImageNeedsUpload]);

    const handlePriceChange = useCallback((field: 'purchasePrice' | 'sellingPrice', text: string) => {
        const cleanText = text.replace(',', '.');
        if (cleanText === '' || /^\d*\.?\d*$/.test(cleanText)) {
            setEditedItem(prev => ({ ...prev, [field]: cleanText }));
        }
    }, []);

    const validateForm = useCallback((): boolean => {
        try {
            if (!validateItemName(editedItem.name)) {
                Alert.alert('Erreur', 'Le nom de l\'article est invalide.');
                return false;
            }

            const purchasePrice = parseFloat(editedItem.purchasePrice);
            const sellingPrice = parseFloat(editedItem.sellingPrice);

            if (isNaN(purchasePrice) || purchasePrice < 0) {
                 Alert.alert('Erreur', 'Le prix d\'achat doit être un nombre positif.');
                 return false;
             }
             if (isNaN(sellingPrice) || sellingPrice < 0) {
                 Alert.alert('Erreur', 'Le prix de vente doit être un nombre positif.');
                 return false;
             }

            if (sellingPrice < purchasePrice) {
                // C'est un avertissement, pas une erreur bloquante. Laissez l'utilisateur continuer s'il le souhaite.
            }

            if (!editedItem.categoryId) {
                 Alert.alert('Erreur', 'La catégorie est requise.');
                 return false;
            }

            return true;
        } catch (error) {
            console.error("[ItemEditForm] validateForm - Erreur:", error);
            handleError(error, 'Erreur de validation', {
                source: 'item_edit_form_validation',
                message: `Erreur lors de la validation de l'article ${item.id}`,
                 showAlert: true
            });
            return false;
        }
    }, [editedItem, item.id]);

    const handleImagePreview = useCallback(async () => {
        try {
            console.log("[ItemEditForm] handleImagePreview - Sélection d'image...");
            const hasPermissions = await checkPhotoPermissions();
            if (!hasPermissions) {
                console.error("handleImagePreview - Permission refusée");
                Alert.alert('Erreur', 'Permission d\'accès aux photos refusée.');
                return;
            }

            const result = await ExpoImagePicker.launchImageLibraryAsync({
                mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
                base64: true,
                exif: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedAsset = result.assets[0];
                const selectedUri = selectedAsset.uri;

                console.log("[ItemEditForm] Image sélectionnée:", selectedUri.substring(0, 50) + "...");

                 const isValid = await validatePhoto(selectedUri);
                 if (!isValid) {
                     console.warn("[ItemEditForm] handleImagePreview - Photo non valide.");
                     return;
                 }

                 setLocalImageUri(selectedUri);
                 setLocalImageNeedsUpload(true);

                 setEditedItem(prev => ({ ...prev, photo_storage_url: undefined }));

            } else {
                 console.log("[ItemEditForm] handleImagePreview - Sélection d'image annulée.");
            }
        } catch (error) {
            console.error("handleImagePreview - Erreur:", error);
            handleError(error, 'Erreur sélection photo', {
                source: 'item_edit_form_image_preview',
                message: `Échec de la sélection de la photo pour l'article ${item.id}`,
                showAlert: true
            });
        }
    }, [item.id, validatePhoto]);

    const handleSubmit = useCallback(async () => {
        console.log("[ItemEditForm] handleSubmit - Début de la sauvegarde");

        if (!hasFormChanged) {
            console.log("[ItemEditForm] handleSubmit - Aucune modification détectée");
            Alert.alert('Information', 'Aucune modification à enregistrer.');
            return;
        }

        console.log("[ItemEditForm] handleSubmit - Formulaire modifié, validation en cours");

        if (!validateForm()) {
            console.log("[ItemEditForm] handleSubmit - Échec de la validation du formulaire.");
            return;
        }

        if (!item.id) {
            console.error("[ItemEditForm] handleSubmit - ID de l'article manquant");
            Alert.alert('Erreur interne', "Impossible de sauvegarder: ID de l'article manquant.");
            return;
        }

        console.log(`[ItemEditForm] handleSubmit - Validation OK pour l'article ${item.id}`);

        let finalPhotoStorageUrl = editedItem.photo_storage_url;

        if (localImageUri && localImageNeedsUpload) {
            console.log("[ItemEditForm] handleSubmit - Upload d'une nouvelle image nécessaire.");

            console.log("[ItemEditForm] handleSubmit - Début de l'upload de la nouvelle image vers R2");
            try {
                const uploadedFilename = await uploadPhoto(localImageUri, true, item.photo_storage_url || undefined);

                if (uploadedFilename) {
                    console.log(`[ItemEditForm] handleSubmit - Nouvelle image R2 uploadée: ${uploadedFilename}`);
                    finalPhotoStorageUrl = uploadedFilename;
                    setLocalImageNeedsUpload(false);
                    setLocalImageUri(null);
                } else {
                    console.warn("[ItemEditForm] handleSubmit - Échec de l'upload de la nouvelle image, continuation sans cette image.");
                    finalPhotoStorageUrl = undefined;
                }
            } catch (uploadError) {
                console.error("[ItemEditForm] handleSubmit - Erreur lors de l'upload de la nouvelle image:", uploadError);
                handleError(uploadError, 'Erreur Upload', {
                    source: 'item_edit_form_upload_new_r2',
                    message: `Échec de l'upload de la nouvelle image.`,
                    showAlert: true
                });
                 finalPhotoStorageUrl = undefined;
            }
        } else if (item.photo_storage_url && editedItem.photo_storage_url === null) {
             console.log(`[ItemEditForm] handleSubmit - Suppression de l'image existante ${item.photo_storage_url} demandée.`);
             try {
                await deletePhoto(item.photo_storage_url);
                console.log(`[ItemEditForm] handleSubmit - Image R2 ${item.photo_storage_url} supprimée.`);
                finalPhotoStorageUrl = null;
             } catch (deleteError) {
                console.warn(`[ItemEditForm] handleSubmit - Échec de la suppression de l'image R2 ${item.photo_storage_url} lors de la sauvegarde:`, deleteError);
                 handleError(deleteError, 'Avertissement Suppression Image', {
                    source: 'item_edit_form_delete_existing_r2_onsave',
                     message: `Échec de la suppression de l'image existante.`,
                     showAlert: true
                 });
                  finalPhotoStorageUrl = item.photo_storage_url;
             }
        } else {
            console.log("[ItemEditForm] handleSubmit - Pas d'upload ou suppression d'image nécessaire (juste mise à jour des métadonnées).");
             finalPhotoStorageUrl = editedItem.photo_storage_url;
        }

        console.log("[ItemEditForm] handleSubmit - Préparation des données pour la mise à jour de la base de données");
        const purchasePrice = parseFloat(editedItem.purchasePrice);
        const sellingPrice = parseFloat(editedItem.sellingPrice);

        const itemToUpdate: ItemUpdate = {
            name: editedItem.name,
            description: editedItem.description,
            purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
            sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
            status: editedItem.status,
            photo_storage_url: finalPhotoStorageUrl === null ? undefined : finalPhotoStorageUrl,
            containerId: editedItem.containerId,
            categoryId: editedItem.categoryId
        };

         const itemToUpdateToSendToDB: any = {
            name: editedItem.name,
            description: editedItem.description,
            purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice,
            sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
            status: editedItem.status,
            containerId: editedItem.containerId,
            categoryId: editedItem.categoryId
         };

         if (finalPhotoStorageUrl !== undefined) {
              itemToUpdateToSendToDB.photo_storage_url = finalPhotoStorageUrl;
         }

        console.log("[ItemEditForm] handleSubmit - Données prêtes pour DB:", JSON.stringify(itemToUpdateToSendToDB, null, 2));

        try {
            console.log(`[ItemEditForm] handleSubmit - Mise à jour de l'article ${item.id} dans la base de données`);
            await database.updateItem(item.id, itemToUpdateToSendToDB);
            console.log("[ItemEditForm] handleSubmit - Mise à jour DB réussie.");

            console.log("[ItemEditForm] handleSubmit - Mise à jour optimiste dans Redux");
            const updatedItem: Item = {
                ...item,
                ...itemToUpdateToSendToDB,
                photo_storage_url: itemToUpdateToSendToDB.photo_storage_url === null || itemToUpdateToSendToDB.photo_storage_url === undefined ? undefined : itemToUpdateToSendToDB.photo_storage_url,
                updatedAt: new Date().toISOString()
            };

             console.log("[ItemEditForm] Redux updatedItem:", JSON.stringify(updatedItem, null, 2));

            dispatch(updateItem(updatedItem));

            console.log("[ItemEditForm] handleSubmit - Invalidation des queries React Query");
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            if (item.photo_storage_url) {
                queryClient.invalidateQueries({ queryKey: ['photo', item.photo_storage_url] });
            }
            if (finalPhotoStorageUrl && typeof finalPhotoStorageUrl === 'string') {
                 queryClient.invalidateQueries({ queryKey: ['photo', finalPhotoStorageUrl] });
            }

            console.log("[ItemEditForm] handleSubmit - Sauvegarde terminée avec succès");
            if (onSuccess) {
                console.log("[ItemEditForm] handleSubmit - Appel du callback onSuccess");
                onSuccess();
            }
        } catch (error) {
            console.error("[ItemEditForm] handleSubmit - Erreur lors de la mise à jour finale de la base de données:", error);
            handleError(error, 'Erreur lors de la mise à jour', {
                source: 'item_edit_form_update_db',
                message: `Échec de la mise à jour de l'article ${item.id}.`,
                showAlert: true
            });
        } finally {
        }
    }, [editedItem, item, validateForm, deletePhoto, uploadPhoto, dispatch, onSuccess, queryClient, localImageUri, localImageNeedsUpload, hasFormChanged]);

    const handleDelete = useCallback(async () => {
        if (!item.id) {
             console.warn("[ItemEditForm] handleDelete - ID de l'article manquant.");
             return;
        }

        setConfirmDialog({
            visible: true,
            itemId: item.id
        });
    }, [item.id]);

    const handleConfirmDelete = useCallback(async () => {
        const itemId = confirmDialog.itemId;
        if (!itemId) {
             console.warn("[ItemEditForm] handleConfirmDelete - ID de l'article manquant dans la confirmation.");
             setConfirmDialog({ visible: false, itemId: null });
             return;
        }

        try {
            console.log(`[ItemEditForm] handleConfirmDelete - Suppression optimiste de l'article ${itemId} dans Redux.`);
            dispatch(deleteItem(itemId));

            if (item.photo_storage_url) {
                console.log(`[ItemEditForm] handleConfirmDelete - Suppression de l'image R2 associée: ${item.photo_storage_url}`);
                 try {
                    await deletePhoto(item.photo_storage_url);
                    console.log(`[ItemEditForm] handleConfirmDelete - Image R2 associée supprimée avec succès.`);
                 } catch (deleteError) {
                    console.warn(`[ItemEditForm] handleConfirmDelete - Échec de la suppression de l'image R2 ${item.photo_storage_url} lors de la suppression de l'item:`, deleteError);
                     handleError(deleteError, 'Avertissement Suppression Image', {
                        source: 'item_edit_form_delete_item_image',
                         message: `L'article a été supprimé, mais son image n'a pas pu être supprimée du serveur.`,
                         showAlert: true
                    });
                 }
            }

            console.log(`[ItemEditForm] handleConfirmDelete - Suppression de l'article ${itemId} de la base de données.`);
            await database.deleteItem(itemId);
            console.log(`[ItemEditForm] handleConfirmDelete - Suppression de l'article DB réussie.`);

            console.log("[ItemEditForm] handleConfirmDelete - Invalidation des queries React Query.");
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            if (item.photo_storage_url) {
                queryClient.invalidateQueries({ queryKey: ['photo', item.photo_storage_url] });
            }

            if (onCancel) {
                console.log("[ItemEditForm] handleConfirmDelete - Appel du callback onCancel");
                onCancel();
            }
        } catch (error) {
            console.error("[ItemEditForm] handleConfirmDelete - Erreur lors de la suppression finale de l'article:", error);
            console.warn("[ItemEditForm] handleConfirmDelete - Rollback Redux.");
            dispatch(updateItem(item));
            handleError(error, 'Erreur lors de la suppression', {
                source: 'item_edit_form_delete_item_db',
                message: `Échec de la suppression de l'article ${item.id}.`,
                showAlert: true
            });
        } finally {
            setConfirmDialog({ visible: false, itemId: null });
        }
    }, [confirmDialog.itemId, dispatch, item, queryClient, onCancel, deletePhoto]);

    const handleCancelDelete = useCallback(() => {
        console.log("[ItemEditForm] handleCancelDelete - Suppression annulée.");
        setConfirmDialog({ visible: false, itemId: null });
    }, []);

    const handlePhotoDelete = useCallback(() => {
        console.log("[ItemEditForm] handlePhotoDelete - Suppression de la photo demandée via UI");
        try {
            setLocalImageUri(null);
            setLocalImageNeedsUpload(false);

            setEditedItem(prev => ({ ...prev, photo_storage_url: null }));

        } catch (error) {
            console.error("[ItemEditForm] handlePhotoDelete - Erreur lors du marquage de la suppression de la photo:", error);
            handleError(error, 'Erreur Photo', {
                source: 'item_edit_form_image_delete_ui',
                message: `Échec du marquage de la photo pour suppression.`,
                showAlert: true
            });
        }
    }, [item, dispatch]);

    const navigateToAddContainer = useCallback(() => {
        console.log("[ItemEditForm] navigateToAddContainer - Saving state and navigating.");
        queryClient.setQueryData(['temp_edit_form_state', item.id], editedItem);
        router.push('/containers');
    }, [router, queryClient, item.id, editedItem]);

    const navigateToAddCategory = useCallback(() => {
        console.log("[ItemEditForm] navigateToAddCategory - Saving state and navigating.");
        queryClient.setQueryData(['temp_edit_form_state', item.id], editedItem);
        router.push('/add-category');
    }, [router, queryClient, item.id, editedItem]);

    useEffect(() => {
        const savedState = queryClient.getQueryData<EditedItemForm>(['temp_edit_form_state', item.id]);
        const fetchedContainers = queryClient.getQueryData<Container[]>(['containers']);

        if (savedState && savedState.containerId === null && fetchedContainers && fetchedContainers.length > 0) {
            console.log("[ItemEditForm] useEffect - Restoring container selection after navigation.");
            const sortedContainers = [...fetchedContainers].sort((a, b) =>
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            setEditedItem(prev => ({ ...prev, containerId: sortedContainers[0].id }));
        }

        const fetchedCategories = queryClient.getQueryData<Category[]>(['categories']);
         if (savedState && savedState.categoryId === undefined && fetchedCategories && fetchedCategories.length > 0) {
             console.log("[ItemEditForm] useEffect - Restoring category selection after navigation.");
             const sortedCategories = [...fetchedCategories].sort((a, b) =>
                 new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
             );
              const uncategorized = sortedCategories.find(cat => cat.name === 'Sans catégorie');
              const defaultCategoryId = uncategorized ? uncategorized.id : sortedCategories[0].id;

              setEditedItem(prev => ({ ...prev, categoryId: defaultCategoryId }));
         }

        if (savedState) {
            console.log("[ItemEditForm] useEffect - Restoring saved form state.");
            setEditedItem(savedState);
            queryClient.removeQueries({ queryKey: ['temp_edit_form_state', item.id] });
        }

    }, [queryClient, item.id]);

    const displayImageUri = localImageUri || photoHookState.uri;
    const isPhotoProcessing = photoHookState.loading;
    const photoError = photoHookState.error;

    const isSaveDisabled = !hasFormChanged || isPhotoProcessing;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.contentContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Nom de l'article"
                    value={editedItem.name}
                    onChangeText={(text) => setEditedItem(prev => ({ ...prev, name: text }))}
                     placeholderTextColor="#999"
                />

                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description de l'article"
                    value={editedItem.description}
                    onChangeText={(text) => setEditedItem(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={4}
                     placeholderTextColor="#999"
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
                             placeholderTextColor="#999"
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
                             placeholderTextColor="#999"
                        />
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Photo</Text>
                    <View style={styles.imageContainer}>
                         {displayImageUri || isPhotoProcessing || photoError ? (
                            <View style={styles.imageWrapper}>
                                {isPhotoProcessing ? (
                                    <View style={[styles.image, styles.imagePlaceholder]}>
                                        <ActivityIndicator size="small" color="#007AFF" />
                                        <Text style={styles.loadingText}>Chargement...</Text>
                                    </View>
                                ) : photoError ? (
                                    <View style={[styles.image, styles.errorImagePlaceholder]}>
                                        <MaterialIcons name="error-outline" size={24} color="#e53935" />
                                        <Text style={styles.errorText}>Erreur de chargement</Text>
                                    </View>
                                ) : displayImageUri && (
                                    <Image
                                        source={{ uri: displayImageUri }}
                                        style={styles.image}
                                        resizeMode="cover"
                                        {...(Platform.OS === 'web' ? {
                                            loading: "eager",
                                            fetchPriority: "high",
                                        } : {})}
                                    />
                                )}
                                <View style={styles.imageActions}>
                                    <TouchableOpacity
                                        style={styles.imageActionButton}
                                        onPress={handleImagePreview}
                                        disabled={isPhotoProcessing}
                                    >
                                        <MaterialIcons name="edit" size={24} color={isPhotoProcessing ? "#cccccc" : "#007AFF"} />
                                    </TouchableOpacity>
                                    {(item.photo_storage_url !== null && item.photo_storage_url !== undefined) || localImageUri ? (
                                         <TouchableOpacity
                                             style={styles.imageActionButton}
                                             onPress={handlePhotoDelete}
                                             disabled={isPhotoProcessing}
                                         >
                                             <MaterialIcons name="delete" size={24} color={isPhotoProcessing ? "#cccccc" : "#FF3B30"} />
                                         </TouchableOpacity>
                                    ) : null}
                                </View>
                                {localImageNeedsUpload && !isPhotoProcessing && (
                                    <View style={styles.newImageBadge}>
                                        <MaterialIcons name="cloud-upload" size={14} color="#FFFFFF" />
                                        <Text style={styles.newImageText}>En attente d'upload</Text>
                                    </View>
                                )}
                                {isPhotoProcessing && (
                                    <View style={styles.uploadingOverlay}>
                                        <ActivityIndicator size="large" color="#FFFFFF" />
                                        <Text style={styles.uploadingText}>Opération en cours...</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.imagePicker}
                                onPress={handleImagePreview}
                                disabled={isPhotoProcessing}
                            >
                                <MaterialIcons name="add-photo-alternate" size={48} color={isPhotoProcessing ? "#cccccc" : "#007AFF"} />
                                <Text style={[styles.imagePickerText, isPhotoProcessing && {color: "#cccccc"}]}>
                                    {isPhotoProcessing ? "Opération en cours..." : "Sélectionner une image"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Container</Text>
                    <ContainerList
                        containers={containers}
                        selectedId={editedItem.containerId}
                        onSelect={(id) => setEditedItem(prev => ({ ...prev, containerId: id }))}
                        onAddNew={navigateToAddContainer}
                    />
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <CategoryList
                        categories={categories}
                        selectedId={editedItem.categoryId}
                        onSelect={(id) => setEditedItem(prev => ({ ...prev, categoryId: id }))}
                        onAddNew={navigateToAddCategory}
                    />
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.deleteButton, isPhotoProcessing && styles.disabledButton]}
                        onPress={handleDelete}
                        disabled={isPhotoProcessing}
                    >
                        <MaterialIcons name="delete" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Supprimer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.cancelButton, isPhotoProcessing && styles.disabledButton]}
                        onPress={onCancel}
                        disabled={isPhotoProcessing}
                    >
                        <Text style={styles.buttonText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.saveButton,
                            isSaveDisabled ? styles.disabledButton : null,
                            localImageNeedsUpload && !isPhotoProcessing ? styles.uploadButton : null
                        ]}
                        onPress={() => {
                            console.log("[ItemEditForm] Bouton de sauvegarde cliqué");
                            handleSubmit();
                        }}
                        disabled={isSaveDisabled}
                    >
                        {localImageNeedsUpload && !isPhotoProcessing ? (
                            <>
                                <MaterialIcons name="cloud-upload" size={20} color="#fff" />
                                <Text style={styles.buttonText}>Uploader & Sauvegarder</Text>
                            </>
                        ) : isPhotoProcessing ? (
                             <Text style={styles.buttonText}>Opération en cours...</Text>
                        ) : (
                            <Text style={styles.buttonText}>Mettre à jour</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ConfirmationDialog
                visible={confirmDialog.visible}
                title="Confirmation de suppression"
                message="Êtes-vous sûr de vouloir supprimer cet article ? Cette action est irréversible."
                confirmText="Supprimer"
                cancelText="Annuler"
                confirmButtonStyle="destructive"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
            {photoError && (
                <View style={styles.globalErrorContainer}>
                    <MaterialIcons name="error-outline" size={24} color="#e53935" />
                    <Text style={styles.globalErrorText}>{photoError.message}</Text>
                </View>
            )}
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
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        fontSize: 16,
        color: '#000',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        elevation: 0,
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
        borderRadius: 8,
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
        gap: 8,
    },
    uploadButton: {
        backgroundColor: '#4CD964',
    },
    disabledButton: {
        backgroundColor: '#CCCCCC',
        opacity: 0.7,
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
    imageActions: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        gap: 8,
    },
    imageActionButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        padding: 8,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    newImageBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: '#007AFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderTopLeftRadius: 8,
        borderBottomRightRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    newImageText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    imagePicker: {
        aspectRatio: 4/3,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePickerText: {
        marginTop: 8,
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '500',
    },
    uploadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        zIndex: 10,
    },
    uploadingText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 8,
    },
    addNewOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#e6f2ff',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#007AFF',
    },
    addNewText: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '500',
    },
    addIcon: {
        marginRight: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxWidth: 500,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000',
        marginBottom: 16,
    },
    modalButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonSave: {
        backgroundColor: '#007AFF',
    },
    modalButtonCancel: {
        backgroundColor: '#8E8E93',
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    iconSelectorLabel: {
        marginTop: 16,
        marginBottom: 8,
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    iconSelector: {
        maxHeight: 150,
        marginBottom: 16,
    },
    iconSelectorContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingVertical: 8,
    },
    iconOption: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        margin: 4,
        borderRadius: 22,
        backgroundColor: '#f5f5f5',
    },
    iconOptionSelected: {
        backgroundColor: '#007AFF',
    },
    imagePlaceholder: {
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#007AFF',
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
    errorImagePlaceholder: {
        backgroundColor: '#ffeeee',
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#e53935',
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
    globalErrorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffebee',
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e53935',
    },
    globalErrorText: {
        marginLeft: 8,
        color: '#e53935',
        fontSize: 14,
        flexShrink: 1,
    },
});