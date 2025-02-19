import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { parseId } from '../utils/identifierManager';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#ffffff'
}) => {
  const { type } = parseId(value);
  
  if (type !== 'CONTAINER') {
    console.warn('QRCodeGenerator doit être utilisé uniquement pour les conteneurs');
    return null;
  }

  return (
    <View style={{ backgroundColor }}>
      <QRCode
        value={value}
        size={size}
        color={color}
        backgroundColor={backgroundColor}
        quietZone={4}
        ecl="M"
        enableLinearGradient={false}
      />
    </View>
  );
}; 