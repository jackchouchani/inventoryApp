import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { useAppTheme } from '../contexts/ThemeContext';
import StyleFactory from '../styles/StyleFactory';

interface CommonHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  leftComponent?: React.ReactNode;
  variant?: 'default' | 'modal' | 'search';
}

const CommonHeader: React.FC<CommonHeaderProps> = ({
  title,
  showBackButton = true,
  onBackPress,
  rightComponent,
  leftComponent,
  variant = 'default'
}) => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'CommonHeader');

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  // ✅ ICÔNE BACK STANDARDISÉE selon les bonnes pratiques
  const getBackIconName = () => {
    return Platform.OS === 'ios' ? 'arrow_back_ios' : 'arrow_back';
  };

  const getBackIconSize = () => {
    return Platform.OS === 'ios' ? 18 : 24;
  };

  const renderBackButton = () => {
    if (!showBackButton) return null;

    return (
      <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
        <Icon 
          name={getBackIconName()} 
          size={getBackIconSize()} 
          color={activeTheme.primary} 
        />
        <Text style={styles.backButtonText}>Retour</Text>
      </TouchableOpacity>
    );
  };

  if (variant === 'modal') {
    return (
      <View style={styles.modalHeader}>
        {leftComponent || renderBackButton()}
        <Text style={styles.modalTitle}>{title}</Text>
        {rightComponent || <View style={styles.headerSpacer} />}
      </View>
    );
  }

  return (
    <View style={styles.topBar}>
      {leftComponent || renderBackButton()}
      {title && <Text style={styles.topBarTitle}>{title}</Text>}
      {rightComponent || <View style={styles.headerSpacer} />}
    </View>
  );
};

export default CommonHeader; 