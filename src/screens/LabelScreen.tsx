import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSelector } from 'react-redux';
import { Item, Container } from '../database/database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { HiddenQRCode } from '../components/HiddenQRCode';

const LabelScreen = () => {
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [selectedContainers, setSelectedContainers] = useState<number[]>([]);
  const [showContainers, setShowContainers] = useState(false);
  const items = useSelector((state: any) => state.items.items);
  const containers = useSelector((state: any) => state.containers.containers);

  const [qrCaptureValue, setQrCaptureValue] = useState<string | null>(null);
  const [qrCaptureResolve, setQrCaptureResolve] = useState<((data: string) => void) | null>(null);

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
      const marginXFixed = 9; // augmenté à 15mm pour test
      const marginYFixed = 9; // augmenté à 15mm pour test

      const itemsToGenerate = selectedItems.length > 0 
        ? items.filter((item: Item) => selectedItems.includes(item.id!))
        : items;

      const containersToGenerate = selectedContainers.length > 0
        ? containers.filter((container: Container) => selectedContainers.includes(container.id!))
        : [];

      if (itemsToGenerate.length === 0 && containersToGenerate.length === 0) {
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
          
          // Application directe des marges fixes
          const posX = marginXFixed + (col * labelWidth);
          const posY = marginYFixed + (row * labelHeight);

          // Dessiner le cadre de l'étiquette
          doc.rect(posX, posY, labelWidth, labelHeight);
          
          // Titre
          doc.setFontSize(11);
          doc.text(itemsToGenerate[i].name, posX + labelWidth/2, posY + 5, { align: 'center' });
          
          // Ligne séparatrice
          doc.line(posX, posY + 7, posX + labelWidth, posY + 7);
          
          // Description
          doc.setFontSize(8);
          const description = doc.splitTextToSize(itemsToGenerate[i].description || '', labelWidth - 15);
          doc.text(description, posX + 2, posY + 11);
          
          // Prix (à gauche en bas)
          doc.setFontSize(10);
          doc.text(`${itemsToGenerate[i].sellingPrice}€`, posX + 2, posY + labelHeight - 2);
          
          // QR Code (à droite en bas)
          const qrCodeBase64 = await getQRCodeBase64Local(itemsToGenerate[i].qrCode);
          doc.addImage(qrCodeBase64.split(',')[1], 'PNG', 
            posX + labelWidth - 12,
            posY + labelHeight - 14,
            12, 12);

          currentIndex++;
        }

        // Génération des étiquettes de containers
        for (let i = 0; i < containersToGenerate.length; i++) {
          if (currentIndex > 0 && currentIndex % totalLabelsPerPage === 0) {
            doc.addPage();
          }

          const indexSurPage = currentIndex % totalLabelsPerPage;
          const col = indexSurPage % labelsPerRow;
          const row = Math.floor(indexSurPage / labelsPerRow);
          
          // Application directe des marges fixes
          const posX = marginXFixed + (col * labelWidth);
          const posY = marginYFixed + (row * labelHeight);

          // Dessiner le cadre de l'étiquette
          doc.rect(posX, posY, labelWidth, labelHeight);
          
          // Titre
          doc.setFontSize(11);
          doc.text(containersToGenerate[i].name, posX + labelWidth/2, posY + 5, { align: 'center' });
          
          // Ligne séparatrice
          doc.line(posX, posY + 7, posX + labelWidth, posY + 7);
          
          // Description
          doc.setFontSize(8);
          const description = doc.splitTextToSize(containersToGenerate[i].description || '', labelWidth - 15);
          doc.text(description, posX + 2, posY + 11);
          
          // Numéro du container (à gauche en bas)
          doc.setFontSize(10);
          doc.text(`#${containersToGenerate[i].number}`, posX + 2, posY + labelHeight - 2);
          
          // QR Code (à droite en bas)
          const qrCodeBase64 = await getQRCodeBase64Local(containersToGenerate[i].qrCode);
          doc.addImage(qrCodeBase64.split(',')[1], 'PNG', 
            posX + labelWidth - 12,
            posY + labelHeight - 14,
            12, 12);

          currentIndex++;
        }

        doc.save(`etiquettes-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
      } else {
        // Génération du PDF pour iOS (mobile) en utilisant expo-print avec un HTML personnalisé
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
          const posX = marginXFixed + (col * labelWidth);
          const posY = marginYFixed + (row * labelHeight);
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
            onPress={() => setShowContainers(false)}
          >
            <Text style={[styles.filterButtonText, !showContainers && styles.filterButtonTextActive]}>
              Articles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, showContainers && styles.filterButtonActive]}
            onPress={() => setShowContainers(true)}
          >
            <Text style={[styles.filterButtonText, showContainers && styles.filterButtonTextActive]}>
              Containers
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.generateButton}
          onPress={generateLabels}
        >
          <Text style={styles.generateButtonText}>
            {showContainers 
              ? `Générer ${selectedContainers.length || 'tous les'} containers`
              : `Générer ${selectedItems.length || 'tous les'} articles`}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={showContainers ? containers : items}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[
              styles.itemRow,
              showContainers 
                ? selectedContainers.includes(item.id!) && styles.selectedItem
                : selectedItems.includes(item.id!) && styles.selectedItem
            ]}
            onPress={() => showContainers 
              ? toggleContainerSelection(item.id!)
              : toggleItemSelection(item.id!)
            }
          >
            <Text style={styles.itemName}>{item.name}</Text>
            {showContainers 
              ? <Text style={styles.itemNumber}>#{item.number}</Text>
              : <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
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
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    color: '#007AFF',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  itemNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
});

export default LabelScreen; 