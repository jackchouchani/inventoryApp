import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';

export const ID_TYPES = {
  ITEM: 'ART',
  CONTAINER: 'CONT'
} as const;

export type IdType = keyof typeof ID_TYPES;

// Génère un UUID en Base64 URL-safe
const generateBase64UUID = (): string => {
  const uuid = uuidv4();
  const cleanUuid = uuid.replace(/-/g, '');
  const buffer = Buffer.from(cleanUuid, 'hex');
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// Génère un identifiant pour un article ou un container
export const generateId = (type: IdType): string => {
  const prefix = ID_TYPES[type];
  const base64Id = generateBase64UUID();
  return `${prefix}_${base64Id}`;
};

// Parse un identifiant
export const parseId = (id: string): { type: IdType | null, value: string | null } => {
  const regex = /^(ART|CONT)_([A-Za-z0-9\-_]{22,24})$/;
  const match = id.match(regex);

  if (!match) {
    return { type: null, value: null };
  }

  const type = Object.entries(ID_TYPES)
    .find(([_, prefix]) => prefix === match[1])?.[0] as IdType;

  return {
    type,
    value: match[2]
  };
};

// Vérifie si un identifiant est valide
export const isValidId = (id: string): boolean => {
  const { type, value } = parseId(id);
  return type !== null && value !== null;
}; 