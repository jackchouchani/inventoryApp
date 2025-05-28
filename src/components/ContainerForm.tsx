import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Container } from '../types/container';
import { useAppTheme } from '../contexts/ThemeContext';
import { QRCodeGenerator } from './QRCodeGenerator';
import { generateId } from '../utils/identifierManager';
import { useValidation } from '../hooks/useValidation';

interface ContainerFormProps {
  initialData?: Container | null;
  onSubmit: (container: Omit<Container, 'id'>) => Promise<boolean>;
  onCancel: () => void;
}

const CONTAINER_VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9\s-_]+$/,
  },
  number: {
    required: true,
    min: 1,
    max: 99999,
  },
  description: {
    maxLength: 500,
  },
};

const ContainerFormComponent: React.FC<ContainerFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const { activeTheme } = useAppTheme();
  const [formData, setFormData] = useState({
    number: initialData?.number?.toString() || '',
    name: initialData?.name || '',
    description: initialData?.description || '',
    qrCode: initialData?.qrCode || generateId('CONTAINER')
  });

  const { errors, validateField, validateForm, clearErrors } = useValidation(CONTAINER_VALIDATION_RULES);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const styles = useMemo(() => getThemedStyles(activeTheme), [activeTheme]);

  useEffect(() => {
    clearErrors();
  }, [initialData, clearErrors]);

  const handleFieldChange = useCallback((field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  }, [validateField]);

  const handleSubmit = async () => {
    clearErrors();
    
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      Alert.alert(
        'Erreur de validation',
        'Veuillez corriger les erreurs suivantes:\n' +
        Object.values(validationErrors).join('\n')
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const success = await onSubmit({
        name: formData.name.trim(),
        number: parseInt(formData.number.trim(), 10),
        description: formData.description.trim(),
        qrCode: formData.qrCode,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      if (success) {
        onCancel();
      }
    } catch (err) {
      Alert.alert(
        'Erreur',
        'Impossible de sauvegarder le container. Veuillez réessayer.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const memoizedQRCode = useMemo(() => (
    <View style={styles.qrCodeContainer}>
      <Text style={styles.label}>QR Code du container</Text>
      <QRCodeGenerator value={formData.qrCode} size={150} />
    </View>
  ), [formData.qrCode]);

  return (
    <View style={styles.container}>
      {errors.length > 0 && <Text style={styles.errorText}>{errors.join('\n')}</Text>}

      <Text style={styles.label}>Numéro du Container *</Text>
      <TextInput
        style={styles.input}
        value={formData.number}
        onChangeText={(text) => handleFieldChange('number', text)}
        placeholder="Numéro du container"
        keyboardType="numeric"
        maxLength={5}
        testID="container-number-input"
      />

      <Text style={styles.label}>Nom *</Text>
      <TextInput
        style={styles.input}
        value={formData.name}
        onChangeText={(text) => handleFieldChange('name', text)}
        placeholder="Nom du container"
        maxLength={50}
        testID="container-name-input"
      />

      <Text style={styles.label}>Description (Optionnel)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.description}
        onChangeText={(text) => handleFieldChange('description', text)}
        placeholder="Description du container"
        multiline
        numberOfLines={4}
        maxLength={500}
        testID="container-description-input"
      />

      {memoizedQRCode}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.cancelButton]} 
          onPress={onCancel}
          disabled={isSubmitting}
          testID="container-cancel-button"
        >
          <Text style={styles.buttonText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
          onPress={handleSubmit}
          disabled={isSubmitting}
          testID="container-submit-button"
        >
          {isSubmitting ? (
            <ActivityIndicator color={activeTheme.text.onPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>
              {initialData ? 'Mettre à jour' : 'Créer'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ContainerForm = React.memo(ContainerFormComponent);

const getThemedStyles = (theme: any) => StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.surface,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  button: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginHorizontal: theme.spacing.xs,
  },
  cancelButton: {
    backgroundColor: theme.error,
  },
  submitButton: {
    backgroundColor: theme.primary,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.text.onPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  submitButtonText: {
    color: theme.text.onPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    color: theme.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    color: theme.text.primary,
    backgroundColor: theme.background,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: theme.error,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.20)', 
    elevation: 2,
  },
});