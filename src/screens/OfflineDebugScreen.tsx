import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Share
} from 'react-native';
import {
  Card,
  Button,
  Chip,
  List,
  Switch,
  ProgressBar,
  IconButton,
  Surface,
  Divider,
  DataTable
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useTheme';
import { useNetwork } from '../contexts/NetworkContext';
import { OfflineEventQueue } from '../services/OfflineEventQueue';
import { offlineIdManager } from '../utils/offlineIdManager';
import { offlineSearchService } from '../services/OfflineSearchService';
import { offlineImageService } from '../services/OfflineImageService';
import { localDB } from '../database/localDatabase';
import { ConflictDetector } from '../services/ConflictDetector';
import { ConflictResolver } from '../services/ConflictResolver';
import { syncService } from '../services/SyncService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DebugStats {
  // Base de données locale
  localDatabase: {
    totalItems: number;
    totalContainers: number;
    totalCategories: number;
    totalImages: number;
    databaseSize: string;
  };
  
  // Queue d'événements
  eventQueue: {
    total: number;
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    conflicts: number;
    oldestEvent?: Date;
    newestEvent?: Date;
  };
  
  // Conflits
  conflicts: {
    total: number;
    resolvedAuto: number;
    resolvedManual: number;
    pending: number;
    byType: { [key: string]: number };
  };
  
  // IDs offline
  idMappings: {
    totalMappings: number;
    mappingsByEntity: Record<string, number>;
    oldestMapping?: Date;
    newestMapping?: Date;
  };
  
  // Images
  images: {
    totalImages: number;
    pendingUploads: number;
    failedUploads: number;
    uploadedImages: number;
    totalSizeBytes: number;
  };
  
  // Recherche
  search: {
    indexLastUpdated: Date;
    indexedItems: number;
    indexedContainers: number;
    indexedCategories: number;
  };
  
  // Réseau
  network: {
    isOnline: boolean;
    isInternetReachable: boolean;
    type: string;
    pendingOperations: number;
    lastSyncTime: Date | null;
  };
}

export const OfflineDebugScreen: React.FC = () => {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forceOfflineMode, setForceOfflineMode] = useState(false);
  const [debugLogsVisible, setDebugLogsVisible] = useState(false);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  const { theme } = useAppTheme();
  const networkContext = useNetwork();
  const eventQueue = OfflineEventQueue.getInstance();

  const loadStats = useCallback(async () => {
    try {
      setIsLoading(true);

      const [
        queueStats,
        conflictStats,
        idStats,
        imageStats,
        searchStats,
        storageStats,
        recentEventsData
      ] = await Promise.all([
        eventQueue.getQueueStats(),
        ConflictResolver.getInstance().getResolutionStats(),
        offlineIdManager.getStats(),
        offlineImageService.getImageStats(),
        offlineSearchService.getSearchStats(),
        localDB.getStorageStats(),
        eventQueue.peek(10)
      ]);

      const debugStats: DebugStats = {
        localDatabase: {
          totalItems: storageStats.itemsCount,
          totalContainers: storageStats.containersCount,
          totalCategories: storageStats.categoriesCount,
          totalImages: storageStats.imagesCount,
          databaseSize: formatBytes(storageStats.imagesBlobSize)
        },
        eventQueue: queueStats,
        conflicts: conflictStats,
        idMappings: idStats,
        images: imageStats,
        search: searchStats,
        network: {
          isOnline: networkContext.isOnline,
          isInternetReachable: networkContext.isInternetReachable,
          type: networkContext.type,
          pendingOperations: networkContext.pendingOperationsCount,
          lastSyncTime: networkContext.lastOnlineTime
        }
      };

      setStats(debugStats);
      setRecentEvents(recentEventsData);

      // Charger l'état du mode offline forcé
      const forcedOffline = localStorage.getItem('force_offline_mode') === 'true';
      setForceOfflineMode(forcedOffline);

    } catch (error) {
      console.error('Erreur chargement stats debug:', error);
      Alert.alert('Erreur', 'Impossible de charger les statistiques de debug');
    } finally {
      setIsLoading(false);
    }
  }, [networkContext]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStats();
    setIsRefreshing(false);
  }, [loadStats]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleToggleForceOffline = useCallback((enabled: boolean) => {
    setForceOfflineMode(enabled);
    localStorage.setItem('force_offline_mode', enabled.toString());
    
    if (enabled) {
      Alert.alert(
        'Mode offline forcé activé',
        'L\'application utilisera uniquement les données locales jusqu\'à désactivation.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const handleClearEventQueue = useCallback(() => {
    Alert.alert(
      'Vider la queue d\'événements',
      'Cette action supprimera tous les événements en attente. Êtes-vous sûr ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: async () => {
          try {
            await eventQueue.clear('CLEAR_ALL_EVENTS');
            Alert.alert('Succès', 'Queue vidée avec succès');
            loadStats();
          } catch (error) {
            Alert.alert('Erreur', 'Impossible de vider la queue');
          }
        }}
      ]
    );
  }, [loadStats]);

  const handleRefreshSearchIndex = useCallback(async () => {
    try {
      await offlineSearchService.refreshSearchIndex();
      Alert.alert('Succès', 'Index de recherche mis à jour');
      loadStats();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour l\'index');
    }
  }, [loadStats]);

  const handleCleanupData = useCallback(() => {
    Alert.alert(
      'Nettoyer les données',
      'Supprimer les données synchronisées anciennes (>7 jours) ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Nettoyer', onPress: async () => {
          try {
            const [queueCleaned, mappingsCleaned, imagesCleaned] = await Promise.all([
              eventQueue.cleanup(7),
              offlineIdManager.cleanupOldMappings(7),
              offlineImageService.cleanupUploadedImages(7)
            ]);
            
            Alert.alert(
              'Nettoyage terminé',
              `${queueCleaned + mappingsCleaned + imagesCleaned} éléments supprimés`
            );
            loadStats();
          } catch (error) {
            Alert.alert('Erreur', 'Erreur lors du nettoyage');
          }
        }}
      ]
    );
  }, [loadStats]);

  const handleExportLogs = useCallback(async () => {
    if (!stats) return;

    const debugInfo = {
      timestamp: new Date().toISOString(),
      stats,
      recentEvents: recentEvents.slice(0, 5),
      network: networkContext,
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };

    const logText = JSON.stringify(debugInfo, null, 2);

    try {
      await Share.share({
        message: logText,
        title: 'Debug Logs - Mode Offline'
      });
    } catch (error) {
      console.error('Erreur export logs:', error);
    }
  }, [stats, recentEvents, networkContext]);

  const handleForceSync = useCallback(async () => {
    if (!networkContext.isOnline) {
      Alert.alert('Erreur', 'Impossible de synchroniser en mode offline');
      return;
    }

    Alert.alert(
      'Forcer la synchronisation',
      'Déclencher une synchronisation complète maintenant ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Synchroniser', onPress: async () => {
          try {
            const result = await syncService.startSync({
              batchSize: 50,
              maxRetries: 3,
              timeoutMs: 30000
            });
            
            Alert.alert(
              'Synchronisation terminée',
              `${result.syncedEvents} événements synchronisés, ${result.failedEvents} échecs`
            );
            loadStats();
          } catch (error) {
            Alert.alert('Erreur', 'Erreur lors de la synchronisation');
          }
        }}
      ]
    );
  }, [networkContext.isOnline, loadStats]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (!stats) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loading}>
          <Text>Chargement des statistiques...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    header: {
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.onSurface,
      marginBottom: 8,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
    },
    section: {
      margin: 16,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.onSurface,
      marginBottom: 12,
    },
    card: {
      marginBottom: 12,
    },
    cardContent: {
      padding: 16,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    statLabel: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      flex: 1,
    },
    statValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.onSurface,
    },
    statusChip: {
      marginRight: 8,
      marginBottom: 8,
    },
    actionButton: {
      marginVertical: 4,
    },
    debugToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    debugToggleLabel: {
      fontSize: 16,
      color: theme.colors.onSurface,
      flex: 1,
    },
    warningCard: {
      backgroundColor: theme.colors.errorContainer,
      marginBottom: 12,
    },
    warningText: {
      color: theme.colors.onErrorContainer,
      fontSize: 14,
      lineHeight: 20,
    },
    progressContainer: {
      marginVertical: 8,
    },
    progressLabel: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
    },
    tableHeader: {
      backgroundColor: theme.colors.surfaceVariant,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Debug Mode Offline</Text>
        <Text style={styles.headerSubtitle}>
          Statistiques et outils de diagnostic
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* État du réseau */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>État du Réseau</Text>
          <Card style={styles.card}>
            <View style={styles.cardContent}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                <Chip
                  icon={stats.network.isOnline ? 'wifi' : 'wifi-off'}
                  style={[
                    styles.statusChip,
                    { backgroundColor: stats.network.isOnline ? theme.colors.primaryContainer : theme.colors.errorContainer }
                  ]}
                  textStyle={{ color: stats.network.isOnline ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer }}
                >
                  {stats.network.isOnline ? 'En ligne' : 'Hors ligne'}
                </Chip>
                <Chip
                  icon="web"
                  style={[styles.statusChip, { backgroundColor: theme.colors.surfaceVariant }]}
                >
                  {stats.network.type}
                </Chip>
                {forceOfflineMode && (
                  <Chip
                    icon="lock"
                    style={[styles.statusChip, { backgroundColor: theme.colors.errorContainer }]}
                    textStyle={{ color: theme.colors.onErrorContainer }}
                  >
                    Mode forcé
                  </Chip>
                )}
              </View>
              
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Internet accessible</Text>
                <Text style={styles.statValue}>
                  {stats.network.isInternetReachable ? 'Oui' : 'Non'}
                </Text>
              </View>
              
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Opérations en attente</Text>
                <Text style={styles.statValue}>{stats.network.pendingOperations}</Text>
              </View>
              
              {stats.network.lastSyncTime && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Dernière synchronisation</Text>
                  <Text style={styles.statValue}>
                    {format(stats.network.lastSyncTime, 'dd/MM HH:mm', { locale: fr })}
                  </Text>
                </View>
              )}

              <View style={styles.debugToggle}>
                <Text style={styles.debugToggleLabel}>Mode offline forcé</Text>
                <Switch
                  value={forceOfflineMode}
                  onValueChange={handleToggleForceOffline}
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Base de données locale */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Base de Données Locale</Text>
          <Card style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Articles</Text>
                <Text style={styles.statValue}>{stats.localDatabase.totalItems}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Containers</Text>
                <Text style={styles.statValue}>{stats.localDatabase.totalContainers}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Catégories</Text>
                <Text style={styles.statValue}>{stats.localDatabase.totalCategories}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Images</Text>
                <Text style={styles.statValue}>{stats.localDatabase.totalImages}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Taille des images</Text>
                <Text style={styles.statValue}>{stats.localDatabase.databaseSize}</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Queue d'événements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Queue d'Événements</Text>
          <Card style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total</Text>
                <Text style={styles.statValue}>{stats.eventQueue.total}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>En attente</Text>
                <Text style={styles.statValue}>{stats.eventQueue.pending}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Synchronisés</Text>
                <Text style={styles.statValue}>{stats.eventQueue.synced}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Échecs</Text>
                <Text style={styles.statValue}>{stats.eventQueue.failed}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Conflits</Text>
                <Text style={styles.statValue}>{stats.eventQueue.conflicts}</Text>
              </View>

              {stats.eventQueue.pending > 0 && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressLabel}>
                    Progression de synchronisation
                  </Text>
                  <ProgressBar
                    progress={stats.eventQueue.synced / stats.eventQueue.total}
                    color={theme.colors.primary}
                  />
                </View>
              )}

              <Button
                mode="outlined"
                onPress={handleClearEventQueue}
                style={styles.actionButton}
                icon="delete-sweep"
                disabled={stats.eventQueue.total === 0}
              >
                Vider la queue
              </Button>
            </View>
          </Card>
        </View>

        {/* Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gestion des Images</Text>
          <Card style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total</Text>
                <Text style={styles.statValue}>{stats.images.totalImages}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>En attente d'upload</Text>
                <Text style={styles.statValue}>{stats.images.pendingUploads}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Échecs d'upload</Text>
                <Text style={styles.statValue}>{stats.images.failedUploads}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Uploadées</Text>
                <Text style={styles.statValue}>{stats.images.uploadedImages}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Taille totale</Text>
                <Text style={styles.statValue}>{formatBytes(stats.images.totalSizeBytes)}</Text>
              </View>

              {stats.images.failedUploads > 0 && (
                <Button
                  mode="outlined"
                  onPress={() => offlineImageService.retryFailedUploads()}
                  style={styles.actionButton}
                  icon="refresh"
                >
                  Relancer les uploads échoués
                </Button>
              )}
            </View>
          </Card>
        </View>

        {/* Index de recherche */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Index de Recherche</Text>
          <Card style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Dernière mise à jour</Text>
                <Text style={styles.statValue}>
                  {format(stats.search.indexLastUpdated, 'dd/MM HH:mm', { locale: fr })}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Articles indexés</Text>
                <Text style={styles.statValue}>{stats.search.indexedItems}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Containers indexés</Text>
                <Text style={styles.statValue}>{stats.search.indexedContainers}</Text>
              </View>

              <Button
                mode="outlined"
                onPress={handleRefreshSearchIndex}
                style={styles.actionButton}
                icon="refresh"
              >
                Reconstruire l'index
              </Button>
            </View>
          </Card>
        </View>

        {/* Actions de maintenance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions de Maintenance</Text>
          <Card style={styles.card}>
            <View style={styles.cardContent}>
              <Button
                mode="contained"
                onPress={handleForceSync}
                style={styles.actionButton}
                icon="sync"
                disabled={!stats.network.isOnline}
              >
                Forcer la synchronisation
              </Button>
              
              <Button
                mode="outlined"
                onPress={handleCleanupData}
                style={styles.actionButton}
                icon="broom"
              >
                Nettoyer les données anciennes
              </Button>
              
              <Button
                mode="outlined"
                onPress={handleExportLogs}
                style={styles.actionButton}
                icon="export"
              >
                Exporter les logs de debug
              </Button>
            </View>
          </Card>
        </View>

        {/* Événements récents */}
        {recentEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Événements Récents</Text>
            <Card style={styles.card}>
              <DataTable>
                <DataTable.Header style={styles.tableHeader}>
                  <DataTable.Title>Type</DataTable.Title>
                  <DataTable.Title>Entité</DataTable.Title>
                  <DataTable.Title>Statut</DataTable.Title>
                  <DataTable.Title>Date</DataTable.Title>
                </DataTable.Header>
                
                {recentEvents.slice(0, 5).map((event, index) => (
                  <DataTable.Row key={index}>
                    <DataTable.Cell>{event.type}</DataTable.Cell>
                    <DataTable.Cell>{event.entity}</DataTable.Cell>
                    <DataTable.Cell>
                      <Chip
                        compact
                        style={{
                          backgroundColor: event.status === 'synced' 
                            ? theme.colors.primaryContainer 
                            : event.status === 'failed'
                            ? theme.colors.errorContainer
                            : theme.colors.surfaceVariant
                        }}
                      >
                        {event.status}
                      </Chip>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {format(new Date(event.timestamp), 'HH:mm', { locale: fr })}
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </Card>
          </View>
        )}

        {/* Warning si mode offline forcé */}
        {forceOfflineMode && (
          <View style={styles.section}>
            <Card style={styles.warningCard}>
              <View style={styles.cardContent}>
                <Text style={styles.warningText}>
                  ⚠️ Mode offline forcé activé. L'application utilisera uniquement 
                  les données locales même si une connexion internet est disponible.
                </Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default OfflineDebugScreen;