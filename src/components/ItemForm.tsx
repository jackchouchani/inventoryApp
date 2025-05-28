import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { database, Category, Container } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { generateId } from '../utils/identifierManager';
import { addItem } from '../store/itemsActions';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Icon } from '../../src/components';
import type { MaterialIconName } from '../types/icons';
import AdaptiveImage from './AdaptiveImage';
import { handleError } from '../utils/errorHandler';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { FallbackProps } from 'react-error-boundary';
import type { Item, ItemInput } from '../types/item';
import { usePhoto } from '../hooks/usePhoto';
import * as ExpoImagePicker from 'expo-image-picker';
import { checkPhotoPermissions } from '../utils/permissions';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../contexts/ThemeContext';

const FORM_VALIDATION = {
    NAME_MAX_LENGTH: 100,
    MIN_PRICE: 0,
    MAX_PRICE: 1000000,
    REQUIRED_FIELDS: ['name', 'categoryId'] as const
} as const;

/**
 * Type pour les erreurs de validation du formulaire
 */
type ValidationError = {
    field: string;
    message: string;
};

/**
 * Props pour le composant ContainerOption
 */
interface ContainerOptionProps {
    container: Container;
    isSelected: boolean;
    onSelect: (id: number) => void;
}

/**
 * Props pour le composant CategoryOption
 */
interface CategoryOptionProps {
    category: Category;
    isSelected: boolean;
    onSelect: (id: number) => void;
}

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
    containerId: null, // Aucun container sélectionné par défaut
    categoryId: null,
};

/**
 * Composant d'option de conteneur mémoïsé
 */
const ContainerOption = memo(({ container, isSelected, onSelect, theme }: ContainerOptionProps & { theme: any }) => (
    <TouchableOpacity
        style={[
            {
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: isSelected ? theme.primary : theme.surface,
                borderColor: isSelected ? theme.primary : theme.border,
            }
        ]}
        onPress={() => onSelect(container.id)}
    >
        <Icon
            name="inbox"
            size={20}
            color={isSelected ? theme.text.onPrimary : theme.text.secondary}
            style={{ marginRight: 8 }}
        />
        <Text style={{
            fontSize: 14,
            color: isSelected ? theme.text.onPrimary : theme.text.primary,
            fontWeight: isSelected ? '500' : 'normal'
        }}>
            {container.name}#{container.number}
        </Text>
    </TouchableOpacity>
));

/**
 * Composant d'option de catégorie mémoïsé
 */
const CategoryOption = memo(({ category, isSelected, onSelect, theme }: CategoryOptionProps & { theme: any }) => (
    <TouchableOpacity
        style={[
            {
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                backgroundColor: isSelected ? theme.primary : theme.surface,
                borderColor: isSelected ? theme.primary : theme.border,
            }
        ]}
        onPress={() => onSelect(category.id)}
    >
        <Icon
            name={(category.icon as MaterialIconName) || 'folder'}
            size={20}
            color={isSelected ? theme.text.onPrimary : theme.text.secondary}
            style={{ marginRight: 8 }}
        />
        <Text style={{
            fontSize: 14,
            color: isSelected ? theme.text.onPrimary : theme.text.primary,
            fontWeight: isSelected ? '500' : 'normal'
        }}>
            {category.name}
        </Text>
    </TouchableOpacity>
));

/**
 * Composant de liste de conteneurs mémoïsé
 */
const ContainerList = memo(({ containers, selectedId, onSelect, onAddNew, theme }: {
    containers: Container[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
    onAddNew: () => void;
    theme: any;
}) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 0 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
            {containers.map((container) => (
                <ContainerOption
                    key={container.id}
                    container={container}
                    isSelected={selectedId === container.id}
                    onSelect={onSelect}
                    theme={theme}
                />
            ))}
            <TouchableOpacity
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: `${theme.primary}15`,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: theme.primary,
                }}
                onPress={onAddNew}
            >
                <Icon
                    name="add_circle"
                    size={20}
                    color={theme.primary}
                    style={{ marginRight: 8 }}
                />
                <Text style={{ fontSize: 14, color: theme.primary, fontWeight: '500' }}>Ajouter un container</Text>
            </TouchableOpacity>
        </View>
    </ScrollView>
));

/**
 * Composant de liste de catégories mémoïsé
 */
const CategoryList = memo(({ categories, selectedId, onSelect, onAddNew, theme }: {
    categories: Category[];
    selectedId?: number | null;
    onSelect: (id: number) => void;
    onAddNew: () => void;
    theme: any;
}) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 0 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
            {categories.map((category) => (
                <CategoryOption
                    key={category.id}
                    category={category}
                    isSelected={selectedId === category.id}
                    onSelect={onSelect}
                    theme={theme}
                />
            ))}
            <TouchableOpacity
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: `${theme.primary}15`,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: theme.primary,
                }}
                onPress={onAddNew}
            >
                <Icon
                    name="add_circle"
                    size={20}
                    color={theme.primary}
                    style={{ marginRight: 8 }}
                />
                <Text style={{ fontSize: 14, color: theme.primary, fontWeight: '500' }}>Ajouter une catégorie</Text>
            </TouchableOpacity>
        </View>
    </ScrollView>
));

/**
 * Composant de fallback en cas d'erreur
 */
const ItemFormErrorFallback: React.FC<FallbackProps & { theme?: any }> = ({ error, resetErrorBoundary, theme }) => {
    const { activeTheme } = useAppTheme();
    const currentTheme = theme || activeTheme;
    
    return (
        <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
            backgroundColor: currentTheme.surface,
        }}>
            <Text style={{
                fontSize: 16,
                color: currentTheme.danger.main,
                textAlign: 'center',
                marginBottom: 16,
            }}>
                Une erreur est survenue lors du chargement du formulaire
            </Text>
            <Text style={{
                fontSize: 14,
                color: currentTheme.text.secondary,
                textAlign: 'center',
                marginBottom: 16,
            }}>{error.message}</Text>
            <TouchableOpacity
                style={{
                    backgroundColor: currentTheme.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                }}
                onPress={resetErrorBoundary}
            >
                <Text style={{
                    color: currentTheme.text.onPrimary,
                    fontSize: 16,
                    fontWeight: '600',
                }}>Réessayer</Text>
            </TouchableOpacity>
        </View>
    );
};

const ItemFormWithErrorBoundary: React.FC<ItemFormProps> = (props) => (
    <ErrorBoundary
        fallbackRender={ItemFormErrorFallback}
        onReset={() => {
            // Réinitialisation du formulaire si nécessaire
        }}
    >
        <ItemForm {...props} />
    </ErrorBoundary>
);

const ItemForm: React.FC<ItemFormProps> = ({ containers, categories: propCategories, onSuccess }) => {
    // Trier les catégories par created_at (plus ancien en premier) pour que "Bags" soit en premier
    const categories = Array.isArray(propCategories) 
        ? [...propCategories].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        : [];
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [item, setItem] = useState<ItemFormState>(INITIAL_STATE);
    const { uploadPhoto } = usePhoto();
    const router = useRouter();
    const { activeTheme } = useAppTheme();
    
    // État pour suivre l'upload en cours
    const [isUploading, setIsUploading] = useState(false);
    
    // État pour tracker l'image locale sélectionnée mais pas encore uploadée
    const [localImage, setLocalImage] = useState<{ uri: string; needsUpload: boolean } | null>(null);

    const resetForm = useCallback(() => {
        setItem(INITIAL_STATE);
        setLocalImage(null);
        setIsUploading(false);
    }, []);

    useEffect(() => {
        return () => {
            resetForm();
        };
    }, [resetForm]);

    /**
     * Valide le formulaire et retourne les erreurs éventuelles
     */
    const validateForm = useCallback((): ValidationError[] => {
        const errors: ValidationError[] = [];
        
        // Validation du nom
        if (!item.name.trim()) {
            errors.push({ field: 'name', message: 'Le nom est requis' });
        } else if (item.name.length > FORM_VALIDATION.NAME_MAX_LENGTH) {
            errors.push({ 
                field: 'name', 
                message: `Le nom ne doit pas dépasser ${FORM_VALIDATION.NAME_MAX_LENGTH} caractères` 
            });
        }
        
        // Validation des prix
        const purchasePrice = parseFloat(item.purchasePrice);
        const sellingPrice = parseFloat(item.sellingPrice);
        
        if (isNaN(purchasePrice) || purchasePrice < FORM_VALIDATION.MIN_PRICE) {
            errors.push({ 
                field: 'purchasePrice', 
                message: 'Le prix d\'achat doit être un nombre positif' 
            });
        } else if (purchasePrice > FORM_VALIDATION.MAX_PRICE) {
            errors.push({ 
                field: 'purchasePrice', 
                message: `Le prix d'achat ne peut pas dépasser ${FORM_VALIDATION.MAX_PRICE}` 
            });
        }
        
        if (isNaN(sellingPrice) || sellingPrice < FORM_VALIDATION.MIN_PRICE) {
            errors.push({ 
                field: 'sellingPrice', 
                message: 'Le prix de vente doit être un nombre positif' 
            });
        } else if (sellingPrice > FORM_VALIDATION.MAX_PRICE) {
            errors.push({ 
                field: 'sellingPrice', 
                message: `Le prix de vente ne peut pas dépasser ${FORM_VALIDATION.MAX_PRICE}` 
            });
        }
        
        // Validation de la catégorie
        if (!item.categoryId) {
            errors.push({ field: 'categoryId', message: 'La catégorie est requise' });
        }
        
        return errors;
    }, [item]);

    /**
     * Mutation pour l'ajout d'un item avec React Query
     */
    const addItemMutation = useMutation({
        mutationFn: async (formData: ItemFormState) => {
            try {
                const qrCode = generateId('ITEM');
                const uploadedUrl = formData.photo_storage_url;
                
                // Assurer que categoryId n'est pas null (mais peut être undefined)
                const categoryId = formData.categoryId || undefined;
                
                const data: ItemInput = {
                    name: formData.name.trim(),
                    description: formData.description.trim(),
                    purchasePrice: parseFloat(formData.purchasePrice),
                    sellingPrice: parseFloat(formData.sellingPrice),
                    status: formData.status,
                    photo_storage_url: uploadedUrl,
                    containerId: formData.containerId || null,
                    categoryId, // Utilisez la version sans null
                    qrCode
                };
                
                // Optimistic update
                queryClient.setQueryData(['items'], (oldData: Item[] = []) => {
                    const tempItem: Item = {
                        ...data,
                        id: Date.now(), // ID temporaire pour l'update optimiste
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    return [...oldData, tempItem];
                });
                
                // Réelle insertion en base de données
                const itemId = await database.addItem(data);
                
                // Mettre à jour le cache avec le vrai ID
                queryClient.setQueryData(['items'], (oldData: Item[] = []) => {
                    return oldData.map(item => 
                        item.id === Date.now() ? { ...item, id: itemId } : item
                    );
                });
                
                // Rafraîchir les données pour être sûr
                await queryClient.invalidateQueries({ queryKey: ['items'] });
                triggerRefresh();
                
                // Créer un objet Item à partir de ItemInput pour le dispatch
                const itemForRedux: Item = {
                    ...data,
                    id: itemId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Dispatch pour le store Redux
                dispatch(addItem(itemForRedux));
                
                resetForm();
                onSuccess?.();
                
                return itemId;
            } catch (error) {
                console.error('Error in addItemMutation:', error);
                handleError(error, 'Erreur lors de l\'ajout de l\'article', {
                    source: 'addItemMutation',
                    showAlert: true
                });
                throw error;
            }
        }
    });

    // Ajouter une fonction pour la sélection d'image directement comme dans ItemEditForm
    const handleImagePreview = useCallback(async () => {
        try {
            console.log("[ItemForm] handleImagePreview - Sélection d'image...");
            const hasPermissions = await checkPhotoPermissions();
            if (!hasPermissions) {
                console.error("handleImagePreview - Permission refusée");
                Alert.alert('Erreur', 'Permission d\'accès aux photos refusée');
                return;
            }
            
            console.log("[ItemForm] handleImagePreview - Lancement du sélecteur d'image...");
            // Utiliser ImagePicker avec compression forte pour éviter les problèmes de taille
            const result = await ExpoImagePicker.launchImageLibraryAsync({
                mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.3,
                base64: true,
            });
            
            console.log("[ItemForm] handleImagePreview - Résultat du sélecteur:", {
                canceled: result.canceled,
                hasAssets: result.assets ? result.assets.length : 0
            });
            
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedAsset = result.assets[0];
                console.log("[ItemForm] handleImagePreview - Asset sélectionné:", {
                    uri: selectedAsset.uri ? selectedAsset.uri.substring(0, 50) + "..." : "null",
                    hasBase64: !!selectedAsset.base64,
                    mimeType: selectedAsset.mimeType,
                    width: selectedAsset.width,
                    height: selectedAsset.height
                });
                
                if (Platform.OS === 'web') {
                    // Pour le web, toujours privilégier le format base64
                    if (selectedAsset.base64) {
                        const mimeType = selectedAsset.mimeType || 'image/jpeg';
                        const base64Uri = `data:${mimeType};base64,${selectedAsset.base64}`;
                        
                        console.log("[ItemForm] Image convertie en base64 pour le web");
                        // Stocker directement l'URI base64 pour la prévisualisation et l'upload
                        setLocalImage({ uri: base64Uri, needsUpload: true });
                    } else {
                        console.error("handleImagePreview - Impossible d'obtenir l'image en base64");
                        Alert.alert('Erreur', 'Impossible d\'obtenir l\'image en format compatible');
                    }
                } else {
                    // Sur les plateformes natives, on utilise l'URI standard
                    setLocalImage({ uri: selectedAsset.uri, needsUpload: true });
                }
                console.log("[ItemForm] handleImagePreview - Image sélectionnée avec succès");
            } else {
                console.log("[ItemForm] handleImagePreview - Sélection d'image annulée ou aucun asset.");
                if (result.canceled) {
                    console.log("[ItemForm] handleImagePreview - Utilisateur a annulé la sélection");
                } else {
                    console.log("[ItemForm] handleImagePreview - Aucun asset dans le résultat:", result);
                }
            }
        } catch (error) {
            console.error("handleImagePreview - Erreur:", error);
            handleError(error, 'Erreur lors de la prévisualisation de la photo', {
                source: 'item_form_image_preview',
                message: 'Échec de la prévisualisation de la photo',
                showAlert: true
            });
        }
    }, []);

    // Modifier la fonction handleSubmit pour éviter les doubles uploads
    const handleSubmit = async () => {
        try {
            const errors = validateForm();
            if (errors.length > 0) {
                Alert.alert(
                    'Erreurs de validation',
                    errors.map(error => error.message).join('\n')
                );
                return;
            }
            
            let photoStorageUrl = undefined; // Pour un nouvel article, pas d'URL existante

            // Si nous avons une image locale en attente d'upload
            if (localImage && localImage.needsUpload) {
                setIsUploading(true);
                try {
                    console.log("[ItemForm] handleSubmit - Upload d'une nouvelle image vers R2...");
                    // Appeler uploadPhoto depuis usePhoto, qui utilise le worker R2
                    // Le hook se charge de générer le nom de fichier et l'uploader
                    const uploadedFilename = await uploadPhoto(localImage.uri, true); // shouldCompress = true par défaut, pas besoin de customFilename ici si usePhoto le génère

                    // uploadPhoto doit retourner le nom de fichier R2 si réussi
                    if (uploadedFilename) {
                        console.log("[ItemForm] handleSubmit - Upload R2 réussi, nom de fichier:", uploadedFilename);
                        photoStorageUrl = uploadedFilename; // Stocker le nom de fichier R2
                    } else {
                        console.warn("[ItemForm] handleSubmit - Échec de l'upload R2, continuation sans photo.");
                        photoStorageUrl = undefined; // Pas d'image si l'upload échoue
                    }
                } catch (uploadError) {
                    console.error("[ItemForm] handleSubmit - Erreur lors de l'upload photo R2:", uploadError);
                    handleError(uploadError, 'Erreur lors de l\'upload de la photo', {
                        source: 'item_form_upload_r2',
                        message: 'Impossible d\'uploader la photo',
                        showAlert: true
                    });
                    // Continuer sans photo si l'upload échoue
                    photoStorageUrl = undefined;
                } finally {
                    setIsUploading(false);
                }
            } else {
                 console.log("[ItemForm] handleSubmit - Pas de nouvelle image locale à uploader.");
            }

            console.log("[ItemForm] handleSubmit - Préparation des données pour l'ajout à la base de données");
            const purchasePrice = parseFloat(item.purchasePrice);
            const sellingPrice = parseFloat(item.sellingPrice);

            // Assurer que categoryId n'est pas null (mais peut être undefined)
            const categoryId = item.categoryId || undefined;

            const data: ItemInput = {
                name: item.name.trim(),
                description: item.description.trim(),
                purchasePrice: isNaN(purchasePrice) ? 0 : purchasePrice, // Gérer les NaN
                sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,   // Gérer les NaN
                status: item.status,
                photo_storage_url: photoStorageUrl, // Stocker le nom de fichier R2 (string | undefined)
                containerId: item.containerId || null,
                categoryId, // Utilisez la version sans null
                qrCode: generateId('ITEM') // Générer le QR Code ici
            };

            console.log("[ItemForm] handleSubmit - Données à ajouter:", JSON.stringify(data, null, 2));

            // Utilisation directe de addItemMutation
            // La mutation s'occupe de l'optimistic update et de l'insertion DB
            await addItemMutation.mutateAsync(data as unknown as ItemFormState);

            // La réinitialisation du formulaire et l'appel à onSuccess sont gérés dans onSuccess de la mutation
            // resetForm();
            // onSuccess?.(); // Appelé dans addItemMutation.mutateAsync().then(...)

        } catch (error) {
            console.error("[ItemForm] handleSubmit - Erreur générale lors de la sauvegarde:", error);
            handleError(error, 'Erreur lors de la création de l\'article', {
                source: 'item_form_submit',
                message: 'Impossible de créer l\'article',
                showAlert: true
            });
            setIsUploading(false); // Assurez-vous que l'indicateur d'upload est désactivé en cas d'erreur
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
    
    // Fonction pour supprimer la photo sélectionnée
    const handlePhotoDelete = useCallback(() => {
        setLocalImage(null);
        setItem(prev => ({ ...prev, photo_storage_url: undefined }));
    }, []);

    // Remplacer les fonctions de gestion modale par la navigation
    const navigateToAddContainer = useCallback(() => {
        // Enregistrer l'état actuel du formulaire dans queryClient pour le récupérer ensuite
        queryClient.setQueryData(['temp_item_form_state'], item);
        
        // Naviguer vers la page d'ajout de container
        router.push('/containers');
    }, [router, queryClient, item]);

    const navigateToAddCategory = useCallback(() => {
        // Enregistrer l'état actuel du formulaire dans queryClient pour le récupérer ensuite
        queryClient.setQueryData(['temp_item_form_state'], item);
        
        // Naviguer vers la page d'ajout de catégorie
        router.push('/add-category');
    }, [router, queryClient, item]);

    // Ajouter un effet pour rafraîchir les données lorsqu'on revient à cet écran
    useEffect(() => {
        // Rafraîchir les données des containers et catégories
        queryClient.invalidateQueries({ queryKey: ['containers'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        
        // NE PAS sélectionner automatiquement un container - laisser l'utilisateur choisir
        
        // Récupérer la catégorie "Bags" par défaut
        const fetchedCategories = queryClient.getQueryData<Category[]>(['categories']);
        if (fetchedCategories && fetchedCategories.length > 0) {
            // Chercher spécifiquement la catégorie "Bags"
            const bagsCategory = fetchedCategories.find(cat => cat.name === 'Bags');
            
            // Si notre catégorie actuelle n'est pas définie, sélectionner "Bags" ou la première par défaut
            if (!item.categoryId) {
                if (bagsCategory) {
                    setItem(prev => ({ ...prev, categoryId: bagsCategory.id }));
                } else {
                    // Si "Bags" n'existe pas, prendre la première triée par created_at
                    const sortedCategories = [...fetchedCategories].sort((a, b) => 
                        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
                    );
                    setItem(prev => ({ ...prev, categoryId: sortedCategories[0].id }));
                }
            }
        }
        
        // Restaurer l'état du formulaire s'il a été sauvegardé avant de naviguer
        const savedState = queryClient.getQueryData<ItemFormState>(['temp_item_form_state']);
        if (savedState) {
            setItem(savedState);
            // Supprimer l'état sauvegardé pour éviter de l'utiliser à nouveau
            queryClient.removeQueries({ queryKey: ['temp_item_form_state'] });
        }
    }, [queryClient, item.categoryId]); // Retirer item.containerId des dépendances

    const styles = getThemedStyles(activeTheme);

    return (
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvel Article</Text>
                <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} disabled={isUploading}>
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
                        placeholderTextColor={activeTheme.text.secondary}
                    />

                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Description de l'article"
                        value={item.description}
                        onChangeText={(text) => setItem(prev => ({ ...prev, description: text }))}
                        multiline
                        numberOfLines={4}
                        placeholderTextColor={activeTheme.text.secondary}
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
                                placeholderTextColor={activeTheme.text.secondary}
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
                                placeholderTextColor={activeTheme.text.secondary}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Photo</Text>
                    <View style={styles.imageContainer}>
                        {(item.photo_storage_url || (localImage && localImage.needsUpload)) ? (
                            <View style={styles.imageWrapper}>
                                <AdaptiveImage
                                    uri={localImage && localImage.needsUpload 
                                        ? localImage.uri 
                                        : item.photo_storage_url || ''}
                                    style={styles.image}
                                    resizeMode="cover"
                                    placeholder={
                                        <View style={styles.placeholderContainer}>
                                            <Icon name="image" size={24} color={activeTheme.text.secondary} />
                                        </View>
                                    }
                                />
                                <TouchableOpacity 
                                    style={styles.deletePhotoButton}
                                    onPress={handlePhotoDelete}
                                    disabled={isUploading}
                                >
                                    <Icon name="delete" size={24} color="#FF3B30" />
                                </TouchableOpacity>
                                
                                {localImage?.needsUpload && (
                                    <View style={styles.newImageBadge}>
                                        <Icon name="cloud_upload" size={14} color="#FFFFFF" />
                                        <Text style={styles.newImageText}>En attente d'upload</Text>
                                    </View>
                                )}
                                
                                {isUploading && (
                                    <View style={styles.uploadingOverlay}>
                                        <Icon name="cloud_upload" size={32} color="#FFFFFF" />
                                        <Text style={styles.uploadingText}>Upload en cours...</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity 
                                style={styles.imagePicker}
                                onPress={handleImagePreview}
                                disabled={isUploading}
                            >
                                <Icon name="add_photo_alternate" size={48} color={isUploading ? activeTheme.text.disabled : activeTheme.primary} />
                                <Text style={[styles.imagePickerText, isUploading && {color: activeTheme.text.disabled}]}>
                                    {isUploading ? "Upload en cours..." : "Sélectionner une image"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Emplacement</Text>
                    <ContainerList
                        containers={containers}
                        selectedId={item.containerId}
                        onSelect={handleContainerSelect}
                        onAddNew={navigateToAddContainer}
                        theme={activeTheme}
                    />
                </View>

                <View style={[styles.formSection, styles.formSectionLast]}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <CategoryList
                        categories={categories}
                        selectedId={item.categoryId}
                        onSelect={handleCategorySelect}
                        onAddNew={navigateToAddCategory}
                        theme={activeTheme}
                    />
                </View>
            </ScrollView>
        </View>
    );
};

const getThemedStyles = (theme: any) => StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: theme.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        elevation: 2,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: theme.text.primary,
    },
    saveButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveText: {
        color: theme.text.onPrimary,
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
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        elevation: 2,
    },
    formSectionLast: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: theme.text.primary,
        marginBottom: 12,
    },
    input: {
        backgroundColor: theme.backgroundSecondary,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: theme.text.primary,
        borderWidth: 1,
        borderColor: theme.border,
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
        color: theme.text.secondary,
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
        backgroundColor: theme.backgroundSecondary,
        borderWidth: 1,
        borderColor: theme.border,
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
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
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
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
    },
    errorText: {
        fontSize: 16,
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 16,
    },
    errorDetail: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    // Nouveaux styles ajoutés inspirés de ItemEditForm
    newImageBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: theme.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderTopLeftRadius: 8,
        borderBottomRightRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    newImageText: {
        color: theme.text.onPrimary,
        fontSize: 10,
        fontWeight: 'bold',
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
    },
    uploadingText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 8,
    },
    imagePicker: {
        aspectRatio: 4/3,
        borderRadius: 8,
        backgroundColor: theme.backgroundSecondary,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePickerText: {
        marginTop: 8,
        color: theme.primary,
        fontSize: 16,
        fontWeight: '500',
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
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        elevation: 5,
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
    disabledButton: {
        opacity: 0.5,
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
});

export default ItemFormWithErrorBoundary;