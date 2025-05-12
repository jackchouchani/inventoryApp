import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { supabase } from '../../src/config/supabase';
import { formatCurrency } from '../../src/utils/format';

export default function ScannerInfoScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [isScanning, setIsScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [containerName, setContainerName] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Timeout pour éviter les blocages
  const loadingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Gérer le bouton retour
  const handleGoBack = () => {
    router.back();
    return true;
  };

  useEffect(() => {
    // Ajouter un écouteur pour le bouton retour physique sur Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleGoBack);
    
    return () => {
      // Nettoyer les écouteurs et les timeouts à la destruction du composant
      backHandler.remove();
      if (loadingTimeout.current) {
        clearTimeout(loadingTimeout.current);
      }
    };
  }, []);

  // Vérifier et demander les permissions si nécessaire
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Récupérer le nom du conteneur en fonction de son ID
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

  // Récupérer le nom de la catégorie en fonction de son ID
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

  // Récupérer l'URL de l'image à partir du bucket Supabase
  const fetchImageUrl = async (imagePathOrId: string) => {
    try {
      if (!imagePathOrId) return null;

      const imagePath = imagePathOrId.includes('/') 
        ? imagePathOrId 
        : `items/${imagePathOrId}`;

      const { data, error } = await supabase.storage
        .from('images')
        .createSignedUrl(imagePath, 3600);

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'image:', error);
      return null;
    }
  };

  // Gérer le scan d'un code QR
  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (hasScanned || loading) return;

    setLoading(true);
    setError(null);
    setHasScanned(true);
    setIsScanning(false);

    // Définir un timeout pour éviter que l'application reste bloquée sur le chargement
    loadingTimeout.current = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Délai d\'attente dépassé. Veuillez réessayer.');
        console.warn('Timeout déclenché pour le chargement des données');
      }
    }, 15000);  // 15 secondes de timeout

    try {
      const { data: qrCode } = result;
      console.log('Code QR scanné:', qrCode);
      
      // Pour les QR codes au format ITEM:ID
      const parts = qrCode.split(':');
      if (parts.length >= 2 && parts[0] === 'ITEM') {
        const itemId = parts[1];
        
        // Récupérer l'article par son ID
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('id', itemId)
          .single();
          
        if (error) {
          setError('Article non trouvé dans la base de données');
          console.error(error);
          if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
          setLoading(false);
          return;
        }
        
        if (data) {
          const item = data;
          
          // Récupérer les informations supplémentaires
          const [container, category, imageUrl] = await Promise.all([
            fetchContainerName(item.container_id),
            fetchCategoryName(item.category_id),
            fetchImageUrl(item.photo_storage_url),
          ]);
          
          setScannedItem(item);
          setContainerName(container);
          setCategoryName(category);
          setImageUrl(imageUrl);
          if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
          setLoading(false);
          return;
        }
      } else {
        // Essayer de trouver l'article par QR code
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('qr_code', qrCode)
          .single();
          
        if (!error && data) {
          const item = data;
          
          // Récupérer les informations supplémentaires
          const [container, category, imageUrl] = await Promise.all([
            fetchContainerName(item.container_id),
            fetchCategoryName(item.category_id),
            fetchImageUrl(item.photo_storage_url),
          ]);
          
          setScannedItem(item);
          setContainerName(container);
          setCategoryName(category);
          setImageUrl(imageUrl);
          if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
          setLoading(false);
          return;
        }
      }
      
      // Si on arrive ici, le code n'a pas été reconnu
      setError('Ce code QR ne correspond pas à un article');
      Alert.alert('Format non reconnu', 'Ce code QR ne correspond pas à un article');
    } catch (error) {
      console.error('Erreur lors du scan:', error);
      setError('Une erreur est survenue lors de la récupération des informations');
      Alert.alert('Erreur', 'Une erreur est survenue lors de la récupération des informations');
    } finally {
      if (loadingTimeout.current) clearTimeout(loadingTimeout.current);
      setLoading(false);
    }
  };

  // Recommencer le scan
  const handleRescan = () => {
    setHasScanned(false);
    setIsScanning(true);
    setScannedItem(null);
    setContainerName('');
    setCategoryName('');
    setImageUrl(null);
    setError(null);
  };

  // Afficher la demande de permission
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

  // Demander la permission si elle n'est pas accordée
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
              barcodeTypes: ["qr"], // Uniquement les QR codes
            }}
            onBarcodeScanned={handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          >
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanText}>
                Placez le QR code dans le cadre
              </Text>
            </View>
            
            {/* Bouton retour visible dans le scanner */}
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
          {loading ? (
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
              {/* Image de l'article */}
              <View style={styles.imageContainer}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.itemImage} resizeMode="cover" />
                ) : (
                  <View style={styles.noImageContainer}>
                    <MaterialIcons name="image-not-supported" size={80} color="#cccccc" />
                    <Text style={styles.noImageText}>Pas d'image</Text>
                  </View>
                )}
              </View>
              
              {/* Informations de l'article */}
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
                  <Text style={styles.infoValue}>{categoryName}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Container:</Text>
                  <Text style={styles.infoValue}>{containerName}</Text>
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
            </View>
          ) : (
            <View style={styles.centerContent}>
              <MaterialIcons name="error-outline" size={80} color="#FF3B30" />
              <Text style={styles.message}>Aucun article trouvé avec ce code</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={handleRescan}
              >
                <Text style={styles.buttonText}>Scanner à nouveau</Text>
              </TouchableOpacity>
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
    height: 200,
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
}); 