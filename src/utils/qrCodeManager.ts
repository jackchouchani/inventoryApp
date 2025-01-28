import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export const QR_CODE_TYPES = {
  ITEM: 'ART',
  CONTAINER: 'CONT'
} as const;

export type QRCodeType = keyof typeof QR_CODE_TYPES;

export const generateQRValue = (type: QRCodeType): string => {
  const prefix = QR_CODE_TYPES[type];
  const uuid = uuidv4();
  return `${prefix}_${uuid}`;
};

export const parseQRCode = (qrValue: string): { type: QRCodeType | null, uuid: string | null } => {
  const regex = /^(ART|CONT)_([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
  const match = qrValue.match(regex);

  if (!match) {
    return { type: null, uuid: null };
  }

  const type = Object.entries(QR_CODE_TYPES).find(([_, prefix]) => prefix === match[1])?.[0] as QRCodeType;
  return {
    type,
    uuid: match[2]
  };
};

export const isValidQRCode = (qrValue: string): boolean => {
  const { type, uuid } = parseQRCode(qrValue);
  return type !== null && uuid !== null;
}; 