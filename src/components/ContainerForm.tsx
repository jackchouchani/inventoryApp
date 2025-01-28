import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Container } from '../database/database';
import { theme } from '../utils/theme';
import { QRCodeGenerator } from './QRCodeGenerator';
import { generateQRValue } from '../utils/qrCodeManager';

interface ContainerFormProps {
  container?: Container;
  onSubmit: (container: Omit<Container, 'id'>) => void;
  onCancel: () => void;
}

export const ContainerForm: React.FC<ContainerFormProps> = ({ container, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: container?.name || '',
    number: container?.number?.toString() || '',
    description: container?.description || '',
    qrCode: container?.qrCode || generateQRValue('CONTAINER')
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!formData.name.trim() || !formData.number.trim()) {
      setError('Name and number are required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: formData.name.trim(),
        number: parseInt(formData.number.trim(), 10),
        description: formData.description.trim(),
        qrCode: formData.qrCode,
        createdAt: container?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      setError('Failed to save container. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.label}>Container Number *</Text>
      <TextInput
        style={styles.input}
        value={formData.number}
        onChangeText={(text) => setFormData(prev => ({ ...prev, number: text }))}
        placeholder="Container number"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={formData.name}
        onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
        placeholder="Container name"
      />

      <Text style={styles.label}>Description (Optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.description}
        onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
        placeholder="Container description"
        multiline
        numberOfLines={4}
      />

      <View style={styles.qrCodeContainer}>
        <Text style={styles.label}>QR Code du container</Text>
        <QRCodeGenerator value={formData.qrCode} size={150} />
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.text.inverse} />
        ) : (
          <Text style={styles.submitButtonText}>
            {container ? 'Update Container' : 'Create Container'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
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
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
  errorText: {
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginVertical: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
});