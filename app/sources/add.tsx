import React, { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  Card,
  SegmentedButtons
} from 'react-native-paper';
import { router } from 'expo-router';
import { useSourcesOptimized } from '../../src/hooks/useSourcesOptimized';
import StyleFactory from '../../src/styles/StyleFactory';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { CommonHeader } from '../../src/components';
import type { SourceInput } from '../../src/types/source';

const SOURCE_TYPES = [
  { value: 'Marché', label: 'Marché' },
  { value: 'Boutique', label: 'Boutique' },
  { value: 'En ligne', label: 'En ligne' },
  { value: 'Particulier', label: 'Particulier' },
];

export default function AddSourceScreen() {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'AddSourceScreen');
  const { actions } = useSourcesOptimized({ autoLoad: false });
  
  const [formData, setFormData] = useState<SourceInput>({
    name: '',
    type: 'Marché',
    city: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<SourceInput>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<SourceInput> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.type) {
      newErrors.type = 'Le type est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await actions.create(formData).unwrap();
      // Navigation immédiate sans Alert pour éviter les problèmes
      router.replace('/sources');
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la création de la source'
      );
      console.error('Error creating source:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="Nouvelle Source"
        onBackPress={() => router.back()}
      />
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Nouvelle Source
          </Text>
          
          <View style={styles.form}>
            <TextInput
              label="Nom de la source *"
              value={formData.name}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, name: text }));
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
              }}
              error={!!errors.name}
              style={styles.input}
              mode="outlined"
              placeholder="Ex: Marché aux Puces, Vinted, etc."
            />
            {errors.name && (
              <Text style={styles.errorText}>{errors.name}</Text>
            )}

            <View style={styles.typeSection}>
              <Text variant="labelLarge" style={styles.typeLabel}>
                Type de source *
              </Text>
              <SegmentedButtons
                value={formData.type}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, type: value as SourceInput['type'] }));
                  if (errors.type) setErrors(prev => ({ ...prev, type: undefined }));
                }}
                buttons={SOURCE_TYPES}
                style={styles.segmentedButtons}
              />
              {errors.type && (
                <Text style={styles.errorText}>{errors.type}</Text>
              )}
            </View>

            <TextInput
              label="Ville (optionnel)"
              value={formData.city || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
              style={styles.input}
              mode="outlined"
              placeholder="Ex: Paris, Lyon, etc."
            />
          </View>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={handleCancel}
          style={styles.cancelButton}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={styles.submitButton}
        >
          Créer
        </Button>
      </View>
      </ScrollView>
    </View>
  );
}

