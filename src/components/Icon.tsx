import React from 'react';
import { Platform } from 'react-native';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  variant?: 'filled' | 'outlined' | 'round' | 'sharp' | 'two-tone';
  style?: any;
}

export const Icon: React.FC<IconProps> = ({ 
  name, 
  size = 24, 
  color = '#000', 
  variant = 'filled',
  style 
}) => {
  if (Platform.OS === 'web') {
    // Déterminer la classe CSS selon la variante
    const getClassName = () => {
      switch (variant) {
        case 'outlined':
          return 'material-icons-outlined';
        case 'round':
          return 'material-icons-round';
        case 'sharp':
          return 'material-icons-sharp';
        case 'two-tone':
          return 'material-icons-two-tone';
        default:
          return 'material-icons';
      }
    };

    return (
      <span
        className={getClassName()}
        style={{
          fontSize: size,
          color: color,
          userSelect: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style
        }}
      >
        {name}
      </span>
    );
  }

  // Pour iOS/Android, utiliser @expo/vector-icons
  const MaterialIcons = require('@expo/vector-icons/MaterialIcons').default;
  return (
    <MaterialIcons 
      name={name as any} 
      size={size} 
      color={color} 
      style={style}
    />
  );
};

export default Icon; 