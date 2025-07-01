import 'react-native-get-random-values';

// Définir les types d'IDs
const ID_TYPES = {
  ITEM: 'ART',
  CONTAINER: 'CONT',
  LOCATION: 'LOC'
} as const;

// Caractères alphanumériques pour générer un ID court (sans les caractères ambigus 0/O, 1/I)
const ALPHANUM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Génère un code court de 4 caractères alphanumériques
 * @returns Une chaîne de 4 caractères alphanumériques
 */
function generateShortCode(): string {
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += ALPHANUM_CHARS.charAt(Math.floor(Math.random() * ALPHANUM_CHARS.length));
  }
  return result;
}

/**
 * Génère un identifiant pour un article, un container ou un emplacement
 * @param type Type d'ID à générer ('ITEM', 'CONTAINER' ou 'LOCATION')
 * @returns Un ID au format 'ART_XXXX' pour les articles, 'CONT_XXXX' pour les containers ou 'LOC_XXXX' pour les emplacements
 */
export function generateId(type: keyof typeof ID_TYPES): string {
  const prefix = ID_TYPES[type];
  const shortCode = generateShortCode();
  return `${prefix}_${shortCode}`;
}

/**
 * Parse un identifiant et extrait son type et sa valeur
 * @param id L'identifiant à parser
 * @returns Un objet contenant le type et la valeur, ou null si le format est invalide
 */
export function parseId(id: string): { type: string; value: string } | null {
  // Format QR code ART_XXXX
  if (id.startsWith(`${ID_TYPES.ITEM}_`)) {
    return {
      type: 'ITEM',
      value: id.substring(4) // Longueur de 'ART_'
    };
  }
  
  // Format QR code CONT_XXXX
  if (id.startsWith(`${ID_TYPES.CONTAINER}_`)) {
    return {
      type: 'CONTAINER',
      value: id.substring(5) // Longueur de 'CONT_'
    };
  }
  
  // Format QR code LOC_XXXX
  if (id.startsWith(`${ID_TYPES.LOCATION}_`)) {
    return {
      type: 'LOCATION',
      value: id.substring(4) // Longueur de 'LOC_'
    };
  }
  
  console.warn(`Format d'identifiant non reconnu: ${id}`);
  return null;
}

/**
 * Vérifie si un identifiant est valide
 * @param id L'identifiant à vérifier
 * @returns true si l'identifiant est valide, false sinon
 */
export function isValidId(id: string): boolean {
  return isItemQrCode(id) || isContainerQrCode(id) || isLocationQrCode(id);
}

/**
 * Vérifie si un identifiant correspond au format QR code d'un article
 * @param id L'identifiant à vérifier
 * @returns true si l'identifiant est au format QR code d'article, false sinon
 */
export function isItemQrCode(id: string): boolean {
  const result = id.startsWith(`${ID_TYPES.ITEM}_`) && id.length >= 8; // ART_ + au moins 4 caractères
  if (!result && id) {
    console.log(`QR code article non reconnu: '${id}'`);
    console.log(`Vérification: commence par '${ID_TYPES.ITEM}_' = ${id.startsWith(`${ID_TYPES.ITEM}_`)}`);
    console.log(`Vérification: longueur >= 8 = ${id.length >= 8}`);
  }
  return result;
}

/**
 * Vérifie si un identifiant correspond au format QR code d'un container
 * @param id L'identifiant à vérifier
 * @returns true si l'identifiant est au format QR code de container, false sinon
 */
export function isContainerQrCode(id: string): boolean {
  const result = id.startsWith(`${ID_TYPES.CONTAINER}_`) && id.length >= 9; // CONT_ + au moins 4 caractères
  if (!result && id) {
    console.log(`QR code container non reconnu: '${id}'`);
    console.log(`Vérification: commence par '${ID_TYPES.CONTAINER}_' = ${id.startsWith(`${ID_TYPES.CONTAINER}_`)}`);
    console.log(`Vérification: longueur >= 9 = ${id.length >= 9}`);
  }
  return result;
}

/**
 * Vérifie si un identifiant correspond au format QR code d'un emplacement
 * @param id L'identifiant à vérifier
 * @returns true si l'identifiant est au format QR code d'emplacement, false sinon
 */
export function isLocationQrCode(id: string): boolean {
  const result = id.startsWith(`${ID_TYPES.LOCATION}_`) && id.length >= 8; // LOC_ + au moins 4 caractères
  if (!result && id) {
    console.log(`QR code emplacement non reconnu: '${id}'`);
    console.log(`Vérification: commence par '${ID_TYPES.LOCATION}_' = ${id.startsWith(`${ID_TYPES.LOCATION}_`)}`);
    console.log(`Vérification: longueur >= 8 = ${id.length >= 8}`);
  }
  return result;
}

/**
 * Vérifie si un identifiant est numérique
 * @param _id L'identifiant à vérifier
 * @returns false (Les identifiants numériques ne sont plus utilisés)
 */
export function isNumericId(_id: string): boolean {
  return false; // Les identifiants numériques ne sont plus utilisés
} 