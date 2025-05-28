import React, { useMemo } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { parseId } from '../utils/identifierManager';
import { handleQRCodeError } from '../utils/labelErrorHandler';

/**
 * Interface pour les propriétés du générateur de QR code
 */
interface QRCodeGeneratorProps {
  /** Valeur à encoder dans le QR code (idéalement au format ART_XXXX ou CONT_XXXX) */
  value: string;
  /** Taille du QR code en pixels (défaut: 200) */
  size?: number;
  /** Couleur du QR code (défaut: noir) */
  color?: string;
  /** Couleur de fond du QR code (défaut: blanc) */
  backgroundColor?: string;
  /** Rotation du code (N=normal, R=90°, L=180°, I=270°) */
  rotate?: 'N' | 'R' | 'L' | 'I';
}

/**
 * Composant pour générer un QR code compatible avec le scanner
 * Il optimise automatiquement les paramètres et le format pour une meilleure compatibilité.
 * 
 * @param props - Les propriétés du composant
 * @returns Le composant QR code
 */
export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = React.memo(({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#ffffff',
  rotate = 'N'
}) => {
  try {
    // Préparation de la valeur - s'assurer qu'elle commence par ART_ ou CONT_
    let encodedValue = value;
    if (!encodedValue.startsWith('ART_') && !encodedValue.startsWith('CONT_')) {
      // Détecter si c'est probablement un container
      const isLikelyContainer = encodedValue.toLowerCase().includes('cont') || 
                               encodedValue.toLowerCase().includes('container');
      
      // Ajouter le préfixe approprié
      if (isLikelyContainer) {
        encodedValue = `CONT_${encodedValue}`;
      } else {
        encodedValue = `ART_${encodedValue}`;
      }
      console.warn(`Format corrigé pour compatibilité scanner: "${value}" -> "${encodedValue}"`);
    }

    // Gestion de la rotation
    const getRotationStyle = () => {
      switch (rotate) {
        case 'R': return { transform: [{ rotate: '90deg' }] };
        case 'L': return { transform: [{ rotate: '180deg' }] };
        case 'I': return { transform: [{ rotate: '270deg' }] };
        default: return {};
      }
    };

    // Déterminer le type d'élément pour l'accessibilité
    let elementType = 'élément';
    try {
      const parsed = parseId(encodedValue);
      if (parsed) {
        elementType = parsed.type === 'ITEM' ? 'article' : 'conteneur';
      }
    } catch (error) {
      // Silencieux en cas d'erreur sur l'accessibilité
    }

    // Optimisation des props du QR code pour maximiser la compatibilité scanner
    const qrProps = useMemo(() => ({
      value: encodedValue,
      size,
      color,
      backgroundColor,
      quietZone: 10, // Marge plus large pour faciliter la détection
      ecl: "H" as const, // Niveau de correction d'erreur plus élevé (High)
      enableLinearGradient: false,
    }), [encodedValue, size, color, backgroundColor]);

    // Annonce pour l'accessibilité
    const accessibilityLabel = `Code QR pour ${elementType} ${encodedValue}`;

    return (
      <View 
        style={[
          { 
            backgroundColor,
            padding: 5, // Padding pour améliorer la scannabilité
          },
          getRotationStyle()
        ]}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
      >
        <QRCode {...qrProps} />
      </View>
    );
  } catch (error) {
    console.error("Erreur de génération QR code:", error);
    try {
      // Fallback avec des paramètres simplifiés
      return (
        <View 
          style={{ 
            backgroundColor,
            padding: 8,
          }}
          accessible={true}
          accessibilityLabel={`Code QR pour ${value}`}
          accessibilityRole="image"
        >
          <QRCode 
            value={value} 
            size={size * 0.9}
            color={color}
            backgroundColor={backgroundColor}
            quietZone={12}
            ecl="H"
          />
        </View>
      );
    } catch (fallbackError) {
      handleQRCodeError(
        error instanceof Error ? error : new Error('Erreur de génération QR code'),
        'QRCodeGenerator'
      );
      return null;
    }
  }
}); 

// Alias pour préserver la compatibilité avec le code existant
export const BarcodeGenerator = QRCodeGenerator;

QRCodeGenerator.displayName = 'QRCodeGenerator';
BarcodeGenerator.displayName = 'BarcodeGenerator'; 