import React from 'react';

interface MaterialIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  variant?: 'filled' | 'outlined' | 'round' | 'sharp' | 'two-tone';
}

// Mapping des icônes vers des caractères Unicode
const ICON_MAP: { [key: string]: string } = {
  'inventory': '\uE179',
  'add_circle_outline': '\uE148',
  'qr_code': '\uEF6B',
  'qr_code_scanner': '\uF206',
  'bar_chart': '\uE26B',
  'settings': '\uE8B8',
  'search': '\uE8B6',
  'filter_list': '\uE152',
  'filter_list_off': '\uEB57',
  'close': '\uE5CD',
  'edit': '\uE3C9',
  'delete': '\uE872',
  'error_outline': '\uE000',
  'folder': '\uE2C7',
  'shopping_bag': '\uF1CC',
  'style': '\uE41D',
  'accessibility': '\uE84E',
  'layers': '\uE53B',
  'hiking': '\uE50A',
  'visibility': '\uE8F4',
  'diamond': '\uEA52',
  'watch': '\uE8B5',
  'straighten': '\uE41C',
  'checkroom': '\uF19C',
  'waves': '\uE176',
  'favorite': '\uE87D',
  'texture': '\uE421',
  'circle': '\uEF4A',
  'more_horiz': '\uE5D3',
};

const MaterialIcon: React.FC<MaterialIconProps> = ({ 
  name, 
  size = 24, 
  color = '#000', 
  style,
  variant = 'filled'
}) => {
  // Pour web app uniquement - utiliser les classes CSS Material Icons
  const className = variant === 'filled' ? 'material-icons' : `material-icons-${variant}`;
  
  return (
    <span
      className={className}
      style={{
        fontSize: size,
        color: color,
        lineHeight: 1,
        userSelect: 'none',
        ...style
      }}
    >
      {name}
    </span>
  );
};

export default MaterialIcon; 