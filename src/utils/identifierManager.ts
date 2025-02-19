import 'react-native-get-random-values';

export const ID_TYPES = {
  ITEM: 'ART',
  CONTAINER: 'CONT'
} as const;

type IdType = keyof typeof ID_TYPES;

// Fonction pour générer un code aléatoire court
const generateShortCode = (): string => {
  // Utilise une combinaison de lettres et chiffres (base36) pour avoir des codes courts
  // Exclut les caractères ambigus (0/O, 1/I/l)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  // 4 caractères donnent 32^4 = 1,048,576 possibilités, largement suffisant pour 1000 articles
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Génère un identifiant court pour un article ou un container
export const generateId = (type: IdType): string => {
  const prefix = ID_TYPES[type];
  const shortCode = generateShortCode();
  return `${prefix}_${shortCode}`;
};

// Parse un identifiant
export const parseId = (id: string): { type: IdType | null; value: string | null } => {
  const regex = /^(ART|CONT)_([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4})$/;
  const match = id.match(regex);

  if (!match) {
    return { type: null, value: null };
  }

  try {
    const prefix = match[1];
    const value = match[2];

    const type = Object.entries(ID_TYPES).find(([_, p]) => p === prefix)?.[0] as IdType;
    return { type, value };
  } catch (error) {
    console.error('Erreur lors du parsing de l\'identifiant:', error);
    return { type: null, value: null };
  }
};

// Vérifie si un identifiant est valide
export const isValidId = (id: string): boolean => {
  const { type, value } = parseId(id);
  return type !== null && value !== null;
}; 