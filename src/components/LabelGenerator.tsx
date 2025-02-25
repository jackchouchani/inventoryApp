import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { handleLabelGenerationError, handleLabelPrintingError } from '../utils/labelErrorHandler';
import { checkNetworkConnection } from '../utils/networkUtils';
import { useRouter } from 'expo-router';
import { QRCodeGenerator } from './QRCodeGenerator';
import { DataMatrixGenerator } from './DataMatrixGenerator';
import { parseId } from '../utils/identifierManager';
import { captureException } from '@sentry/react-native';
import { useTheme } from '../hooks/useTheme';

// Import dynamique des dépendances lourdes
let html2canvas: any;
let jsPDF: any;

if (Platform.OS === 'web') {
  import('html2canvas').then(module => {
    html2canvas = module.default;
  });
  import('jspdf').then(module => {
    jsPDF = module.jsPDF;
  });
}

interface Item {
  id: number;
  name: string;
  qrCode: string;
  description?: string;
  sellingPrice?: number;
  number?: string;
}

interface LabelGeneratorProps {
  items: Item[];
  onComplete: () => void;
  onError: (error: Error) => void;
  mode: 'items' | 'containers';
  compact?: boolean;
}

/**
 * Composant pour générer des étiquettes avec codes QR/DataMatrix
 * @param props - Les propriétés du composant
 * @returns JSX.Element
 */
export const LabelGenerator: React.FC<LabelGeneratorProps> = React.memo(({
  items,
  onComplete,
  onError,
  mode,
  compact = false
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const [currentCode, setCurrentCode] = useState<{ data: string; size: number } | null>(null);

  // Validation des items
  const validItems = useMemo(() => {
    return items.filter(item => {
      const isValid = item.id && item.name && item.qrCode;
      if (!isValid) {
        console.warn(`Item invalide détecté: ${JSON.stringify(item)}`);
        captureException(new Error('Item invalide détecté'), { extra: { item } });
      }
      return isValid;
    });
  }, [items]);

  const handleComplete = useCallback(() => {
    if (Platform.OS === 'web') {
      onComplete();
    } else {
      router.replace('/(tabs)');
    }
  }, [onComplete, router]);

  const CodeRenderer = () => {
    if (!currentCode) return null;

    // Déterminer le type de code à partir de la donnée
    let type = 'QR_CODE';
    try {
      const parsed = parseId(currentCode.data);
      type = parsed.type === 'ITEM' ? 'DATAMATRIX' : 'QR_CODE';
    } catch (error) {
      console.warn('Erreur lors du parsing de l\'ID:', error);
      // Par défaut, utiliser QR_CODE si le parsing échoue
      type = currentCode.data.startsWith('ITEM_') ? 'DATAMATRIX' : 'QR_CODE';
    }

    // Choisir le composant approprié
    const CodeComponent = type === 'DATAMATRIX' ? DataMatrixGenerator : QRCodeGenerator;


    return (
      <div style={{ 
        width: currentCode.size, 
        height: currentCode.size, 
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        <CodeComponent
          value={currentCode.data}
          size={currentCode.size * 0.95}
        />
      </div>
    );
  };

  const generateContainerPDF = useCallback(async () => {
    if (!jsPDF) {
      throw new Error('jsPDF not loaded');
    }

    try {
      setLoading(true);

      const isConnected = await checkNetworkConnection();
      if (!isConnected) {
        throw new Error('Pas de connexion réseau');
      }

      // Dimensions pour les containers (en mm)
      const labelWidth = 100;
      const labelHeight = 150;
      const margin = 5;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [labelWidth, labelHeight]
      });

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        
        // Assurer que chaque conteneur a un code QR
        if (!item.qrCode) {
          console.warn(`QR code manquant pour le container ${item.name}, génération d'un code par défaut`);
          item.qrCode = `CONTAINER_${item.id}_${Date.now()}`;
        }

        if (i > 0) {
          doc.addPage([labelWidth, labelHeight]);
        }

        // Bordure simple en noir
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.rect(margin, margin, labelWidth - 2*margin, labelHeight - 2*margin);
        
        // Titre du container
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(item.name, labelWidth/2, margin + 15, { align: 'center' });

        // Numéro du container
        if (item.number) {
          doc.setFontSize(32);
          doc.setTextColor(0, 0, 0);
          doc.text(`#${item.number}`, labelWidth/2, margin + 35, { align: 'center' });
        }

        // Ligne séparatrice
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(margin + 5, margin + 40, labelWidth - margin - 5, margin + 40);

        // Forcer la génération du QR code
        setCurrentCode({ data: item.qrCode, size: 200 });
        
        // Attendre que le code soit rendu
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!codeContainerRef.current) {
          console.error('Référence au conteneur de code manquante');
          doc.setFontSize(12);
          doc.text('QR code non disponible', labelWidth/2, margin + 75, { align: 'center' });
        } else {
          try {
            const canvas = await html2canvas(codeContainerRef.current, {
              backgroundColor: '#ffffff',
              scale: 2,
              logging: true,
              useCORS: true,
              allowTaint: true
            });
            
            const qrCodeBase64 = canvas.toDataURL('image/png');
            const qrSize = 65;
            
            doc.addImage(
              qrCodeBase64, 
              'PNG',
              (labelWidth - qrSize) / 2,
              margin + 45,
              qrSize, 
              qrSize
            );
            
          } catch (qrError) {
            console.error('Erreur lors de la capture du QR code:', qrError);
            doc.setFontSize(12);
            doc.text('QR code non disponible', labelWidth/2, margin + 75, { align: 'center' });
          }
        }
        
        // Réinitialiser le code courant
        setCurrentCode(null);

        // Description
        if (item.description) {
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(0, 0, 0);
          const description = doc.splitTextToSize(item.description, labelWidth - (2 * margin) - 10);
          doc.text(description, labelWidth/2, margin + 120, { align: 'center' });
        }

        setProgress(((i + 1) / validItems.length) * 100);
      }

      const fileName = `etiquettes-containers-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      doc.save(fileName);
      handleComplete();
    } catch (error) {
      const err = error as Error;
      handleLabelPrintingError(err, 'LabelGenerator.generateContainerPDF');
      onError(err);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [validItems, handleComplete, onError, codeContainerRef]);

  const generateItemsPDF = useCallback(async () => {
    if (!jsPDF) {
      throw new Error('jsPDF not loaded');
    }

    try {
      setLoading(true);

      const isConnected = await checkNetworkConnection();
      if (!isConnected) {
        throw new Error('Pas de connexion réseau');
      }

      // Dimensions de la page A4 en mm
      const labelWidth = 48.5;
      const labelHeight = 25.4;
      const labelsPerRow = 4;
      const labelsPerColumn = 11;
      const totalLabelsPerPage = labelsPerRow * labelsPerColumn;
      const marginXFixed = 11;
      const marginYFixed = 11;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        
        // Assurer que chaque article a un code DataMatrix
        if (!item.qrCode) {
          console.warn(`Code DataMatrix manquant pour l'article ${item.name}, génération d'un code par défaut`);
          item.qrCode = `ITEM_${item.id}_${Date.now()}`;
        }

        if (i > 0 && i % totalLabelsPerPage === 0) {
          doc.addPage();
        }

        const indexSurPage = i % totalLabelsPerPage;
        const col = indexSurPage % labelsPerRow;
        const row = Math.floor(indexSurPage / labelsPerRow);
        
        const posX = marginXFixed + (col * labelWidth);
        const posY = marginYFixed + (row * labelHeight);

        // Cadre de l'étiquette
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.rect(posX, posY, labelWidth, labelHeight);
        
        // Titre
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        const titleMaxWidth = labelWidth - 2;
        const titleText = doc.splitTextToSize(item.name, titleMaxWidth);
        doc.text(titleText, posX + labelWidth/2, posY + 4, { align: 'center' });
        
        // Ligne séparatrice
        doc.setLineWidth(0.2);
        doc.setDrawColor(0, 0, 0);
        doc.line(posX + 5, posY + 7, posX + labelWidth - 5, posY + 7);
        
        // Description (si présente)
        if (item.description) {
          doc.setFontSize(7);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(0, 0, 0);
          const descMaxWidth = labelWidth - 22; // Réservons de l'espace pour le code
          const description = doc.splitTextToSize(item.description, descMaxWidth);
          // Limiter à 2 lignes maximum pour la description
          const limitedDesc = description.slice(0, 2);
          doc.text(limitedDesc, posX + 2, posY + 11);
        }
        
        // Prix (si présent)
        if (item.sellingPrice !== undefined) {
          doc.setFontSize(14);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text(`${item.sellingPrice}€`, posX + 12, posY + labelHeight - 5, { align: 'center' });
        }
        
        // DataMatrix - Génération directe
        
        // Forcer la génération du DataMatrix
        setCurrentCode({ data: item.qrCode, size: 150 });
        
        // Attendre que le code soit rendu
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!codeContainerRef.current) {
          console.error('Référence au conteneur de code manquante');
          doc.setFontSize(6);
          doc.text('Code non disponible', posX + labelWidth - 15, posY + labelHeight - 10);
        } else {
          try {
            const canvas = await html2canvas(codeContainerRef.current, {
              backgroundColor: '#ffffff',
              scale: 2,
              logging: false,
              useCORS: true,
              allowTaint: true
            });
            
            const codeBase64 = canvas.toDataURL('image/png');
            const codeSize = 15; // Taille réduite
            
            doc.addImage(
              codeBase64, 
              'PNG', 
              posX + labelWidth - 17,
              posY + labelHeight - 17,
              codeSize, 
              codeSize
            );
            
          } catch (codeError) {
            console.error('Erreur lors de la capture du DataMatrix:', codeError);
            doc.setFontSize(6);
            doc.text('Code non disponible', posX + labelWidth - 15, posY + labelHeight - 10);
          }
        }
        
        // Réinitialiser le code courant
        setCurrentCode(null);

        setProgress(((i + 1) / validItems.length) * 100);
      }

      const fileName = `etiquettes-articles-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      doc.save(fileName);
      handleComplete();
    } catch (error) {
      const err = error as Error;
      handleLabelGenerationError(err, 'LabelGenerator.generateItemsPDF');
      onError(err);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [validItems, handleComplete, onError, codeContainerRef]);

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

      {!compact && (
        <Text style={styles.title}>
          Génération des étiquettes
        </Text>
      )}
      
      {loading && (
        <View style={[styles.loadingContainer, compact && styles.loadingContainerCompact]}>
          <ActivityIndicator 
            size={compact ? "small" : "large"} 
            color={theme.colors.primary}
          />
          <Text style={[styles.progressText, compact && styles.progressTextCompact]}>
            {Math.round(progress)}%
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button, 
          loading && styles.buttonDisabled,
          compact && styles.buttonCompact
        ]}
        onPress={mode === 'containers' ? generateContainerPDF : generateItemsPDF}
        disabled={loading || validItems.length === 0}
      >
        <Text style={[styles.buttonText, compact && styles.buttonTextCompact]}>
          {loading 
            ? 'Génération...' 
            : `Générer ${validItems.length} étiquette${validItems.length > 1 ? 's' : ''}`
          }
        </Text>
      </TouchableOpacity>

      <Text style={[styles.infoText, compact && styles.infoTextCompact]}>
        {validItems.length} étiquette{validItems.length > 1 ? 's' : ''} à générer
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000000',
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
    color: '#000000',
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
    color: '#666666',
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
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextCompact: {
    fontSize: 14,
  },
  infoText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#666666',
    fontSize: 14,
  },
  infoTextCompact: {
    fontSize: 12,
  },
}); 