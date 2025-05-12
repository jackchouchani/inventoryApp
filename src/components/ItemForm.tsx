import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { database, Category, Container } from '../database/database';
import { useRefreshStore } from '../store/refreshStore';
import { generateId } from '../utils/identifierManager';
import { addItem } from '../store/itemsActions';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
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
    containerId: null,
    categoryId: null,
};

/**
 * Composant d'option de conteneur mémoïsé
 */
const ContainerOption = memo(({ container, isSelected, onSelect }: ContainerOptionProps) => (
    <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={() => onSelect(container.id)}
    >
        <MaterialIcons
            name="inbox"
            size={20}
            color={isSelected ? '#fff' : '#666'}
            style={styles.containerIcon}
        />
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {container.name}
        </Text>
    </TouchableOpacity>
));

/**
 * Composant d'option de catégorie mémoïsé
 */
const CategoryOption = memo(({ category, isSelected, onSelect }: CategoryOptionProps) => (
    <TouchableOpacity
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={() => onSelect(category.id)}
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

/**
 * Composant de liste de conteneurs mémoïsé
 */
const ContainerList = memo(({ containers, selectedId, onSelect, onAddNew }: {
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
                    onSelect={onSelect}
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

/**
 * Composant de liste de catégories mémoïsé
 */
const CategoryList = memo(({ categories, selectedId, onSelect, onAddNew }: {
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
                    onSelect={onSelect}
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

/**
 * Composant de fallback en cas d'erreur
 */
const ItemFormErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
    <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
            Une erreur est survenue lors du chargement du formulaire
        </Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={resetErrorBoundary}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
    </View>
);

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

const ItemForm: React.FC<ItemFormProps> = ({ containers, categories, onSuccess }) => {
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const triggerRefresh = useRefreshStore(state => state.triggerRefresh);
    const [item, setItem] = useState<ItemFormState>(INITIAL_STATE);
    const { uploadPhoto } = usePhoto();
    const router = useRouter();
    
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
            const hasPermissions = await checkPhotoPermissions();
            if (!hasPermissions) {
                console.error("handleImagePreview - Permission refusée");
                Alert.alert('Erreur', 'Permission d\'accès aux photos refusée');
                return;
            }
            
            // Utiliser ImagePicker avec la bonne API (MediaTypeOptions est toujours utilisé dans la version actuelle)
            const result = await ExpoImagePicker.launchImageLibraryAsync({
                mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.5,
                base64: true,
            });
            
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedAsset = result.assets[0];
                
                if (Platform.OS === 'web') {
                    // Pour le web, toujours privilégier le format base64
                    if (selectedAsset.base64) {
                        const mimeType = selectedAsset.mimeType || 'image/jpeg';
                        const base64Uri = `data:${mimeType};base64,${selectedAsset.base64}`;
                        
                        
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
            
            let finalFormData = { ...item };
            
            // Si nous avons une image locale en attente d'upload
            if (localImage && localImage.needsUpload) {
                setIsUploading(true);
                try {
                    // Ici on upload réellement l'image
                    const uploadedUrl = await uploadPhoto(localImage.uri);
                    
                    // Assurer que l'URL est correctement traitée
                    if (uploadedUrl) {
                        finalFormData.photo_storage_url = uploadedUrl;
                    } else {
                        finalFormData.photo_storage_url = undefined;
                    }
                } catch (uploadError) {
                    handleError(uploadError, 'Erreur lors de l\'upload de la photo', {
                        source: 'item_form',
                        message: 'Impossible d\'uploader la photo',
                        showAlert: true
                    });
                    // Continuer sans photo si l'upload échoue
                    finalFormData.photo_storage_url = undefined;
                } finally {
                    setIsUploading(false);
                }
            }

            // Utilisation directe de addItemMutation sans passer par handleSave
            await addItemMutation.mutateAsync(finalFormData);
        } catch (error) {
            handleError(error, 'Erreur lors de la création', {
                source: 'item_form',
                message: 'Impossible de créer l\'article',
                showAlert: true
            });
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
        
        // Récupérer le dernier container ajouté
        const fetchedContainers = queryClient.getQueryData<Container[]>(['containers']);
        if (fetchedContainers && fetchedContainers.length > 0) {
            // Trier par date de création pour obtenir le plus récent
            const sortedContainers = [...fetchedContainers].sort((a, b) => 
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            
            // Si notre container actuel n'est pas défini, sélectionner automatiquement le plus récent
            if (!item.containerId) {
                setItem(prev => ({ ...prev, containerId: sortedContainers[0].id }));
            }
        }
        
        // Récupérer la dernière catégorie ajoutée
        const fetchedCategories = queryClient.getQueryData<Category[]>(['categories']);
        if (fetchedCategories && fetchedCategories.length > 0) {
            // Trier par date de création pour obtenir la plus récente
            const sortedCategories = [...fetchedCategories].sort((a, b) => 
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            
            // Si notre catégorie actuelle n'est pas définie, sélectionner automatiquement la plus récente
            if (!item.categoryId) {
                setItem(prev => ({ ...prev, categoryId: sortedCategories[0].id }));
            }
        }
        
        // Restaurer l'état du formulaire s'il a été sauvegardé avant de naviguer
        const savedState = queryClient.getQueryData<ItemFormState>(['temp_item_form_state']);
        if (savedState) {
            setItem(savedState);
            // Supprimer l'état sauvegardé pour éviter de l'utiliser à nouveau
            queryClient.removeQueries({ queryKey: ['temp_item_form_state'] });
        }
    }, [queryClient, item.containerId, item.categoryId]);

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
                                            <MaterialIcons name="image" size={24} color="#ccc" />
                                        </View>
                                    }
                                />
                                <TouchableOpacity 
                                    style={styles.deletePhotoButton}
                                    onPress={handlePhotoDelete}
                                    disabled={isUploading}
                                >
                                    <MaterialIcons name="delete" size={24} color="#FF3B30" />
                                </TouchableOpacity>
                                
                                {localImage?.needsUpload && (
                                    <View style={styles.newImageBadge}>
                                        <MaterialIcons name="cloud-upload" size={14} color="#FFFFFF" />
                                        <Text style={styles.newImageText}>En attente d'upload</Text>
                                    </View>
                                )}
                                
                                {isUploading && (
                                    <View style={styles.uploadingOverlay}>
                                        <MaterialIcons name="cloud-upload" size={32} color="#FFFFFF" />
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
                                <MaterialIcons name="add-photo-alternate" size={48} color={isUploading ? "#cccccc" : "#007AFF"} />
                                <Text style={[styles.imagePickerText, isUploading && {color: "#cccccc"}]}>
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
                    />
                </View>

                <View style={[styles.formSection, styles.formSectionLast]}>
                    <Text style={styles.sectionTitle}>Catégorie</Text>
                    <CategoryList
                        categories={categories}
                        selectedId={item.categoryId}
                        onSelect={handleCategorySelect}
                        onAddNew={navigateToAddCategory}
                    />
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