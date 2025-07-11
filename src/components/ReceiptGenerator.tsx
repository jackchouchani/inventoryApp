import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, TextInput, ScrollView } from 'react-native';
import logoAsset from '../../assets/Logo.png';

// Logo en base64 pour usage offline - version simplifiée pour éviter les problèmes de chargement
const LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // Transparent pixel fallback
import { uploadInvoiceToR2 } from '../utils/r2Client';

import getJsPDF from '../utils/jspdf-polyfill';
import { downloadBlobSafely, monitorMemoryAndCleanup } from '../utils/downloadUtils';

interface Item {
  id: number;
  name: string;
  qrCode: string; // Non utilisé dans la génération PDF actuelle, mais conservé
  description?: string;
  sellingPrice?: number;
  purchasePrice?: number; // Non utilisé dans la génération PDF actuelle, mais conservé
  image?: string; // Non utilisé dans la génération PDF actuelle, mais conservé
  quantity?: number; // Quantité pour les reçus multi-articles
  actualSellingPrice?: number; // Prix de vente modifié pour l'article
}

interface ReceiptGeneratorProps {
  items: Item[];
  onComplete: () => void;
  onError: (error: Error) => void;
  multiPage?: boolean; // Indique si la réception doit être divisée en plusieurs pages
}

// Informations juridiques de l'entreprise
const COMPANY_INFO = {
  name: 'COMPTOIR VINTAGE',
  address: '34 Avenue des Champs Elysées, 75008 Paris',
  phone: '06 24 28 52 50',
  email: 'contact@comptoirvintage.com',
  website: 'www.comptoirvintage.com',
  siret: '921 490 777 00015',
  rcs: '921 490 777 R.C.S. Paris',
};

// Mentions légales TVA
const TVA_MENTIONS = {
  regime: "Régime particulier – Biens d'occasion",
  legalReference: "Article 297 A du CGI et directive communautaire 2006/112/CE",
};

// Hooks et utils factices si les originaux ne sont pas disponibles dans ce contexte
const useTheme = () => ({
  colors: {
    primary: '#007AFF', // Couleur par défaut
  },
});

const checkNetworkConnection = async () => {
  if (Platform.OS === 'web') {
    return navigator.onLine;
  }
  // Pour React Native, vous utiliseriez @react-native-community/netinfo
  // NetInfo.fetch().then(state => state.isConnected);
  return true; // Par défaut à true si non implémenté
};


export const ReceiptGenerator: React.FC<ReceiptGeneratorProps> = ({
  items,
  onComplete,
  onError,
  multiPage = false
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  // const router = useRouter(); // Décommentez si vous utilisez expo-router

  const [itemPrices, setItemPrices] = useState<Map<number, string>>(new Map(
    items.map(item => [item.id, item.actualSellingPrice ? item.actualSellingPrice.toString() : 
      (item.sellingPrice ? item.sellingPrice.toString() : '0')])
  ));

  useEffect(() => {
    setItemPrices(new Map(
      items.map(item => [item.id, item.actualSellingPrice ? item.actualSellingPrice.toString() : 
        (item.sellingPrice ? item.sellingPrice.toString() : '0')])
    ));
  }, [items]);
  
  const handlePriceChange = (id: number, value: string) => {
    setItemPrices(prev => {
      const newMap = new Map(prev);
      newMap.set(id, value);
      return newMap;
    });
  };

  // Calculer la remise totale pour tous les articles
  const calculateDiscounts = useCallback(() => {
    let totalDiscount = 0;
    let totalOriginalPrice = 0;
    
    items.forEach(item => {
      if (item.sellingPrice) {
        const actualPrice = parseFloat(itemPrices.get(item.id) || '0');
        if (actualPrice < item.sellingPrice) {
          totalDiscount += (item.sellingPrice - actualPrice) * (item.quantity || 1);
          totalOriginalPrice += item.sellingPrice * (item.quantity || 1);
        } else {
          totalOriginalPrice += actualPrice * (item.quantity || 1);
        }
      }
    });
    
    const discountPercentage = totalOriginalPrice > 0 
      ? Math.round((totalDiscount / totalOriginalPrice) * 100) 
      : 0;
      
    return { totalDiscount, discountPercentage };
  }, [items, itemPrices]);
  
  const { totalDiscount, discountPercentage } = calculateDiscounts();

  const handleComplete = useCallback(() => {
    if (Platform.OS === 'web') {
      onComplete();
    } else {
      // router.replace('/(tabs)'); // Adaptez si besoin
      onComplete(); // Appeler onComplete aussi pour les plateformes non-web
    }
  }, [onComplete /*, router */]);


  // Calcule le prix total de tous les articles
  const calculateTotal = useCallback(() => {
    return items.reduce((total, item) => {
      const price = parseFloat(itemPrices.get(item.id) || '0');
      return total + price * (item.quantity || 1);
    }, 0);
  }, [items, itemPrices]);

  const generateReceipt = useCallback(async () => {
    const jsPDF = getJsPDF();
    if (!jsPDF) {
      onError(new Error('jsPDF n\'a pas pu être chargé. Assurez-vous d\'être sur une plateforme web.'));
      return;
    }

    try {
      setLoading(true);
      setProgress(10);

      // ✅ OFFLINE - Suppression de la vérification réseau (la génération PDF fonctionne hors ligne)

      const receiptWidth = 105; // mm (A6 width)
      const margin = 6; // mm
      const contentWidth = receiptWidth - 2 * margin;
      const pageHeight = 148; // Hauteur A6 explicitement définie

      const doc = new jsPDF(
        'portrait',
        'mm',
        'a6'
      );

      setProgress(20);

      // ✅ OFFLINE - Utilisation du logo base64 pour éviter les problèmes de chargement en mode offline
      let logoData: string | undefined = LOGO_BASE64;
      
      // Essayer de charger le vrai logo seulement si on est en ligne et que logoAsset existe
      if (Platform.OS === 'web' && typeof logoAsset !== 'undefined' && logoAsset) {
        try {
          // Vérifier si on peut charger le logo depuis les assets
          const logoImg = new window.Image();
          logoImg.crossOrigin = 'Anonymous';
          
          // Promise avec timeout pour éviter de bloquer
          const logoLoadPromise = Promise.race([
            new Promise<void>((resolve, reject) => {
              logoImg.onload = () => {
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width = logoImg.naturalWidth;
                  canvas.height = logoImg.naturalHeight;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(logoImg, 0, 0);
                    logoData = canvas.toDataURL('image/png');
                    console.log('[ReceiptGenerator] Logo chargé avec succès depuis assets');
                    resolve();
                  } else {
                    reject(new Error('Canvas context unavailable'));
                  }
                } catch (error) {
                  console.warn('[ReceiptGenerator] Erreur canvas, utilisation fallback');
                  reject(error);
                }
              };
              logoImg.onerror = (e) => {
                console.warn('[ReceiptGenerator] Erreur chargement logo, utilisation fallback');
                reject(new Error('Logo load failed'));
              };
              
              const sourceUri = (typeof logoAsset === 'object' && (logoAsset as any).uri) ? (logoAsset as any).uri : logoAsset;
              logoImg.src = sourceUri;
            }),
            // Timeout après 2 secondes
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Logo load timeout')), 2000);
            })
          ]);
          
          await logoLoadPromise;
        } catch (logoError) {
          console.warn('[ReceiptGenerator] Utilisation du logo fallback:', logoError);
          // logoData reste sur LOGO_BASE64
        }
      }

      setProgress(30);

      let yPos = margin;

      // 1. Logo et Nom de l'entreprise
      const logoDisplayHeight = 12;
      if (logoData) {
        try {
          const tempImg = new window.Image();
          tempImg.src = logoData;
          // Attendre que tempImg soit chargée pour avoir ses dimensions
          await new Promise<void>(resolve => {
            tempImg.onload = () => resolve();
            tempImg.onerror = () => resolve(); // Résoudre même en cas d'erreur pour ne pas bloquer
          });

          const aspectRatio = tempImg.naturalWidth > 0 && tempImg.naturalHeight > 0 ? tempImg.naturalWidth / tempImg.naturalHeight : 1.5; // Fallback aspect ratio
          const logoDisplayWidth = logoDisplayHeight * aspectRatio;
          const logoX = (receiptWidth - logoDisplayWidth) / 2;

          doc.addImage(logoData, 'PNG', logoX, yPos, logoDisplayWidth, logoDisplayHeight);
          yPos += logoDisplayHeight + 1;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(COMPANY_INFO.name, receiptWidth / 2, yPos + 3, { align: 'center' });
          yPos += 6;

        } catch (logoErrorAdding) {
          console.error("Erreur lors de l'ajout du logo au PDF:", logoErrorAdding);
          // Fallback si addImage échoue
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(COMPANY_INFO.name, receiptWidth / 2, yPos + 5, { align: 'center' });
          yPos += 10;
        }
      } else {
        // Si pas de logo, afficher le nom de l'entreprise en grand
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(COMPANY_INFO.name, receiptWidth / 2, yPos + 5, { align: 'center' });
        yPos += 10;
      }
      doc.setFont('helvetica', 'normal');

      setProgress(40);

      // 2. Informations de l'entreprise (adresse, contact)
      doc.setFontSize(7.5);
      doc.text(COMPANY_INFO.address, receiptWidth / 2, yPos, { align: 'center' });
      yPos += 3;
      doc.text(`Tél: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`, receiptWidth / 2, yPos, { align: 'center' });
      yPos += 3;
      doc.text(`SIRET: ${COMPANY_INFO.siret} | RCS: ${COMPANY_INFO.rcs}`, receiptWidth / 2, yPos, { align: 'center' });
      yPos += 5;

      // 3. Date et Référence
      const currentDate = new Date();
      const dateStr = currentDate.toLocaleDateString('fr-FR');
      const timeStr = currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      // Générer une référence unique basée sur l'horodatage ou le premier article si disponible
      const refIdPart = items.length > 0 && items[0].id ? items[0].id.toString().padStart(3, '0') : Date.now().toString().slice(-4);
      const timestampPart = Date.now().toString().slice(-5);
      const invoiceRef = `INV-${refIdPart}-${timestampPart}`;

      doc.setFontSize(8.5);
      doc.text(`Date: ${dateStr} ${timeStr}`, margin, yPos);
      doc.text(`Réf: ${invoiceRef}`, receiptWidth - margin, yPos, { align: 'right' });
      yPos += 6;

      doc.setLineWidth(0.2);
      doc.line(margin, yPos, receiptWidth - margin, yPos);
      yPos += 5;

      // 4. Titre de la section des articles
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Désignation', margin, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 5;

      const colDescWidth = contentWidth - 25; // Largeur pour la description/nom article (laisse 25mm pour le prix à droite)

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Article', margin, yPos);
      doc.text('Prix €', receiptWidth - margin, yPos, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      const headerLineY = yPos + 0.8;
      doc.setLineWidth(0.1);
      doc.line(margin, headerLineY, receiptWidth - margin, headerLineY);
      yPos = headerLineY + 3.5;

      // 5. Articles
      let totalGeneralTTC = 0;
      let maxYBeforeNewPage = pageHeight - margin - 45; // Espace pour le total et le footer
      let currentPage = 1;
      let totalPages = multiPage && items.length > 5 ? Math.ceil(items.length / 5) : 1;
      let itemsProcessed = 0;
      
      // Fonction pour dessiner l'en-tête de page
      const drawPageHeader = (pageNum: number) => {
        if (pageNum > 1) {
          doc.addPage('a6');
          yPos = margin;
          
          // Ajouter en-tête de page pour les pages supplémentaires
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(COMPANY_INFO.name, receiptWidth / 2, yPos, { align: 'center' });
          yPos += 5;
          
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(`Facture ${invoiceRef} - page ${pageNum}/${totalPages}`, receiptWidth / 2, yPos, { align: 'center' });
          yPos += 7;
          
          // Redessiner l'en-tête de tableau des articles
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text('Article', margin, yPos);
          doc.text('Prix €', receiptWidth - margin, yPos, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          const headerLineY = yPos + 0.8;
          doc.setLineWidth(0.1);
          doc.line(margin, headerLineY, receiptWidth - margin, headerLineY);
          yPos = headerLineY + 3.5;
        }
      };
      
      // Dessiner les articles par pages si nécessaire
      while (itemsProcessed < items.length) {
        if (itemsProcessed > 0 && multiPage && (itemsProcessed % 5 === 0 || yPos > maxYBeforeNewPage)) {
          currentPage++;
          drawPageHeader(currentPage);
        }
        
        const item = items[itemsProcessed];
        const price = parseFloat(itemPrices.get(item.id) || '0');
        const quantity = item.quantity || 1;
        const itemTotal = price * quantity;
        totalGeneralTTC += itemTotal;
        
        doc.setFontSize(9);
        const itemStartY = yPos;
        
        const quantityPrefix = quantity > 1 ? `${quantity}x ` : '';
        const itemNameLines = doc.splitTextToSize(`${quantityPrefix}${item.name}`, colDescWidth);
        doc.text(itemNameLines, margin, yPos);
        let currentItemTextHeight = itemNameLines.length * 3.8;
        
        if (item.description) {
          doc.setFontSize(7.5);
          doc.setTextColor(80, 80, 80); // Gris pour la description
          const descLines = doc.splitTextToSize(item.description, colDescWidth);
          doc.text(descLines, margin, yPos + currentItemTextHeight);
          currentItemTextHeight += descLines.length * 3.2;
          doc.setTextColor(0, 0, 0); // Revenir au noir
        }
        
        // Afficher prix unitaire et total si quantité > 1
        doc.setFontSize(9);
        if (quantity > 1) {
          doc.text(itemTotal.toFixed(2), receiptWidth - margin, itemStartY, { align: 'right' });
          doc.setFontSize(7);
          doc.text(`(${price.toFixed(2)} € × ${quantity})`, receiptWidth - margin, itemStartY + 3, { align: 'right' });
        } else {
          doc.text(itemTotal.toFixed(2), receiptWidth - margin, itemStartY, { align: 'right' });
        }
        
        yPos += currentItemTextHeight + 2;
        
        // Afficher les remises par article
        if (item.sellingPrice && price < item.sellingPrice) {
          const itemDiscount = item.sellingPrice - price;
          const itemDiscountPercentage = Math.round((itemDiscount / item.sellingPrice) * 100);
          
          yPos += 1;
          doc.setFontSize(7.5);
          doc.setTextColor(150, 0, 0); // Rouge pour la remise
          doc.text(`Prix original: ${item.sellingPrice.toFixed(2)} €${quantity > 1 ? ` × ${quantity}` : ''}`, receiptWidth - margin, yPos, { align: 'right' });
          yPos += 3;
          doc.text(`Remise (${itemDiscountPercentage}%): -${(itemDiscount * quantity).toFixed(2)} €`, receiptWidth - margin, yPos, { align: 'right' });
          yPos += 3;
          doc.setTextColor(0, 0, 0); // Revenir au noir
        }
        
        yPos += 3; // Espace entre les articles
        itemsProcessed++;
        
        // Vérifier si on doit aller à une nouvelle page
        if (yPos > maxYBeforeNewPage && itemsProcessed < items.length && multiPage) {
          currentPage++;
          drawPageHeader(currentPage);
        }
      }

      setProgress(70);
      let contentBottomY = yPos + 3; // Y actuel après le contenu principal

      // --- TOTAL ---
      // Dessiner le total uniquement sur la dernière page
      // Le total sera dessiné APRÈS avoir potentiellement déplacé yPos pour le footer,
      // afin de le positionner juste avant le footer.

      // --- CALCUL ET POSITIONNEMENT DU FOOTER TOUT EN BAS ---
      let calculatedFooterContentHeight = 0;
      const footerLineSpacing = 2.8;
      const footerMerciSpacing = 3.5;
      const footerTopSeparatorHeight = 0.2 + 3.5; // ligne + espace avant mentions

      calculatedFooterContentHeight += footerTopSeparatorHeight;

      doc.setFontSize(7);
      const tvaTextLines = [TVA_MENTIONS.regime, TVA_MENTIONS.legalReference];
      tvaTextLines.forEach(line => {
        const split = doc.splitTextToSize(line, contentWidth);
        calculatedFooterContentHeight += split.length * footerLineSpacing;
      });
      calculatedFooterContentHeight += 2; // Espace après les mentions TVA

      doc.setFontSize(8.5);
      const merciMsg = 'Merci pour votre achat et à bientôt !';
      const splitMerci = doc.splitTextToSize(merciMsg, contentWidth);
      calculatedFooterContentHeight += splitMerci.length * footerMerciSpacing;

      let footerDrawStartY = pageHeight - calculatedFooterContentHeight;

      // S'assurer que le contenu principal ne chevauche pas le footer
      // Si le contenu est trop long, il faudrait gérer l'ajout d'une page (non implémenté ici pour simplicité)
      if (contentBottomY + 15 > footerDrawStartY) { // 15mm pour le total
        // Pour un ticket A6, on ne s'attend pas à ce que ça arrive souvent avec un seul article.
        // Si cela arrive, le total pourrait être un peu écrasé par le footer.
        // Une solution simple serait de faire démarrer le footer un peu après contentBottomY.
        // footerDrawStartY = contentBottomY + 15 + 5; // Décaler le footer plus bas
        // Ceci pourrait le faire sortir de la page A6 si contentBottomY est déjà très bas.
        // Pour l'instant, on priorise que le footer soit en bas.
      }

      // --- DESSIN DU TOTAL (juste avant le footer) ---
      const totalSectionHeight = 8; // Hauteur approx pour la section Total TTC
      yPos = footerDrawStartY - totalSectionHeight; // Positionner le Y pour le total

      const totalLineXStart = margin + contentWidth / 2.5;
      doc.setLineWidth(0.5);
      doc.line(totalLineXStart, yPos - 1, receiptWidth - margin, yPos - 1);
      yPos += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TOTAL TTC', totalLineXStart, yPos);
      doc.text(`${totalGeneralTTC.toFixed(2)} €`, receiptWidth - margin, yPos, { align: 'right' });
      yPos += 3;
      
      // Afficher le total des remises si applicable
      if (totalDiscount > 0) {
        yPos += 1;
        doc.setFontSize(8);
        doc.setTextColor(150, 0, 0); // Rouge pour la remise
        doc.text(`Économie totale: ${totalDiscount.toFixed(2)} € (${discountPercentage}%)`, receiptWidth - margin, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0); // Revenir au noir
        yPos += 3;
      }
      doc.setFont('helvetica', 'normal');


      // --- DESSIN DU FOOTER ---
      yPos = footerDrawStartY;

      doc.setLineWidth(0.1);
      doc.line(margin, yPos, receiptWidth - margin, yPos);
      yPos += 3.5;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      tvaTextLines.forEach(line => {
        const split = doc.splitTextToSize(line, contentWidth);
        doc.text(split, receiptWidth / 2, yPos, { align: 'center' });
        yPos += split.length * footerLineSpacing;
      });
      yPos += 2;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.text(merciMsg, receiptWidth / 2, yPos, { align: 'center' });

      setProgress(90);

      const fileName = `Facture-${COMPANY_INFO.name.replace(/\s+/g, '_')}-${invoiceRef}.pdf`;
      
      // ✅ CORRECTION: Générer le blob une seule fois
      const pdfBlob = doc.output('blob');
      
      try {
        // Uploader la facture vers R2 en arrière-plan (seulement si le blob existe)
        if (pdfBlob) {
          uploadInvoiceToR2(pdfBlob, fileName)
            .then(invoiceUrl => {
              console.log('Facture téléchargée avec succès:', invoiceUrl);
            })
            .catch(error => {
              console.error('Erreur lors du téléchargement de la facture:', error);
              // Ne pas bloquer l'utilisateur en cas d'échec de l'upload
            });
        }
      } catch (error) {
        console.error('Erreur lors de la préparation de l\'upload de la facture:', error);
        // Continuer même en cas d'erreur
      }
      
      // ✅ CORRECTION: Utiliser l'utilitaire sécurisé pour le téléchargement
      await downloadBlobSafely(pdfBlob, fileName, { timeout: 30000, cleanup: true });
      
      // Monitorer la mémoire après génération
      monitorMemoryAndCleanup();

      setProgress(100);
      handleComplete();

    } catch (error) {
      const err = error as Error;
      console.error('Erreur lors de la génération de la facture:', err);
      onError(err);
    } finally {
      setLoading(false);
      setProgress(0);
      
      // ✅ CORRECTION: Nettoyage forcé des ressources jsPDF
      if (typeof window !== 'undefined') {
        console.log('[ReceiptGenerator] Force cleanup resources');
        // Le nettoyage des URL est déjà fait, mais on s'assure que tout est propre
      }
    }
  }, [items, itemPrices, totalDiscount, discountPercentage, multiPage, handleComplete, onError, calculateTotal]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Génération de Facture</Text>
      <ScrollView style={styles.itemsScrollView}>
        {items.map((item) => {
          const price = parseFloat(itemPrices.get(item.id) || '0');
          const discount = item.sellingPrice && price < item.sellingPrice
            ? item.sellingPrice - price
            : 0;
          const discountPercentage = item.sellingPrice && price < item.sellingPrice && item.sellingPrice !== 0
            ? Math.round((discount / item.sellingPrice) * 100)
            : 0;
            
          return (
            <View key={item.id} style={styles.itemPreview}>
              <View style={styles.itemHeaderRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.quantity && item.quantity > 1 && (
                  <Text style={styles.quantityLabel}>×{item.quantity}</Text>
                )}
              </View>
              {item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Prix unitaire:</Text>
                <TextInput
                  style={styles.priceInput}
                  value={itemPrices.get(item.id) || '0'}
                  onChangeText={(value) => handlePriceChange(item.id, value)}
                  keyboardType="numeric"
                  placeholder="Prix"
                />
                <Text style={styles.priceUnit}>€</Text>
              </View>
              {discount > 0 && (
                <View style={styles.discountContainer}>
                  <Text style={styles.discountLabel}>
                    Remise: {(discount * (item.quantity || 1)).toFixed(2)}€ ({discountPercentage}%)
                  </Text>
                </View>
              )}
            </View>
          );
        })}
        
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total: {calculateTotal().toFixed(2)}€</Text>
          {totalDiscount > 0 && (
            <Text style={styles.totalDiscountLabel}>
              Économie totale: {totalDiscount.toFixed(2)}€ ({discountPercentage}%)
            </Text>
          )}
        </View>
      </ScrollView>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, (loading || !getJsPDF()) && styles.buttonDisabled]}
        onPress={generateReceipt}
        disabled={loading || !getJsPDF()}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Génération...' : 'Générer la Facture'}
        </Text>
      </TouchableOpacity>
      {!getJsPDF() && Platform.OS === 'web' && <Text style={styles.errorText}>jsPDF est en cours de chargement ou n'a pas pu être chargé.</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    margin: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  itemPreview: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee'
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#444',
  },
  itemDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 14,
    marginRight: 10,
    color: '#555',
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: 100,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  itemsScrollView: {
    maxHeight: 400,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  totalContainer: {
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b3d4fc',
    marginTop: 15,
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#333',
  },
  totalDiscountLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    color: '#c0392b',
    marginTop: 5,
  },
  priceUnit: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555',
  },
  discountContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fff0f0',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ffd9d9',
  },
  discountLabel: {
    color: '#c0392b',
    fontSize: 13,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  progressText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  button: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
  }
});

export default ReceiptGenerator;