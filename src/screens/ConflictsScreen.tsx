import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert
} from 'react-native';
import {
  Card,
  Button,
  Chip,
  FAB,
  Searchbar,
  Surface,
  IconButton,
  Badge,
  ActivityIndicator,
  Portal,
  Dialog
} from 'react-native-paper';
import { ConflictRecord, localDB } from '../database/localDatabase';
import { ConflictDetector } from '../services/ConflictDetector';
import { ConflictResolver } from '../services/ConflictResolver';
import { ConflictResolutionModal } from '../components/ConflictResolutionModal';
import { ConflictHelpModal } from '../components/ConflictHelpModal';
import { CommonHeader } from '../components';
import { useAppTheme } from '../hooks/useTheme';
import { useNetwork } from '../contexts/NetworkContext';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConflictItemProps {
  conflict: ConflictRecord;
  onPress: () => void;
  onResolveAuto: () => void;
}

const ConflictItem: React.FC<ConflictItemProps> = ({ conflict, onPress, onResolveAuto }) => {
  const { activeTheme } = useAppTheme();

  const getConflictTypeInfo = (type: string) => {
    const types: { [key: string]: { label: string; color: string; icon: string } } = {
      'UPDATE_UPDATE': { label: 'Modifications', color: activeTheme.warning, icon: 'pencil' },
      'DELETE_UPDATE': { label: 'Suppression/Modification', color: activeTheme.error, icon: 'delete' },
      'CREATE_CREATE': { label: 'Duplicata', color: activeTheme.primary, icon: 'content-copy' },
      'MOVE_MOVE': { label: 'Déplacement', color: activeTheme.secondary, icon: 'swap-horizontal' }
    };
    return types[type] || { label: type, color: activeTheme.border, icon: 'help' };
  };

  const getEntityIcon = (entity: string) => {
    const icons: { [key: string]: string } = {
      item: 'package-variant',
      container: 'archive',
      category: 'folder'
    };
    return icons[entity] || 'help';
  };

  const typeInfo = getConflictTypeInfo(conflict.type);
  const timeDiff = Date.now() - conflict.localTimestamp.getTime();
  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));

  const styles = StyleSheet.create({
    card: {
      margin: 8,
      marginBottom: 12,
    },
    cardContent: {
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      alignItems: 'flex-end',
    },
    conflictType: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    typeChip: {
      backgroundColor: typeInfo.color,
      marginRight: 8,
    },
    entityInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      opacity: 0.7,
    },
    entityText: {
      fontSize: 12,
      color: activeTheme.text.secondary,
      marginLeft: 4,
    },
    timeInfo: {
      fontSize: 12,
      color: activeTheme.text.secondary,
      textAlign: 'right',
    },
    conflictDetails: {
      backgroundColor: activeTheme.surface,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    conflictText: {
      fontSize: 14,
      color: activeTheme.text.secondary,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
    },
  });

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.conflictType}>
              <Chip
                icon={typeInfo.icon}
                style={styles.typeChip}
                textStyle={{ color: activeTheme.text.onPrimary }}
                compact
              >
                {typeInfo.label}
              </Chip>
              {conflict.resolution && (
                <Chip
                  icon="check"
                  style={{ backgroundColor: activeTheme.primary }}
                  textStyle={{ color: activeTheme.text.onPrimary }}
                  compact
                >
                  Résolu
                </Chip>
              )}
            </View>
            <View style={styles.entityInfo}>
              <IconButton
                icon={getEntityIcon(conflict.entity)}
                size={16}
                iconColor={activeTheme.text.secondary}
              />
              <Text style={styles.entityText}>
                {conflict.entity} #{conflict.entityId.toString().substring(0, 8)}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.timeInfo}>
              Il y a {hoursAgo}h
            </Text>
            <Text style={styles.timeInfo}>
              {format(conflict.localTimestamp, 'dd/MM HH:mm', { locale: fr })}
            </Text>
          </View>
        </View>

        {conflict.type === 'UPDATE_UPDATE' && (
          <View style={styles.conflictDetails}>
            <Text style={styles.conflictText}>
              Modifications simultanées détectées. Les données locales et serveur ont été modifiées récemment.
            </Text>
          </View>
        )}

        {conflict.type === 'DELETE_UPDATE' && (
          <View style={styles.conflictDetails}>
            <Text style={styles.conflictText}>
              L'élément a été supprimé localement mais modifié sur le serveur.
            </Text>
          </View>
        )}

        {!conflict.resolution && (
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onResolveAuto}
              style={styles.actionButton}
              icon="auto-fix"
              compact
            >
              Auto
            </Button>
            <Button
              mode="contained"
              onPress={onPress}
              style={styles.actionButton}
              icon="pencil"
              compact
            >
              Résoudre
            </Button>
          </View>
        )}
        
        {conflict.resolution && (
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onPress}
              style={styles.actionButton}
              icon="eye"
              compact
            >
              Voir détails
            </Button>
          </View>
        )}
      </View>
    </Card>
  );
};

interface ConflictsScreenProps {
  navigation?: any;
}

export const ConflictsScreen: React.FC<ConflictsScreenProps> = ({ navigation }) => {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [filteredConflicts, setFilteredConflicts] = useState<ConflictRecord[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<ConflictRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showDetectDialog, setShowDetectDialog] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const { activeTheme } = useAppTheme();
  const { isOnline, pendingOperationsCount } = useNetwork();
  const router = useRouter();
  const conflictDetector = ConflictDetector.getInstance();
  const conflictResolver = ConflictResolver.getInstance();

  const loadConflicts = useCallback(async () => {
    try {
      setIsLoading(true);
      // Charger TOUS les conflits, pas seulement les non résolus
      const allConflicts = await localDB.conflicts.toArray();
      console.log('Tous les conflits chargés:', allConflicts.length);
      console.log('Conflits résolus:', allConflicts.filter(c => c.resolution).length);
      console.log('Conflits non résolus:', allConflicts.filter(c => !c.resolution).length);
      
      setConflicts(allConflicts);
      filterConflicts(allConflicts, filterType, searchQuery);
    } catch (error) {
      console.error('Erreur chargement conflits:', error);
      Alert.alert('Erreur', 'Impossible de charger les conflits');
    } finally {
      setIsLoading(false);
    }
  }, [filterType, searchQuery]);

  const filterConflicts = useCallback((
    allConflicts: ConflictRecord[],
    type: 'all' | 'pending' | 'resolved',
    query: string
  ) => {
    console.log(`Filtrage des conflits: type=${type}, total=${allConflicts.length}`);
    let filtered = [...allConflicts];

    // Filtrer par statut
    if (type === 'pending') {
      filtered = filtered.filter(c => !c.resolution);
      console.log(`Après filtrage pending: ${filtered.length} conflits`);
    } else if (type === 'resolved') {
      filtered = filtered.filter(c => c.resolution);
      console.log(`Après filtrage resolved: ${filtered.length} conflits`);
    }

    // Filtrer par recherche
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(c =>
        c.entity.toLowerCase().includes(lowerQuery) ||
        c.type.toLowerCase().includes(lowerQuery) ||
        c.entityId.toString().toLowerCase().includes(lowerQuery)
      );
    }

    // Trier par timestamp (plus récent en premier)
    filtered.sort((a, b) => b.localTimestamp.getTime() - a.localTimestamp.getTime());

    console.log(`Résultat final du filtrage: ${filtered.length} conflits`);
    setFilteredConflicts(filtered);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadConflicts();
    setIsRefreshing(false);
  }, [loadConflicts]);

  const handleDetectConflicts = useCallback(async () => {
    setIsDetecting(true);
    setShowDetectDialog(false);

    try {
      const newConflicts = await conflictDetector.detectAllConflicts();
      
      if (newConflicts.length > 0) {
        Alert.alert(
          'Conflits détectés',
          `${newConflicts.length} nouveau(x) conflit(s) détecté(s)`,
          [{ text: 'OK', onPress: loadConflicts }]
        );
      } else {
        Alert.alert('Aucun conflit', 'Aucun nouveau conflit détecté');
      }
    } catch (error) {
      console.error('Erreur détection conflits:', error);
      Alert.alert('Erreur', 'Erreur lors de la détection des conflits');
    } finally {
      setIsDetecting(false);
    }
  }, [loadConflicts]);

  const handleResolveAuto = useCallback(async (conflict: ConflictRecord) => {
    console.log('handleResolveAuto called with conflict:', conflict.id);
    setIsResolving(true);

    try {
      console.log('Calling conflictResolver.resolveConflictAutomatically...');
      const result = await conflictResolver.resolveConflictAutomatically(conflict);
      console.log('Resolution result:', result);
      
      if (result.success) {
        // Recharger la liste immédiatement
        await loadConflicts();
        
        if (result.strategy.type === 'manual') {
          Alert.alert(
            'Résolution manuelle requise',
            'Ce conflit nécessite une résolution manuelle',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Résoudre', onPress: () => {
                setSelectedConflict(conflict);
                setShowResolutionModal(true);
              }}
            ]
          );
        } else {
          Alert.alert(
            'Conflit résolu',
            `Résolu automatiquement avec la stratégie: ${result.strategy.type}`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de résoudre automatiquement');
      }
    } catch (error) {
      console.error('Erreur résolution auto:', error);
      Alert.alert('Erreur', 'Erreur lors de la résolution automatique');
    } finally {
      setIsResolving(false);
    }
  }, [loadConflicts]);

  const handleResolveAll = useCallback(async () => {
    setIsResolving(true);

    try {
      const result = await conflictResolver.resolveAllConflictsAutomatically();
      
      // Recharger immédiatement la liste
      await loadConflicts();
      
      Alert.alert(
        'Résolution terminée',
        `${result.resolved} conflit(s) résolu(s), ${result.manualRequired} nécessitent une intervention manuelle`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Erreur résolution globale:', error);
      Alert.alert('Erreur', 'Erreur lors de la résolution globale');
    } finally {
      setIsResolving(false);
    }
  }, [loadConflicts]);

  const handleConflictResolved = useCallback((conflictId: string, resolution: string) => {
    loadConflicts();
  }, [loadConflicts]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  useEffect(() => {
    filterConflicts(conflicts, filterType, searchQuery);
  }, [conflicts, filterType, searchQuery, filterConflicts]);

  const pendingCount = conflicts.filter(c => !c.resolution).length;
  const resolvedCount = conflicts.filter(c => c.resolution).length;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: activeTheme.background,
    },
    header: {
      padding: 16,
      backgroundColor: activeTheme.surface,
      borderBottomWidth: 1,
      borderBottomColor: activeTheme.border,
    },
    headerStats: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statChip: {
      paddingHorizontal: 12,
    },
    searchContainer: {
      marginBottom: 16,
    },
    filterTabs: {
      flexDirection: 'row',
      gap: 8,
    },
    filterTab: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: activeTheme.text.primary,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: activeTheme.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    list: {
      flex: 1,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
    },
    fabGroup: {
      position: 'absolute',
      right: 16,
      bottom: 16,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    loadingCard: {
      backgroundColor: activeTheme.surface,
      padding: 24,
      borderRadius: 12,
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 16,
      color: activeTheme.text.primary,
    },
  });

  const renderConflictItem = ({ item }: { item: ConflictRecord }) => (
    <ConflictItem
      conflict={item}
      onPress={() => {
        setSelectedConflict(item);
        setShowResolutionModal(true);
      }}
      onResolveAuto={() => handleResolveAuto(item)}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconButton
        icon={filterType === 'pending' ? 'check-all' : 'magnify'}
        size={64}
        iconColor={activeTheme.text.secondary}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>
        {filterType === 'pending' ? 'Aucun conflit en attente' : 'Aucun conflit trouvé'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filterType === 'pending' 
          ? 'Tous les conflits ont été résolus ou il n\'y en a aucun.'
          : 'Essayez de modifier vos critères de recherche.'
        }
      </Text>
      {filterType === 'pending' && isOnline && (
        <Button
          mode="contained"
          onPress={() => setShowDetectDialog(true)}
          style={{ marginTop: 16 }}
          icon="magnify"
        >
          Détecter les conflits
        </Button>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="Gestion des Conflits"
        onBackPress={() => router.back()}
        rightComponent={
          <IconButton
            icon="help-circle"
            size={24}
            iconColor={activeTheme.primary}
            onPress={() => setShowHelpModal(true)}
          />
        }
      />
      
      {/* Header stats */}
      <View style={styles.header}>
        <View style={styles.headerStats}>
          <Chip
            icon="alert"
            style={[styles.statChip, { backgroundColor: activeTheme.danger.background }]}
            textStyle={{ color: activeTheme.onErrorContainer }}
          >
            {pendingCount} en attente
          </Chip>
          <Chip
            icon="check"
            style={[styles.statChip, { backgroundColor: activeTheme.primaryContainer }]}
            textStyle={{ color: activeTheme.text.onPrimaryContainer }}
          >
            {resolvedCount} résolus
          </Chip>
          {!isOnline && (
            <Chip
              icon="wifi-off"
              style={[styles.statChip, { backgroundColor: activeTheme.surface }]}
              textStyle={{ color: activeTheme.text.secondary }}
            >
              Hors ligne
            </Chip>
          )}
        </View>

        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Rechercher des conflits..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ marginBottom: 12 }}
          />
          
          <View style={styles.filterTabs}>
            <Button
              mode={filterType === 'pending' ? 'contained' : 'outlined'}
              onPress={() => setFilterType('pending')}
              style={styles.filterTab}
              compact
            >
              En attente ({pendingCount})
            </Button>
            <Button
              mode={filterType === 'resolved' ? 'contained' : 'outlined'}
              onPress={() => setFilterType('resolved')}
              style={styles.filterTab}
              compact
            >
              Résolus ({resolvedCount})
            </Button>
            <Button
              mode={filterType === 'all' ? 'contained' : 'outlined'}
              onPress={() => setFilterType('all')}
              style={styles.filterTab}
              compact
            >
              Tous
            </Button>
          </View>
        </View>
      </View>

      {/* Liste des conflits */}
      {isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={activeTheme.primary} />
          <Text style={[styles.emptyTitle, { marginTop: 16 }]}>
            Chargement des conflits...
          </Text>
        </View>
      ) : filteredConflicts.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          style={styles.list}
          data={filteredConflicts}
          renderItem={renderConflictItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[activeTheme.primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* FAB */}
      {pendingCount > 0 && (
        <FAB
          icon="auto-fix"
          label="Résoudre tout"
          onPress={handleResolveAll}
          style={styles.fab}
          disabled={isResolving}
        />
      )}

      {/* Modal de résolution */}
      <ConflictResolutionModal
        visible={showResolutionModal}
        conflict={selectedConflict}
        onDismiss={() => {
          setShowResolutionModal(false);
          setSelectedConflict(null);
        }}
        onResolved={handleConflictResolved}
      />

      {/* Modal d'aide */}
      <ConflictHelpModal
        visible={showHelpModal}
        onDismiss={() => setShowHelpModal(false)}
      />

      {/* Dialog de détection */}
      <Portal>
        <Dialog visible={showDetectDialog} onDismiss={() => setShowDetectDialog(false)}>
          <Dialog.Title>Détecter les conflits</Dialog.Title>
          <Dialog.Content>
            <Text>
              Cette action va analyser les données locales et serveur pour détecter de nouveaux conflits. 
              Cela peut prendre quelques instants.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDetectDialog(false)}>Annuler</Button>
            <Button onPress={handleDetectConflicts}>Détecter</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Overlay de chargement */}
      {(isDetecting || isResolving) && (
        <View style={styles.loadingOverlay}>
          <Surface style={styles.loadingCard}>
            <ActivityIndicator size="large" color={activeTheme.primary} />
            <Text style={styles.loadingText}>
              {isDetecting ? 'Détection en cours...' : 'Résolution en cours...'}
            </Text>
          </Surface>
        </View>
      )}
    </View>
  );
};

export default ConflictsScreen;