import React, { useCallback, memo, useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useImagePicker } from '../hooks/useImagePicker';
import { useAppTheme, AppThemeType } from '../contexts/ThemeContext';

interface ImagePickerProps {
  onImageSelected: (uri: string) => void;
  onError: (error: string) => void;
  quality?: number;
  aspect?: [number, number];
  allowsEditing?: boolean;
  disabled?: boolean;
}

export const ImagePicker: React.FC<ImagePickerProps> = memo(({
  onImageSelected,
  onError,
  quality,
  aspect,
  allowsEditing,
  disabled = false
}) => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(activeTheme), [activeTheme]);
  
  const { pickImage, isLoading, error } = useImagePicker({
    quality,
    aspect,
    allowsEditing
  });

  const handlePress = useCallback(async () => {
    const uri = await pickImage();
    if (uri) {
      onImageSelected(uri);
    } else if (error) {
      onError(error);
    }
  }, [pickImage, error, onImageSelected, onError]);

  return (
    <TouchableOpacity 
      style={[
        styles.button,
        disabled && styles.buttonDisabled
      ]}
      onPress={handlePress}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color={activeTheme.text.onPrimary} />
      ) : (
        <Text style={styles.buttonText}>
          Sélectionner une image
        </Text>
      )}
    </TouchableOpacity>
  );
});

ImagePicker.displayName = 'ImagePicker';

const createStyles = (theme: AppThemeType) => StyleSheet.create({
  button: {
    backgroundColor: theme.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: theme.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
}); 