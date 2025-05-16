import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, BackHandler, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { supabase } from '../../src/config/supabase';
import { formatCurrency } from '../../src/utils/format';
// Importation de la librairie algoliasearch
import algoliasearch from 'algoliasearch';
import { ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, INDEX_NAME } from '../../src/config/algolia';
// Importation de la configuration Supabase
import { SUPABASE_CONFIG } from '../../src/config/supabaseConfig'; 
// Importation de la fonction parseId
import { parseId } from '../../src/utils/identifierManager';

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

type ScannedItemWithAlgolia = Item & { objectID?: string; photo_storage_url?: string };

export default function ScannerInfoScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [isScanning, setIsScanning] = useState(true);
  const [scannedItem, setScannedItem] = useState<ScannedItemWithAlgolia | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [similarItems, setSimilarItems] = useState<any[]>([]); // Sera typé plus tard
  const [containerName, setContainerName] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [algoliaObjectID, setAlgoliaObjectID] = useState<string | null>(null); // Nouvel état

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
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const fetchContainerName = async (containerId: string) => {
    try {
      const { data, error } = await supabase
        .from('containers')
        .select('name')
        .eq('id', containerId)
        .single();

      if (error) throw error;
      return data?.name || 'Non spécifié';
    } catch (error) {
      console.error('Erreur lors de la récupération du conteneur:', error);
      return 'Non spécifié';
    }
  };

  const fetchCategoryName = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .eq('id', categoryId)
        .single();

      if (error) throw error;
      return data?.name || 'Non spécifiée';
    } catch (error) {
      console.error('Erreur lors de la récupération de la catégorie:', error);
      return 'Non spécifiée';
    }
  };

  const fetchImageUrl = useCallback(async (photoUrl: string | null | undefined) => {
    if (!photoUrl) {
      setImageUrl(FALLBACK_IMAGE_URL || null);
      return;
    }
    setImageLoading(true);
    setImageError(false);
    try {
      // Extrait le chemin relatif si une URL complète est fournie
      let relativePath = photoUrl;
      // Vérifier si photoUrl est une URL HTTP(S) complète. Si oui, il s'agit peut-être déjà d'une URL signée ou publique.
      if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
          // Si elle vient de notre propre bucket Supabase S3 et que ce n'est pas déjà une URL signée (difficile à vérifier sans plus d'infos)
          // on pourrait vouloir extraire le chemin. Mais pour l'instant, on suppose qu'une URL complète est utilisable directement
          // ou qu'elle provient d'Algolia (photo_storage_url) qui est déjà une URL complète.
          // Si elle vient de Supabase (photo_url) et que c'est un chemin relatif, la logique ci-dessous s'applique.
          // Le problème est que photo_url de Supabase est un chemin relatif.
          // Et photo_storage_url d'Algolia est une URL complète.
          // Cette fonction est appelée avec photo_url (relatif) ou photo_storage_url (complet).

          if (photoUrl.startsWith(SUPABASE_CONFIG.S3_URL)) {
             // C'est une URL de notre bucket, extrayons le chemin pour créer une URL signée
             relativePath = photoUrl.substring(SUPABASE_CONFIG.S3_URL.length);
             if (relativePath.startsWith(SUPABASE_CONFIG.STORAGE.BUCKETS.PHOTOS)) { // Ex: /bucket-name/path/to/file.jpg
                relativePath = relativePath.substring(SUPABASE_CONFIG.STORAGE.BUCKETS.PHOTOS.length + 1); // +1 pour le / après le nom du bucket
             }
             // S'assurer qu'il n'y a pas de slash au début pour createSignedUrl
             if (relativePath.startsWith('/')) {
               relativePath = relativePath.substring(1);
             }
             console.log('Chemin relatif extrait pour Supabase Storage (depuis URL S3 complète):', relativePath);
          } else if (!photoUrl.includes('/')) {
            //  Si ce n'est pas une URL http et ne contient pas de '/', on suppose que c'est un chemin relatif simple pour Supabase
            console.log('Utilisation de photoUrl comme chemin relatif direct pour Supabase Storage:', relativePath);
          } else if (photoUrl.startsWith('http')) {
             // Si c'est une URL complète (ex: Algolia photo_storage_url ou URL déjà signée/publique)
             console.log("Utilisation de l'URL complète directement (présumée Algolia ou déjà signée):", photoUrl);
             setImageUrl(photoUrl);
             setImageLoading(false);
             return; // Utiliser directement
          }
          // Si ce n'est aucun des cas ci-dessus, la logique de signature s'appliquera avec 'relativePath' tel quel.
      }
      // Si relativePath est toujours une URL http(s) ici, c'est qu'on n'a pas pu l'interpréter comme chemin pour Supabase
      // Ce cas ne devrait pas arriver si la logique précédente est correcte.
      if (relativePath.startsWith('http')) {
          console.warn("Tentative de créer une URL signée pour une URL déjà complète:", relativePath, " - utilisation directe à la place.");
          setImageUrl(relativePath);
          setImageLoading(false);
          return;
      }


      console.log('Chemin final pour Supabase Storage createSignedUrl:', relativePath);

      const { data, error: RLSerror } = await supabase.storage
        .from(SUPABASE_CONFIG.STORAGE.BUCKETS.PHOTOS) // Assurez-vous que S3_BUCKET_NAME est défini dans SUPABASE_CONFIG
        .createSignedUrl(relativePath, 600); // 10 minutes

      if (RLSerror) {
        throw RLSerror;
      }
      setImageUrl(data?.signedUrl || FALLBACK_IMAGE_URL || null);
    } catch (e) {
      console.error("Erreur lors de la récupération de l'URL signée:", e);
      setImageError(true);
      setImageUrl(FALLBACK_IMAGE_URL || null);
    } finally {
      setImageLoading(false);
    }
  }, []);

  const handleBarCodeScanned = useCallback(async ({ data: qrCodeValue }: { data: string }) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setScannedItem(null);
    setImageUrl(null);
    setSimilarItems([]);
    setContainerName(null);
    setCategoryName(null);
    setIsScanning(false); // Arrêter le scan une fois qu'un code est traité
    setAlgoliaObjectID(null); // Réinitialiser l'objectID

    console.log('QR Code Scanné:', qrCodeValue);

    const parsedIdentifier = parseId(qrCodeValue);
    console.log('Identifiant analysé:', parsedIdentifier);

    if (!parsedIdentifier || parsedIdentifier.type !== 'ITEM') {
      setError('Format de code QR invalide ou non supporté pour un article.');
      setLoading(false);
      setIsScanning(true); // Permettre un nouveau scan
      return;
    }

    if (!itemsIndex) { // Vérification cruciale ici
      console.error("handleBarCodeScanned: itemsIndex n'est pas initialisé.");
      setError("Erreur de configuration: Client de recherche non initialisé.");
      setLoading(false);
      setIsScanning(true); // Permettre un nouveau scan ou afficher un message d'erreur permanent
      return;
    }

    try {
      // 1. Récupérer l'article depuis Supabase par qr_code
      const { data: supabaseItem, error: supabaseError } = await supabase
        .from('items')
        .select('*, containers(name), categories(name)')
        .eq('qr_code', qrCodeValue) // Recherche par qr_code exact
        .single();

      if (supabaseError || !supabaseItem) {
        console.error('Erreur Supabase ou article non trouvé:', supabaseError);
        setError(supabaseError?.message || 'Article non trouvé dans Supabase.');
        setLoading(false);
        setIsScanning(true);
        return;
      }

      console.log('Article trouvé dans Supabase:', supabaseItem);
      const itemWithRelations = {
        ...supabaseItem,
        container_name: (supabaseItem.containers as { name: string })?.name || 'N/A',
        category_name: (supabaseItem.categories as { name: string })?.name || 'N/A',
      };

      // L'ID de Supabase EST l'objectID d'Algolia
      const objectID = supabaseItem.id.toString(); // Assurer que objectID est une string
      setAlgoliaObjectID(objectID);
      console.log("Utilisation de supabaseItem.id comme objectID Algolia:", objectID);

      // Mettre à jour scannedItem avec l'objectID
      // photo_storage_url sera ajouté après la récupération depuis Algolia
      let updatedScannedItem: ScannedItemWithAlgolia = { 
        ...itemWithRelations, 
        objectID 
      };
      setScannedItem(updatedScannedItem);

      // 2. Récupérer photo_storage_url (et d'autres infos si besoin) de l'article depuis Algolia via son objectID
      try {
        console.log("Récupération des détails de l'article depuis Algolia avec objectID:", objectID);
        const algoliaItem = await itemsIndex.getObject(objectID, {
          attributesToRetrieve: ['photo_storage_url', 'name'],
        });
        
        console.log('Article récupéré depuis Algolia (getObject):', algoliaItem);

        if (algoliaItem && algoliaItem.photo_storage_url) {
          console.log("Utilisation de photo_storage_url d'Algolia:", algoliaItem.photo_storage_url);
          setImageUrl(algoliaItem.photo_storage_url);
          setImageLoading(false); // L'URL est directe, pas de chargement supplémentaire pour l'URL elle-même
          setImageError(false);
          // Mettre à jour scannedItem avec l'URL de la photo d'Algolia
          updatedScannedItem = { ...updatedScannedItem, photo_storage_url: algoliaItem.photo_storage_url };
          setScannedItem(updatedScannedItem);
        } else if (supabaseItem.photo_url) {
          console.log("photo_storage_url non trouvée dans Algolia ou article Algolia incomplet, tentative avec Supabase photo_url:", supabaseItem.photo_url);
          await fetchImageUrl(supabaseItem.photo_url); // fetchImageUrl va gérer le loading/error pour l'image
        } else {
          console.log("Aucune URL d'image trouvée ni dans Algolia (getObject) ni dans Supabase.");
          setImageUrl(FALLBACK_IMAGE_URL || null);
        }
      } catch (algoliaGetError) {
        console.error("Erreur lors de la récupération de l'article depuis Algolia (getObject):", algoliaGetError);
        // Continuer avec les données Supabase pour l'image si Algolia échoue
        if (supabaseItem.photo_url) {
          console.log("Erreur getObject Algolia, tentative avec Supabase photo_url:", supabaseItem.photo_url);
          await fetchImageUrl(supabaseItem.photo_url);
        } else {
          console.log("Erreur getObject Algolia et pas de photo_url Supabase.");
          setImageUrl(FALLBACK_IMAGE_URL || null);
        }
      }

    } catch (e: any) {
      console.error('Erreur globale dans handleBarCodeScanned:', e);
      setError(e.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
      // Ne pas remettre isScanning à true ici, car on veut afficher les infos
    }
  }, [loading, fetchImageUrl]);

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
        console.log('Réponse de getRecommendations:', JSON.stringify(response, null, 2));

        if (response && response.results && response.results[0] && response.results[0].hits) {
          const similar = response.results[0].hits;
          console.log('Articles similaires trouvés:', similar);
          setSimilarItems(similar);
        } else {
          console.log('Aucun article similaire trouvé ou structure de réponse inattendue.');
          setSimilarItems([]);
        }
      } catch (e) {
        console.error('Erreur lors de la récupération des articles similaires:', e);
        setError('Erreur lors de la récupération des articles similaires.');
        setSimilarItems([]);
      } finally {
        setLoading(false); // Fin du chargement global
      }
    };

    fetchSimilarItems();
  }, [algoliaObjectID, scannedItem]); // Déclencher si scannedItem change aussi, au cas où l'objectID est défini après

  // Effet pour charger l'image de l'article scanné si elle n'a pas été définie par la logique getObject/photo_storage_url
  useEffect(() => {
    // Cette logique est maintenant principalement gérée dans handleBarCodeScanned après getObject
    // Ce useEffect sert de fallback ou si scannedItem est mis à jour autrement.
    if (scannedItem) {
      if (scannedItem.photo_storage_url) {
        // Si photo_storage_url est déjà là (normalement mis par getObject) et imageUrl n'est pas encore défini (ou différent)
        if (imageUrl !== scannedItem.photo_storage_url) {
           console.log("useEffect image: photo_storage_url présent, mise à jour de imageUrl:", scannedItem.photo_storage_url);
           setImageUrl(scannedItem.photo_storage_url);
           setImageLoading(false);
           setImageError(false);
        }
      } else if (scannedItem.photo_url) {
        // Si pas de photo_storage_url mais on a photo_url de Supabase
        // Et que fetchImageUrl n'a pas déjà été appelé ou que l'URL n'est pas déjà là
        // Pour éviter des appels multiples, on pourrait vérifier si imageUrl est déjà le fallback ou null
        // ou si imageLoading est en cours.
        // La logique dans handleBarCodeScanned devrait déjà appeler fetchImageUrl.
        // Cet appel est une sécurité.
        console.log("useEffect image: photo_storage_url absent, photo_url présent. Appel fetchImageUrl si nécessaire:", scannedItem.photo_url);
        // Pour éviter boucle infinie si fetchImageUrl échoue et remet imageUrl à null/fallback,
        // on ne rappelle que si imageUrl est explicitement null (pas encore tenté ou en attente de fallback)
        if (imageUrl === null && !imageLoading) { 
            fetchImageUrl(scannedItem.photo_url);
        } else if (!imageUrl && !imageLoading && !imageError && !FALLBACK_IMAGE_URL){
            // Cas où il n'y a pas de fallback et rien n'a été chargé, on tente.
             fetchImageUrl(scannedItem.photo_url);
        }

      } else if (!imageLoading && !imageUrl) { // Si aucune URL (ni Algolia, ni Supabase) et pas en chargement
        console.log("useEffect image: Ni photo_storage_url ni photo_url. Utilisation du fallback.");
        setImageUrl(FALLBACK_IMAGE_URL || null);
      }
    }
  }, [scannedItem, fetchImageUrl, imageUrl, imageLoading, imageError]); // Ajout de imageUrl, imageLoading, imageError aux dépendances

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
    console.log('Article similaire sélectionné, isScanning = false, loading = false');
    setIsScanning(false);
    // Attention: item ici est un hit Algolia, il faut peut-être le remapper sur ScannedItemWithAlgolia
    // ou s'assurer qu'il a tous les champs nécessaires.
    // Pour l'instant, on suppose qu'il a au moins objectID, name, photo_storage_url
    // et qu'on va re-déclencher la logique d'affichage/fetch de détails si nécessaire.
    // Le plus simple est de traiter cet item comme le nouveau 'scannedItem'.
    
    // Transformer l'item similaire en un format compatible avec ScannedItemWithAlgolia
    // Ce mapping est une supposition et doit être ajusté selon la structure réelle des hits de recommandation
    const newScannedItem: ScannedItemWithAlgolia = {
        id: item.objectID, // Utiliser objectID comme id
        qr_code: item.qr_code || '', // Peut être manquant pour les recommandations
        name: item.name,
        purchase_price: item.purchase_price || 0,
        selling_price: item.selling_price || 0,
        container_id: item.container_id || '',
        category_id: item.category_id || '',
        status: item.status || 'available', // Fournir un statut par défaut
        description: item.description,
        photo_storage_url: item.photo_storage_url, // L'URL d'Algolia
        objectID: item.objectID,
        // Les relations containers(name), categories(name) ne seront pas là,
        // donc fetchContainerName/fetchCategoryName seront appelés.
    };

    setScannedItem(newScannedItem); // Ceci va déclencher les useEffect pour l'image et les noms
    setAlgoliaObjectID(item.objectID); // Mettre à jour l'objectID pour les prochaines recommandations (si pertinent)
    setSimilarItems([]); // Cacher la liste des articles similaires
    setError(null);
    setLoading(false);
    if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
  };

  const renderSimilarItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.similarItemContainer} 
      onPress={() => handleSimilarItemPress(item)}
    >
      <Image
        source={{ uri: item.photo_storage_url || FALLBACK_IMAGE_URL }}
        style={styles.similarItemImage}
        resizeMode="cover"
      />
      <Text style={styles.similarItemName} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  if (!permission) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ 
          title: 'Scanner',
          headerLeft: () => (
            <TouchableOpacity onPress={handleGoBack}>
              <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
          )
        }} />
        <View style={styles.centerContent}>
          <Text style={styles.message}>Demande d'accès à la caméra...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{
          title: 'Scanner',
          headerLeft: () => (
            <TouchableOpacity onPress={handleGoBack}>
              <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
          )
        }} />
        <View style={styles.centerContent}>
          <Text style={styles.message}>L'accès à la caméra est nécessaire pour scanner les QR codes.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>Autoriser l'accès</Text>
          </TouchableOpacity>
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
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
        )
      }} />
      
      {isScanning ? (
        <View style={styles.cameraContainer}>
          <CameraView
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={isScanning && !loading ? handleBarCodeScanned : undefined}
            style={StyleSheet.absoluteFillObject}
          >
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
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </CameraView>
        </View>
      ) : (
        <ScrollView style={styles.itemInfo}>
          {loading && !scannedItem ? ( // Afficher le chargement principal seulement si aucun item n'est encore affiché
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#0066CC" />
              <Text style={styles.message}>Chargement des informations...</Text>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
                  setLoading(false);
                  handleRescan();
                }}
              >
                <MaterialIcons name="cancel" size={24} color="#ffffff" />
                <Text style={styles.buttonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <MaterialIcons name="error-outline" size={80} color="#FF3B30" />
              <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={handleRescan}
              >
                <MaterialIcons name="refresh" size={24} color="#ffffff" />
                <Text style={styles.buttonText}>Scanner à nouveau</Text>
              </TouchableOpacity>
            </View>
          ) : scannedItem ? (
            <View style={styles.detailsContainer}>
              <View style={styles.imageContainer}>
                {/* Affichage de l'image avec états de chargement et d'erreur */}
                {imageLoading ? (
                  <View style={[styles.itemImage, styles.imagePlaceholder]}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.loadingText}>Chargement...</Text>
                  </View>
                ) : imageError ? (
                  <View style={[styles.itemImage, styles.errorImagePlaceholder]}>
                    <MaterialIcons name="error-outline" size={40} color="#e53935" />
                    <Text style={styles.errorText}>Erreur de chargement</Text>
                  </View>
                ) : imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.itemImage} resizeMode="cover" />
                ) : (
                  <View style={styles.noImageContainer}>
                    <MaterialIcons name="image-not-supported" size={80} color="#cccccc" />
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
                    <MaterialIcons name="qr-code-scanner" size={24} color="#ffffff" />
                    <Text style={styles.buttonText}>Scanner un autre article</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {loading && similarItems.length === 0 && ( // Indicateur de chargement pour les articles similaires
                <View style={styles.centerContentSmall}>
                  <ActivityIndicator size="small" color="#0066CC" />
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
            </View>
          ) : ( 
            // Ce cas (pas de loading, pas d'erreur, pas d'item) ne devrait plus être atteint si le loading initial est bien géré
            <View style={styles.centerContent}>
              <MaterialIcons name="error-outline" size={80} color="#FF3B30" />
              <Text style={styles.message}>Scannez un code pour commencer.</Text> 
              {/* Ou un message si le scan a été fait mais n'a rien retourné et pas d'erreur explicite */}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 12,
  },
  scanText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 4,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
}); 