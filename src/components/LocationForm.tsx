import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Location } from '../types/location';
import { useAppTheme } from '../contexts/ThemeContext';
import { QRCodeGenerator } from './QRCodeGenerator';
import { generateId } from '../utils/identifierManager';
import { useValidation } from '../hooks/useValidation';

interface LocationFormProps {
  initialData?: Location | null;
  onSubmit: (location: Omit<Location, 'id'>) => Promise<boolean>;
  onCancel: () => void;
}

const LOCATION_VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9\s-_]+$/,
  },
  address: {
    maxLength: 200,
  },
  description: {
    maxLength: 500,
  },
};

const LocationFormComponent: React.FC<LocationFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const { activeTheme } = useAppTheme();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    address: initialData?.address || '',
    description: initialData?.description || '',
    qrCode: initialData?.qrCode || generateId('LOCATION')
  });

  const { errors, validateField, validateForm, clearErrors } = useValidation(LOCATION_VALIDATION_RULES);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);

  useEffect(() => {
    clearErrors();
  }, [initialData, clearErrors]);

  const handleFieldChange = useCallback((field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const fieldErrors = validateField(field, value) || [];
    setFieldErrors(prev => ({
      ...prev,
      [field]: fieldErrors.length > 0 ? fieldErrors[0] : ''
    }));
  }, [validateField]);

  const handleSubmit = async () => {
    clearErrors();
    
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      const errorMessages = Object.entries(validationErrors)
        .map(([, errors]) => errors.join('\n'))
        .join('\n');
      Alert.alert(
        'Erreur de validation',
        'Veuillez corriger les erreurs suivantes:\n' + errorMessages
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const success = await onSubmit({
        name: formData.name.trim(),
        address: formData.address.trim(),
        description: formData.description.trim(),
        qrCode: formData.qrCode,
        userId: '', // Will be set by the thunk
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deleted: false
      });
      
      if (success) {
        onCancel();
      }
    } catch (error) {
      console.error('Erreur lors de la soumission du formulaire:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'enregistrement de l\'emplacement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = useMemo(() => {
    const hasRequiredFields = formData.name.trim().length >= 3;
    const hasFieldErrors = Object.values(fieldErrors).some(error => error !== '');
    return hasRequiredFields && !hasFieldErrors;
  }, [formData.name, fieldErrors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {initialData ? 'Modifier l\'emplacement' : 'Nouvel emplacement'}
      </Text>

      {/* Nom de l'emplacement */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Nom de l'emplacement *</Text>
        <TextInput
          style={[styles.input, fieldErrors.name && styles.inputError]}
          value={formData.name}
          onChangeText={(value) => handleFieldChange('name', value)}
          placeholder="Ex: Entrepôt A, Garage, Bureau..."
          placeholderTextColor={activeTheme.text.secondary}
          autoCapitalize="words"
          maxLength={50}
        />
        {fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}
      </View>

      {/* Adresse */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Adresse</Text>
        <TextInput
          style={[styles.input, fieldErrors.address && styles.inputError]}
          value={formData.address}
          onChangeText={(value) => handleFieldChange('address', value)}
          placeholder="Adresse complète (optionnel)"
          placeholderTextColor={activeTheme.text.secondary}
          autoCapitalize="words"
          maxLength={200}
          multiline
          numberOfLines={2}
        />
        {fieldErrors.address && <Text style={styles.errorText}>{fieldErrors.address}</Text>}
      </View>

      {/* Description */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, fieldErrors.description && styles.inputError]}
          value={formData.description}
          onChangeText={(value) => handleFieldChange('description', value)}
          placeholder="Description ou notes sur cet emplacement..."
          placeholderTextColor={activeTheme.text.secondary}
          multiline
          numberOfLines={3}
          maxLength={500}
        />
        {fieldErrors.description && <Text style={styles.errorText}>{fieldErrors.description}</Text>}
      </View>

      {/* QR Code */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>QR Code de l'emplacement</Text>
        <View style={styles.qrCodeContainer}>
          <QRCodeGenerator 
            value={formData.qrCode} 
            size={120}
          />
          <Text style={styles.qrCodeText}>{formData.qrCode}</Text>
        </View>
      </View>

      {/* Boutons d'action */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={isSubmitting}
        >
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.submitButton, !isValid && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={activeTheme.text.onPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>
              {initialData ? 'Modifier' : 'Créer'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getThemedStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: theme.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text.primary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text.primary,
    backgroundColor: theme.backgroundSecondary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: theme.error,
  },
  errorText: {
    color: theme.error,
    fontSize: 14,
    marginTop: 4,
  },
  qrCodeContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 8,
  },
  qrCodeText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.text.secondary,
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  submitButton: {
    backgroundColor: theme.primary,
  },
  disabledButton: {
    backgroundColor: theme.backgroundSecondary,
    opacity: 0.6,
  },
  cancelButtonText: {
    color: theme.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    color: theme.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LocationFormComponent;