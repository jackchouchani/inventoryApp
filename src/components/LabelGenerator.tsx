import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { handleLabelGenerationError, handleLabelPrintingError } from '../utils/labelErrorHandler';
import { checkNetworkConnection } from '../utils/networkUtils';
import { useRouter } from 'expo-router';
import { captureException } from '@sentry/react-native';
import { useAppTheme } from '../contexts/ThemeContext';

// Import des dépendances
import getJsPDF from '../utils/jspdf-polyfill';

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
 * Composant pour générer des étiquettes avec codes QR
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
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getThemedStyles(activeTheme, compact), [activeTheme, compact]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  // Cache pour les QR codes générés - optimisation majeure
  const qrCodeCache = useRef<Map<string, string>>(new Map());

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

  // Fonction pour générer un QR code directement sans HTML
  const getQRCodeImage = useCallback(async (qrValue: string, size: number, rotate: 'N' | 'R' | 'L' | 'I' = 'N') => {
    console.log('[LabelGenerator] getQRCodeImage called with:', qrValue, size, rotate);
    
    // Créer une clé unique pour ce QR code
    const cacheKey = `${qrValue}_${size}_${rotate}`;
    
    // Vérifier si le QR code est déjà dans le cache
    if (qrCodeCache.current.has(cacheKey)) {
      console.log('[LabelGenerator] QR code found in cache');
      return qrCodeCache.current.get(cacheKey);
    }
    
    try {
      // Utiliser QRCode.js pour générer directement un canvas
      const QRCode = await import('qrcode');
      console.log('[LabelGenerator] Generating QR code directly with QRCode.js');
      
      // Générer le QR code en tant que Data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrValue, {
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      console.log('[LabelGenerator] QR code generated successfully');
      
      // Ajouter au cache
      qrCodeCache.current.set(cacheKey, qrCodeDataURL);
      
      return qrCodeDataURL;
    } catch (qrError) {
      console.error('Erreur lors de la génération du QR code:', qrError);
      return null;
    }
  }, []);

  const generateContainerPDF = useCallback(async () => {
    console.log('[LabelGenerator] generateContainerPDF called');
    const jsPDF = getJsPDF();
    console.log('[LabelGenerator] jsPDF class:', jsPDF);
    if (!jsPDF) {
      throw new Error('jsPDF not loaded');
    }

    try {
      setLoading(true);
      console.log('[LabelGenerator] Starting container PDF generation for', validItems.length, 'items');

      const isConnected = await checkNetworkConnection();
      if (!isConnected) {
        throw new Error('Pas de connexion réseau');
      }

      // Dimensions pour les containers (en mm)
      const labelWidth = 100;
      const labelHeight = 150;
      const margin = 5;

      console.log('[LabelGenerator] Creating new jsPDF instance');
      const doc = new jsPDF(
        'portrait',
        'mm',
        [labelWidth, labelHeight]
      );
      console.log('[LabelGenerator] jsPDF instance created successfully');
      console.log('[LabelGenerator] doc instance:', doc);
      console.log('[LabelGenerator] doc.setDrawColor exists:', typeof doc.setDrawColor);
      console.log('[LabelGenerator] doc methods:', Object.getOwnPropertyNames(doc));
      console.log('[LabelGenerator] doc prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(doc)));
      
      // Test direct de la méthode
      try {
        console.log('[LabelGenerator] Testing setDrawColor method...');
        doc.setDrawColor(0, 0, 0);
        console.log('[LabelGenerator] setDrawColor test successful');
      } catch (testError) {
        console.error('[LabelGenerator] setDrawColor test failed:', testError);
      }

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        console.log(`[LabelGenerator] Processing item ${i + 1}/${validItems.length}:`, item.name);
        
        // Assurer que chaque conteneur a un code QR
        if (!item.qrCode) {
          console.warn(`QR code manquant pour le container ${item.name}, génération d'un code par défaut`);
          item.qrCode = `CONT_${item.id}_${Date.now()}`;
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
        doc.setFont('helvetica', 'bold');
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

        // Taille optimisée pour les QR codes
        const qrSize = 70;

        // Récupérer ou générer l'image du QR code
        const qrCodeBase64 = await getQRCodeImage(item.qrCode, 240);
        
        if (!qrCodeBase64) {
          doc.setFontSize(12);
          doc.text('QR code non disponible', labelWidth/2, margin + 75, { align: 'center' });
        } else {
          // Centrer le QR code dans l'étiquette
          doc.addImage(
            qrCodeBase64, 
            'JPEG',
            (labelWidth - qrSize) / 2,
            margin + 50,
            qrSize, 
            qrSize
          );
        }
        
        // Description
        if (item.description) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          const description = doc.splitTextToSize(item.description, labelWidth - (2 * margin) - 10);
          doc.text(description, labelWidth/2, margin + 130, { align: 'center' });
        }

        setProgress(((i + 1) / validItems.length) * 100);
      }

      const fileName = `etiquettes-containers-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      doc.save(fileName);
      
      console.log('[LabelGenerator] PDF preview opened successfully');
      handleComplete();
    } catch (error) {
      console.error('[LabelGenerator] Error in generateContainerPDF:', error);
      const err = error as Error;
      handleLabelPrintingError(err, 'LabelGenerator.generateContainerPDF');
      onError(err);
    } finally {
      setLoading(false);
      setProgress(0);
      // Vider le cache après utilisation
      qrCodeCache.current.clear();
    }
  }, [validItems, handleComplete, onError, getQRCodeImage]);

  const generateItemsPDF = useCallback(async () => {
    console.log('[LabelGenerator] generateItemsPDF called');
    const jsPDF = getJsPDF();
    console.log('[LabelGenerator] jsPDF class:', jsPDF);
    if (!jsPDF) {
      throw new Error('jsPDF not loaded');
    }

    try {
      setLoading(true);
      console.log('[LabelGenerator] Starting items PDF generation for', validItems.length, 'items');

      const isConnected = await checkNetworkConnection();
      if (!isConnected) {
        throw new Error('Pas de connexion réseau');
      }

      // Dimensions de la page A4 en mm
      const labelWidth = 48.5;
      const labelHeight = 25.2;
      const labelsPerRow = 4;
      const labelsPerColumn = 11;
      const totalLabelsPerPage = labelsPerRow * labelsPerColumn;
      const marginXFixed = 11.2;
      const marginYFixed = 11.3;

      console.log('[LabelGenerator] Creating new jsPDF instance for items');
      const doc = new jsPDF(
        'portrait',
        'mm',
        'a4'
      );
      console.log('[LabelGenerator] jsPDF instance created successfully for items');
      console.log('[LabelGenerator] doc instance:', doc);
      console.log('[LabelGenerator] doc.setDrawColor exists:', typeof doc.setDrawColor);
      console.log('[LabelGenerator] doc methods:', Object.getOwnPropertyNames(doc));
      console.log('[LabelGenerator] doc prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(doc)));
      
      // Test direct de la méthode
      try {
        console.log('[LabelGenerator] Testing setDrawColor method for items...');
        doc.setDrawColor(0, 0, 0);
        console.log('[LabelGenerator] setDrawColor test successful for items');
      } catch (testError) {
        console.error('[LabelGenerator] setDrawColor test failed for items:', testError);
      }

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        
        // Assurer que chaque article a un code QR
        if (!item.qrCode) {
          console.warn(`QR code manquant pour l'article ${item.name}, génération d'un code par défaut`);
          item.qrCode = `ART_${item.id}_${Date.now()}`;
        }

        if (i > 0 && i % totalLabelsPerPage === 0) {
          doc.addPage('a4');
        }

        const indexSurPage = i % totalLabelsPerPage;
        const col = indexSurPage % labelsPerRow;
        const row = Math.floor(indexSurPage / labelsPerRow);
        
        const posX = marginXFixed + (col * labelWidth);
        const posY = marginYFixed + (row * labelHeight);

                // === DESIGN OPTIMISÉ POUR IMPRIMANTE THERMIQUE V2 ===
        
        // Marges internes pour l'étiquette
        const padding = 0.8;
        
        // // Cadre de l'étiquette simple et net
        // doc.setDrawColor(0, 0, 0);
        // doc.setLineWidth(0.0);
        // doc.rect(posX, posY, labelWidth, labelHeight);
        
        // === ZONE QR CODE (en haut à droite, priorité) ===
        const qrSize = 23; // QR code encore plus grand
        const qrX = posX + labelWidth - qrSize - padding;
        const qrY = posY + padding;
        
        const qrCodeBase64 = await getQRCodeImage(item.qrCode, 300, 'N'); // Résolution maximale
        
        if (!qrCodeBase64) {
          doc.setFontSize(6);
          doc.setTextColor(0, 0, 0);
          doc.text('QR manquant', qrX + qrSize/2, qrY + qrSize/2, { align: 'center' });
        } else {
          doc.addImage(
            qrCodeBase64, 
            'JPEG', 
            qrX,
            qrY,
            qrSize, 
            qrSize
          );
        }
        
        // === ZONE TITRE (optimisée, à gauche du QR) ===
        const titleStartY = posY + padding + 3.5; // Plus bas
        const titleZoneWidth = labelWidth - qrSize - (3 * padding); // Espace à gauche du QR
        
        doc.setFontSize(10); // Titre plus petit
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        
        const titleText = doc.splitTextToSize(item.name, titleZoneWidth);
        const limitedTitle = titleText.slice(0, 2); // Max 2 lignes
        
        // Aligner le titre à gauche
        doc.text(limitedTitle, posX + padding, titleStartY, { align: 'left' });
        
                 // === ZONE PRIX (très visible, sous le titre) ===
         let currentY = titleStartY + (limitedTitle.length * 2.2) + 6;
         
         if (item.sellingPrice !== undefined) {
           // Prix sans encadrement, plus simple et plus propre
           doc.setFontSize(20); // Prix plus raisonnable
           doc.setFont('helvetica', 'bold');
           doc.setTextColor(0, 0, 0);
           
           // Centrer le prix dans la zone de texte
           doc.text(`${item.sellingPrice}€`, posX + titleZoneWidth/2, currentY, { align: 'center' });
           
           currentY += 6; // Espacement après le prix
         }
        
        // === ZONE DESCRIPTION (espace restant optimisé) ===
        if (item.description) {
          // Calculer l'espace disponible pour la description
          const descEndY = posY + labelHeight - padding - 0.5;
          const descAvailableHeight = descEndY - currentY;
          
          if (descAvailableHeight > 2.5) { // Assez d'espace pour au moins une ligne
            // Zone de texte sous le prix, à gauche du QR code
            const descMaxWidth = titleZoneWidth;
            
            doc.setFontSize(9); // Description plus lisible
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            
            const description = doc.splitTextToSize(item.description, descMaxWidth);
            const maxLines = Math.floor(descAvailableHeight / 2.5); // Lignes qui rentrent
            const limitedDesc = description.slice(0, maxLines);
            
            // Aligner à gauche pour une meilleure lisibilité
            doc.text(limitedDesc, posX + padding, currentY, { align: 'left' });
          }
        }

        setProgress(((i + 1) / validItems.length) * 100);
      }

      const fileName = `etiquettes-articles-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      doc.save(fileName);
      
      console.log('[LabelGenerator] PDF preview opened successfully');
      handleComplete();
    } catch (error) {
      const err = error as Error;
      handleLabelGenerationError(err, 'LabelGenerator.generateItemsPDF');
      onError(err);
    } finally {
      setLoading(false);
      setProgress(0);
      // Vider le cache après utilisation
      qrCodeCache.current.clear();
    }
  }, [validItems, handleComplete, onError, getQRCodeImage]);

      return (
      <View style={styles.container}>
        {!compact && (
        <Text style={styles.title}>
          Génération des étiquettes
        </Text>
      )}
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            size={compact ? "small" : "large"} 
            color={activeTheme.primary}
          />
          <Text style={styles.progressText}>
            {Math.round(progress)}%
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          console.log('[LabelGenerator] Button pressed, mode:', mode);
          console.log('[LabelGenerator] validItems.length:', validItems.length);
          console.log('[LabelGenerator] loading:', loading);
          if (mode === 'containers') {
            console.log('[LabelGenerator] Calling generateContainerPDF');
            generateContainerPDF();
          } else {
            console.log('[LabelGenerator] Calling generateItemsPDF');
            generateItemsPDF();
          }
        }}
        disabled={loading || validItems.length === 0}
      >
        <Text style={styles.buttonText}>
          {loading 
            ? 'Génération...' 
            : `Générer ${validItems.length} étiquette${validItems.length > 1 ? 's' : ''}`
          }
        </Text>
      </TouchableOpacity>

      <Text style={styles.infoText}>
        {validItems.length} étiquette{validItems.length > 1 ? 's' : ''} à générer
      </Text>
    </View>
  );
});

const getThemedStyles = (theme: ReturnType<typeof useAppTheme>['activeTheme'], compact: boolean) => StyleSheet.create({
  container: {
    padding: compact ? 8 : 20,
    backgroundColor: theme.surface,
    borderRadius: compact ? 8 : 10,
    boxShadow: compact ? '0px 1px 2px rgba(0, 0, 0, 0.05)' : '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: compact ? 2 : 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: theme.text.primary,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: compact ? 8 : 20,
  },
  progressText: {
    marginTop: compact ? 4 : 10,
    fontSize: compact ? 12 : 16,
    color: theme.text.secondary,
  },
  button: {
    backgroundColor: theme.primary,
    padding: compact ? 10 : 15,
    borderRadius: compact ? 6 : 8,
    alignItems: 'center',
    opacity: 1,
  },
  buttonText: {
    color: theme.text.onPrimary,
    fontSize: compact ? 14 : 16,
    fontWeight: '600',
  },
  infoText: {
    marginTop: 10,
    textAlign: 'center',
    color: theme.text.secondary,
    fontSize: compact ? 12 : 14,
  },
});