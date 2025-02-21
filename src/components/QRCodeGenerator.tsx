import React, { useMemo } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { parseId } from '../utils/identifierManager';
import { handleQRCodeError } from '../utils/labelErrorHandler';

interface QRCodeGeneratorProps {
  /** Identifiant du conteneur à encoder dans le QR code */
  value: string;
  /** Taille du QR code en pixels (défaut: 200) */
  size?: number;
  /** Couleur du QR code (défaut: noir) */
  color?: string;
  /** Couleur de fond du QR code (défaut: blanc) */
  backgroundColor?: string;
}

/**
 * Composant pour générer un QR code pour les conteneurs.
 * @param props - Les propriétés du composant
 * @returns Le composant QR code ou null si l'identifiant n'est pas valide
 */
export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = React.memo(({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#ffffff'
}) => {
  try {
    const { type } = parseId(value);
    
    if (type !== 'CONTAINER') {
      handleQRCodeError(
        new Error('Type d\'identifiant invalide'),
        'QRCodeGenerator'
      );
      return null;
    }

    // Optimisation des props du QR code
    const qrProps = useMemo(() => ({
      value,
      size,
      color,
      backgroundColor,
      quietZone: 4,
      ecl: "M" as const,
      enableLinearGradient: false
    }), [value, size, color, backgroundColor]);

    // Annonce pour l'accessibilité
    const accessibilityLabel = `Code QR pour le conteneur ${value}`;

    return (
      <View 
        style={{ backgroundColor }}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
      >
        <QRCode {...qrProps} />
      </View>
    );
  } catch (error) {
    handleQRCodeError(
      error instanceof Error ? error : new Error('Erreur de génération QR code'),
      'QRCodeGenerator'
    );
    return null;
  }
}); 

QRCodeGenerator.displayName = 'QRCodeGenerator'; 