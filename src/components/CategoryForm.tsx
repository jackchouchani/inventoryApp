import React, { useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { debounce } from 'lodash';
import type { MaterialIconName } from '../types/icons';
import { IconSelector } from './IconSelector';
import { theme } from '../utils/theme';
import { useRouter } from 'expo-router';

export interface CategoryFormData {
  name: string;
  description: string;
  icon: MaterialIconName;
}

interface CategoryFormProps {
  initialData?: CategoryFormData;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  submitButtonText: string;
  title: string;
  loading?: boolean;
}

export const CategoryForm: React.FC<CategoryFormProps> = ({
  initialData,
  onSubmit,
  submitButtonText,
  title,
  loading = false
}) => {
  const router = useRouter();
  const { control, handleSubmit, formState: { errors, isDirty }, setValue } = useForm<CategoryFormData>({
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      icon: initialData?.icon || 'folder'
    },
    mode: 'onChange'
  });

  const debouncedSetValue = useCallback(
    debounce((field: keyof CategoryFormData, value: string) => {
      setValue(field, value, { shouldValidate: true });
    }, 300),
    [setValue]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.primary} />
              <Text style={styles.backButtonText}>Retour</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              rules={{
                required: 'Le nom est requis',
                minLength: { value: 3, message: 'Le nom doit contenir au moins 3 caractères' },
                maxLength: { value: 50, message: 'Le nom ne peut pas dépasser 50 caractères' }
              }}
              render={({ field }) => (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Nom</Text>
                  <TextInput
                    style={[styles.input, errors.name && styles.inputError]}
                    value={field.value}
                    onChangeText={(text: string) => {
                      field.onChange(text);
                      debouncedSetValue('name', text);
                    }}
                    placeholder="Nom de la catégorie"
                    placeholderTextColor={theme.colors.text.secondary}
                  />
                  {errors.name && (
                    <Text style={styles.errorText}>{errors.name.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="description"
              rules={{
                maxLength: { value: 200, message: 'La description ne peut pas dépasser 200 caractères' }
              }}
              render={({ field }) => (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Description (optionnelle)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, errors.description && styles.inputError]}
                    value={field.value}
                    onChangeText={(text: string) => {
                      field.onChange(text);
                      debouncedSetValue('description', text);
                    }}
                    placeholder="Description de la catégorie"
                    placeholderTextColor={theme.colors.text.secondary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  {errors.description && (
                    <Text style={styles.errorText}>{errors.description.message}</Text>
                  )}
                  <Text style={styles.charCount}>
                    {field.value.length}/200 caractères
                  </Text>
                </View>
              )}
            />

            <Controller
              control={control}
              name="icon"
              rules={{ required: 'Une icône est requise' }}
              render={({ field }) => (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Icône</Text>
                  <IconSelector
                    selectedIcon={field.value}
                    onSelectIcon={field.onChange}
                  />
                  {errors.icon && (
                    <Text style={styles.errorText}>{errors.icon.message}</Text>
                  )}
                </View>
              )}
            />

            <TouchableOpacity 
              style={[
                styles.submitButton,
                (!isDirty || loading) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit(onSubmit)}
              disabled={!isDirty || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons 
                    name={initialData ? 'save' : 'add'} 
                    size={24} 
                    color="#fff" 
                  />
                  <Text style={styles.submitButtonText}>{submitButtonText}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  keyboardAvoidingView: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  header: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginTop: Platform.OS === 'ios' ? 47 : 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 17,
    color: theme.colors.primary,
    marginLeft: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  form: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.text.secondary,
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
}); 