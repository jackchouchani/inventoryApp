import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDispatch } from 'react-redux';

import { updateItem } from '../store/itemsActions';
import { fetchItems } from '../store/itemsThunks';
import { AppDispatch } from '../store/store';
import { databaseInterface, Container, Item } from '../database/database';
import { parseId } from '../utils/identifierManager';

// Interface pour les résultats de scan
export interface ScanResult {
  success: boolean;
  message: string;
  type?: 'container' | 'item';
  data?: any;
}

/**
 * Hook personnalisé pour gérer le workflow de scan avec Scanner
 * @param items Liste des articles disponibles
 * @param containers Liste des containers disponibles
 * @param refetch Fonction pour rafraîchir les données (pour compatibilité, peut être supprimée)
 */
export const useScannerWorkflow = (
  items: Item[], 
  containers: Container[],
  refetch?: () => Promise<any> // Optionnel maintenant
) => {
  const dispatch = useDispatch<AppDispatch>();
  
  /**
   * Traitement du scan d'un code-barres
   */
  const handleScan = useCallback(async (scannedData: string): Promise<ScanResult | null> => {
    try {
      console.log(`Analyse du code scanné: ${scannedData}`);
      
      // 1. Vérifier les codes Code128 pour les articles (support supplémentaire pour les codes numériques)
      if (/^\d+$/.test(scannedData)) {
        console.log('Format numérique détecté, recherche dans les articles...');
        // Rechercher l'article par son code numérique
        const item = items.find(i => i.qrCode === scannedData);
        
        if (item) {
          console.log(`Article trouvé par code numérique: ${item.name}`);
          return {
            success: true,
            message: `Article ${item.name} trouvé`,
            type: 'item',
            data: item
          };
        } else {
          console.log('Aucun article trouvé avec ce code numérique');
        }
      }
      
      // 2. Utiliser le parser standard pour les codes QR
      console.log('Utilisation du parser standard pour le code QR');
      const parsedResult = parseId(scannedData);
      
      if (!parsedResult) {
        console.log('Format de code non valide après parsing');
        Alert.alert('Format non reconnu', 'Ce code n\'est pas au format attendu.');
        return {
          success: false,
          message: 'Format de code non valide'
        };
      }
      
      const { type, value } = parsedResult;
      console.log(`Type détecté: ${type}, Valeur: ${value}`);
      
      if (!type || !value) {
        console.log('Type ou valeur manquant dans le code');
        Alert.alert('Code incomplet', 'Le code scanné ne contient pas toutes les informations nécessaires.');
        return {
          success: false,
          message: 'Format de code incomplet'
        };
      }
      
      // 3. Traiter les différents types de codes
      if (type === 'CONTAINER') {
        console.log('Code container détecté, recherche dans les containers...');
        console.log(`Containers en mémoire (${containers.length}):`, containers.map(c => ({ id: c.id, name: c.name, qrCode: c.qrCode })));
        
        // D'abord chercher dans les containers en mémoire
        let container = containers.find(c => c.qrCode === scannedData);
        
        if (!container) {
          console.log('Container non trouvé en mémoire, tentative de recherche en base de données...');
          
          try {
            // Recherche directe en base de données
            const foundContainer = await databaseInterface.getContainerByQRCode(scannedData);
            
            if (foundContainer) {
              container = foundContainer;
              console.log(`Container trouvé en base de données: ${container.name} (ID: ${container.id})`);
            }
          } catch (error) {
            console.error('Erreur lors de la recherche en base:', error);
          }
        } else {
          console.log(`Container trouvé en mémoire: ${container.name} (ID: ${container.id})`);
        }
        
        if (!container) {
          console.log('Container non trouvé ni en mémoire ni en base de données');
          console.log(`QR Code recherché: "${scannedData}"`);
          Alert.alert('Container non trouvé', 'Ce container n\'est pas enregistré dans la base de données.');
          return {
            success: false,
            message: 'Container non trouvé'
          };
        }
        
        console.log(`Container trouvé: ${container.name} (ID: ${container.id})`);
        
        return {
          success: true,
          message: `Container ${container.name} sélectionné`,
          type: 'container',
          data: container
        };
      } 
      else if (type === 'ITEM') {
        console.log('Code article détecté, recherche dans les articles...');
        // Rechercher l'article correspondant
        const item = items.find(i => i.qrCode === scannedData);
        
        if (!item) {
          console.log('Article non trouvé dans la base de données');
          Alert.alert('Article non trouvé', 'Cet article n\'est pas enregistré dans la base de données.');
          return {
            success: false,
            message: 'Article non trouvé'
          };
        }
        
        console.log(`Article trouvé: ${item.name} (ID: ${item.id})`);
        
        return {
          success: true,
          message: `Article ${item.name} trouvé`,
          type: 'item',
          data: item
        };
      } 
      
      // Type de code non reconnu
      console.log(`Type de code non reconnu: ${type}`);
      Alert.alert('Type non reconnu', `Le type de code "${type}" n'est pas supporté.`);
      return {
        success: false,
        message: 'Type de code non reconnu'
      };
    } catch (error) {
      console.error('Erreur lors du scan:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors du traitement du code scanné.');
      return {
        success: false,
        message: 'Erreur lors du scan'
      };
    }
  }, [items, containers]);
  
  /**
   * Mise à jour d'un article
   */
  const updateItemInDatabase = useCallback(async (item: Item): Promise<void> => {
    try {
      // Mise à jour optimiste
      dispatch(updateItem(item));
      
      // Mise à jour dans la base de données
      await databaseInterface.updateItem(item.id!, item);
      
      // ✅ INVALIDATION REDUX - Remplace queryClient.invalidateQueries()
      await dispatch(fetchItems({ page: 0, limit: 1000 }));
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      // Fallback vers refetch si fourni pour compatibilité
      if (refetch) {
        await refetch();
      }
      throw new Error('Impossible de mettre à jour l\'article');
    }
  }, [dispatch, refetch]);
  
  /**
   * Finalisation du scan
   */
  const finalizeScan = useCallback(async (container: Container, scannedItems: Item[]): Promise<void> => {
    try {
      // Traiter chaque article
      for (const item of scannedItems) {
        // Vérifier si l'article est déjà dans le bon container
        if (item.containerId === container.id) {
          console.log(`Article ${item.name} déjà dans le container ${container.name}`);
          continue;
        }
        
        const updateData = {
          ...item,
          containerId: container.id,
          updatedAt: new Date().toISOString()
        };
        
        // Mettre à jour l'article
        await updateItemInDatabase(updateData);
      }
      
      console.log(`${scannedItems.length} articles assignés au container ${container.name}`);
      
    } catch (error) {
      console.error('Erreur lors de la finalisation:', error);
      throw error;
    }
  }, [updateItemInDatabase]);
  
  return {
    handleScan,
    updateItemInDatabase,
    finalizeScan
  };
}; 