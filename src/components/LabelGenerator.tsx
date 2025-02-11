import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { handleLabelGenerationError, handleLabelPrintingError, handleQRCodeError } from '../utils/labelErrorHandler';
import { checkNetworkConnection } from '../utils/errorHandler';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

interface LabelGeneratorProps {
  items: Array<{ id: number; name: string; qrCode: string; description?: string; sellingPrice?: number; number?: string }>;
  onComplete: () => void;
  onError: (error: Error) => void;
  mode: 'items' | 'containers';
}

export const LabelGenerator: React.FC<LabelGeneratorProps> = ({
  items,
  onComplete,
  onError,
  mode
}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateQRCode = async (data: string): Promise<string> => {
    try {
      if (!data) {
        throw new Error('QR code data is required');
      }
      return await QRCode.toDataURL(data);
    } catch (error) {
      throw handleQRCodeError(error as Error, 'LabelGenerator.generateQRCode');
    }
  };

  const generateContainerPDF = async () => {
    try {
      setLoading(true);

      // Vérifier la connexion réseau
      const isConnected = await checkNetworkConnection();
      if (!isConnected) return;

      // Dimensions pour les containers (en mm)
      const labelWidth = 100; // 10cm
      const labelHeight = 150; // 15cm
      const margin = 5;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [labelWidth, labelHeight]
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.qrCode) {
          throw new Error(`QR code missing for container ${item.name}`);
        }

        if (i > 0) {
          doc.addPage([labelWidth, labelHeight]);
        }

        // Titre du container
        doc.setFontSize(24);
        doc.text(item.name, labelWidth/2, margin + 20, { align: 'center' });

        // Numéro du container
        doc.setFontSize(36);
        doc.text(`#${item.number}`, labelWidth/2, margin + 40, { align: 'center' });

        // QR Code (grand format)
        const qrCodeBase64 = await generateQRCode(item.qrCode);
        const qrSize = 70; // 7cm
        doc.addImage(qrCodeBase64, 'PNG',
          (labelWidth - qrSize) / 2,
          margin + 50,
          qrSize, qrSize
        );

        // Description (si présente)
        if (item.description) {
          doc.setFontSize(12);
          const description = doc.splitTextToSize(item.description, labelWidth - (2 * margin));
          doc.text(description, labelWidth/2, margin + 130, { align: 'center' });
        }

        setProgress(((i + 1) / items.length) * 100);
      }

      doc.save(`etiquettes-containers-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
      onComplete();
    } catch (error) {
      handleLabelPrintingError(error as Error, 'LabelGenerator.generateContainerPDF');
      onError(error as Error);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const generateItemsPDF = async () => {
    try {
      setLoading(true);

      // Vérifier la connexion réseau
      const isConnected = await checkNetworkConnection();
      if (!isConnected) return;

      // Dimensions de la page A4 en mm
      const pageWidth = 210;
      const pageHeight = 297;

      // Dimensions des étiquettes en mm (48.5 x 25.4 mm)
      const labelWidth = 48.5;
      const labelHeight = 25.4;

      // Nombre d'étiquettes par ligne et par colonne
      const labelsPerRow = 4;
      const labelsPerColumn = 11;
      const totalLabelsPerPage = labelsPerRow * labelsPerColumn;

      // Marges fixes en mm
      const marginXFixed = 11;
      const marginYFixed = 11;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.qrCode) {
          throw new Error(`QR code missing for item ${item.name}`);
        }

        if (i > 0 && i % totalLabelsPerPage === 0) {
          doc.addPage();
        }

        const indexSurPage = i % totalLabelsPerPage;
        const col = indexSurPage % labelsPerRow;
        const row = Math.floor(indexSurPage / labelsPerRow);
        
        const posX = marginXFixed + (col * labelWidth);
        const posY = marginYFixed + (row * labelHeight);

        // Dessiner le cadre de l'étiquette
        doc.rect(posX, posY, labelWidth, labelHeight);
        
        // Titre
        doc.setFontSize(11);
        doc.text(item.name, posX + labelWidth/2, posY + 5, { align: 'center' });
        
        // Ligne séparatrice
        doc.line(posX + 5, posY + 7, posX + labelWidth - 5, posY + 7);
        
        // Description
        if (item.description) {
          doc.setFontSize(8);
          const description = doc.splitTextToSize(item.description, labelWidth - 15);
          doc.text(description, posX + 2, posY + 11);
        }
        
        // Prix
        if (item.sellingPrice !== undefined) {
          doc.setFontSize(13);
          doc.text(`${item.sellingPrice}€`, posX + labelWidth/2, posY + labelHeight - 5, { align: 'center' });
        }
        
        // QR Code
        const qrCodeBase64 = await generateQRCode(item.qrCode);
        doc.addImage(qrCodeBase64, 'PNG', 
          posX + labelWidth - 13,
          posY + labelHeight - 14,
          12, 12);

        setProgress(((i + 1) / items.length) * 100);
      }

      doc.save(`etiquettes-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
      onComplete();
    } catch (error) {
      handleLabelGenerationError(error as Error, 'LabelGenerator.generateItemsPDF');
      onError(error as Error);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Génération des étiquettes</Text>
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={mode === 'containers' ? generateContainerPDF : generateItemsPDF}
        disabled={loading || items.length === 0}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Génération en cours...' : 'Générer les étiquettes'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.infoText}>
        {items.length} étiquette{items.length > 1 ? 's' : ''} à générer
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  progressText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#666',
  },
}); 