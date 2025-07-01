import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import {
  Card,
  Switch,
  Button,
  Chip,
  Divider,
  Slider,
  Dialog,
  Portal
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useTheme';
import { useNetwork } from '../contexts/NetworkContext';
import { conflictNotificationService } from '../services/ConflictNotificationService';
import { syncService } from '../services/SyncService';
import { OfflineEventQueue } from '../services/OfflineEventQueue';

interface OfflineSettings {
  // Mode offline forcé
  forceOfflineMode: boolean;
  
  // Notifications
  enableConflictNotifications: boolean;
  enableSyncNotifications: boolean;
  conflictCheckInterval: number; // en minutes
  maxNotificationsPerHour: number;
  
  // Synchronisation
  autoSyncEnabled: boolean;
  syncInterval: number; // en minutes
  syncOnlyOnWifi: boolean;
  batchSize: number;
  maxRetries: number;
  
  // Stockage
  autoCleanupEnabled: boolean;
  cleanupInterval: number; // en jours
  maxStorageSize: number; // en MB
  compressImages: boolean;
  
  // Performance
  enableVirtualization: boolean;
  cacheSize: number; // en éléments
  preloadData: boolean;
  
  // Debug
  enableDebugLogs: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

const DEFAULT_SETTINGS: OfflineSettings = {
  forceOfflineMode: false,
  enableConflictNotifications: true,
  enableSyncNotifications: true,
  conflictCheckInterval: 5,
  maxNotificationsPerHour: 10,
  autoSyncEnabled: true,
  syncInterval: 15,
  syncOnlyOnWifi: false,
  batchSize: 50,
  maxRetries: 3,
  autoCleanupEnabled: true,
  cleanupInterval: 30,
  maxStorageSize: 100,
  compressImages: true,
  enableVirtualization: true,
  cacheSize: 1000,
  preloadData: true,
  enableDebugLogs: false,
  logLevel: 'warn'
};

export const OfflineSettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<OfflineSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { theme } = useAppTheme();
  const networkContext = useNetwork();

  /**
   * Charger les paramètres depuis le stockage local
   */
  const loadSettings = useCallback(async () => {
    try {
      const savedSettings = localStorage.getItem('offline_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Erreur chargement paramètres offline:', error);
    }
  }, []);

  /**
   * Sauvegarder les paramètres
   */
  const saveSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      localStorage.setItem('offline_settings', JSON.stringify(settings));
      
      // Appliquer les paramètres aux services
      await applySettings(settings);
      
      setHasUnsavedChanges(false);
      Alert.alert('Succès', 'Paramètres sauvegardés');
    } catch (error) {
      console.error('Erreur sauvegarde paramètres:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les paramètres');
    } finally {
      setIsLoading(false);
    }
  }, [settings, applySettings]);

  /**
   * Appliquer les paramètres aux services
   */
  const applySettings = useCallback(async (newSettings: OfflineSettings) => {
    // Paramètres de mode offline forcé
    localStorage.setItem('force_offline_mode', newSettings.forceOfflineMode.toString());

    // Paramètres de notification
    conflictNotificationService.updateOptions({
      enableToasts: newSettings.enableConflictNotifications,
      autoDetectionInterval: newSettings.conflictCheckInterval * 60 * 1000, // convertir en ms
      maxToastsPerSession: newSettings.maxNotificationsPerHour
    });

    // Paramètres de synchronisation
    if (newSettings.autoSyncEnabled) {
      // Configurer la synchronisation automatique
      // TODO: Implémenter un service de synchronisation automatique
    }

    // Paramètres de nettoyage automatique
    localStorage.setItem('offline_auto_cleanup', newSettings.autoCleanupEnabled.toString());
    localStorage.setItem('offline_cleanup_interval', newSettings.cleanupInterval.toString());

    // Paramètres de stockage
    localStorage.setItem('offline_max_storage', (newSettings.maxStorageSize * 1024 * 1024).toString());
    
    console.log('[OfflineSettings] Paramètres appliqués:', newSettings);
  }, []);

  /**
   * Mettre à jour un paramètre
   */
  const updateSetting = useCallback((key: keyof OfflineSettings, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  }, []);

  /**
   * Réinitialiser aux paramètres par défaut
   */
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setHasUnsavedChanges(true);
    setShowResetDialog(false);
  }, []);

  /**
   * Vider le cache offline
   */
  const clearOfflineCache = useCallback(() => {
    Alert.alert(
      'Vider le cache offline',
      'Cette action supprimera toutes les données offline locales. Êtes-vous sûr ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: async () => {
          try {
            setIsLoading(true);
            
            // Vider la queue d'événements
            const eventQueue = OfflineEventQueue.getInstance();
            await eventQueue.clear('CLEAR_ALL_EVENTS');
            
            // TODO: Vider les autres caches
            
            Alert.alert('Succès', 'Cache offline vidé');
          } catch {
            Alert.alert('Erreur', 'Impossible de vider le cache');
          } finally {
            setIsLoading(false);
          }
        }}
      ]
    );
  }, []);

  /**
   * Forcer une synchronisation
   */
  const forceSyncNow = useCallback(async () => {
    if (!networkContext.isOnline) {
      Alert.alert('Erreur', 'Impossible de synchroniser en mode offline');
      return;
    }

    try {
      setIsLoading(true);
      const result = await syncService.startSync({
        batchSize: settings.batchSize,
        maxRetries: settings.maxRetries,
        timeoutMs: 30000
      });
      
      Alert.alert(
        'Synchronisation terminée',
        `${result.syncedEvents} événements synchronisés, ${result.failedEvents} échecs`
      );
    } catch {
      Alert.alert('Erreur', 'Erreur lors de la synchronisation');
    } finally {
      setIsLoading(false);
    }
  }, [networkContext.isOnline, settings]);

  // Charger les paramètres au montage
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
    content: {
      flex: 1,
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
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    settingLabel: {
      fontSize: 16,
      color: theme.colors.onSurface,
      flex: 1,
    },
    settingDescription: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    sliderContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    sliderLabel: {
      fontSize: 14,
      color: theme.colors.onSurface,
      marginBottom: 8,
    },
    sliderValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      textAlign: 'center',
      marginBottom: 8,
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
    actionsCard: {
      marginBottom: 32,
    },
    actionButton: {
      marginVertical: 4,
    },
    saveButton: {
      margin: 16,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Paramètres Offline</Text>
        <Text style={styles.headerSubtitle}>
          Configuration du mode hors ligne et synchronisation
        </Text>
        {hasUnsavedChanges && (
          <Chip
            icon="circle"
            style={{ marginTop: 8, alignSelf: 'flex-start' }}
            textStyle={{ color: theme.colors.onPrimaryContainer }}
          >
            Modifications non sauvegardées
          </Chip>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mode offline forcé */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode Offline</Text>
          
          {settings.forceOfflineMode && (
            <Card style={styles.warningCard}>
              <View style={{ padding: 16 }}>
                <Text style={styles.warningText}>
                  ⚠️ Mode offline forcé activé. L'application utilisera uniquement 
                  les données locales même si une connexion internet est disponible.
                </Text>
              </View>
            </Card>
          )}

          <Card style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Forcer le mode offline</Text>
                <Text style={styles.settingDescription}>
                  Ignorer la connexion internet et utiliser uniquement les données locales
                </Text>
              </View>
              <Switch
                value={settings.forceOfflineMode}
                onValueChange={(value) => updateSetting('forceOfflineMode', value)}
              />
            </View>
          </Card>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Card style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Notifications de conflits</Text>
                <Text style={styles.settingDescription}>
                  Être alerté lors de conflits de synchronisation
                </Text>
              </View>
              <Switch
                value={settings.enableConflictNotifications}
                onValueChange={(value) => updateSetting('enableConflictNotifications', value)}
              />
            </View>

            <Divider />

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Notifications de synchronisation</Text>
                <Text style={styles.settingDescription}>
                  Être informé du succès/échec des synchronisations
                </Text>
              </View>
              <Switch
                value={settings.enableSyncNotifications}
                onValueChange={(value) => updateSetting('enableSyncNotifications', value)}
              />
            </View>

            <Divider />

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Intervalle de vérification (minutes)</Text>
              <Text style={styles.sliderValue}>{settings.conflictCheckInterval}</Text>
              <Slider
                style={{ height: 40 }}
                minimumValue={1}
                maximumValue={60}
                step={1}
                value={settings.conflictCheckInterval}
                onValueChange={(value) => updateSetting('conflictCheckInterval', Math.round(value))}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.outline}
                thumbTintColor={theme.colors.primary}
              />
            </View>
          </Card>
        </View>

        {/* Synchronisation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synchronisation</Text>
          <Card style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Synchronisation automatique</Text>
                <Text style={styles.settingDescription}>
                  Synchroniser automatiquement quand en ligne
                </Text>
              </View>
              <Switch
                value={settings.autoSyncEnabled}
                onValueChange={(value) => updateSetting('autoSyncEnabled', value)}
              />
            </View>

            <Divider />

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Uniquement en WiFi</Text>
                <Text style={styles.settingDescription}>
                  Synchroniser seulement avec une connexion WiFi
                </Text>
              </View>
              <Switch
                value={settings.syncOnlyOnWifi}
                onValueChange={(value) => updateSetting('syncOnlyOnWifi', value)}
              />
            </View>

            <Divider />

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Taille des lots de synchronisation</Text>
              <Text style={styles.sliderValue}>{settings.batchSize} éléments</Text>
              <Slider
                style={{ height: 40 }}
                minimumValue={10}
                maximumValue={200}
                step={10}
                value={settings.batchSize}
                onValueChange={(value) => updateSetting('batchSize', Math.round(value))}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.outline}
                thumbTintColor={theme.colors.primary}
              />
            </View>
          </Card>
        </View>

        {/* Stockage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stockage</Text>
          <Card style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Nettoyage automatique</Text>
                <Text style={styles.settingDescription}>
                  Supprimer automatiquement les données anciennes
                </Text>
              </View>
              <Switch
                value={settings.autoCleanupEnabled}
                onValueChange={(value) => updateSetting('autoCleanupEnabled', value)}
              />
            </View>

            <Divider />

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Compression des images</Text>
                <Text style={styles.settingDescription}>
                  Compresser les images pour économiser l'espace
                </Text>
              </View>
              <Switch
                value={settings.compressImages}
                onValueChange={(value) => updateSetting('compressImages', value)}
              />
            </View>

            <Divider />

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Limite de stockage</Text>
              <Text style={styles.sliderValue}>{settings.maxStorageSize} MB</Text>
              <Slider
                style={{ height: 40 }}
                minimumValue={50}
                maximumValue={500}
                step={25}
                value={settings.maxStorageSize}
                onValueChange={(value) => updateSetting('maxStorageSize', Math.round(value))}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.outline}
                thumbTintColor={theme.colors.primary}
              />
            </View>
          </Card>
        </View>

        {/* Actions de maintenance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <Card style={styles.actionsCard}>
            <View style={{ padding: 16 }}>
              <Button
                mode="contained"
                onPress={forceSyncNow}
                style={styles.actionButton}
                icon="sync"
                disabled={!networkContext.isOnline || isLoading}
                loading={isLoading}
              >
                Synchroniser maintenant
              </Button>
              
              <Button
                mode="outlined"
                onPress={clearOfflineCache}
                style={styles.actionButton}
                icon="delete-sweep"
                disabled={isLoading}
              >
                Vider le cache offline
              </Button>
              
              <Button
                mode="outlined"
                onPress={() => setShowResetDialog(true)}
                style={styles.actionButton}
                icon="restore"
                disabled={isLoading}
              >
                Réinitialiser aux valeurs par défaut
              </Button>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Bouton de sauvegarde */}
      <Button
        mode="contained"
        onPress={saveSettings}
        style={styles.saveButton}
        icon="content-save"
        disabled={!hasUnsavedChanges || isLoading}
        loading={isLoading}
      >
        {isLoading ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
      </Button>

      {/* Dialog de réinitialisation */}
      <Portal>
        <Dialog visible={showResetDialog} onDismiss={() => setShowResetDialog(false)}>
          <Dialog.Title>Réinitialiser les paramètres</Dialog.Title>
          <Dialog.Content>
            <Text>
              Cette action restaurera tous les paramètres offline aux valeurs par défaut. 
              Vos données ne seront pas supprimées.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowResetDialog(false)}>Annuler</Button>
            <Button onPress={resetToDefaults}>Réinitialiser</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default OfflineSettingsScreen;