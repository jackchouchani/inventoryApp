import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform, TextInput, ScrollView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Item, Container, getContainers, Category } from '../database/database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { HiddenQRCode } from '../components/HiddenQRCode';
import { setContainers } from '../store/containersSlice';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import DateTimePicker from '@react-native-community/datetimepicker';

// Ajout de l'interface Filters
interface Filters {
  search: string;
  categoryId: number | null;
  containerId: number | null;
  minPrice: string;
  maxPrice: string;
  startDate: Date | null;
  endDate: Date | null;
  status: 'all' | 'available' | 'sold';
}

const LabelScreen = () => {
  const dispatch = useDispatch();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedContainers, setSelectedContainers] = useState<number[]>([]);
  const [showContainers, setShowContainers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showRecentOnly, setShowRecentOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    categoryId: null,
    containerId: null,
    minPrice: '',
    maxPrice: '',
    startDate: null,
    endDate: null,
    status: 'all'
  });
  
  // Ajout des types explicites pour le state Redux
  const items = useSelector((state: any) => state.items.items) as Item[];
  const containers = useSelector((state: any) => state.containers.containers) as Container[];
  const categories = useSelector((state: any) => state.categories.categories);

  // Ajout de logs pour debug
  console.log('Mode containers:', showContainers);
  console.log('Containers disponibles:', containers);
  console.log('Items disponibles:', items);

  const [qrCaptureValue, setQrCaptureValue] = useState<string | null>(null);
  const [qrCaptureResolve, setQrCaptureResolve] = useState<((data: string) => void) | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Chargement des containers au montage du composant
  useEffect(() => {
    const loadContainers = async () => {
      try {
        const containersData = await getContainers();
        dispatch(setContainers(containersData));
      } catch (error) {
        console.error('Erreur lors du chargement des containers:', error);
      }
    };
    
    loadContainers();
  }, [dispatch]);

  // Mettre à jour selectedItems quand les filtres changent
  useEffect(() => {
    const filteredIds = filteredItems.map(item => item.id!);
    setSelectedItems(filteredIds);
  }, [filters, items]); // Dépendances du useEffect

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleContainerSelection = (containerId: number) => {
    setSelectedContainers(prev => 
      prev.includes(containerId) 
        ? prev.filter(id => id !== containerId)
        : [...prev, containerId]
    );
  };

  const getQRCodeBase64Local = (value: string): Promise<string> => {
    return new Promise((resolve) => {
      setQrCaptureResolve(() => resolve);
      setQrCaptureValue(value);
    });
  };

  const handleQRCodeCapture = (data: string) => {
    if (qrCaptureResolve) {
      qrCaptureResolve(`data:image/png;base64,${data}`);
      setQrCaptureResolve(null);
      setQrCaptureValue(null);
    }
  };

  const generateLabels = async () => {
    try {
      // Dimensions de la page A4 en mm
      const pageWidth = 210; // largeur en mm
      const pageHeight = 297; // hauteur en mm

      // Dimensions souhaitées pour chaque étiquette
      const labelWidth = 48.5; // mm
      const labelHeight = 25.4; // mm

      // Nombre d'étiquettes par ligne et par colonne
      const labelsPerRow = 4;
      const labelsPerColumn = 11;
      const totalLabelsPerPage = labelsPerRow * labelsPerColumn;

      // Marges fixes pour éviter les problèmes d'impression
      const marginXFixed = 11;
      const marginYFixed = 11;

      const itemsToGenerate = selectedItems.length > 0 
        ? items.filter((item: Item) => selectedItems.includes(item.id!))
        : items;

      if (itemsToGenerate.length === 0) {
        Alert.alert('Erreur', 'Aucun élément à générer');
        return;
      }

      if (Platform.OS === 'web') {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        let currentIndex = 0;

        // Génération des étiquettes d'articles
        for (let i = 0; i < itemsToGenerate.length; i++) {
          if (currentIndex > 0 && currentIndex % totalLabelsPerPage === 0) {
            doc.addPage();
          }

          const indexSurPage = currentIndex % totalLabelsPerPage;
          const col = indexSurPage % labelsPerRow;
          const row = Math.floor(indexSurPage / labelsPerRow);
          
          const posX = marginXFixed + (col * labelWidth);
          const posY = marginYFixed + (row * labelHeight);

          // Dessiner le cadre de l'étiquette
          doc.rect(posX, posY, labelWidth, labelHeight);
          
          // Titre
          doc.setFontSize(11);
          doc.text(itemsToGenerate[i].name, posX + labelWidth/2, posY + 5, { align: 'center' });
          
          // Ligne séparatrice
          doc.line(posX + 5, posY + 7, posX + labelWidth - 5, posY + 7);
          
          // Description
          doc.setFontSize(8);
          const description = doc.splitTextToSize(itemsToGenerate[i].description || '', labelWidth - 15);
          doc.text(description, posX + 2, posY + 11);
          
          // Prix (à gauche en bas)
          doc.setFontSize(13);
          doc.text(`${itemsToGenerate[i].sellingPrice}€`, posX + labelWidth/2, posY + labelHeight - 5, { align: 'center' });
          
          // QR Code (à droite en bas)
          const qrCodeBase64 = await getQRCodeBase64Local(itemsToGenerate[i].qrCode);
          doc.addImage(qrCodeBase64.split(',')[1], 'PNG', 
            posX + labelWidth - 13,
            posY + labelHeight - 14,
            12, 12);

          currentIndex++;
        }

        doc.save(`etiquettes-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
      } else {
        // Version mobile avec HTML
        let fullHTML = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body {
                margin: ${marginYFixed}mm ${marginXFixed}mm;
                padding: 0;
              }
              .page {
                width: ${pageWidth}mm;
                height: ${pageHeight}mm;
                position: relative;
                page-break-after: always;
              }
              .label {
                width: ${labelWidth}mm;
                height: ${labelHeight}mm;
                position: absolute;
                border: 1px solid #000;
                box-sizing: border-box;
                padding: 0;
                font-family: Arial, sans-serif;
              }
              .label-title {
                text-align: center;
                font-size: 11pt;
                font-weight: bold;
                margin: 2mm 1mm;
                border-bottom: 1px solid black;
                padding-bottom: 1mm;
              }
              .label-description {
                font-size: 8pt;
                margin: 1mm 1mm;
                height: 8mm;
                overflow: hidden;
              }
              .label-footer {
                position: absolute;
                bottom: 1mm;
                width: 100%;
                display: flex;
                justify-content: space-between;
                padding: 0 1mm;
              }
              .label-price {
                font-size: 10pt;
                font-weight: bold;
              }
              .label-qr {
                width: 12mm;
                height: 12mm;
              }
            </style>
          </head>
          <body>
        `;

        for (let i = 0; i < itemsToGenerate.length; i++) {
          if (i % totalLabelsPerPage === 0) {
            if (i > 0) {
              fullHTML += `</div>`;
            }
            fullHTML += `<div class="page">`;
          }
          const indexSurPage = i % totalLabelsPerPage;
          const col = indexSurPage % labelsPerRow;
          const row = Math.floor(indexSurPage / labelsPerRow);
          const posX = col * labelWidth;
          const posY = row * labelHeight;
          fullHTML += `
            <div class="label" style="left: ${posX}mm; top: ${posY}mm;">
              <div class="label-title">${itemsToGenerate[i].name}</div>
              <div class="label-description">${itemsToGenerate[i].description || ''}</div>
              <div class="label-footer">
                <div class="label-price">${itemsToGenerate[i].sellingPrice}€</div>
                <img class="label-qr" src="data:image/png;base64,${await getQRCodeBase64Local(itemsToGenerate[i].qrCode)}"/>
              </div>
            </div>`;
        }
        fullHTML += `</div></body></html>`;

        const { uri: pdfUri } = await Print.printToFileAsync({
          html: fullHTML,
          base64: false
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `etiquettes-${timestamp}.pdf`;
        const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.copyAsync({
          from: pdfUri,
          to: destinationUri
        });

        await Sharing.shareAsync(destinationUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Sauvegarder les étiquettes',
          UTI: 'com.adobe.pdf'
        });
      }
    } catch (error) {
      console.error('Erreur lors de la génération ou du partage des étiquettes:', error);
      Alert.alert('Erreur', 'Impossible de générer ou partager les étiquettes');
    }
  };

  const generateContainerLabels = async () => {
    try {
      const containersToGenerate = selectedContainers.length > 0
        ? containers.filter((container: Container) => selectedContainers.includes(container.id!))
        : containers;

      if (containersToGenerate.length === 0) {
        Alert.alert('Erreur', 'Aucun container à générer');
        return;
      }

      if (Platform.OS === 'web') {
        const { jsPDF } = await import('jspdf');

        // Dimensions en mm
        const labelWidth = 100; // 10 cm
        const labelHeight = 150; // 15 cm
        const margin = 5;

        // Créer un document pour chaque container
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [labelWidth, labelHeight]
        });

        for (let i = 0; i < containersToGenerate.length; i++) {
          const container = containersToGenerate[i];

          // Titre du container
          doc.setFontSize(24);
          doc.text(container.name, labelWidth/2, margin + 20, { align: 'center' });

          // Numéro du container
          doc.setFontSize(36);
          doc.text(`#${container.number}`, labelWidth/2, margin + 40, { align: 'center' });

          // QR Code (grand format)
          const qrCodeBase64 = await getQRCodeBase64Local(container.qrCode);
          const qrSize = 70; // 7cm
          doc.addImage(qrCodeBase64.split(',')[1], 'PNG',
            (labelWidth - qrSize) / 2,
            margin + 50,
            qrSize, qrSize
          );

          // Description (si présente)
          if (container.description) {
            doc.setFontSize(12);
            const description = doc.splitTextToSize(container.description, labelWidth - (2 * margin));
            doc.text(description, labelWidth/2, margin + 130, { align: 'center' });
          }

          if (i < containersToGenerate.length - 1) {
            doc.addPage([labelWidth, labelHeight]);
          }
        }

        doc.save(`etiquettes-containers-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
      } else {
        // Version mobile avec HTML
        let fullHTML = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page {
                size: 100mm 150mm;
                margin: 0;
              }
              body {
                margin: 5mm;
                font-family: Arial, sans-serif;
              }
              .container-label {
                width: 90mm;
                height: 140mm;
                text-align: center;
                page-break-after: always;
              }
              .container-name {
                font-size: 24pt;
                font-weight: bold;
                margin-top: 15mm;
              }
              .container-number {
                font-size: 36pt;
                font-weight: bold;
                margin: 10mm 0;
              }
              .container-qr {
                width: 70mm;
                height: 70mm;
                margin: 5mm auto;
              }
              .container-description {
                font-size: 12pt;
                margin-top: 10mm;
                padding: 0 5mm;
              }
            </style>
          </head>
          <body>
        `;

        for (const container of containersToGenerate) {
          fullHTML += `
            <div class="container-label">
              <div class="container-name">${container.name}</div>
              <div class="container-number">#${container.number}</div>
              <img class="container-qr" src="data:image/png;base64,${await getQRCodeBase64Local(container.qrCode)}"/>
              ${container.description ? `<div class="container-description">${container.description}</div>` : ''}
            </div>
          `;
        }

        fullHTML += `</body></html>`;

        const { uri: pdfUri } = await Print.printToFileAsync({
          html: fullHTML,
          base64: false
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `etiquettes-containers-${timestamp}.pdf`;
        const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.copyAsync({
          from: pdfUri,
          to: destinationUri
        });

        await Sharing.shareAsync(destinationUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Sauvegarder les étiquettes',
          UTI: 'com.adobe.pdf'
        });
      }
    } catch (error) {
      console.error('Erreur lors de la génération des étiquettes containers:', error);
      Alert.alert('Erreur', 'Impossible de générer les étiquettes containers');
    }
  };

  const onDateChange = (event: any, selectedDate: Date | undefined, isStartDate: boolean) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
    }

    if (selectedDate) {
      setFilters(prev => ({
        ...prev,
        [isStartDate ? 'startDate' : 'endDate']: selectedDate
      }));
    }
  };

  const renderDatePicker = (isStartDate: boolean) => {
    if (Platform.OS === 'web') {
      return (
        <input
          type="date"
          style={{
            opacity: 0,
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'pointer'
          }}
          onClick={(e) => e.currentTarget.showPicker()}
          onChange={(e) => {
            const date = e.target.value ? new Date(e.target.value) : undefined;
            onDateChange(null, date, isStartDate);
          }}
        />
      );
    }

    return (
      (isStartDate ? showStartDatePicker : showEndDatePicker) && (
        <DateTimePicker
          value={isStartDate ? filters.startDate || new Date() : filters.endDate || new Date()}
          mode="date"
          onChange={(event, date) => onDateChange(event, date, isStartDate)}
        />
      )
    );
  };

  // Filtrer les items
  const filteredItems = items.filter((item: Item) => {
    // Filtres existants
    const matchesSearch = !filters.search || item.name.toLowerCase().includes(filters.search.toLowerCase());
    const matchesCategory = !filters.categoryId || item.categoryId === filters.categoryId;
    const matchesContainer = !filters.containerId || item.containerId === filters.containerId;
    
    // Filtre de prix
    const minPrice = parseFloat(filters.minPrice);
    const maxPrice = parseFloat(filters.maxPrice);
    const matchesPrice = 
      (!minPrice || item.sellingPrice >= minPrice) &&
      (!maxPrice || item.sellingPrice <= maxPrice);

    // Filtre de date
    const itemDate = item.createdAt ? new Date(item.createdAt) : null;
    const matchesDate = 
      (!filters.startDate || !itemDate || itemDate >= filters.startDate) &&
      (!filters.endDate || !itemDate || itemDate <= filters.endDate);

    // Filtre de status
    const matchesStatus = filters.status === 'all' || item.status === filters.status;

    return matchesSearch && matchesCategory && matchesContainer && 
           matchesPrice && matchesDate && matchesStatus;
  });

  return (
    <View style={styles.container}>
      {qrCaptureValue && (
        <HiddenQRCode value={qrCaptureValue} onCapture={handleQRCodeCapture} />
      )}
      <View style={styles.header}>
        <Text style={styles.title}>Génération d'étiquettes</Text>
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterButton, !showContainers && styles.filterButtonActive]}
            onPress={() => {
              console.log('Switch to Articles');
              setShowContainers(false);
            }}
          >
            <Text style={[styles.filterButtonText, !showContainers && styles.filterButtonTextActive]}>
              Articles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, showContainers && styles.filterButtonActive]}
            onPress={() => {
              console.log('Switch to Containers');
              setShowContainers(true);
            }}
          >
            <Text style={[styles.filterButtonText, showContainers && styles.filterButtonTextActive]}>
              Containers
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.generateButton}
          onPress={() => {
            console.log('Generate button pressed, showContainers:', showContainers);
            if (showContainers) {
              generateContainerLabels();
            } else {
              generateLabels();
            }
          }}
        >
          <Text style={styles.generateButtonText}>
            {showContainers 
              ? `Générer ${selectedContainers.length || 'tous les'} containers`
              : `Générer ${selectedItems.length || 'tous les'} articles`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Ajout d'un texte de debug pour voir ce qui est affiché */}
      <Text style={styles.debugText}>
        {showContainers 
          ? `Affichage des containers (${containers.length})` 
          : `Affichage des articles (${items.length})`}
      </Text>

      {!showContainers && (
        <View style={styles.filtersSection}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher..."
              value={filters.search}
              onChangeText={(text) => setFilters({ ...filters, search: text })}
            />
            <TouchableOpacity
              style={[styles.filterButton, showFilters && styles.filterButtonActive]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>
                Filtres {showFilters ? '✕' : '▼'}
              </Text>
            </TouchableOpacity>
          </View>

          {showFilters && (
            <View style={styles.filtersContainer}>
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Catégorie</Text>
                <View style={styles.filterOptions}>
                  {categories.map((category: Category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.filterOption,
                        filters.categoryId === category.id && styles.filterOptionSelected,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          categoryId: filters.categoryId === category.id ? null : category.id ?? null,
                        })
                      }
                    >
                      <Text>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Container</Text>
                <View style={styles.filterOptions}>
                  {containers.map((container) => (
                    <TouchableOpacity
                      key={container.id}
                      style={[
                        styles.filterOption,
                        filters.containerId === container.id && styles.filterOptionSelected,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          containerId: filters.containerId === container.id ? null : container.id ?? null,
                        })
                      }
                    >
                      <Text>{container.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Disponibilité</Text>
                <View style={styles.filterOptions}>
                  {['all', 'available', 'sold'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterOption,
                        filters.status === status && styles.filterOptionSelected,
                      ]}
                      onPress={() => setFilters({ 
                        ...filters, 
                        status: status as Filters['status'] 
                      })}
                    >
                      <Text>{
                        status === 'all' ? 'Tous' :
                        status === 'available' ? 'Disponible' : 'Vendu'
                      }</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Date de création</Text>
                <View style={styles.dateInputs}>
                  <TouchableOpacity style={styles.dateInput}>
                    <Text style={styles.dateInputText}>
                      {filters.startDate 
                        ? filters.startDate.toLocaleDateString() 
                        : 'Date début'}
                    </Text>
                    {renderDatePicker(true)}
                  </TouchableOpacity>
                  <Text>-</Text>
                  <TouchableOpacity style={styles.dateInput}>
                    <Text style={styles.dateInputText}>
                      {filters.endDate 
                        ? filters.endDate.toLocaleDateString() 
                        : 'Date fin'}
                    </Text>
                    {renderDatePicker(false)}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Fourchette de prix</Text>
                <View style={styles.priceInputs}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Min"
                    value={filters.minPrice}
                    onChangeText={(text) => setFilters({ ...filters, minPrice: text })}
                    keyboardType="numeric"
                  />
                  <Text>-</Text>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="Max"
                    value={filters.maxPrice}
                    onChangeText={(text) => setFilters({ ...filters, maxPrice: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      <FlatList<Item | Container>
        data={showContainers ? containers : filteredItems}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[
              styles.itemRow,
              showContainers 
                ? selectedContainers.includes(item.id!) && styles.selectedItem
                : selectedItems.includes(item.id!) && styles.selectedItem
            ]}
            onPress={() => {
              if (showContainers) {
                console.log('Container selected:', item.id);
                toggleContainerSelection(item.id!);
              } else {
                toggleItemSelection(item.id!);
              }
            }}
          >
            <Text style={styles.itemName}>{item.name}</Text>
            {showContainers 
              ? <Text style={styles.itemNumber}>#{(item as Container).number}</Text>
              : <Text style={styles.itemPrice}>{(item as Item).sellingPrice}€</Text>
            }
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id!.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  generateButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedItem: {
    backgroundColor: '#e3e3e3',
  },
  itemName: {
    fontSize: 16,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  filterContainer: {
    flexDirection: 'row',
    marginVertical: 10,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500'
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  itemNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  debugText: {
    padding: 10,
    color: '#666',
    fontSize: 12,
  },
  filtersSection: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  filtersContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    padding: 8,
    margin: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
  },
  filterOptionSelected: {
    backgroundColor: '#e3e3e3',
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    width: 100,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginHorizontal: 5,
  },
  dateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dateInputText: {
    color: '#333',
    fontSize: 13,
  },
});

export default LabelScreen; 