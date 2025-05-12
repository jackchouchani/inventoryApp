import { Platform } from 'react-native';

/**
 * Utilitaire pour optimiser la détection et le traitement des codes-barres sur le web
 * Cet utilitaire fournit des fonctions pour aider à la détection et au traitement des codes-barres
 * spécifiquement dans un environnement web où la détection peut être moins fiable.
 */

// Vérifier si on est sur la plateforme web
export const isWeb = Platform.OS === 'web';

// Types de codes-barres courants
export type BarcodeFormat = 'CODE128' | 'QR_CODE' | 'EAN13' | 'EAN8';

/**
 * Normalise un code scanné en fonction du format probable
 * Cette fonction aide à traiter les codes qui peuvent être détectés 
 * avec un type incorrect sur le web
 */
export const normalizeScannedCode = (data: string, detectedType: string): { 
  value: string, 
  probableFormat: BarcodeFormat 
} => {
  // Log pour débogage
  console.log(`[WebBarcode] Normalisation: ${data}, type détecté: ${detectedType}`);
  
  // Si c'est un code numérique pur - très probablement un Code128 pour les articles
  if (/^\d+$/.test(data)) {
    return { 
      value: data, 
      probableFormat: 'CODE128' 
    };
  }
  
  // Si le code commence par CONT_ (format pour containers)
  if (data.startsWith('CONT_')) {
    return { 
      value: data, 
      probableFormat: 'QR_CODE' 
    };
  }
  
  // Pour les anciens codes d'articles avec préfixe ART_
  if (data.startsWith('ART_')) {
    // Extraire la partie numérique pour la compatibilité
    const numericPart = data.replace('ART_', '');
    return { 
      value: numericPart, 
      probableFormat: 'CODE128' 
    };
  }
  
  // Cas par défaut - conserver le code tel quel
  return {
    value: data,
    // Essayer de déterminer le format basé sur le type détecté
    probableFormat: mapToStandardFormat(detectedType)
  };
};

/**
 * Convertit un type de code-barres détecté en format standard
 */
export const mapToStandardFormat = (detectedType: string): BarcodeFormat => {
  const normalizedType = detectedType.toLowerCase();
  
  if (normalizedType.includes('qr')) return 'QR_CODE';
  if (normalizedType.includes('128')) return 'CODE128';
  if (normalizedType.includes('ean13') || normalizedType.includes('ean-13')) return 'EAN13';
  if (normalizedType.includes('ean8') || normalizedType.includes('ean-8')) return 'EAN8';
  
  // Par défaut, pour les codes numériques ou non reconnus
  return 'CODE128';
};

/**
 * Vérifie si un code est probablement un code article
 */
export const isProbablyItemCode = (data: string, type: string): boolean => {
  // Codes purement numériques sont probablement des articles
  if (/^\d+$/.test(data)) return true;
  
  // Si le type détecté est un code-barres linéaire (et pas un QR code)
  const isLinearCode = !type.toLowerCase().includes('qr');
  
  // Si c'est un code linéaire avec un contenu qui pourrait être un code article
  if (isLinearCode && (data.startsWith('ART_') || /^\d+$/.test(data))) {
    return true;
  }
  
  return false;
};

/**
 * Vérifie si un code est probablement un code container
 */
export const isProbablyContainerCode = (data: string, type: string): boolean => {
  // Les codes container commencent toujours par CONT_
  if (data.startsWith('CONT_')) return true;
  
  // Si le type détecté est un QR code et qu'il contient le format attendu
  const isQRCode = type.toLowerCase().includes('qr');
  
  if (isQRCode && data.includes('CONT_')) {
    return true;
  }
  
  return false;
};

/**
 * Effectue un traitement optimisé des données scannées pour le web
 * Cette fonction est spécifiquement conçue pour contourner les limitations
 * de la détection de codes-barres sur le web
 */
export const processWebScanResult = (data: string, type: string): {
  normalizedData: string;
  isValid: boolean;
  probableType: 'container' | 'item' | 'unknown';
} => {
  // Normaliser le code scanné
  const { value, probableFormat } = normalizeScannedCode(data, type);
  
  let isValid = false;
  let probableType: 'container' | 'item' | 'unknown' = 'unknown';
  
  // Déterminer le type probable
  if (isProbablyContainerCode(data, type)) {
    isValid = true;
    probableType = 'container';
  } else if (isProbablyItemCode(data, type)) {
    isValid = true;
    probableType = 'item';
  }
  
  // Journalisation du résultat pour débogage
  console.log(`[WebBarcode] Traitement: ${data} -> ${value} (${probableType}), Format: ${probableFormat}`);
  
  return {
    normalizedData: value,
    isValid,
    probableType
  };
}; 