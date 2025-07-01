import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import StyleFactory from '../styles/StyleFactory';
import { ReportData, ReportService, CSVColumn } from '../services/ReportService';
import { useExportData } from '../hooks/useExportData';

interface ExportButtonsProps {
  data: ReportData;
  title?: string;
  style?: any;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ 
  data, 
  title = "Exporter", 
  style 
}) => {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ExportButtons');
  const { isExporting, exportError, exportWithData } = useExportData();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'available' | 'sold'>('all');
  const [availableColumns] = useState<CSVColumn[]>(ReportService.getAvailableCSVColumns());

  const handleExport = async (format: 'csv' | 'pdf' | 'html') => {
    if (format === 'csv') {
      // Pour CSV, ouvrir d'abord la sélection de colonnes
      setShowExportModal(false);
      // Initialiser avec les colonnes par défaut
      const defaultColumns = availableColumns.filter(col => col.defaultSelected).map(col => col.key);
      setSelectedColumns(defaultColumns);
      setShowColumnsModal(true);
      return;
    }

    setShowExportModal(false);
    
    try {
      await exportWithData(format, data);
      
      // Afficher un message de succès
      Alert.alert(
        'Export réussi',
        `Le fichier ${format.toUpperCase()} a été téléchargé avec succès.`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      // L'erreur est déjà gérée dans le hook
      Alert.alert(
        'Erreur d\'export',
        exportError || 'Une erreur est survenue lors de l\'export.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Réessayer', style: 'default', onPress: () => handleExport(format) }
        ]
      );
    }
  };

  const handleCSVExport = async () => {
    setShowColumnsModal(false);
    
    try {
      await exportWithData('csv', data, {
        format: 'csv',
        csvColumns: selectedColumns,
        csvStatusFilter: selectedStatus
      });
      
      Alert.alert(
        'Export réussi',
        'Le fichier CSV a été téléchargé avec succès.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      Alert.alert(
        'Erreur d\'export',
        exportError || 'Une erreur est survenue lors de l\'export.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const toggleColumn = (columnKey: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnKey) 
        ? prev.filter(key => key !== columnKey)
        : [...prev, columnKey]
    );
  };

  const getExportButtonStyle = (format: string) => {
    const baseStyle = [styles.exportButton];
    
    switch (format) {
      case 'csv':
        return [...baseStyle, { backgroundColor: activeTheme.success + '20', borderColor: activeTheme.success }];
      case 'pdf':
        return [...baseStyle, { backgroundColor: activeTheme.error + '20', borderColor: activeTheme.error }];
      case 'html':
        return [...baseStyle, { backgroundColor: activeTheme.warning + '20', borderColor: activeTheme.warning }];
      default:
        return baseStyle;
    }
  };

  const getExportButtonTextStyle = (format: string) => {
    const baseStyle = [styles.exportButtonText];
    
    switch (format) {
      case 'csv':
        return [...baseStyle, { color: activeTheme.success }];
      case 'pdf':
        return [...baseStyle, { color: activeTheme.error }];
      case 'html':
        return [...baseStyle, { color: activeTheme.warning }];
      default:
        return baseStyle;
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.mainButton, { backgroundColor: activeTheme.primary }]}
        onPress={() => setShowExportModal(true)}
        disabled={isExporting}
      >
        {isExporting ? (
          <ActivityIndicator size="small" color={activeTheme.text.onPrimary} />
        ) : (
          <>
            <Text style={[styles.mainButtonText, { color: activeTheme.text.onPrimary }]}>
              📊 {title}
            </Text>
            <Text style={[styles.mainButtonSubtext, { color: activeTheme.text.onPrimary + '80' }]}>
              {data.items.length} article{data.items.length > 1 ? 's' : ''}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Modal de sélection du format */}
      <Modal
        visible={showExportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: activeTheme.surface }]}>
            <Text style={[styles.modalTitle, { color: activeTheme.text.primary }]}>
              Choisir le format d'export
            </Text>
            
            <Text style={[styles.modalSubtitle, { color: activeTheme.text.secondary }]}>
              {data.items.length} article{data.items.length > 1 ? 's' : ''} • {data.categories.length} catégorie{data.categories.length > 1 ? 's' : ''}
            </Text>

            <View style={styles.formatButtonsContainer}>
              <TouchableOpacity
                style={getExportButtonStyle('csv')}
                onPress={() => handleExport('csv')}
                disabled={isExporting}
              >
                <Text style={styles.formatIcon}>📊</Text>
                <Text style={getExportButtonTextStyle('csv')}>CSV</Text>
                <Text style={[styles.formatDescription, { color: activeTheme.text.secondary }]}>
                  Fichier tableur
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={getExportButtonStyle('pdf')}
                onPress={() => handleExport('pdf')}
                disabled={isExporting}
              >
                <Text style={styles.formatIcon}>📄</Text>
                <Text style={getExportButtonTextStyle('pdf')}>PDF</Text>
                <Text style={[styles.formatDescription, { color: activeTheme.text.secondary }]}>
                  Rapport imprimable
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={getExportButtonStyle('html')}
                onPress={() => handleExport('html')}
                disabled={isExporting}
              >
                <Text style={styles.formatIcon}>🌐</Text>
                <Text style={getExportButtonTextStyle('html')}>HTML</Text>
                <Text style={[styles.formatDescription, { color: activeTheme.text.secondary }]}>
                  Page web
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: activeTheme.border }]}
              onPress={() => setShowExportModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: activeTheme.text.secondary }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de sélection des colonnes CSV */}
      <Modal
        visible={showColumnsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowColumnsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: activeTheme.surface, maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, { color: activeTheme.text.primary }]}>
              Choisir les colonnes CSV
            </Text>
            
            <Text style={[styles.modalSubtitle, { color: activeTheme.text.secondary }]}>
              Sélectionnez les colonnes à inclure dans votre export CSV
            </Text>

            {/* Sélection du statut des articles */}
            <View style={styles.statusSectionContainer}>
              <Text style={[styles.statusSectionTitle, { color: activeTheme.text.primary }]}>
                Statut des articles
              </Text>
              <View style={styles.statusButtonsContainer}>
                {[
                  { key: 'all', label: 'Tous', count: data.items.length },
                  { key: 'available', label: 'Disponibles', count: data.items.filter(i => i.status === 'available').length },
                  { key: 'sold', label: 'Vendus', count: data.items.filter(i => i.status === 'sold').length }
                ].map((statusOption) => (
                  <TouchableOpacity
                    key={statusOption.key}
                    style={[
                      styles.statusButton,
                      {
                        backgroundColor: selectedStatus === statusOption.key 
                          ? activeTheme.primary + '15' 
                          : 'transparent',
                        borderColor: selectedStatus === statusOption.key 
                          ? activeTheme.primary 
                          : activeTheme.border,
                        borderWidth: selectedStatus === statusOption.key ? 2 : 1,
                      }
                    ]}
                    onPress={() => setSelectedStatus(statusOption.key as 'all' | 'available' | 'sold')}
                  >
                    <Text style={[
                      styles.statusButtonText,
                      { 
                        color: selectedStatus === statusOption.key 
                          ? activeTheme.primary 
                          : activeTheme.text.primary,
                        fontWeight: selectedStatus === statusOption.key ? '600' : '400'
                      }
                    ]}>
                      {statusOption.label}
                    </Text>
                    <Text style={[
                      styles.statusButtonCount,
                      { 
                        color: selectedStatus === statusOption.key 
                          ? activeTheme.primary + '80' 
                          : activeTheme.text.secondary
                      }
                    ]}>
                      ({statusOption.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Boutons de sélection rapide */}
            <View style={styles.quickSelectContainer}>
              <TouchableOpacity
                style={[styles.quickSelectButton, { borderColor: activeTheme.primary }]}
                onPress={() => {
                  const defaultColumns = availableColumns.filter(col => col.defaultSelected).map(col => col.key);
                  setSelectedColumns(defaultColumns);
                }}
              >
                <Text style={[styles.quickSelectText, { color: activeTheme.primary }]}>
                  Sélection par défaut
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.quickSelectButton, { borderColor: activeTheme.primary }]}
                onPress={() => {
                  const allColumns = availableColumns.map(col => col.key);
                  setSelectedColumns(allColumns);
                }}
              >
                <Text style={[styles.quickSelectText, { color: activeTheme.primary }]}>
                  Tout sélectionner
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.quickSelectButton, { borderColor: activeTheme.error }]}
                onPress={() => setSelectedColumns([])}
              >
                <Text style={[styles.quickSelectText, { color: activeTheme.error }]}>
                  Tout désélectionner
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350, marginVertical: 15 }}>
              <View style={styles.columnsGrid}>
                {availableColumns.map((column) => {
                  const isSelected = selectedColumns.includes(column.key);
                  return (
                    <TouchableOpacity
                      key={column.key}
                      style={[
                        styles.columnCard,
                        { 
                          backgroundColor: isSelected 
                            ? activeTheme.primary + '15' 
                            : activeTheme.surface,
                          borderColor: isSelected 
                            ? activeTheme.primary 
                            : activeTheme.border,
                          borderWidth: isSelected ? 2 : 1,
                        }
                      ]}
                      onPress={() => toggleColumn(column.key)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.columnCardHeader}>
                        <View style={[
                          styles.modernCheckbox,
                          { 
                            backgroundColor: isSelected 
                              ? activeTheme.primary 
                              : 'transparent',
                            borderColor: isSelected 
                              ? activeTheme.primary 
                              : activeTheme.border,
                          }
                        ]}>
                          {isSelected && (
                            <Text style={{ 
                              color: activeTheme.text.onPrimary, 
                              fontSize: 10, 
                              fontWeight: 'bold' 
                            }}>
                              ✓
                            </Text>
                          )}
                        </View>
                        
                        {column.defaultSelected && (
                          <View style={[styles.defaultBadge, { backgroundColor: activeTheme.warning + '30' }]}>
                            <Text style={[styles.defaultBadgeText, { color: activeTheme.warning }]}>
                              Recommandé
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <Text style={[
                        styles.modernColumnLabel,
                        { 
                          color: isSelected 
                            ? activeTheme.primary 
                            : activeTheme.text.primary,
                          fontWeight: isSelected ? '600' : '400'
                        }
                      ]}>
                        {column.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.formatButtonsContainer}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: activeTheme.border }]}
                onPress={() => setShowColumnsModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: activeTheme.text.secondary }]}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.exportButton,
                  { 
                    backgroundColor: activeTheme.primary,
                    borderColor: activeTheme.primary,
                    minWidth: 100
                  }
                ]}
                onPress={handleCSVExport}
                disabled={selectedColumns.length === 0}
              >
                <Text style={[
                  styles.exportButtonText,
                  { color: activeTheme.text.onPrimary }
                ]}>
                  Exporter ({selectedColumns.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ExportButtons;