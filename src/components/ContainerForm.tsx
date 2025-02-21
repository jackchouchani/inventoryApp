import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Container } from '../types/container';
import { theme } from '../utils/theme';
import { QRCodeGenerator } from './QRCodeGenerator';
import { generateId } from '../utils/identifierManager';
import { useValidation } from '../hooks/useValidation';

interface ContainerFormProps {
  initialData?: Container | null;
  onSubmit: (container: Omit<Container, 'id'>) => void;
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
  const [formData, setFormData] = useState({
    number: initialData?.number?.toString() || '',
    name: initialData?.name || '',
    description: initialData?.description || '',
    qrCode: initialData?.qrCode || generateId('CONTAINER')
  });

  const { errors, validateField, validateForm } = useValidation(CONTAINER_VALIDATION_RULES);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = useCallback((field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  }, [validateField]);

  const handleSubmit = async () => {
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
      await onSubmit({
        name: formData.name.trim(),
        number: parseInt(formData.number.trim(), 10),
        description: formData.description.trim(),
        qrCode: formData.qrCode,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
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
            <ActivityIndicator color={theme.colors.text.inverse} />
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

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.error,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  submitButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    color: theme.colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
});