import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { handleLabelGenerationError, handleLabelPrintingError } from '../utils/labelErrorHandler';
import { checkNetworkConnection } from '../utils/networkUtils';
import { useRouter } from 'expo-router';
import { QRCodeGenerator } from './QRCodeGenerator';
import { captureException } from '@sentry/react-native';
import { useAppTheme } from '../contexts/ThemeContext';

// Import des dépendances
import getJsPDF from '../utils/jspdf-polyfill';

let html2canvas: any;

// Import dynamique de html2canvas pour le web
const loadHtml2Canvas = async () => {
  if (Platform.OS === 'web' && !html2canvas) {
    try {
      const module = await import('html2canvas');
      html2canvas = module.default;
      console.log('[LabelGenerator] html2canvas loaded successfully');
    } catch (error) {
      console.error('[LabelGenerator] Failed to load html2canvas:', error);
    }
  }
  return html2canvas;
};

// Fonction pour générer un QR code avec validation de format
const generateQRCode = (value: string, size: number, rotate: 'N' | 'R' | 'L' | 'I' = 'N') => {
  // Valeur par défaut en cas de chaîne vide
  if (!value) {
    console.error("Valeur de QR code vide");
    value = "INVALID_CODE";
  }
  
  // QRCodeGenerator gère déjà la validation et correction du format
  return (
    <QRCodeGenerator 
      value={value} 
      size={size}
      rotate={rotate}
    />
  );
};

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
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const [currentCode, setCurrentCode] = useState<{ data: string; size: number; rotate?: 'N' | 'R' | 'L' | 'I' } | null>(null);
  
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

  const CodeRenderer = () => {
    if (!currentCode) return null;

    // QRCodeGenerator fait déjà la validation et correction des formats
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
        {generateQRCode(
          currentCode.data,
          currentCode.size * 0.95,
          currentCode.rotate
        )}
      </div>
    );
  };

  // Fonction pour générer ou récupérer un QR code depuis le cache
  const getQRCodeImage = useCallback(async (qrValue: string, size: number, rotate: 'N' | 'R' | 'L' | 'I' = 'N') => {
    console.log('[LabelGenerator] getQRCodeImage called with:', qrValue, size, rotate);
    
    // Créer une clé unique pour ce QR code
    const cacheKey = `${qrValue}_${size}_${rotate}`;
    
    // Vérifier si le QR code est déjà dans le cache
    if (qrCodeCache.current.has(cacheKey)) {
      console.log('[LabelGenerator] QR code found in cache');
      return qrCodeCache.current.get(cacheKey);
    }
    
    // Charger html2canvas si nécessaire
    const html2canvasLib = await loadHtml2Canvas();
    if (!html2canvasLib) {
      console.error('[LabelGenerator] html2canvas not available');
      return null;
    }
    
    // Générer un nouveau QR code
    console.log('[LabelGenerator] Generating new QR code');
    setCurrentCode({ data: qrValue, size, rotate });
    
    // Attendre que le code soit rendu
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (!codeContainerRef.current) {
      console.error('Référence au conteneur de code manquante');
      return null;
    }
    
    try {
      console.log('[LabelGenerator] Capturing QR code with html2canvas');
      // Utiliser une échelle réduite pour html2canvas
      const canvas = await html2canvasLib(codeContainerRef.current, {
        backgroundColor: '#ffffff',
        scale: 1.5, // Réduit de 3-4 à 1.5
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      // Utiliser JPEG avec qualité réduite au lieu de PNG
      const qrCodeBase64 = canvas.toDataURL('image/jpeg', 0.7);
      console.log('[LabelGenerator] QR code captured successfully');
      
      // Ajouter au cache
      qrCodeCache.current.set(cacheKey, qrCodeBase64);
      
      return qrCodeBase64;
    } catch (qrError) {
      console.error('Erreur lors de la capture du QR code:', qrError);
      return null;
    } finally {
      setCurrentCode(null);
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
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [labelWidth, labelHeight],
        compress: true // Activer la compression du PDF
      });
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
          doc.setFont(undefined, 'normal');
          doc.setTextColor(0, 0, 0);
          const description = doc.splitTextToSize(item.description, labelWidth - (2 * margin) - 10);
          doc.text(description, labelWidth/2, margin + 130, { align: 'center' });
        }

        setProgress(((i + 1) / validItems.length) * 100);
      }

      const fileName = `etiquettes-containers-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      console.log('[LabelGenerator] Saving PDF with filename:', fileName);
      doc.save(fileName);
      console.log('[LabelGenerator] PDF saved successfully');
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
      const labelHeight = 25.4;
      const labelsPerRow = 4;
      const labelsPerColumn = 11;
      const totalLabelsPerPage = labelsPerRow * labelsPerColumn;
      const marginXFixed = 11;
      const marginYFixed = 11;

      console.log('[LabelGenerator] Creating new jsPDF instance for items');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true // Activer la compression du PDF
      });
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
          doc.addPage();
        }

        const indexSurPage = i % totalLabelsPerPage;
        const col = indexSurPage % labelsPerRow;
        const row = Math.floor(indexSurPage / labelsPerRow);
        
        const posX = marginXFixed + (col * labelWidth);
        const posY = marginYFixed + (row * labelHeight);

                // === DESIGN OPTIMISÉ POUR IMPRIMANTE THERMIQUE V2 ===
        
        // Marges internes pour l'étiquette
        const padding = 0.8;
        const innerWidth = labelWidth - (2 * padding);
        const innerHeight = labelHeight - (2 * padding);
        
        // Cadre de l'étiquette simple et net
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.rect(posX, posY, labelWidth, labelHeight);
        
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
        const titleStartY = posY + padding + 1.5;
        const titleZoneWidth = labelWidth - qrSize - (3 * padding); // Espace à gauche du QR
        
        doc.setFontSize(13); // Titre encore plus grand
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        
        const titleText = doc.splitTextToSize(item.name, titleZoneWidth);
        const limitedTitle = titleText.slice(0, 2); // Max 2 lignes
        
        // Aligner le titre à gauche
        doc.text(limitedTitle, posX + padding, titleStartY, { align: 'left' });
        
                 // === ZONE PRIX (très visible, sous le titre) ===
         let currentY = titleStartY + (limitedTitle.length * 3.8) + 1;
         
         if (item.sellingPrice !== undefined) {
           // Prix sans encadrement, plus simple et plus propre
           doc.setFontSize(20); // Prix très grand et visible
           doc.setFont(undefined, 'bold');
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
            doc.setFont(undefined, 'normal');
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