import React, { useCallback, memo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useImagePicker } from '../hooks/useImagePicker';
import { useTheme } from '../hooks/useTheme';

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
  const theme = useTheme();
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
        { backgroundColor: theme.colors.primary },
        disabled && styles.buttonDisabled
      ]}
      onPress={handlePress}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.background} />
      ) : (
        <Text style={[
          styles.buttonText,
          { color: theme.colors.background }
        ]}>
          Sélectionner une image
        </Text>
      )}
    </TouchableOpacity>
  );
});

ImagePicker.displayName = 'ImagePicker';

const styles = StyleSheet.create({
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 