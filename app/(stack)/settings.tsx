import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, useColorScheme } from 'react-native';
import { Modal, Portal, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

import { Icon, CommonHeader } from '../../src/components';
import ThemeToggle from '../../src/components/ThemeToggle';
import { useAuth } from '../../src/contexts/AuthContext';
import { useNetwork } from '../../src/contexts/NetworkContext';
import { useUnresolvedConflictsCount } from '../../src/hooks/useConflicts';
import { useTestMode } from '../../src/hooks/useTestMode';
import { selectAllCategories } from '../../src/store/categorySlice';
import { useAppTheme, ThemeMode } from '../../src/contexts/ThemeContext';
import { offlinePreparationService, DownloadProgress, resetDownloadFlag } from '../../src/services/OfflinePreparationService';
import { useUserPermissions } from '../../src/hooks/useUserPermissions';
import * as Sentry from '@sentry/react-native';

const SettingsScreen = () => {
  const router = useRouter();
  const { activeTheme, themeMode, setThemeMode } = useAppTheme();
  const { isOnline } = useNetwork();
  const { count: conflictsCount } = useUnresolvedConflictsCount();
  const { isTestModeEnabled, cleanupTestData, testService } = useTestMode();
  const systemScheme = useColorScheme();
  const isSystemDark = systemScheme === 'dark';
  const categories = useSelector(selectAllCategories);
  const { signOut } = useAuth();
  const userPermissions = useUserPermissions();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCreatingTestData, setIsCreatingTestData] = useState(false);
  const [isDownloadingOfflineData, setIsDownloadingOfflineData] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showOfflineInfoModal, setShowOfflineInfoModal] = useState(false);
  const [offlineStats, setOfflineStats] = useState<{
    itemsCount: number;
    categoriesCount: number;
    containersCount: number;
    offlineEventsCount: number;
    imagesCount: number;
    estimatedSize: string;
  } | null>(null);

  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Settings');

  // Charger les stats offline au montage
  useEffect(() => {
    const loadOfflineStats = async () => {
      try {
        const stats = await offlinePreparationService.getOfflineStorageStats();
        console.log('[Settings] Stats offline chargées:', stats);
        setOfflineStats(stats);
      } catch (error) {
        console.error('Erreur chargement stats offline:', error);
      }
    };
    loadOfflineStats();
  }, []);

  // Debug logs
  useEffect(() => {
    console.log('Settings - isTestModeEnabled:', isTestModeEnabled);
  }, [isTestModeEnabled]);

  // Empêcher la navigation pendant le téléchargement
  useEffect(() => {
    if (isDownloadingOfflineData) {
      console.log('[Settings] Téléchargement en cours, empêcher navigation');
      // Note: Ici on pourrait bloquer la navigation si nécessaire
    }
  }, [isDownloadingOfflineData]);

  useEffect(() => {
    if (!isLoggingOut) return;
    
    const timer = setTimeout(() => {
      router.replace('/(auth)/login');
      setIsLoggingOut(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isLoggingOut, router]);

  const handleLogout = useCallback(async () => {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User initiated logout',
        level: 'info'
      });
      
      setIsLoggingOut(true);
      await signOut();
    } catch (error) {
      setIsLoggingOut(false);
      console.error('Erreur lors de la déconnexion:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la déconnexion. Veuillez réessayer.'
      );
      Sentry.captureException(error, {
        tags: { action: 'logout' }
      });
    }
  }, [signOut, router]);

  const handleCreateTestConflicts = useCallback(async () => {
    if (!isTestModeEnabled) {
      Alert.alert('Erreur', 'Le mode test doit être activé');
      return;
    }

    setIsCreatingTestData(true);
    try {
      await testService.createAllTestScenarios();
      
      Alert.alert(
        'Conflits de test créés',
        'Tous les scénarios de test ont été créés. Vous pouvez maintenant les voir dans la section "Résoudre les conflits".',
        [
          { text: 'OK' },
          { 
            text: 'Voir les conflits', 
            onPress: () => router.push('/conflicts')
          }
        ]
      );
    } catch (error) {
      console.error('Erreur création test:', error);
      Alert.alert('Erreur', 'Impossible de créer les conflits de test');
    } finally {
      setIsCreatingTestData(false);
    }
  }, [isTestModeEnabled, testService, router]);

  const handleCleanupTestData = useCallback(async () => {
    try {
      console.log('Nettoyage des données de test...');
      await cleanupTestData();
      console.log('Données de test nettoyées avec succès');
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
    }
  }, [cleanupTestData]);

  const handleDownloadOfflineData = useCallback(async () => {
    console.log('[Settings] handleDownloadOfflineData appelé');
    console.log('[Settings] isOnline:', isOnline);
    
    if (!isOnline) {
      console.log('[Settings] Pas de connexion, affichage alert erreur');
      Alert.alert('Erreur', 'Une connexion internet est requise pour télécharger les données');
      return;
    }

    console.log('[Settings] Affichage du modal de confirmation');
    setShowDownloadModal(true);
  }, [isOnline]);

  const executeDownload = useCallback(async () => {
    console.log('[Settings] Début du téléchargement offline');
    setShowDownloadModal(false);
    setIsDownloadingOfflineData(true);
    setDownloadProgress(null);
    
    try {
      console.log('[Settings] Appel de downloadEverything');
      await offlinePreparationService.downloadEverything((progress) => {
        console.log('[Settings] Progrès reçu:', progress);
        setDownloadProgress(progress);
      });
      
      // Recharger les stats après téléchargement
      const stats = await offlinePreparationService.getOfflineStorageStats();
      setOfflineStats(stats);
      console.log('[Settings] Stats rechargées:', stats);
      
      console.log('[Settings] Téléchargement terminé avec succès');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('[Settings] Erreur téléchargement offline:', error);
      Alert.alert(
        'Erreur de téléchargement', 
        `Impossible de télécharger toutes les données: ${error instanceof Error ? error.message : 'Erreur inconnue'}. Vérifiez votre connexion et réessayez.`
      );
    } finally {
      console.log('[Settings] Fin du téléchargement, nettoyage des états');
      setIsDownloadingOfflineData(false);
      setDownloadProgress(null);
      
      // Petit délai pour s'assurer que tous les états sont synchronisés
      setTimeout(() => {
        console.log('[Settings] Vérification finale - isDownloadingOfflineData devrait être false');
      }, 100);
    }
  }, []);

  const handleResetDownloadFlag = useCallback(() => {
    console.log('[Settings] Reset manuel du flag de téléchargement');
    resetDownloadFlag();
    setIsDownloadingOfflineData(false);
    setDownloadProgress(null);
    Alert.alert('Reset effectué', 'Le flag de téléchargement a été réinitialisé.');
  }, []);

  const handleClearOfflineData = useCallback(async () => {
    console.log('[Settings] handleClearOfflineData appelé');
    setShowClearDataModal(true);
  }, []);

  const executeClearData = useCallback(async () => {
    setShowClearDataModal(false);
    try {
      console.log('[Settings] Début de la suppression des données offline');
      await offlinePreparationService.clearAllOfflineData();
      console.log('[Settings] Suppression terminée, rechargement des stats');
      
      // Recharger les stats après nettoyage
      const stats = await offlinePreparationService.getOfflineStorageStats();
      console.log('[Settings] Nouvelles stats après nettoyage:', stats);
      setOfflineStats(stats);
      
      Alert.alert('Terminé', 'Toutes les données hors ligne ont été supprimées.');
    } catch (error) {
      console.error('[Settings] Erreur nettoyage offline:', error);
      Alert.alert('Erreur', 'Impossible de supprimer les données hors ligne.');
    }
  }, []);

  if (!categories) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ✅ COMMONHEADER - Header standardisé */}
      <CommonHeader 
        title="Paramètres"
        onBackPress={() => router.replace('/(tabs)/stock')}
      />

      <View style={{ 
        flex: 1
      }}>
        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Thème</Text>
            <ThemeToggle />
          </View>


      {/* Offline Data Preparation Section */}
      <View style={styles.sectionContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Préparation Mode Hors Ligne</Text>
          <TouchableOpacity 
            style={{ marginLeft: 8, padding: 4 }}
            onPress={() => setShowOfflineInfoModal(true)}
          >
            <Icon name="info" size={16} color={activeTheme.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Stats section */}
        {offlineStats && (
          <View style={[styles.menuItem, { borderTopColor: activeTheme.border, borderTopWidth: 1, backgroundColor: activeTheme.surface }]}>
            <Icon name="storage" size={24} color={activeTheme.primary} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.menuText}>Données locales</Text>
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 4, fontSize: 12 }]}>
                {offlineStats.itemsCount} articles • {offlineStats.categoriesCount} catégories • {offlineStats.containersCount} containers
              </Text>
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 2, fontSize: 11 }]}>
                {offlineStats.imagesCount} images • Taille: {offlineStats.estimatedSize}
              </Text>
            </View>
          </View>
        )}

        {/* Download everything button */}
        <TouchableOpacity 
          style={[
            styles.menuItem, 
            { borderTopColor: activeTheme.border, borderTopWidth: 1 },
            isDownloadingOfflineData && { backgroundColor: activeTheme.primaryContainer + '20' }
          ]}
          onPress={() => {
            console.log('[Settings] Bouton télécharger cliqué');
            handleDownloadOfflineData();
          }}
          disabled={isDownloadingOfflineData || !isOnline}
        >
          <Icon 
            name={isDownloadingOfflineData ? "downloading" : "cloud_download"} 
            size={24} 
            color={isOnline ? activeTheme.primary : activeTheme.text.disabled} 
          />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={[styles.menuText, { color: isOnline ? activeTheme.text.primary : activeTheme.text.disabled }]}>
              {isDownloadingOfflineData ? 'Téléchargement en cours...' : 'Tout télécharger'}
            </Text>
            <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 4, fontSize: 12, color: isOnline ? activeTheme.text.secondary : activeTheme.text.disabled }]}>
              {isDownloadingOfflineData 
                ? (downloadProgress ? `${downloadProgress.message} (${downloadProgress.current}%)` : 'Initialisation...')
                : isOnline 
                  ? 'Télécharger tous les articles, catégories et images'
                  : 'Connexion internet requise'
              }
            </Text>
          </View>
          {isDownloadingOfflineData && (
            <ActivityIndicator size="small" color={activeTheme.primary} style={{ marginRight: 8 }} />
          )}
          {!isDownloadingOfflineData && (
            <Icon name="chevron_right" size={24} color={isOnline ? activeTheme.text.secondary : activeTheme.text.disabled} />
          )}
        </TouchableOpacity>

        {/* Clear offline data button - Afficher si n'importe quel type de données existe */}
        {offlineStats && (
          offlineStats.itemsCount > 0 || 
          offlineStats.categoriesCount > 0 || 
          offlineStats.containersCount > 0 || 
          offlineStats.imagesCount > 0 || 
          offlineStats.offlineEventsCount > 0
        ) && (
          <TouchableOpacity 
            style={[styles.menuItem, { borderTopColor: activeTheme.border, borderTopWidth: 1 }]}
            onPress={() => {
              console.log('[Settings] Bouton Effacer données locales cliqué');
              console.log('[Settings] Stats actuelles:', offlineStats);
              handleClearOfflineData();
            }}
          >
            <Icon name="delete_sweep" size={24} color={activeTheme.error} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[styles.menuText, { color: activeTheme.error }]}>Effacer les données locales</Text>
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 4, fontSize: 12 }]}>
                Libérer l'espace de stockage local
              </Text>
            </View>
            <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
          </TouchableOpacity>
        )}

        {/* Reset download flag button - only show if downloading is stuck */}
        {isDownloadingOfflineData && (
          <TouchableOpacity 
            style={[styles.menuItem, { borderTopColor: activeTheme.warning, borderTopWidth: 1, backgroundColor: activeTheme.warning + '10' }]}
            onPress={handleResetDownloadFlag}
          >
            <Icon name="refresh" size={24} color={activeTheme.warning} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[styles.menuText, { color: activeTheme.warning }]}>Reset téléchargement bloqué</Text>
              <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 4, fontSize: 12, color: activeTheme.warning }]}>
                À utiliser si le téléchargement semble bloqué
              </Text>
            </View>
            <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Conflict Resolution Section - Only show if there are conflicts */}
      {conflictsCount > 0 && (
        <TouchableOpacity 
          style={[styles.menuItem, { borderTopColor: activeTheme.border, borderTopWidth: 1, backgroundColor: activeTheme.warning + '10' }]}
          onPress={() => router.push('/conflicts')}
        >
          <Icon name="warning" size={24} color={activeTheme.warning} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.menuText}>Résoudre les conflits</Text>
            <Text style={[styles.sectionTitle, { marginBottom: 0, marginTop: 4, fontSize: 12, color: activeTheme.warning }]}>
              {conflictsCount} conflit{conflictsCount > 1 ? 's' : ''} nécessitent votre attention
            </Text>
          </View>
          <View style={{ backgroundColor: activeTheme.warning, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 }}>
            <Text style={{ color: activeTheme.text.onPrimary, fontSize: 12, fontWeight: 'bold' }}>
              {conflictsCount}
            </Text>
          </View>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}


      {/* Gérer les containers - Permission containers.update */}
      {(userPermissions.canCreateContainers || userPermissions.canUpdateContainers || userPermissions.canDeleteContainers) && (
        <TouchableOpacity 
          style={[styles.menuItem, { borderTopColor: activeTheme.border, borderTopWidth: 1 }]}
          onPress={() => router.push('/container')}
        >
          <Icon name="inbox" size={24} color={activeTheme.primary} />
          <Text style={styles.menuText}>Gérer les containers</Text>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}

      {/* Gérer les catégories - Permission categories.update */}
      {(userPermissions.canCreateCategories || userPermissions.canUpdateCategories || userPermissions.canDeleteCategories) && (
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/category')}
        >
          <Icon name="category" size={24} color={activeTheme.primary} />
          <Text style={styles.menuText}>Gérer les catégories</Text>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}

      {/* Gérer les emplacements - Permission features.locations */}
      {userPermissions.canViewLocations && (
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/location')}
        >
          <Icon name="location_on" size={24} color={activeTheme.primary} />
          <Text style={styles.menuText}>Gérer les emplacements</Text>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}

      {/* Gérer les sources - Permission features.sources */}
      {userPermissions.canViewSources && (
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/sources')}
        >
          <Icon name="store" size={24} color={activeTheme.primary} />
          <Text style={styles.menuText}>Gérer les sources</Text>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}

      {/* Générer des étiquettes - Permission features.labels */}
      {userPermissions.canViewLabels && (
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/labels')}
        >
          <Icon name="label" size={24} color={activeTheme.primary} />
          <Text style={styles.menuText}>Générer des étiquettes</Text>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}

      {/* Facture multi-articles - Permission features.invoices */}
      {userPermissions.canViewInvoices && (
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/multi-receipt')}
        >
          <Icon name="receipt" size={24} color={activeTheme.primary} />
          <Text style={styles.menuText}>Facture multi-articles</Text>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}

      {/* Journal d'Audit - Permission features.auditLog */}
      {userPermissions.canViewAuditLog && (
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/(stack)/audit-log')}
        >
          <Icon name="history" size={24} color={activeTheme.primary} />
          <Text style={styles.menuText}>Journal d'Audit</Text>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}
      
      {/* Menu Administration - Permission settings.canManageUsers */}
      {userPermissions.canManageUsers && (
        <TouchableOpacity 
          style={[styles.menuItem, { borderTopColor: activeTheme.border, borderTopWidth: 1, marginTop: 16 }]}
          onPress={() => router.push('/(stack)/admin/permissions')}
        >
          <Icon name="admin_panel_settings" size={24} color={activeTheme.secondary} />
          <Text style={styles.menuText}>Gestion des permissions</Text>
          <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => router.push('/(stack)/settings')}
      >
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, styles.dangerItem]}
        onPress={handleLogout}
      >
        <Icon name="logout" size={24} color={activeTheme.danger.main} />
        <Text style={[styles.menuText, styles.dangerText]}>Se déconnecter</Text>
        <Icon name="chevron_right" size={24} color={activeTheme.text.secondary} />
      </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Modal de confirmation pour le téléchargement */}
      <Portal>
        <Modal
          visible={showDownloadModal}
          onDismiss={() => setShowDownloadModal(false)}
          contentContainerStyle={{
            backgroundColor: activeTheme.surface,
            margin: 20,
            padding: 20,
            borderRadius: 8,
          }}
        >
          <Text style={[styles.menuText, { fontSize: 18, fontWeight: 'bold', marginBottom: 16 }]}>
            Télécharger toutes les données
          </Text>
          <Text style={[styles.sectionTitle, { marginBottom: 20, fontSize: 14 }]}>
            Cette opération va télécharger tous les articles, catégories, containers et images critiques pour une utilisation hors ligne. 
            Cela peut prendre quelques minutes et utiliser beaucoup de données mobiles.
          </Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
            <Button 
              mode="outlined" 
              onPress={() => setShowDownloadModal(false)}
              textColor={activeTheme.text.secondary}
            >
              Annuler
            </Button>
            <Button 
              mode="contained" 
              onPress={executeDownload}
              buttonColor={activeTheme.primary}
              textColor={activeTheme.text.inverse}
            >
              Télécharger
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Modal de succès après téléchargement */}
      <Portal>
        <Modal
          visible={showSuccessModal}
          onDismiss={() => setShowSuccessModal(false)}
          contentContainerStyle={{
            backgroundColor: activeTheme.surface,
            margin: 20,
            padding: 20,
            borderRadius: 8,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Icon name="check_circle" size={48} color={activeTheme.primary} />
          </View>
          
          <Text style={[styles.menuText, { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }]}>
            Téléchargement terminé !
          </Text>
          
          <Text style={[styles.sectionTitle, { marginBottom: 20, fontSize: 14, textAlign: 'center' }]}>
            Toutes les données ont été téléchargées avec succès. L'application est maintenant prête pour une utilisation hors ligne complète.
          </Text>

          {offlineStats && (
            <View style={{ backgroundColor: activeTheme.primaryContainer + '20', padding: 12, borderRadius: 8, marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { fontSize: 12, textAlign: 'center' }]}>
                {offlineStats.itemsCount} articles • {offlineStats.categoriesCount} catégories • {offlineStats.containersCount} containers • {offlineStats.imagesCount} images
              </Text>
              <Text style={[styles.sectionTitle, { fontSize: 11, textAlign: 'center', marginTop: 4 }]}>
                Taille totale: {offlineStats.estimatedSize}
              </Text>
            </View>
          )}
          
          <View style={{ alignItems: 'center' }}>
            <Button 
              mode="contained" 
              onPress={() => setShowSuccessModal(false)}
              buttonColor={activeTheme.primary}
              textColor={activeTheme.text.inverse}
            >
              Parfait !
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Modal de confirmation pour effacer les données locales */}
      <Portal>
        <Modal
          visible={showClearDataModal}
          onDismiss={() => setShowClearDataModal(false)}
          contentContainerStyle={{
            backgroundColor: activeTheme.surface,
            margin: 20,
            padding: 20,
            borderRadius: 8,
          }}
        >
          <Text style={[styles.menuText, { fontSize: 18, fontWeight: 'bold', marginBottom: 16 }]}>
            Effacer les données hors ligne
          </Text>
          <Text style={[styles.sectionTitle, { marginBottom: 20, fontSize: 14 }]}>
            Cette action va supprimer toutes les données téléchargées pour le mode hors ligne. Vous devrez les télécharger à nouveau pour utiliser l'app hors ligne.
          </Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
            <Button 
              mode="outlined" 
              onPress={() => setShowClearDataModal(false)}
              textColor={activeTheme.text.secondary}
            >
              Annuler
            </Button>
            <Button 
              mode="contained" 
              onPress={executeClearData}
              buttonColor={activeTheme.error}
              textColor={activeTheme.text.inverse}
            >
              Effacer
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Modal d'information sur le mode hors ligne */}
      <Portal>
        <Modal
          visible={showOfflineInfoModal}
          onDismiss={() => setShowOfflineInfoModal(false)}
          contentContainerStyle={{
            backgroundColor: activeTheme.surface,
            margin: 20,
            padding: 20,
            borderRadius: 8,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Icon name="wifi_off" size={48} color={activeTheme.primary} />
          </View>
          
          <Text style={[styles.menuText, { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }]}>
            Mode Hors Ligne
          </Text>
          
          <Text style={[styles.sectionTitle, { marginBottom: 16, fontSize: 16, lineHeight: 24 }]}>
            Le mode hors ligne vous permet d'utiliser l'application sans connexion internet.
          </Text>

          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
              <Icon name="download" size={20} color={activeTheme.primary} style={{ marginRight: 12, marginTop: 2 }} />
              <Text style={[styles.sectionTitle, { flex: 1, fontSize: 14 }]}>
                <Text style={{ fontWeight: 'bold' }}>Téléchargez</Text> toutes vos données en avance
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
              <Icon name="work" size={20} color={activeTheme.primary} style={{ marginRight: 12, marginTop: 2 }} />
              <Text style={[styles.sectionTitle, { flex: 1, fontSize: 14 }]}>
                <Text style={{ fontWeight: 'bold' }}>Travaillez</Text> normalement sans internet
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
              <Icon name="sync" size={20} color={activeTheme.primary} style={{ marginRight: 12, marginTop: 2 }} />
              <Text style={[styles.sectionTitle, { flex: 1, fontSize: 14 }]}>
                <Text style={{ fontWeight: 'bold' }}>Synchronisation</Text> automatique au retour en ligne
              </Text>
            </View>
          </View>

          <View style={{ backgroundColor: activeTheme.warning + '20', padding: 12, borderRadius: 8, marginBottom: 20, flexDirection: 'row', alignItems: 'flex-start' }}>
            <Icon name="warning" size={20} color={activeTheme.warning} style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { fontSize: 13, fontWeight: 'bold', color: activeTheme.warning, marginBottom: 4 }]}>
                Important
              </Text>
              <Text style={[styles.sectionTitle, { fontSize: 13, color: activeTheme.warning }]}>
                Téléchargez vos données avant de partir dans une zone sans connexion.
              </Text>
            </View>
          </View>
          
          <View style={{ alignItems: 'center' }}>
            <Button 
              mode="contained" 
              onPress={() => setShowOfflineInfoModal(false)}
              buttonColor={activeTheme.primary}
              textColor={activeTheme.text.inverse}
            >
              Compris
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

export default SettingsScreen;