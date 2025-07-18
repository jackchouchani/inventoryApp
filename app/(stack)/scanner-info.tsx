import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, BackHandler, FlatList, Modal, TextInput, Platform } from 'react-native';
import { Icon } from '../../src/components';
import { useRouter, Stack } from 'expo-router';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { CameraView as ExpoCameraView } from 'expo-camera';
import { useCameraPermissions } from '../../src/hooks/useCameraPermissions';
import { formatCurrency } from '../../src/utils/format';
import { getImageUrl } from '../../src/utils/r2Client';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllItems, selectAllCategories, selectAllContainers } from '../../src/store/selectors';
import { updateItem, updateItemStatus } from '../../src/store/itemsThunks';
import { AppDispatch } from '../../src/store/store';
// Importation de la librairie algoliasearch
import algoliasearch from 'algoliasearch';
import { ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, INDEX_NAME } from '../../src/config/algolia';
// Importation de la fonction parseId
import { parseId } from '../../src/utils/identifierManager';
// Importation du composant ReceiptGenerator
import { ReceiptGenerator } from '../../src/components/ReceiptGenerator';

// Placeholder - L'utilisateur doit s'assurer que cela correspond à sa définition réelle
// et que l'import @/types/types fonctionne.
type Item = {
  id: string; // ou number, selon la BDD
  qr_code: string;
  name: string;
  purchase_price: number;
  selling_price: number;
  container_id: string;
  category_id: string;
  status: 'available' | 'sold';
  description?: string;
  photo_url?: string; // Depuis Supabase (chemin relatif)
  containers?: { name: string }; // Relation Supabase
  categories?: { name: string }; // Relation Supabase
  // Les champs Algolia comme objectID et photo_storage_url sont gérés par ScannedItemWithAlgolia
};

// Initialisation des clients Algolia
let itemsIndex: any; // Sera un SearchIndex
let searchClient: any; // Client Algolia

try {
  if (!ALGOLIA_APP_ID || !ALGOLIA_SEARCH_API_KEY || !INDEX_NAME) {
    throw new Error("Les configurations Algolia (APP_ID, API_KEY, ou INDEX_NAME) sont manquantes.");
  }
  
  searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY);
  itemsIndex = searchClient.initIndex(INDEX_NAME);

  if (!itemsIndex) {
    throw new Error("L'initialisation de itemsIndex a échoué.");
  }
  
  console.log("Clients Algolia initialisés avec succès.");

} catch (error) {
  console.error("Erreur critique lors de l'initialisation des clients Algolia:", error);
  // Laisser itemsIndex et searchClient comme undefined ou null pour que les vérifications ultérieures échouent.
  itemsIndex = null; 
  searchClient = null;
}

const FALLBACK_IMAGE_URL = process.env.EXPO_PUBLIC_FALLBACK_IMAGE_URL;

// Web-only implementation for camera scanning
interface WebCameraProps {
  barcodeScannerSettings: { barcodeTypes: string[] };
  onBarcodeScanned: ((data: { data: string }) => void) | undefined;
  style: any;
}

// Import QrScanner pour une meilleure implémentation web
import QrScanner from 'qr-scanner';

// Composant caméra web avec scanner QR intégré (même implémentation que Scanner.tsx)
const WebCamera: React.FC<{ 
  onBarcodeScanned: (result: { data: string }) => void;
  onCameraReady: () => void;
}> = ({ onBarcodeScanned, onCameraReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeScanner = async () => {
      if (!videoRef.current || qrScannerRef.current) return;

      try {
        console.log("Initialisation du scanner QR...");
        
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
        if (!isSecure) {
          throw new Error('HTTPS est requis pour l\'accès à la caméra. Veuillez utiliser: npx expo start --web --https');
        }
        
        const qrScanner = new QrScanner(
          videoRef.current,
          (result) => {
            console.log("Code QR détecté:", result.data);
            onBarcodeScanned({ data: result.data });
          },
          {
            onDecodeError: () => {},
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment'
          }
        );

        qrScannerRef.current = qrScanner;

        await new Promise(resolve => setTimeout(resolve, 100));
        await qrScanner.start();
        
        if (mounted) {
          console.log("Scanner QR démarré avec succès!");
          setIsReady(true);
          setError(null);
          onCameraReady();
        }

      } catch (error) {
        console.error('Erreur lors de l\'initialisation du scanner:', error);
        if (mounted) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage?.includes('HTTPS')) {
            setError('HTTPS requis. Démarrez avec: npx expo start --web --https');
          } else {
            setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
          }
        }
      }
    };

    const timeoutId = setTimeout(() => {
      if (mounted) {
        initializeScanner();
      }
    }, 200);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      
      if (qrScannerRef.current) {
        console.log("Arrêt du scanner QR...");
        try {
          qrScannerRef.current.stop();
          qrScannerRef.current.destroy();
        } catch {
          console.log("Nettoyage du scanner (normal)");
        }
        qrScannerRef.current = null;
      }
    };
  }, []); // Dépendances vides pour éviter les re-rendus

        if (error) {
        return (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.9)' }]}>
            <Icon name="error" size={48} color="#FF3B30" />
            <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginVertical: 20, paddingHorizontal: 20 }}>{error}</Text>
            <TouchableOpacity 
              style={{ backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
              onPress={() => {
                setError(null);
                window.location.reload();
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        );
      }

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Video element pour le web */}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
      {!isReady && !error && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
            Initialisation du scanner QR...
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            Veuillez autoriser l'accès à la caméra
          </Text>
        </View>
      )}
      {isReady && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100 }]}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center', fontWeight: '500' }}>
              Pointez la caméra vers un code QR
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// React QR Barcode Scanner implementation for web et mobile
const CameraView = ({ onBarcodeScanned, style }: WebCameraProps) => {
  const [, setIsCameraReady] = useState(false);
  
  return (
    <View style={style}>
      {/* Utiliser WebCamera sur le web et ExpoCameraView sur mobile */}
      {Platform.OS === 'web' ? (
        <WebCamera 
          onBarcodeScanned={onBarcodeScanned || (() => {})}
          onCameraReady={() => {
            console.log("Caméra web prête!");
            setIsCameraReady(true);
          }}
        />
      ) : (
        <ExpoCameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={onBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_e', 'itf14', 'datamatrix', 'codabar', 'pdf417'],
          }}
          onCameraReady={() => {
            console.log("Caméra mobile prête!");
            setIsCameraReady(true);
          }}
        />
      )}
      
      {/* Overlay pour le cadre de scan (seulement sur web pour éviter les conflits avec expo) */}
      {Platform.OS === 'web' && (
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>
            Placez le QR code dans le cadre
          </Text>
        </View>
      )}
    </View>
  );
};

type ScannedItemWithAlgolia = Item & { objectID?: string; photo_storage_url?: string };

export default function ScannerInfoScreen() {
  const router = useRouter();
  const permissions = useCameraPermissions();
  const dispatch = useDispatch<AppDispatch>();
  const { activeTheme } = useAppTheme();
  
  // Hooks Redux pour accéder aux données offline
  const allItems = useSelector(selectAllItems);
  const allCategories = useSelector(selectAllCategories);
  const allContainers = useSelector(selectAllContainers);

  const [isScanning, setIsScanning] = useState(true);
  const [scannedItem, setScannedItem] = useState<ScannedItemWithAlgolia | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [similarItems, setSimilarItems] = useState<any[]>([]); // Sera typé plus tard
  const [containerName, setContainerName] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [algoliaObjectID, setAlgoliaObjectID] = useState<string | null>(null); // Nouvel état
  const [isMarkSoldModalVisible, setIsMarkSoldModalVisible] = useState(false);
  const [salePrice, setSalePrice] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isReceiptGeneratorVisible, setIsReceiptGeneratorVisible] = useState(false);
  const [showMarkAsSoldConfirmation, setShowMarkAsSoldConfirmation] = useState(false);
  const [isConfirmingAfterReceipt, setIsConfirmingAfterReceipt] = useState(false);

  const loadingTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleGoBack = () => {
    router.back();
    return true;
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
    
    return () => {
      backHandler.remove();
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!permissions.isGranted && permissions.needsRequest) {
      permissions.requestPermission();
    }
  }, [permissions.isGranted, permissions.needsRequest, permissions.requestPermission]);

  const fetchContainerName = async (containerId: string | null | undefined) => {
    // Si containerId est null ou undefined, retourner directement 'Non spécifié'
    if (containerId === null || containerId === undefined) {
      return 'Non spécifié';
    }
    
    try {
      // Utiliser les données Redux au lieu de Supabase
      const container = allContainers.find(cont => cont.id === Number(containerId));
      return container?.name || 'Non spécifié';
    } catch (error) {
      console.error('Erreur lors de la récupération du conteneur:', error);
      return 'Non spécifié';
    }
  };

  const fetchCategoryName = async (categoryId: string | null | undefined) => {
    // Si categoryId est null ou undefined, retourner directement 'Non spécifiée'
    if (categoryId === null || categoryId === undefined) {
      return 'Non spécifiée';
    }
    
    try {
      // Utiliser les données Redux au lieu de Supabase
      const category = allCategories.find(cat => cat.id === Number(categoryId));
      return category?.name || 'Non spécifiée';
    } catch (error) {
      console.error('Erreur lors de la récupération de la catégorie:', error);
      return 'Non spécifiée';
    }
  };

  const handleBarCodeScanned = useCallback(async ({ data: qrCodeValue }: { data: string }) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setScannedItem(null);
    setImageUrl(null);
    setSimilarItems([]);
    setContainerName(null);
    setCategoryName(null);
    setIsScanning(false);
    setAlgoliaObjectID(null);

    console.log('QR Code Scanné:', qrCodeValue);
    const parsedIdentifier = parseId(qrCodeValue);
    console.log('Identifiant analysé:', parsedIdentifier);

    if (!parsedIdentifier || parsedIdentifier.type !== 'ITEM') {
      setError('Format de code QR invalide ou non supporté pour un article.');
      setLoading(false);
      setIsScanning(true);
      return;
    }

    if (!itemsIndex) {
      console.error("handleBarCodeScanned: itemsIndex n'est pas initialisé.");
      setError("Erreur de configuration: Client de recherche non initialisé.");
      setLoading(false);
      setIsScanning(true);
      return;
    }

    try {
      console.log('[Scanner] Recherche de l\'item avec QR code:', qrCodeValue);
      
      // Rechercher l'item dans les données Redux (marche offline et online)
      const foundItem = allItems.find(item => item.qrCode === qrCodeValue);
      
      if (!foundItem) {
        console.error('[Scanner] Article non trouvé dans les données locales:', qrCodeValue);
        setError('Article non trouvé. Assurez-vous que les données sont synchronisées.');
        setLoading(false);
        setIsScanning(true);
        return;
      }

      console.log('[Scanner] Article trouvé:', foundItem.id);
      
      // Récupérer les informations de catégorie et container depuis Redux
      const category = allCategories.find(cat => cat.id === foundItem.categoryId);
      const container = allContainers.find(cont => cont.id === foundItem.containerId);
      
      // Créer l'objet item avec les relations
      const itemWithRelations = {
        ...foundItem,
        id: foundItem.id,
        qr_code: foundItem.qrCode, // Mapping pour compatibilité
        name: foundItem.name,
        purchase_price: foundItem.purchasePrice,
        selling_price: foundItem.sellingPrice,
        container_id: foundItem.containerId,
        category_id: foundItem.categoryId,
        status: foundItem.status,
        description: foundItem.description,
        photo_url: foundItem.photo_storage_url,
        containers: container ? { name: container.name } : undefined,
        categories: category ? { name: category.name } : undefined,
      };

      // Rediriger directement vers la page d'informations de l'article
      console.log('[Scanner] Redirection vers la page d\'informations:', itemWithRelations.id);
      router.replace(`/item/${itemWithRelations.id}/info`);

    } catch (e: any) {
      console.error('[Scanner] Erreur globale dans handleBarCodeScanned:', e);
      setError(e.message || 'Une erreur est survenue.');
      setLoading(false);
      setIsScanning(true);
    }
  }, [loading, router, allItems, allCategories, allContainers]);

  // Effet pour récupérer les articles similaires une fois que l'objectID est connu
  useEffect(() => {
    if (!algoliaObjectID || !scannedItem) return;

    const fetchSimilarItems = async () => {
      const currentObjectID = scannedItem?.objectID || algoliaObjectID;
      if (!currentObjectID) {
        console.warn("fetchSimilarItems appelé mais objectID non disponible.");
        return;
      }
      if (!searchClient) { // Vérification cruciale ici
        console.error("fetchSimilarItems: searchClient n'est pas initialisé.");
        setError("Erreur de configuration: Client de recherche non initialisé.");
        return;
      }

      try {
        setLoading(true); 
        console.log("Récupération d'articles similaires pour l'objectID:", currentObjectID);
        
        // Utilisation directe du client Algolia pour rechercher des articles similaires
        const requestOptions = {
          indexName: INDEX_NAME,
          objectID: currentObjectID,
          model: 'looking-similar',
          threshold: 0,
          maxRecommendations: 5
        };

        const response = await searchClient.getRecommendations([requestOptions]);

        if (response && response.results && response.results[0] && response.results[0].hits) {
          const similar = response.results[0].hits;
          setSimilarItems(similar);
        } else {
          setSimilarItems([]);
        }
      } catch {
        setError('Erreur lors de la récupération des articles similaires.');
        setSimilarItems([]);
      } finally {
        setLoading(false); // Fin du chargement global
      }
    };

    fetchSimilarItems();
  }, [algoliaObjectID, scannedItem]); // Déclencher si scannedItem change aussi, au cas où l'objectID est défini après

  // Effet pour gérer les cas où l'image pourrait ne pas être définie correctement
  useEffect(() => {
    if (scannedItem && !imageUrl && !imageLoading) {
      // Cas de secours si l'image n'a pas été définie dans handleBarCodeScanned
      if (scannedItem.photo_url) {
        setImageUrl(getImageUrl(scannedItem.photo_url));
      } else {
        setImageUrl(FALLBACK_IMAGE_URL || null);
      }
    }
  }, [scannedItem, imageUrl, imageLoading]);

  // Effet pour mettre à jour les noms de conteneur et catégorie
  useEffect(() => {
    const loadNames = async () => {
      if (scannedItem) {
        // Récupérer les noms du conteneur et de la catégorie
        const [container, category] = await Promise.all([
          fetchContainerName(scannedItem.container_id), // Utiliser container_id de scannedItem
          fetchCategoryName(scannedItem.category_id), // Utiliser category_id de scannedItem
        ]);
        setContainerName(container);
        setCategoryName(category);
      } else {
        // Pas d'article scanné, réinitialiser les noms
        setContainerName('');
        setCategoryName('');
      }
    };

    loadNames();
  }, [scannedItem]); // Déclencher l'effet lorsque scannedItem change

  const handleRescan = () => {
    console.log('Réinitialisation du scanner, isScanning = true, loading = false');
    setIsScanning(true);
    setScannedItem(null);
    setContainerName('');
    setCategoryName('');
    setImageUrl(null);
    setImageError(false);
    setSimilarItems([]);
    setError(null);
    setLoading(false);
    if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
  };

  const handleSimilarItemPress = async (item: any) => {
    console.log('Article similaire sélectionné');
    setIsScanning(false);
    const newScannedItem: ScannedItemWithAlgolia = {
        id: item.objectID,
        qr_code: item.qr_code || '',
        name: item.name,
        purchase_price: item.purchase_price || 0,
        selling_price: item.selling_price || 0,
        container_id: item.container_id || '',
        category_id: item.category_id || '',
        status: item.status || 'available',
        description: item.description,
        photo_storage_url: item.photo_storage_url,
        objectID: item.objectID,
    };

    setScannedItem(newScannedItem);
    setAlgoliaObjectID(item.objectID);
    setSimilarItems([]);
    setError(null);
    setLoading(false);
    if (item.photo_storage_url) {
      setImageUrl(getImageUrl(item.photo_storage_url));
    } else {
      setImageUrl(FALLBACK_IMAGE_URL || null);
    }
    if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
  };

  const renderSimilarItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.similarItemContainer} 
      onPress={() => handleSimilarItemPress(item)}
    >
      <Image
        source={{ uri: item.photo_storage_url ? getImageUrl(item.photo_storage_url) : FALLBACK_IMAGE_URL }}
        style={styles.similarItemImage}
        resizeMode="cover"
      />
      <Text style={styles.similarItemName} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const handleMarkAsSold = async () => {
    if (!scannedItem) return;
    
    setIsUpdating(true);
    try {
      // Utiliser Redux thunk au lieu de Supabase direct
      // D'abord mettre à jour le statut
      await dispatch(updateItemStatus({
        itemId: Number(scannedItem.id),
        status: 'sold'
      })).unwrap();
      
      // Puis mettre à jour le prix de vente
      await dispatch(updateItem({
        id: Number(scannedItem.id),
        updates: {
          sellingPrice: salePrice
        }
      })).unwrap();

      // Mettre à jour l'état local
      setScannedItem(prev => prev ? { ...prev, status: 'sold', selling_price: salePrice } : null);
      Alert.alert('Succès', 'Article marqué comme vendu avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour');
    } finally {
      setIsUpdating(false);
      setIsMarkSoldModalVisible(false);
    }
  };

  if (permissions.isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ 
          title: 'Scanner',
          headerLeft: () => (
            <TouchableOpacity onPress={handleGoBack}>
              <Icon name="arrow_back" size={24} color="#007AFF" />
            </TouchableOpacity>
          )
        }} />
        <View style={styles.centerContent}>
          <Text style={styles.message}>Demande d'accès à la caméra...</Text>
        </View>
      </View>
    );
  }

  if (!permissions.isGranted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{
          title: 'Scanner',
          headerLeft: () => (
            <TouchableOpacity onPress={handleGoBack}>
              <Icon name="arrow_back" size={24} color="#007AFF" />
            </TouchableOpacity>
          )
        }} />
        <View style={styles.centerContent}>
          <Text style={styles.message}>L'accès à la caméra est nécessaire pour scanner les QR codes.</Text>
          {permissions.instructions && (
            <Text style={styles.message}>{permissions.instructions}</Text>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={permissions.requestPermission}
            disabled={permissions.isLoading}
          >
            <Text style={styles.buttonText}>
              {permissions.isLoading ? 'Demande en cours...' : 'Autoriser l\'accès'}
            </Text>
          </TouchableOpacity>
          {permissions.error && (
            <Text style={styles.message}>{permissions.error}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
              <Stack.Screen options={{
        title: 'Scanner QR Code',
        headerLeft: () => (
          <TouchableOpacity onPress={handleGoBack}>
            <Icon name="arrow_back" size={24} color="#007AFF" />
          </TouchableOpacity>
        )
      }} />
      
      {isScanning ? (
        <View style={styles.cameraContainer}>
          {/* Web-specific camera implementation */}
          <CameraView
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={isScanning && !loading ? handleBarCodeScanned : undefined}
            style={StyleSheet.absoluteFillObject}
          />
          
          {/* Overlay elements */}
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>
              Placez le QR code dans le cadre
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.scanBackButton} 
            onPress={handleGoBack}
          >
            <Icon name="arrow_back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.itemInfo}>
          {loading && !scannedItem ? ( // Afficher le chargement principal seulement si aucun item n'est encore affiché
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={activeTheme.primary} />
              <Text style={styles.message}>Chargement des informations...</Text>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
                  setLoading(false);
                  handleRescan();
                }}
              >
                <Icon name="cancel" size={24} color="#ffffff" />
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : error ? (
                          <View style={styles.centerContent}>
                <Icon name="error_outline" size={80} color="#FF3B30" />
                <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={handleRescan}
              >
                <Icon name="refresh" size={24} color="#ffffff" />
                <Text style={styles.buttonText}>Scanner à nouveau</Text>
              </TouchableOpacity>
            </View>
          ) : scannedItem ? (
            <View style={styles.detailsContainer}>
              <View style={styles.imageContainer}>
                {/* Affichage de l'image avec états de chargement et d'erreur */}
                {imageLoading ? (
                  <View style={[styles.itemImage, styles.imagePlaceholder]}>
                    <ActivityIndicator size="small" color={activeTheme.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                  </View>
                ) : imageError ? (
                                      <View style={[styles.itemImage, styles.errorImagePlaceholder]}>
                      <Icon name="error_outline" size={40} color="#e53935" />
                      <Text style={styles.errorText}>Erreur de chargement</Text>
                    </View>
                ) : imageUrl ? (
                  <Image
                    source={{ uri: imageUrl || FALLBACK_IMAGE_URL }}
                    style={styles.itemImage}
                    resizeMode="cover"
                    onError={() => {
                      console.log("Erreur de chargement de l'image:", imageUrl);
                      setImageError(true);
                    }}
                  />
                ) : (
                                      <View style={styles.noImageContainer}>
                      <Icon name="image_not_supported" size={80} color="#cccccc" />
                      <Text style={styles.noImageText}>Pas d'image</Text>
                    </View>
                )}
              </View>
              
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{scannedItem.name}</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Prix d'achat:</Text>
                  <Text style={styles.infoValue}>
                    {formatCurrency(scannedItem.purchase_price)}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Prix de vente:</Text>
                  <Text style={styles.infoValue}>
                    {formatCurrency(scannedItem.selling_price)}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Catégorie:</Text>
                  <Text style={styles.infoValue}>{categoryName || 'Chargement...'}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Container:</Text>
                  <Text style={styles.infoValue}>{containerName || 'Chargement...'}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Statut:</Text>
                  <Text style={[
                    styles.statusValue,
                    scannedItem.status === 'available' ? styles.availableStatus : styles.soldStatus
                  ]}>
                    {scannedItem.status === 'available' ? 'Disponible' : 'Vendu'}
                  </Text>
                </View>
                
                {scannedItem.description ? (
                  <View style={styles.descriptionContainer}>
                    <Text style={styles.infoLabel}>Description:</Text>
                    <Text style={styles.description}>{scannedItem.description}</Text>
                  </View>
                ) : null}
                
                <View style={styles.buttonsContainer}>
                                      <TouchableOpacity
                      style={[styles.button, styles.rescanButton]}
                      onPress={handleRescan}
                    >
                      <Icon name="qr_code_scanner" size={24} color="#ffffff" />
                      <Text style={styles.buttonText}>Scanner un autre article</Text>
                    </TouchableOpacity>
                </View>
              </View>

              {loading && similarItems.length === 0 && ( // Indicateur de chargement pour les articles similaires
                <View style={styles.centerContentSmall}>
                  <ActivityIndicator size="small" color={activeTheme.primary} />
                  <Text style={styles.messageSmall}>Recherche d'articles similaires...</Text>
                </View>
              )}
              {similarItems.length > 0 && (
                <View style={styles.similarItemsSection}>
                  <Text style={styles.similarItemsTitle}>Articles similaires</Text>
                  <FlatList
                    horizontal
                    data={similarItems}
                    renderItem={renderSimilarItem}
                    keyExtractor={(item) => item.objectID}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.similarItemsList}
                  />
                </View>
              )}

              {scannedItem?.status === 'available' && (
                <>
                  <TouchableOpacity
                    style={[styles.button, styles.sellButton]}
                    onPress={() => {
                      setSalePrice(scannedItem.selling_price); // Initialiser avec le prix actuel
                      setIsMarkSoldModalVisible(true);
                    }}
                  >
                    <Icon name="shopping_cart" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Marquer comme vendu</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.receiptButton]}
                    onPress={() => setIsReceiptGeneratorVisible(true)}
                  >
                    <Icon name="receipt" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Générer un ticket de caisse</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : ( 
            // Ce cas (pas de loading, pas d'erreur, pas d'item) ne devrait plus être atteint si le loading initial est bien géré
                          <View style={styles.centerContent}>
                <Icon name="error_outline" size={80} color="#FF3B30" />
                <Text style={styles.message}>Scannez un code pour commencer.</Text> 
              {/* Ou un message si le scan a été fait mais n'a rien retourné et pas d'erreur explicite */}
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={isMarkSoldModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsMarkSoldModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Marquer comme vendu</Text>
            
            <View style={styles.priceInputContainer}>
              <Text style={styles.priceLabel}>Prix de vente:</Text>
              <TextInput
                style={styles.priceInput}
                keyboardType="numeric"
                value={salePrice.toString()}
                onChangeText={(text) => setSalePrice(Number(text) || 0)}
                placeholder="Prix de vente"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsMarkSoldModalVisible(false)}
                disabled={isUpdating}
              >
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleMarkAsSold}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color={activeTheme.text.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Confirmer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal pour le générateur de tickets */}
      <Modal
        visible={isReceiptGeneratorVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsReceiptGeneratorVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Générer un ticket de caisse</Text>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsReceiptGeneratorVisible(false)}
            >
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            
            {scannedItem && (
              <ReceiptGenerator
                items={[{
                  id: Number(scannedItem.id),
                  name: scannedItem.name,
                  qrCode: scannedItem.qr_code,
                  description: scannedItem.description || "",
                  sellingPrice: scannedItem.selling_price,
                  purchasePrice: scannedItem.purchase_price,
                  image: imageUrl || undefined,
                  actualSellingPrice: scannedItem.selling_price // Ajout du prix de vente actuel
                }]}
                onComplete={() => {
                  setIsReceiptGeneratorVisible(false);
                  // Demander à l'utilisateur s'il souhaite marquer l'article comme vendu
                  setIsConfirmingAfterReceipt(true);
                  setShowMarkAsSoldConfirmation(true);
                }}
                onError={(error) => {
                  setIsReceiptGeneratorVisible(false);
                  Alert.alert('Erreur', `Erreur lors de la génération du reçu: ${error.message}`);
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Confirmation pour marquer l'article comme vendu après génération de facture */}
      {showMarkAsSoldConfirmation && scannedItem && (
        <Modal
          visible={showMarkAsSoldConfirmation}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowMarkAsSoldConfirmation(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Marquer comme vendu ?</Text>
              <Text style={styles.priceLabel}>
                Souhaitez-vous marquer l'article "{scannedItem.name}" comme vendu ?
              </Text>
              
              {isConfirmingAfterReceipt && (
                <View style={styles.priceInputContainer}>
                  <Text style={styles.priceLabel}>Prix de vente :</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={String(salePrice || scannedItem.selling_price)}
                    onChangeText={(text) => setSalePrice(parseFloat(text.replace(',', '.')) || 0)}
                    keyboardType="numeric"
                    placeholder="Prix de vente"
                  />
                </View>
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowMarkAsSoldConfirmation(false);
                    setIsConfirmingAfterReceipt(false);
                  }}
                  disabled={isUpdating}
                >
                  <Text style={styles.buttonText}>Non</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={async () => {
                    if (isConfirmingAfterReceipt) {
                      // Si la confirmation vient après génération d'un reçu
                      await handleMarkAsSold();
                      setIsConfirmingAfterReceipt(false);
                    } else {
                      setIsMarkSoldModalVisible(true);
                      setShowMarkAsSoldConfirmation(false);
                    }
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator color={activeTheme.text.onPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>Oui</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webTestButton: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  webTestButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0)', // Transparence augmentée pour meilleure visibilité
    zIndex: 2,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 8,
    borderRadius: 4,
    fontWeight: 'bold',
  },
  scanBackButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    padding: 10,
    zIndex: 10,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#555555',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#FF3B30',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    marginTop: 30,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  itemInfo: {
    flex: 1,
  },
  detailsContainer: {
    padding: 16,
  },
  imageContainer: {
    height: 350,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  noImageText: {
    marginTop: 8,
    fontSize: 16,
    color: '#888888',
  },
  itemDetails: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  itemName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555555',
  },
  infoValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  availableStatus: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
  },
  soldStatus: {
    backgroundColor: '#ffebee',
    color: '#c62828',
  },
  descriptionContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#333333',
    marginTop: 8,
    lineHeight: 22,
  },
  buttonsContainer: {
    marginTop: 16,
    gap: 12,
  },
  rescanButton: {
    backgroundColor: '#555555',
  },
  similarItemsSection: {
    marginTop: 20,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal:16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  similarItemsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333333',
  },
  similarItemsList: {
    paddingBottom: 8,
  },
  similarItemContainer: {
    width: 120,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 1,
  },
  similarItemImage: {
    width: 100,
    height: 100,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: '#e9ecef',
  },
  similarItemName: {
    fontSize: 13,
    textAlign: 'center',
    color: '#495057',
  },
  centerContentSmall: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  messageSmall: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    color: '#555555',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  errorImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffebee',
  },
  errorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  priceInputContainer: {
    marginBottom: 20,
  },
  priceLabel: {
    marginBottom: 8,
    fontSize: 16,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  sellButton: {
    backgroundColor: '#4CAF50',
    marginTop: 10,
  },
  receiptButton: {
    backgroundColor: '#FF9800',
    marginTop: 10,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
    padding: 5,
  },
}); 