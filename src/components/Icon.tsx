import React from 'react';
import { Platform } from 'react-native';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  variant?: 'filled' | 'outlined' | 'round' | 'sharp' | 'two-tone';
  style?: any;
}

// Table de correspondance Material Icons vers Ionicons (plus fiable sur mobile)
const materialToIoniconsMapping: { [key: string]: string } = {
  // Navigation & Actions
  'add': 'add',
  'add_circle': 'add-circle',
  'add_circle_outline': 'add-circle-outline',
  'arrow_back': 'arrow-back',
  'arrow_back_ios': 'chevron-back',
  'close': 'close',
  'done': 'checkmark',
  'done_all': 'checkmark-done',
  'edit': 'create',
  'delete': 'trash',
  'save': 'save',
  'cancel': 'close-circle',
  'check_circle': 'checkmark-circle',
  'check_box': 'checkbox',
  'check_box_outline_blank': 'square-outline',
  
  // Interface
  'settings': 'settings',
  'refresh': 'refresh',
  'search': 'search',
  'search_off': 'search',
  'filter_list': 'filter',
  'filter_list_off': 'filter',
  'more_horiz': 'ellipsis-horizontal',
  'chevron_right': 'chevron-forward',
  
  // Content & Media
  'image': 'image',
  'image_not_supported': 'image',
  'add_photo_alternate': 'camera',
  'cloud_upload': 'cloud-upload',
  
  // Business & Shopping
  'inventory': 'cube',
  'shopping_cart': 'cart',
  'shopping_bag': 'bag',
  'receipt': 'receipt',
  'bar_chart': 'bar-chart',
  'business_center': 'briefcase',
  
  // Categories
  'category': 'albums',
  'label': 'pricetag',
  'folder': 'folder',
  'work': 'briefcase',
  'style': 'shirt',
  'layers': 'layers',
  'texture': 'grid',
  'circle': 'ellipse',
  'diamond': 'diamond',
  'favorite': 'heart',
  'accessibility': 'accessibility',
  'hiking': 'walk',
  'visibility': 'eye',
  'watch': 'watch',
  'waves': 'water',
  'checkroom': 'shirt',
  'straighten': 'resize',
  
  // Technical
  'qr_code': 'qr-code',
  'qr_code_scanner': 'scan',
  'cleaning_services': 'construct',
  'build': 'construct',
  'error_outline': 'alert-circle-outline',
  'inbox': 'mail',
  'logout': 'log-out',
};

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

  // Pour iOS/Android, utiliser Ionicons qui est plus fiable
  const Ionicons = require('@expo/vector-icons/Ionicons').default;
  
  // Utiliser le mapping vers Ionicons s'il existe, sinon fallback
  const ionicName = materialToIoniconsMapping[name];
  
  if (ionicName) {
    return (
      <Ionicons 
        name={ionicName as any} 
        size={size} 
        color={color} 
        style={style}
      />
    );
  }
  
  // Fallback : essayer MaterialIcons avec le nom original
  try {
    const MaterialIcons = require('@expo/vector-icons/MaterialIcons').default;
    return (
      <MaterialIcons 
        name={name as any} 
        size={size} 
        color={color} 
        style={style}
      />
    );
  } catch (error) {
    // Dernier fallback : utiliser une icône Ionicons générique
    return (
      <Ionicons 
        name="help-circle-outline" 
        size={size} 
        color={color} 
        style={style}
      />
    );
  }
};

export default Icon; 