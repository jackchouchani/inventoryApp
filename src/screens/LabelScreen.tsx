import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import { Item } from '../database/database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { HiddenQRCode } from '../components/HiddenQRCode';

const LabelScreen = () => {
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const items = useSelector((state: any) => state.items.items);

  const [qrCaptureValue, setQrCaptureValue] = useState<string | null>(null);
  const [qrCaptureResolve, setQrCaptureResolve] = useState<((data: string) => void) | null>(null);

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
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
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil');
        return;
      }

      const itemsToGenerate = selectedItems.length > 0 
        ? items.filter((item: Item) => selectedItems.includes(item.id!))
        : items;

      if (itemsToGenerate.length === 0) {
        Alert.alert('Erreur', 'Aucun article à générer');
        return;
      }

      const labelsPerPage = 44;
      const pages = Math.ceil(itemsToGenerate.length / labelsPerPage);
      
      let fullHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              /* Le PDF est généré en portrait en A4 */
              @page { 
                size: A4 portrait;
                margin: 0;
              }
              body { 
                margin: 0;
                padding: 0;
                width: 210mm;
                height: 297mm;
                position: relative;
              }
              .page {
                width: 210mm;
                height: 297mm;
                position: relative;
              }
              /* 
                Ce conteneur sera transformé pour simuler un Landscape Top Left.
                Il occupe la zone utilisable en paysage (dans le PDF portrait, la zone effective est de 287mm x 200mm)
                et est positionné dès 5mm depuis le bord gauche et en bas (en portrait, le coin inférieur gauche correspond à (5,292))
              */
              .rotated-container {
                position: absolute;
                top: 5mm;
                left: 5mm;
                width: 287mm;
                height: 200mm;
                /* 
                  Pour que le coin (0,0) de la zone de 287x200 soit rendu en bas à gauche (5,292 en portrait),
                  on effectue : translate(-287mm, 0) suivi d'une rotation de -90°.
                */
                transform: rotate(-90deg) translate(-287mm, 0);
                transform-origin: top left;
              }
              /* 
                La grille dans le conteneur tourné.
                Dans la vue finale, chaque cellule aura : 
                  - 25.4mm de largeur (ce qui correspond à la dimension courte de l'étiquette)
                  - 48.5mm de hauteur (la dimension longue)
                Les gaps ont été calculés pour que la grille occupe exactement 287 x 200 mm.
                L'ordre de remplissage est "par colonne" (de haut en bas).
              */
              .grid-container {
                width: 287mm;
                height: 200mm;
                display: grid;
                grid-template-columns: repeat(11, 25.4mm);
                grid-template-rows: repeat(4, 48.5mm);
                column-gap: 0.76mm;
                row-gap: 2mm;
                grid-auto-flow: column;
              }
              /* Chaque étiquette est conçue pour s'afficher dans une cellule de la grille.
                 Ainsi, dans la vue finale (après rotation), elle occupera 25.4mm (largeur) x 48.5mm (hauteur).
                 Vous pouvez ajuster le padding ou le contenu intérieur au besoin.
              */
              .label {
                width: 25.4mm;
                height: 48.5mm;
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
            <div class="page">
              <div class="rotated-container">
                <div class="grid-container">
      `;

      for (let i = 0; i < labelsPerPage; i++) {
        if (i < itemsToGenerate.length) {
          const label = itemsToGenerate[i];
          try {
            const qrCodeBase64 = await getQRCodeBase64Local(label.qrCode);
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
          fullHTML += `<div class="label"></div>`;
        }
      }

      fullHTML += `
                </div> <!-- fermeture grid-container -->
              </div> <!-- fermeture rotated-container -->
            </div> <!-- fermeture page -->
          </body>
        </html>
      `;

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

    } catch (error) {
      console.error('Erreur complète:', error);
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