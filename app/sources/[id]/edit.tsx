import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { 
  Text, 
  TextInput, 
  Button, 
  SegmentedButtons,
  Card
} from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { useSourceOptimized, useSourcesOptimized } from '../../../src/hooks/useSourcesOptimized';
import StyleFactory from '../../../src/styles/StyleFactory';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import { CommonHeader } from '../../../src/components';
import type { SourceUpdate } from '../../../src/types/source';

const SOURCE_TYPES = [
  { value: 'Marché', label: 'Marché' },
  { value: 'Boutique', label: 'Boutique' },
  { value: 'En ligne', label: 'En ligne' },
  { value: 'Particulier', label: 'Particulier' },
];

export default function EditSourceScreen() {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'AddSourceScreen'); // Reuse add source styles
  const { id } = useLocalSearchParams<{ id: string }>();
  const sourceId = parseInt(id || '0', 10);
  
  const { source } = useSourceOptimized(sourceId);
  const { actions } = useSourcesOptimized({ autoLoad: false });
  
  const [formData, setFormData] = useState<SourceUpdate>({
    name: '',
    type: 'Marché',
    city: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<SourceUpdate>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load source data when available
  useEffect(() => {
    if (source && !isLoaded) {
      setFormData({
        name: source.name,
        type: source.type,
        city: source.city || '',
      });
      setIsLoaded(true);
    }
  }, [source, isLoaded]);

  const validateForm = (): boolean => {
    const newErrors: Partial<SourceUpdate> = {};

    if (!formData.name?.trim()) {
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
      await actions.update(sourceId, formData).unwrap();
      // Navigation immédiate sans Alert pour éviter les problèmes
      router.back();
    } catch (error) {
      console.error('Error updating source:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleDelete = async () => {
    console.log('[EditSource] Delete button pressed for source:', sourceId);
    setIsSubmitting(true);
    try {
      await actions.delete(sourceId).unwrap();
      // Navigation immédiate sans Alert pour éviter les problèmes
      router.replace('/sources');
    } catch (error) {
      console.error('Error deleting source:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!source) {
    return (
      <View style={styles.container}>
        <CommonHeader 
          title="Modifier la Source"
          onBackPress={() => router.back()}
        />
        <View style={styles.content}>
          <Text>Source non trouvée</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="Modifier la Source"
        onBackPress={() => router.back()}
      />
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.title}>
              Modifier "{source.name}"
            </Text>
            
            <View style={styles.form}>
              <TextInput
                label="Nom de la source *"
                value={formData.name || ''}
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
                  value={formData.type || 'Marché'}
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, type: value as SourceUpdate['type'] }));
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
            Modifier
          </Button>
        </View>

        <View style={[styles.actions, { marginTop: 16 }]}>
          <Button
            mode="contained"
            onPress={handleDelete}
            disabled={isSubmitting}
            buttonColor="#dc3545"
            textColor="white"
            style={[styles.submitButton, { backgroundColor: '#dc3545' }]}
          >
            Supprimer la source
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}