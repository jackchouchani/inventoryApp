import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import StyleFactory from '../styles/StyleFactory';
import { ReportData, ReportService, CSVColumn } from '../services/ReportService';
import { useExportData } from '../hooks/useExportData';
import { Icon } from './Icon';

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
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [availableColumns] = useState<CSVColumn[]>(ReportService.getAvailableCSVColumns());

  const handleExport = async (format: 'csv' | 'pdf') => {
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
        csvStatusFilter: selectedStatus,
        csvCategoryFilter: selectedCategories.length > 0 ? selectedCategories : undefined
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

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getFilteredItemsCount = () => {
    let count = data.items.length;
    
    // Filtre par statut
    if (selectedStatus !== 'all') {
      count = data.items.filter(item => item.status === selectedStatus).length;
    }
    
    // Filtre par catégories
    if (selectedCategories.length > 0) {
      const statusFilteredItems = selectedStatus !== 'all' 
        ? data.items.filter(item => item.status === selectedStatus)
        : data.items;
      count = statusFilteredItems.filter(item => 
        item.categoryId && selectedCategories.includes(item.categoryId)
      ).length;
    }
    
    return count;
  };

  const getExportButtonStyle = (format: string) => {
    const baseStyle = [styles.exportButton];
    
    switch (format) {
      case 'csv':
        return [...baseStyle, { backgroundColor: activeTheme.success + '20', borderColor: activeTheme.success }];
      case 'pdf':
        return [...baseStyle, { backgroundColor: activeTheme.error + '20', borderColor: activeTheme.error }];
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
          <View style={[styles.modalContent, { backgroundColor: activeTheme.surface }]}>
            <Text style={[styles.modalTitle, { color: activeTheme.text.primary }]}>
              Options d'export CSV
            </Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Statut simple */}
              <View style={styles.simpleSection}>
                <Text style={[styles.simpleSectionTitle, { color: activeTheme.text.primary }]}>
                  Statut des articles
                </Text>
                <View style={styles.simpleButtonRow}>
                  {[
                    { key: 'all', label: 'Tous', count: data.items.length },
                    { key: 'available', label: 'Disponibles', count: data.items.filter(i => i.status === 'available').length },
                    { key: 'sold', label: 'Vendus', count: data.items.filter(i => i.status === 'sold').length }
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.simpleButton,
                        {
                          backgroundColor: selectedStatus === option.key ? activeTheme.primary : activeTheme.surface,
                          borderColor: selectedStatus === option.key ? activeTheme.primary : activeTheme.border,
                        }
                      ]}
                      onPress={() => setSelectedStatus(option.key as 'all' | 'available' | 'sold')}
                    >
                      <Text style={[
                        styles.simpleButtonText,
                        { color: selectedStatus === option.key ? activeTheme.text.onPrimary : activeTheme.text.primary }
                      ]}>
                        {option.label}
                      </Text>
                      <Text style={[
                        styles.simpleButtonCount,
                        { color: selectedStatus === option.key ? activeTheme.text.onPrimary + '80' : activeTheme.text.secondary }
                      ]}>
                        ({option.count})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Catégories simples */}
              <View style={styles.simpleSection}>
                <Text style={[styles.simpleSectionTitle, { color: activeTheme.text.primary }]}>
                  Catégories
                </Text>
                
                {/* Toutes les catégories */}
                <TouchableOpacity
                  style={[
                    styles.allCategoriesSimple,
                    {
                      backgroundColor: selectedCategories.length === 0 ? activeTheme.primary : activeTheme.surface,
                      borderColor: selectedCategories.length === 0 ? activeTheme.primary : activeTheme.border,
                    }
                  ]}
                  onPress={() => setSelectedCategories([])}
                >
                  <Text style={[
                    styles.allCategoriesSimpleText,
                    { color: selectedCategories.length === 0 ? activeTheme.text.onPrimary : activeTheme.text.primary }
                  ]}>
                    📂 Toutes les catégories ({data.categories.length})
                  </Text>
                </TouchableOpacity>

                {/* Liste des catégories */}
                <View style={styles.categoriesSimpleGrid}>
                  {data.categories.map((category) => {
                    const itemsInCategory = data.items.filter(item => item.categoryId === category.id).length;
                    const isSelected = selectedCategories.includes(category.id);
                    
                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categorySimpleCard,
                          {
                            backgroundColor: isSelected ? activeTheme.primary + '15' : activeTheme.surface,
                            borderColor: isSelected ? activeTheme.primary : activeTheme.border,
                          }
                        ]}
                        onPress={() => toggleCategory(category.id)}
                      >
                        <View style={styles.categorySimpleContent}>
                          <Icon
                            name={category.icon || 'folder'}
                            size={18}
                            color={isSelected ? activeTheme.primary : activeTheme.text.secondary}
                          />
                          <Text style={[
                            styles.categorySimpleText,
                            { color: isSelected ? activeTheme.primary : activeTheme.text.primary }
                          ]}>
                            {category.name}
                          </Text>
                        </View>
                        <Text style={[
                          styles.categorySimpleCount,
                          { color: isSelected ? activeTheme.primary : activeTheme.text.secondary }
                        ]}>
                          ({itemsInCategory})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Résumé */}
              {(selectedStatus !== 'all' || selectedCategories.length > 0) && (
                <View style={[styles.summaryBox, { backgroundColor: activeTheme.primary + '10' }]}>
                  <Text style={[styles.summaryText, { color: activeTheme.primary }]}>
                    📊 {getFilteredItemsCount()} article{getFilteredItemsCount() > 1 ? 's' : ''} à exporter
                  </Text>
                </View>
              )}

              {/* Colonnes */}
              <View style={styles.simpleSection}>
                <Text style={[styles.simpleSectionTitle, { color: activeTheme.text.primary }]}>
                  Colonnes à inclure
                </Text>
                
                {/* Boutons rapides */}
                <View style={styles.quickButtons}>
                  <TouchableOpacity
                    style={[styles.quickButton, { borderColor: activeTheme.primary }]}
                    onPress={() => {
                      const defaultColumns = availableColumns.filter(col => col.defaultSelected).map(col => col.key);
                      setSelectedColumns(defaultColumns);
                    }}
                  >
                    <Text style={[styles.quickButtonText, { color: activeTheme.primary }]}>Par défaut</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.quickButton, { borderColor: activeTheme.primary }]}
                    onPress={() => {
                      const allColumns = availableColumns.map(col => col.key);
                      setSelectedColumns(allColumns);
                    }}
                  >
                    <Text style={[styles.quickButtonText, { color: activeTheme.primary }]}>Tout</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.quickButton, { borderColor: activeTheme.error }]}
                    onPress={() => setSelectedColumns([])}
                  >
                    <Text style={[styles.quickButtonText, { color: activeTheme.error }]}>Aucun</Text>
                  </TouchableOpacity>
                </View>

                {/* Liste des colonnes */}
                <View style={styles.columnsSimpleList}>
                  {availableColumns.map((column) => {
                    const isSelected = selectedColumns.includes(column.key);
                    return (
                      <TouchableOpacity
                        key={column.key}
                        style={[
                          styles.columnSimpleItem,
                          {
                            backgroundColor: isSelected ? activeTheme.primary + '10' : 'transparent',
                            borderColor: activeTheme.border,
                          }
                        ]}
                        onPress={() => toggleColumn(column.key)}
                      >
                        <View style={[
                          styles.checkbox,
                          {
                            backgroundColor: isSelected ? activeTheme.primary : 'transparent',
                            borderColor: isSelected ? activeTheme.primary : activeTheme.border,
                          }
                        ]}>
                          {isSelected && <Text style={{ color: activeTheme.text.onPrimary, fontSize: 12 }}>✓</Text>}
                        </View>
                        <Text style={[
                          styles.columnSimpleLabel,
                          { color: isSelected ? activeTheme.primary : activeTheme.text.primary }
                        ]}>
                          {column.label}
                        </Text>
                        {column.defaultSelected && (
                          <View style={[styles.recommendedBadge, { backgroundColor: activeTheme.warning + '30' }]}>
                            <Text style={[styles.recommendedText, { color: activeTheme.warning }]}>★</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Boutons d'action */}
            <View style={styles.actionButtons}>
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
                    opacity: selectedColumns.length === 0 ? 0.5 : 1
                  }
                ]}
                onPress={handleCSVExport}
                disabled={selectedColumns.length === 0}
              >
                <Text style={[styles.exportButtonText, { color: activeTheme.text.onPrimary }]}>
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