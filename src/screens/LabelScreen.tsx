import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { Item } from '../database/database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

const LabelScreen = () => {
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const items = useSelector((state: any) => state.items.items);

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const getQRCodeBase64 = async (value: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const qrRef = React.createRef();
      const qrCode = (
        <QRCode
          value={value}
          size={150}
          getRef={(c) => {
            if (c) {
              c.toDataURL((base64: string) => {
                resolve(`data:image/png;base64,${base64}`);
              });
            }
          }}
          onError={(err: any) => reject(err)}
        />
      );
      
      // Force le rendu du QR code
      const RootComponent = () => qrCode;
      require('react-native').AppRegistry.registerComponent('QRTemp', () => RootComponent);
    });
  };

  const generateLabels = async () => {
    try {
      console.log('Début génération labels');
      
      // Vérifier le partage
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil');
        return;
      }

      // Sélectionner les items
      const itemsToGenerate = selectedItems.length > 0 
        ? items.filter((item: Item) => selectedItems.includes(item.id!))
        : items;

      if (itemsToGenerate.length === 0) {
        Alert.alert('Erreur', 'Aucun article à générer');
        return;
      }

      // Générer le HTML
      const labelsPerPage = 44;
      const pages = Math.ceil(itemsToGenerate.length / labelsPerPage);
      
      let fullHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page { 
                size: A4 portrait; 
                margin: 0; 
              }
              body { 
                margin: 0; 
                padding: 0; 
                width: 210mm;
                height: 297mm;
              }
              .page {
                width: 210mm;
                height: 297mm;
                display: grid;
                grid-template-columns: repeat(4, 48.5mm);
                grid-template-rows: repeat(11, 25.4mm);
                gap: 0;
                padding: 5mm 8mm;
                box-sizing: border-box;
                page-break-after: always;
              }
              .page:last-child {
                page-break-after: auto;
              }
              .label {
                width: 48.5mm;
                height: 25.4mm;
                padding: 2mm;
                box-sizing: border-box;
                border: 1px solid #000;
                display: flex;
                flex-direction: row;
                overflow: hidden;
              }
              .label-content {
                flex: 1;
                margin-right: 2mm;
                overflow: hidden;
              }
              .title {
                font-size: 10pt;
                font-weight: bold;
                margin-bottom: 1mm;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .separator {
                height: 1px;
                background: black;
                margin: 1mm 0;
              }
              .description {
                font-size: 8pt;
                margin: 1mm 0;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
              }
              .price {
                font-size: 9pt;
                font-weight: bold;
              }
              .qr-code {
                width: 15mm;
                height: 15mm;
              }
              .qr-code img {
                width: 100%;
                height: 100%;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
    `;

      // Générer les pages
      for (let page = 0; page < pages; page++) {
        fullHTML += '<div class="page">';
        const start = page * labelsPerPage;
        const end = start + labelsPerPage;
        const currentLabels = itemsToGenerate.slice(start, end);

        // Générer les étiquettes
        for (let i = 0; i < labelsPerPage; i++) {
          if (i < currentLabels.length) {
            const label = currentLabels[i];
            try {
              const qrCodeBase64 = await getQRCodeBase64(label.qrCode);
              
              fullHTML += `
                <div class="label">
                  <div class="label-content">
                    <div class="title">${label.name}</div>
                    <div class="separator"></div>
                    <div class="description">${label.description || ''}</div>
                    <div class="price">Prix: ${label.sellingPrice}€</div>
                  </div>
                  <div class="qr-code">
                    <img src="${qrCodeBase64}" alt="QR Code" />
                  </div>
                </div>
              `;
            } catch (error) {
              console.error('Erreur génération QR code pour', label.name, error);
            }
          } else {
            fullHTML += '<div class="label"></div>';
          }
        }
        fullHTML += '</div>';
      }

      fullHTML += `
          </body>
        </html>
      `;

      // Générer le PDF
      const { uri: pdfUri } = await Print.printToFileAsync({
        html: fullHTML,
        base64: false
      });

      // Copier dans le dossier Documents
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `etiquettes-${timestamp}.pdf`;
      const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: pdfUri,
        to: destinationUri
      });

      // Partager le fichier
      await Sharing.shareAsync(destinationUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Sauvegarder les étiquettes',
        UTI: 'com.adobe.pdf'
      });

    } catch (error) {
      console.error('Erreur complète:', error);
      Alert.alert('Erreur', 'Impossible de générer ou partager les étiquettes');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Génération d'étiquettes</Text>
        <TouchableOpacity 
          style={styles.generateButton}
          onPress={generateLabels}
        >
          <Text style={styles.generateButtonText}>
            {selectedItems.length > 0 
              ? `Générer ${selectedItems.length} étiquettes`
              : 'Générer toutes les étiquettes'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[
              styles.itemRow,
              selectedItems.includes(item.id!) && styles.selectedItem
            ]}
            onPress={() => toggleItemSelection(item.id!)}
          >
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>{item.sellingPrice}€</Text>
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
});

export default LabelScreen; 