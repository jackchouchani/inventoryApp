/**
 * Génération des QR codes pour containers et articles
 * Format: CONT_XXXX pour containers, ART_XXXX pour articles
 * XXXX = 4 caractères alphanumériques aléatoires
 * 
 * ⚠️ RÈGLE : TOUJOURS utiliser les fonctions *Unique* pour garantir l'unicité
 */

import { supabase } from '../config/supabase';

// Configuration
const QR_CODE_LENGTH = 4;
const MAX_ATTEMPTS = 100; // Augmenté pour éviter les fallbacks invalides

/**
 * Génère une chaîne aléatoire de caractères alphanumériques
 */
const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Vérifie si un QR code container existe déjà dans la base de données
 */
const isContainerQRCodeExists = async (qrCode: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('containers')
      .select('id')
      .eq('qr_code', qrCode)
      .eq('deleted', false)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la vérification du QR code container:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Erreur lors de la vérification du QR code container:', error);
    return false;
  }
};

/**
 * Vérifie si un QR code item existe déjà dans la base de données
 */
const isItemQRCodeExists = async (qrCode: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('id')
      .eq('qr_code', qrCode)
      .eq('deleted', false)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la vérification du QR code item:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Erreur lors de la vérification du QR code item:', error);
    return false;
  }
};

/**
 * ✅ RECOMMANDÉ - Génère un QR code unique pour un container
 * Format: CONT_XXXX avec vérification d'unicité
 */
export const generateUniqueContainerQRCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const qrCode = `CONT_${generateRandomString(QR_CODE_LENGTH)}`;
    
    const exists = await isContainerQRCodeExists(qrCode);
    if (!exists) {
      console.log(`[QR Generator] QR code container unique généré: ${qrCode} (tentative ${attempt + 1})`);
      return qrCode;
    }
    
    console.log(`[QR Generator] QR code container ${qrCode} existe déjà, nouvelle tentative...`);
  }
  
  // Si après 100 tentatives on n'y arrive pas, utiliser une stratégie différente
  // Générer avec un suffixe plus long pour garantir l'unicité
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const qrCode = `CONT_${generateRandomString(QR_CODE_LENGTH + 2)}`; // 6 caractères au lieu de 4
    
    const exists = await isContainerQRCodeExists(qrCode);
    if (!exists) {
      console.warn(`[QR Generator] QR code container avec suffixe étendu: ${qrCode} (tentative ${attempt + 1})`);
      return qrCode;
    }
  }
  
  // Dernière stratégie : utiliser 8 caractères aléatoires
  const ultimateCode = `CONT_${generateRandomString(8)}`;
  console.error(`[QR Generator] Utilisation du code ultime (non vérifié): ${ultimateCode}`);
  return ultimateCode;
};

/**
 * ✅ RECOMMANDÉ - Génère un QR code unique pour un article
 * Format: ART_XXXX avec vérification d'unicité
 */
export const generateUniqueItemQRCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const qrCode = `ART_${generateRandomString(QR_CODE_LENGTH)}`;
    
    const exists = await isItemQRCodeExists(qrCode);
    if (!exists) {
      console.log(`[QR Generator] QR code item unique généré: ${qrCode} (tentative ${attempt + 1})`);
      return qrCode;
    }
    
    console.log(`[QR Generator] QR code item ${qrCode} existe déjà, nouvelle tentative...`);
  }
  
  // Si après 100 tentatives on n'y arrive pas, utiliser une stratégie différente
  // Générer avec un suffixe plus long pour garantir l'unicité
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const qrCode = `ART_${generateRandomString(QR_CODE_LENGTH + 2)}`; // 6 caractères au lieu de 4
    
    const exists = await isItemQRCodeExists(qrCode);
    if (!exists) {
      console.warn(`[QR Generator] QR code item avec suffixe étendu: ${qrCode} (tentative ${attempt + 1})`);
      return qrCode;
    }
  }
  
  // Dernière stratégie : utiliser 8 caractères aléatoires
  const ultimateCode = `ART_${generateRandomString(8)}`;
  console.error(`[QR Generator] Utilisation du code ultime (non vérifié): ${ultimateCode}`);
  return ultimateCode;
};

/**
 * ⚠️ DÉPRÉCIÉ - Génère un QR code pour un container SANS vérification d'unicité
 * Utiliser generateUniqueContainerQRCode() à la place
 */
export const generateContainerQRCode = (): string => {
  const randomSuffix = generateRandomString(QR_CODE_LENGTH);
  return `CONT_${randomSuffix}`;
};

/**
 * ⚠️ DÉPRÉCIÉ - Génère un QR code pour un article SANS vérification d'unicité
 * Utiliser generateUniqueItemQRCode() à la place
 */
export const generateItemQRCode = (): string => {
  const randomSuffix = generateRandomString(QR_CODE_LENGTH);
  return `ART_${randomSuffix}`;
};

/**
 * Valide le format d'un QR code container
 */
export const isValidContainerQRCode = (qrCode: string): boolean => {
  return /^CONT_[A-Z0-9]{4}$/.test(qrCode);
};

/**
 * Valide le format d'un QR code article
 */
export const isValidItemQRCode = (qrCode: string): boolean => {
  return /^ART_[A-Z0-9]{4}$/.test(qrCode);
}; 