import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { handleLabelGenerationError, handleLabelPrintingError, handleQRCodeError } from '../utils/labelErrorHandler';
import { checkNetworkConnection } from '../utils/errorHandler';
import { useRouter } from 'expo-router';
import { QRCodeGenerator } from './QRCodeGenerator';
import { DataMatrixGenerator } from './DataMatrixGenerator';
import { parseId } from '../utils/identifierManager';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface LabelGeneratorProps {
  items: Array<{ id: number; name: string; qrCode: string; description?: string; sellingPrice?: number; number?: string }>;
  onComplete: () => void;
  onError: (error: Error) => void;
  mode: 'items' | 'containers';
  compact?: boolean;
}

export const LabelGenerator: React.FC<LabelGeneratorProps> = ({
  items,
  onComplete,
  onError,
  mode,
  compact = false
}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const [currentCode, setCurrentCode] = useState<{ data: string; size: number } | null>(null);

  const handleComplete = () => {
    if (Platform.OS === 'web') {
      onComplete();
    } else {
      router.replace('/(tabs)');
    }
  };

  const generateCode = async (data: string): Promise<string> => {
    try {
      if (!data) {
        throw new Error('Code data is required');
      }

      const size = compact ? 150 : 200;
      
      return new Promise<string>((resolve, reject) => {
        setCurrentCode({ data, size });

        // Attendre que le composant soit rendu
        setTimeout(async () => {
          try {
            if (!codeContainerRef.current) {
              throw new Error('Code container reference not available');
            }

            const canvas = await html2canvas(codeContainerRef.current, {
              backgroundColor: '#ffffff',
              scale: 2,
              logging: false,
              useCORS: true,
              allowTaint: true
            });

            resolve(canvas.toDataURL('image/png'));
          } catch (error) {
            console.error('Erreur lors de la capture du code:', error);
            reject(error);
          } finally {
            setCurrentCode(null);
          }
        }, 200); // Augmenter le délai pour s'assurer que le rendu est complet
      });
    } catch (error) {
      throw handleQRCodeError(error as Error, 'LabelGenerator.generateCode');
    }
  };

  const CodeRenderer = useCallback(() => {
    if (!currentCode) return null;

    const { type } = parseId(currentCode.data);
    const CodeComponent = type === 'ITEM' ? DataMatrixGenerator : QRCodeGenerator;

    return (
      <div style={{ 
        width: currentCode.size, 
        height: currentCode.size, 
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <CodeComponent
          value={currentCode.data}
          size={currentCode.size}
        />
      </div>
    );
  }, [currentCode]);

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
        const qrCodeBase64 = await generateCode(item.qrCode);
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
      handleComplete();
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
          const description = doc.splitTextToSize(item.description, labelWidth - 20);
          doc.text(description, posX + 2, posY + 11);
        }
        
        // Prix
        if (item.sellingPrice !== undefined) {
          doc.setFontSize(13);
          doc.text(`${item.sellingPrice}€`, posX + 15, posY + labelHeight - 5, { align: 'center' });
        }
        
        // DataMatrix pour les articles
        const codeBase64 = await generateCode(item.qrCode);
        doc.addImage(codeBase64, 'PNG', 
          posX + labelWidth - 20,
          posY + labelHeight - 20,
          18, 18);

        setProgress(((i + 1) / items.length) * 100);
      }

      doc.save(`etiquettes-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
      handleComplete();
    } catch (error) {
      handleLabelGenerationError(error as Error, 'LabelGenerator.generateItemsPDF');
      onError(error as Error);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <div 
        ref={codeContainerRef}
        style={{ 
          position: 'absolute', 
          opacity: 1, 
          zIndex: -1, 
          backgroundColor: 'white',
          overflow: 'hidden'
        }}
      >
        <CodeRenderer />
      </div>

      {!compact && <Text style={styles.title}>Génération des étiquettes</Text>}
      
      {loading && (
        <View style={[styles.loadingContainer, compact && styles.loadingContainerCompact]}>
          <ActivityIndicator size={compact ? "small" : "large"} color="#007AFF" />
          <Text style={[styles.progressText, compact && styles.progressTextCompact]}>{Math.round(progress)}%</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button, 
          loading && styles.buttonDisabled,
          compact && styles.buttonCompact
        ]}
        onPress={mode === 'containers' ? generateContainerPDF : generateItemsPDF}
        disabled={loading || items.length === 0}
      >
        <Text style={[styles.buttonText, compact && styles.buttonTextCompact]}>
          {loading ? 'Génération...' : `Générer ${items.length} étiquette${items.length > 1 ? 's' : ''}`}
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
  containerCompact: {
    padding: 8,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  loadingContainerCompact: {
    marginVertical: 8,
  },
  progressText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  progressTextCompact: {
    marginTop: 4,
    fontSize: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonCompact: {
    padding: 10,
    borderRadius: 6,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextCompact: {
    fontSize: 14,
  },
  infoText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#666',
  },
}); 