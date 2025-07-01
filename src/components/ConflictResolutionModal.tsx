import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import {
  Modal,
  Portal,
  Card,
  Button,
  RadioButton,
  IconButton
} from 'react-native-paper';
import { ConflictRecord } from '../database/localDatabase';
import { ConflictResolution, ConflictResolutionStrategy } from '../types/offline';
import { ConflictResolver } from '../services/ConflictResolver';
import { useAppTheme } from '../hooks/useTheme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConflictResolutionModalProps {
  visible: boolean;
  conflict: ConflictRecord | null;
  onDismiss: () => void;
  onResolved: (conflictId: string, resolution: ConflictResolution) => void;
}

interface FieldComparisonProps {
  field: string;
  localValue: any;
  serverValue: any;
  selectedValue: 'local' | 'server' | 'custom';
  customValue?: any;
  onSelectionChange: (field: string, selection: 'local' | 'server' | 'custom', customValue?: any) => void;
  styles: any;
}

const FieldComparison: React.FC<FieldComparisonProps> = ({
  field,
  localValue,
  serverValue,
  selectedValue,
  onSelectionChange,
  styles
}) => {
  const { activeTheme } = useAppTheme();


  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'Non défini';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return value.toString();
  };

  const getFieldDisplayName = (field: string): string => {
    const fieldNames: { [key: string]: string } = {
      name: 'Nom',
      description: 'Description',
      price: 'Prix',
      purchasePrice: 'Prix d\'achat',
      sellingPrice: 'Prix de vente',
      status: 'Statut',
      containerId: 'Container',
      categoryId: 'Catégorie',
      locationId: 'Emplacement',
      qrCode: 'Code QR',
      number: 'Numéro'
    };
    return fieldNames[field] || field;
  };

  const areValuesEqual = localValue === serverValue;

  if (areValuesEqual) {
    return (
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldName, { color: activeTheme.text.primary }]}>
          {getFieldDisplayName(field)}
        </Text>
        <Text style={[styles.fieldValue, { color: activeTheme.text.secondary }]}>
          {formatValue(localValue)} (identique)
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.conflictField}>
      <Text style={[styles.fieldName, { color: activeTheme.text.primary }]}>
        {getFieldDisplayName(field)}
      </Text>
      
      <View style={styles.valuesComparison}>
        <TouchableOpacity
          style={[
            styles.valueOption,
            { backgroundColor: activeTheme.surface },
            selectedValue === 'local' && { backgroundColor: activeTheme.primaryLight }
          ]}
          onPress={() => onSelectionChange(field, 'local')}
        >
          <RadioButton
            value="local"
            status={selectedValue === 'local' ? 'checked' : 'unchecked'}
            onPress={() => onSelectionChange(field, 'local')}
          />
          <View style={styles.valueContent}>
            <Text style={[styles.valueLabel, { color: activeTheme.primary }]}>
              Local
            </Text>
            <Text style={[styles.valueText, { color: activeTheme.text.primary }]}>
              {formatValue(localValue)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.valueOption,
            { backgroundColor: activeTheme.surface },
            selectedValue === 'server' && { backgroundColor: activeTheme.primaryLight }
          ]}
          onPress={() => onSelectionChange(field, 'server')}
        >
          <RadioButton
            value="server"
            status={selectedValue === 'server' ? 'checked' : 'unchecked'}
            onPress={() => onSelectionChange(field, 'server')}
          />
          <View style={styles.valueContent}>
            <Text style={[styles.valueLabel, { color: activeTheme.secondary }]}>
              Serveur
            </Text>
            <Text style={[styles.valueText, { color: activeTheme.text.primary }]}>
              {formatValue(serverValue)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflict,
  onDismiss,
  onResolved
}) => {
  const [resolutionType, setResolutionType] = useState<ConflictResolution>('manual');
  const [fieldSelections, setFieldSelections] = useState<{ [key: string]: 'local' | 'server' | 'custom' }>({});
  const [isResolving, setIsResolving] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const { activeTheme } = useAppTheme();

  useEffect(() => {
    if (conflict && visible) {
      // Initialiser les sélections avec 'server' par défaut
      const initialSelections: { [key: string]: 'local' | 'server' | 'custom' } = {};
      
      if (conflict.localData && conflict.serverData) {
        Object.keys(conflict.localData).forEach(field => {
          if (field !== 'id' && field !== 'createdAt' && field !== 'updatedAt') {
            initialSelections[field] = 'server'; // Priorité serveur par défaut
          }
        });
      }
      
      setFieldSelections(initialSelections);
      setResolutionType('merge');
      updatePreviewData(initialSelections);
    }
  }, [conflict, visible]);

  const updatePreviewData = (selections: { [key: string]: 'local' | 'server' | 'custom' }) => {
    if (!conflict?.localData || !conflict?.serverData) return;

    const merged = { ...conflict.serverData };
    
    Object.entries(selections).forEach(([field, selection]) => {
      if (selection === 'local') {
        merged[field] = conflict.localData[field];
      } else if (selection === 'server') {
        merged[field] = conflict.serverData[field];
      }
    });

    setPreviewData(merged);
  };

  const handleFieldSelectionChange = (
    field: string, 
    selection: 'local' | 'server' | 'custom'
  ) => {
    const newSelections = {
      ...fieldSelections,
      [field]: selection
    };
    setFieldSelections(newSelections);
    updatePreviewData(newSelections);
  };

  const handleQuickResolution = (type: 'local' | 'server') => {
    console.log('handleQuickResolution called with type:', type);
    setResolutionType(type);
    
    if (type === 'local') {
      setPreviewData(conflict?.localData);
    } else {
      setPreviewData(conflict?.serverData);
    }
  };

  const handleResolve = async () => {
    if (!conflict) return;
    
    // Vérifier si le conflit est déjà résolu
    if (conflict.resolution) {
      Alert.alert('Information', 'Ce conflit a déjà été résolu');
      return;
    }

    setIsResolving(true);

    try {
      const conflictResolver = ConflictResolver.getInstance();
      let strategy: ConflictResolutionStrategy;

      switch (resolutionType) {
        case 'local':
          strategy = { type: 'local', reason: 'Résolution manuelle: version locale choisie' };
          break;
        case 'server':
          strategy = { type: 'server', reason: 'Résolution manuelle: version serveur choisie' };
          break;
        case 'merge':
          strategy = {
            type: 'merge',
            fields: fieldSelections,
            reason: 'Résolution manuelle: merge personnalisé'
          };
          break;
        default:
          throw new Error('Type de résolution non supporté');
      }

      const success = await conflictResolver.resolveConflictManually(
        conflict.id,
        strategy,
        'user-manual'
      );

      if (success) {
        onResolved(conflict.id, resolutionType);
        onDismiss();
      } else {
        Alert.alert('Erreur', 'Impossible de résoudre le conflit');
      }
    } catch (error) {
      console.error('Erreur résolution conflit:', error);
      Alert.alert('Erreur', `Erreur lors de la résolution: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsResolving(false);
    }
  };

  const getConflictTypeDescription = (type: string): string => {
    const descriptions: { [key: string]: string } = {
      'UPDATE_UPDATE': 'Modifications simultanées',
      'DELETE_UPDATE': 'Suppression vs Modification',
      'CREATE_CREATE': 'Créations dupliquées',
      'MOVE_MOVE': 'Déplacements simultanés'
    };
    return descriptions[type] || type;
  };

  const getConflictingFields = () => {
    if (!conflict?.localData || !conflict?.serverData) return [];
    
    const conflictingFields: string[] = [];
    
    Object.keys(conflict.localData).forEach(field => {
      if (field !== 'id' && field !== 'createdAt' && field !== 'updatedAt') {
        if (conflict.localData[field] !== conflict.serverData[field]) {
          conflictingFields.push(field);
        }
      }
    });
    
    return conflictingFields;
  };

  if (!conflict) return null;

  const conflictingFields = getConflictingFields();

  const styles = StyleSheet.create({
    modal: {
      margin: 20,
      maxHeight: Dimensions.get('window').height * 0.8,
      maxWidth: 500,
      alignSelf: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      backgroundColor: activeTheme.danger.background,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: activeTheme.text.inverse,
      flex: 1,
    },
    headerSubtitle: {
      fontSize: 14,
      color: activeTheme.text.inverse,
      opacity: 0.8,
      marginTop: 2,
    },
    content: {
      padding: 20,
      maxHeight: Dimensions.get('window').height * 0.6,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: activeTheme.text.primary,
      marginBottom: 12,
    },
    conflictInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    conflictDetails: {
      flex: 1,
    },
    conflictType: {
      fontSize: 14,
      fontWeight: '600',
      color: activeTheme.error,
      marginBottom: 4,
    },
    entityInfo: {
      fontSize: 12,
      color: activeTheme.text.secondary,
    },
    timestamps: {
      alignItems: 'flex-end',
    },
    timestamp: {
      fontSize: 12,
      color: activeTheme.text.secondary,
      marginBottom: 2,
    },
    quickActions: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    quickButton: {
      flex: 1,
    },
    fieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: activeTheme.surface,
      borderRadius: 8,
      marginBottom: 8,
    },
    fieldName: {
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    fieldValue: {
      fontSize: 14,
      flex: 2,
      textAlign: 'right',
    },
    conflictField: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: activeTheme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: activeTheme.border,
    },
    valuesComparison: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    valueOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: activeTheme.border,
    },
    valueContent: {
      flex: 1,
      marginLeft: 8,
    },
    valueLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 2,
    },
    valueText: {
      fontSize: 14,
    },
    previewSection: {
      backgroundColor: activeTheme.surface,
      padding: 16,
      borderRadius: 8,
      marginBottom: 20,
    },
    previewTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: activeTheme.text.primary,
      marginBottom: 8,
    },
    previewContent: {
      backgroundColor: activeTheme.surface,
      padding: 12,
      borderRadius: 6,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: activeTheme.border,
    },
    cancelButton: {
      flex: 1,
    },
    resolveButton: {
      flex: 2,
    },
    exampleBox: {
      backgroundColor: activeTheme.surface,
      padding: 16,
      borderRadius: 8,
      marginVertical: 12,
      borderLeftWidth: 4,
      borderLeftColor: activeTheme.primary,
    },
    exampleTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: activeTheme.primary,
      marginBottom: 8,
    },
    exampleText: {
      fontSize: 15,
      lineHeight: 22,
      color: activeTheme.text.primary,
    },
  });

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modal}
      >
        <Card>
          <View style={styles.header}>
            <View style={styles.conflictDetails}>
              <Text style={styles.headerTitle}>
                {conflict.resolution ? 'Conflit Résolu' : 'Résolution de Conflit'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {getConflictTypeDescription(conflict.type)} - {conflict.entity}
              </Text>
              {conflict.resolution && (
                <Text style={styles.headerSubtitle}>
                  Résolu le {format(conflict.resolvedAt || new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                </Text>
              )}
            </View>
            <IconButton
              icon="close"
              size={24}
              iconColor={activeTheme.text.inverse}
              onPress={onDismiss}
            />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Informations sur le conflit */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations</Text>
              <View style={styles.conflictInfo}>
                <View style={styles.conflictDetails}>
                  <Text style={styles.conflictType}>
                    {getConflictTypeDescription(conflict.type)}
                  </Text>
                  <Text style={styles.entityInfo}>
                    {conflict.entity} #{conflict.entityId}
                  </Text>
                  <Text style={styles.entityInfo}>
                    {conflictingFields.length} champ(s) en conflit
                  </Text>
                </View>
                <View style={styles.timestamps}>
                  <Text style={styles.timestamp}>
                    Local: {format(conflict.localTimestamp, 'dd/MM HH:mm', { locale: fr })}
                  </Text>
                  <Text style={styles.timestamp}>
                    Serveur: {format(conflict.serverTimestamp, 'dd/MM HH:mm', { locale: fr })}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions rapides - seulement si non résolu */}
            {!conflict.resolution && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Résolution rapide</Text>
                <View style={styles.quickActions}>
                  <Button
                    mode={resolutionType === 'local' ? 'contained' : 'outlined'}
                    onPress={() => handleQuickResolution('local')}
                    style={styles.quickButton}
                    icon="arrow-left"
                  >
                    Garder Local
                  </Button>
                  <Button
                    mode={resolutionType === 'server' ? 'contained' : 'outlined'}
                    onPress={() => handleQuickResolution('server')}
                    style={styles.quickButton}
                    icon="arrow-right"
                  >
                    Garder Serveur
                  </Button>
                </View>
                <Button
                  mode={resolutionType === 'merge' ? 'contained' : 'outlined'}
                  onPress={() => {
                    console.log('Fusionner manuellement clicked, setting resolutionType to merge');
                    setResolutionType('merge');
                  }}
                  icon="merge"
                >
                  Fusionner manuellement
                </Button>
              </View>
            )}

            {/* Informations de résolution - si déjà résolu */}
            {conflict.resolution && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Résolution appliquée</Text>
                <View style={styles.exampleBox}>
                  <Text style={styles.exampleTitle}>Stratégie utilisée :</Text>
                  <Text style={styles.exampleText}>
                    {conflict.resolution === 'local' ? 'Version locale conservée' :
                     conflict.resolution === 'server' ? 'Version serveur conservée' :
                     conflict.resolution === 'merge' ? 'Fusion personnalisée' :
                     conflict.resolution}
                  </Text>
                  {conflict.resolvedBy && (
                    <Text style={styles.exampleText}>
                      Résolu par : {conflict.resolvedBy}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Comparaison des champs - seulement si non résolu */}
            {resolutionType === 'merge' && !conflict.resolution && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Comparaison des champs</Text>
                {Object.keys(conflict.localData || {}).map(field => {
                  if (field === 'id' || field === 'createdAt' || field === 'updatedAt') {
                    return null;
                  }
                  
                  return (
                    <FieldComparison
                      key={field}
                      field={field}
                      localValue={conflict.localData?.[field]}
                      serverValue={conflict.serverData?.[field]}
                      selectedValue={fieldSelections[field] || 'server'}
                      onSelectionChange={handleFieldSelectionChange}
                      styles={styles}
                    />
                  );
                })}
              </View>
            )}

            {/* Aperçu du résultat */}
            {previewData && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aperçu du résultat</Text>
                <View style={styles.previewSection}>
                  <Text style={styles.previewTitle}>Données finales</Text>
                  <View style={styles.previewContent}>
                    {Object.entries(previewData)
                      .filter(([key]) => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt')
                      .map(([key, value]) => (
                        <View key={key} style={styles.fieldRow}>
                          <Text style={[styles.fieldName, { color: activeTheme.text.primary }]}>
                            {key}:
                          </Text>
                          <Text style={[styles.fieldValue, { color: activeTheme.text.primary }]}>
                            {value?.toString() || 'Non défini'}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {conflict.resolution ? (
              <Button
                mode="contained"
                onPress={onDismiss}
                style={[styles.cancelButton, styles.resolveButton]}
                icon="check"
              >
                Fermer
              </Button>
            ) : (
              <>
                <Button
                  mode="outlined"
                  onPress={onDismiss}
                  style={styles.cancelButton}
                  disabled={isResolving}
                >
                  Annuler
                </Button>
                <Button
                  mode="contained"
                  onPress={handleResolve}
                  style={styles.resolveButton}
                  loading={isResolving}
                  disabled={isResolving}
                  icon="check"
                >
                  {isResolving ? 'Résolution...' : 'Résoudre'}
                </Button>
              </>
            )}
          </View>
        </Card>
      </Modal>
    </Portal>
  );
};

export default ConflictResolutionModal;