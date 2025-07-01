import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl
} from 'react-native';
import {
  Card,
  Button,
  ProgressBar,
  Switch,
  Divider,
  Dialog,
  Portal,
  TextInput
} from 'react-native-paper';
import { localDB } from '../database/localDatabase';
import { OfflineEventQueue } from '../services/OfflineEventQueue';
import { offlineImageService } from '../services/OfflineImageService';
import { offlineIdManager } from '../utils/offlineIdManager';
import { useAppTheme } from '../hooks/useTheme';

interface StorageInfo {
  // Stockage par type de données
  items: { count: number; sizeBytes: number };
  categories: { count: number; sizeBytes: number };
  containers: { count: number; sizeBytes: number };
  images: { count: number; sizeBytes: number };
  events: { count: number; sizeBytes: number };
  conflicts: { count: number; sizeBytes: number };
  idMappings: { count: number; sizeBytes: number };
  
  // Totaux
  totalCount: number;
  totalSizeBytes: number;
  
  // Limites et quotas
  quotaBytes?: number;
  usagePercentage: number;
  
  // Métadonnées
  lastCleanup?: Date;
  oldestEntry?: Date;
  newestEntry?: Date;
}

interface CleanupOptions {
  olderThanDays: number;
  keepSyncedData: boolean;
  keepUnresolvedConflicts: boolean;
  keepPendingEvents: boolean;
  compressImages: boolean;
}

interface OfflineStorageManagerProps {
  visible?: boolean;
  onStorageChange?: (info: StorageInfo) => void;
}

export const OfflineStorageManager: React.FC<OfflineStorageManagerProps> = ({
  visible = true,
  onStorageChange
}) => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoCleanup, setAutoCleanup] = useState(false);
  const [cleanupOptions, setCleanupOptions] = useState<CleanupOptions>({
    olderThanDays: 30,
    keepSyncedData: true,
    keepUnresolvedConflicts: true,
    keepPendingEvents: true,
    compressImages: false
  });
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [showQuotaDialog, setShowQuotaDialog] = useState(false);
  const [quotaLimitMB, setQuotaLimitMB] = useState('100');

  const { activeTheme } = useAppTheme();

  /**
   * Calculer les informations de stockage
   */
  const calculateStorageInfo = useCallback(async (): Promise<StorageInfo> => {
    try {
      // Compter les éléments dans chaque table
      const [
        itemsCount,
        categoriesCount,
        containersCount,
        imagesCount,
        eventsCount,
        conflictsCount,
        idMappingsCount
      ] = await Promise.all([
        localDB.items.count(),
        localDB.categories.count(),
        localDB.containers.count(),
        localDB.imagesBlob.count(),
        localDB.offlineEvents.count(),
        localDB.conflicts.count(),
Promise.resolve(0) // TODO: implement mapping count
      ]);

      // Estimer la taille (approximation)
      const avgItemSize = 500; // bytes
      const avgCategorySize = 200;
      const avgContainerSize = 150;
      const avgEventSize = 800;
      const avgConflictSize = 1500;
      const avgMappingSize = 100;

      // Calculer la taille des images
      const imageBlobs = await localDB.imagesBlob.toArray();
      const imagesSizeBytes = imageBlobs.reduce((total, imageBlob) => {
        return total + (imageBlob.blob ? imageBlob.blob.size : 0);
      }, 0);

      const storageData = {
        items: { count: itemsCount, sizeBytes: itemsCount * avgItemSize },
        categories: { count: categoriesCount, sizeBytes: categoriesCount * avgCategorySize },
        containers: { count: containersCount, sizeBytes: containersCount * avgContainerSize },
        images: { count: imagesCount, sizeBytes: imagesSizeBytes },
        events: { count: eventsCount, sizeBytes: eventsCount * avgEventSize },
        conflicts: { count: conflictsCount, sizeBytes: conflictsCount * avgConflictSize },
        idMappings: { count: idMappingsCount, sizeBytes: idMappingsCount * avgMappingSize }
      };

      const totalCount = Object.values(storageData).reduce((sum, item) => sum + item.count, 0);
      const totalSizeBytes = Object.values(storageData).reduce((sum, item) => sum + item.sizeBytes, 0);

      // Vérifier le quota (si disponible dans le navigateur)
      let quotaBytes: number | undefined;
      let usagePercentage = 0;

      if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          quotaBytes = estimate.quota;
          if (quotaBytes) {
            usagePercentage = (totalSizeBytes / quotaBytes) * 100;
          }
        } catch {
          console.warn('Impossible d\'obtenir les informations de quota');
        }
      }

      // Obtenir les dates d'entrées
      const [oldestItem, newestItem] = await Promise.all([
        localDB.items.orderBy('createdAt').first(),
        localDB.items.orderBy('createdAt').reverse().first()
      ]);

      return {
        ...storageData,
        totalCount,
        totalSizeBytes,
        quotaBytes,
        usagePercentage,
        oldestEntry: oldestItem ? new Date(oldestItem.createdAt) : undefined,
        newestEntry: newestItem ? new Date(newestItem.createdAt) : undefined
      };

    } catch (error) {
      console.error('Erreur calcul stockage:', error);
      throw error;
    }
  }, []);

  /**
   * Charger les informations de stockage
   */
  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await calculateStorageInfo();
      setStorageInfo(info);
      onStorageChange?.(info);
    } catch (error) {
      console.error('Erreur chargement stockage:', error);
      Alert.alert('Erreur', 'Impossible de charger les informations de stockage');
    }
  }, [calculateStorageInfo, onStorageChange]);

  /**
   * Rafraîchir les données
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStorageInfo();
    setIsRefreshing(false);
  }, [loadStorageInfo]);

  /**
   * Nettoyer le stockage selon les options
   */
  const performCleanup = useCallback(async (options: CleanupOptions) => {
    try {
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);
      
      let totalCleaned = 0;

      // Nettoyer les événements synchronisés anciens
      if (!options.keepSyncedData) {
        const eventQueue = OfflineEventQueue.getInstance();
        const cleanedEvents = await eventQueue.cleanup(options.olderThanDays);
        totalCleaned += cleanedEvents;
      }

      // Nettoyer les mappings d'IDs anciens
      const cleanedMappings = await offlineIdManager.cleanupOldMappings(options.olderThanDays);
      totalCleaned += cleanedMappings;

      // Nettoyer les images uploadées anciennes
      const cleanedImages = await offlineImageService.cleanupUploadedImages(options.olderThanDays);
      totalCleaned += cleanedImages;

      // Compresser les images si demandé
      if (options.compressImages) {
        // TODO: implement compressStoredImages method
        const compressedCount = 0;
        console.log(`${compressedCount} images compressées`);
      }

      // Nettoyer les conflits résolus anciens
      if (!options.keepUnresolvedConflicts) {
        const oldResolvedConflicts = await localDB.conflicts
          .where('resolvedAt')
          .below(cutoffDate.toISOString())
          .delete();
        totalCleaned += oldResolvedConflicts;
      }

      Alert.alert(
        'Nettoyage terminé',
        `${totalCleaned} éléments supprimés. Espace libéré: ${formatBytes(totalCleaned * 500)}`
      );

      // Actualiser les informations de stockage
      await loadStorageInfo();

    } catch (error) {
      console.error('Erreur nettoyage:', error);
      Alert.alert('Erreur', 'Erreur lors du nettoyage du stockage');
    }
  }, [loadStorageInfo]);

  /**
   * Formater les bytes en unités lisibles
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * Obtenir la couleur selon le pourcentage d'utilisation
   */
  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return activeTheme.primary;
    if (percentage < 80) return activeTheme.warning;
    return activeTheme.error;
  };

  // Charger les données au montage
  useEffect(() => {
    if (visible) {
      loadStorageInfo();
    }
  }, [visible, loadStorageInfo]);

  // Charger les paramètres de nettoyage automatique
  useEffect(() => {
    const loadAutoCleanupSetting = async () => {
      try {
        const setting = localStorage.getItem('offline_auto_cleanup');
        setAutoCleanup(setting === 'true');
      } catch {
        console.warn('Impossible de charger les paramètres de nettoyage auto');
      }
    };
    loadAutoCleanupSetting();
  }, []);

  if (!visible || !storageInfo) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: activeTheme.background,
    },
    card: {
      margin: 16,
      marginBottom: 8,
    },
    cardContent: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: activeTheme.text.primary,
      marginBottom: 16,
    },
    storageBar: {
      marginBottom: 20,
    },
    usageText: {
      fontSize: 14,
      color: activeTheme.text.secondary,
      marginBottom: 8,
      textAlign: 'center',
    },
    storageItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    storageLabel: {
      fontSize: 14,
      color: activeTheme.text.primary,
      flex: 1,
    },
    storageValue: {
      fontSize: 14,
      fontWeight: '600',
      color: activeTheme.text.primary,
      marginRight: 8,
    },
    storageSize: {
      fontSize: 12,
      color: activeTheme.text.secondary,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    settingLabel: {
      fontSize: 16,
      color: activeTheme.text.primary,
      flex: 1,
    },
    settingDescription: {
      fontSize: 12,
      color: activeTheme.text.secondary,
      marginTop: 2,
    },
    actionButton: {
      marginVertical: 4,
    },
    cleanupOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    cleanupLabel: {
      fontSize: 14,
      color: activeTheme.text.primary,
      flex: 1,
    },
    dialogContent: {
      paddingVertical: 16,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[activeTheme.primary]}
        />
      }
    >
      {/* Utilisation globale */}
      <Card style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Utilisation du Stockage</Text>
          
          <View style={styles.storageBar}>
            <Text style={styles.usageText}>
              {formatBytes(storageInfo.totalSizeBytes)}
              {storageInfo.quotaBytes && ` / ${formatBytes(storageInfo.quotaBytes)}`}
              {storageInfo.usagePercentage > 0 && ` (${storageInfo.usagePercentage.toFixed(1)}%)`}
            </Text>
            <ProgressBar
              progress={storageInfo.usagePercentage / 100}
              color={getUsageColor(storageInfo.usagePercentage)}
            />
          </View>

          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>Total d'éléments</Text>
            <Text style={styles.storageValue}>{storageInfo.totalCount}</Text>
          </View>
        </View>
      </Card>

      {/* Détail par type de données */}
      <Card style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Détail par Type</Text>
          
          {Object.entries(storageInfo).map(([key, value]) => {
            if (typeof value === 'object' && 'count' in value && 'sizeBytes' in value) {
              const displayNames: { [key: string]: string } = {
                items: 'Articles',
                categories: 'Catégories', 
                containers: 'Containers',
                images: 'Images',
                events: 'Événements',
                conflicts: 'Conflits',
                idMappings: 'Mappings ID'
              };
              
              return (
                <View key={key} style={styles.storageItem}>
                  <Text style={styles.storageLabel}>
                    {displayNames[key] || key}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.storageValue}>{value.count}</Text>
                    <Text style={styles.storageSize}>{formatBytes(value.sizeBytes)}</Text>
                  </View>
                </View>
              );
            }
            return null;
          })}
        </View>
      </Card>

      {/* Paramètres de nettoyage */}
      <Card style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.sectionTitle}>Nettoyage Automatique</Text>
          
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Nettoyage automatique</Text>
              <Text style={styles.settingDescription}>
                Nettoyer automatiquement les données anciennes
              </Text>
            </View>
            <Switch
              value={autoCleanup}
              onValueChange={(value) => {
                setAutoCleanup(value);
                localStorage.setItem('offline_auto_cleanup', value.toString());
              }}
            />
          </View>

          <Divider style={{ marginVertical: 12 }} />

          <Button
            mode="outlined"
            onPress={() => setShowCleanupDialog(true)}
            style={styles.actionButton}
            icon="broom"
          >
            Nettoyer maintenant
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => setShowQuotaDialog(true)}
            style={styles.actionButton}
            icon="chart-pie"
          >
            Gérer les quotas
          </Button>
        </View>
      </Card>

      {/* Dialog de nettoyage */}
      <Portal>
        <Dialog visible={showCleanupDialog} onDismiss={() => setShowCleanupDialog(false)}>
          <Dialog.Title>Options de Nettoyage</Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogContent}>
              <View style={styles.cleanupOption}>
                <Text style={styles.cleanupLabel}>Conserver les données synchronisées</Text>
                <Switch
                  value={cleanupOptions.keepSyncedData}
                  onValueChange={(value) => 
                    setCleanupOptions(prev => ({ ...prev, keepSyncedData: value }))
                  }
                />
              </View>
              
              <View style={styles.cleanupOption}>
                <Text style={styles.cleanupLabel}>Conserver les conflits non résolus</Text>
                <Switch
                  value={cleanupOptions.keepUnresolvedConflicts}
                  onValueChange={(value) => 
                    setCleanupOptions(prev => ({ ...prev, keepUnresolvedConflicts: value }))
                  }
                />
              </View>
              
              <View style={styles.cleanupOption}>
                <Text style={styles.cleanupLabel}>Compresser les images</Text>
                <Switch
                  value={cleanupOptions.compressImages}
                  onValueChange={(value) => 
                    setCleanupOptions(prev => ({ ...prev, compressImages: value }))
                  }
                />
              </View>

              <TextInput
                label="Supprimer les données plus anciennes que (jours)"
                value={cleanupOptions.olderThanDays.toString()}
                onChangeText={(text) => {
                  const days = parseInt(text) || 30;
                  setCleanupOptions(prev => ({ ...prev, olderThanDays: days }));
                }}
                keyboardType="numeric"
                style={{ marginTop: 16 }}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCleanupDialog(false)}>Annuler</Button>
            <Button onPress={() => {
              setShowCleanupDialog(false);
              performCleanup(cleanupOptions);
            }}>
              Nettoyer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog de quota */}
      <Portal>
        <Dialog visible={showQuotaDialog} onDismiss={() => setShowQuotaDialog(false)}>
          <Dialog.Title>Gestion des Quotas</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 16, color: activeTheme.text.secondary }}>
              Définir une limite personnalisée pour le stockage offline.
            </Text>
            <TextInput
              label="Limite de stockage (MB)"
              value={quotaLimitMB}
              onChangeText={setQuotaLimitMB}
              keyboardType="numeric"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowQuotaDialog(false)}>Annuler</Button>
            <Button onPress={() => {
              const limitBytes = parseInt(quotaLimitMB) * 1024 * 1024;
              localStorage.setItem('offline_quota_limit', limitBytes.toString());
              setShowQuotaDialog(false);
              Alert.alert('Succès', 'Limite de quota mise à jour');
            }}>
              Définir
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

export default OfflineStorageManager;