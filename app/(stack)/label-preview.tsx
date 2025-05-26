// app/(stack)/label-preview.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LabelGenerator } from '../../src/components/LabelGenerator'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons'; 
import { useAppTheme } from '../../src/contexts/ThemeContext'; 

// Define the structure of the data we expect for each label
// This should match the LabelData type in labels.tsx and be compatible with LabelGenerator's Item type
type LabelDataItem = {
  id: number;
  name: string;
  description?: string; // Changed from string | null | undefined to string | undefined
  sellingPrice?: number; // Changed from number | null | undefined to number | undefined
  number?: string; // Changed from string | null | undefined to string | undefined
  qrCode: string;
};

const LabelPreviewScreen = () => {
  const params = useLocalSearchParams<{ items?: string; mode?: 'items' | 'containers' }>();
  const router = useRouter(); 
  const { activeTheme } = useAppTheme(); 
  const styles = getThemedStyles(activeTheme);
  let itemsToDisplay: LabelDataItem[] = [];
  const mode = params.mode || 'items'; // Default to 'items' if not provided

  try {
    if (params.items) {
      const parsedItems = JSON.parse(params.items) as any[];
      // Ensure description, sellingPrice, and number are not null
      itemsToDisplay = parsedItems.map(item => ({
        ...item,
        description: item.description === null ? undefined : item.description,
        sellingPrice: item.sellingPrice === null ? undefined : item.sellingPrice,
        number: item.number === null ? undefined : item.number,
      }));
    }
  } catch (error) {
    console.error("Failed to parse items for label preview:", error);
    Alert.alert("Erreur", "Impossible de charger les données des étiquettes.");
    // Optionally, navigate back or show an error message
  }

  const handleComplete = () => {
    Alert.alert("Succès", "Les étiquettes PDF ont été générées.");
    // Optionally navigate back or to another screen
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)'); // Fallback if cannot go back
    }
  };

  const handleError = (error: Error) => {
    console.error("Erreur de génération d'étiquette:", error);
    Alert.alert("Erreur", `La génération d'étiquettes a échoué: ${error.message}`);
  };

  if (itemsToDisplay.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Custom Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(stack)/labels')}
          >
            <MaterialIcons 
              name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} 
              size={24} 
              color={activeTheme.primary} 
              style={Platform.OS === 'ios' ? { marginRight: 5 } : {}}
            />
            {Platform.OS === 'ios' && (
              <Text style={styles.backButtonText}>Retour</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Aperçu Étiquettes</Text>
          <View style={{ width: Platform.OS === 'ios' ? 80 : 50 }} /> {/* Spacer */}
        </View>

        <View style={styles.centered}>
          <Text>Aucune étiquette à afficher.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(stack)/labels')}
        >
          <MaterialIcons 
            name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} 
            size={24} 
            color={activeTheme.primary} 
            style={Platform.OS === 'ios' ? { marginRight: 5 } : {}}
          />
          {Platform.OS === 'ios' && (
            <Text style={styles.backButtonText}>Retour</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Aperçu Étiquettes</Text>
        <View style={{ width: Platform.OS === 'ios' ? 80 : 50 }} /> {/* Spacer */}
      </View>

      <ScrollView>
        <LabelGenerator 
          items={itemsToDisplay} 
          mode={mode} 
          onComplete={handleComplete} 
          onError={handleError} 
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const getThemedStyles = (theme: ReturnType<typeof useAppTheme>['activeTheme']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.surface, 
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    height: Platform.OS === 'ios' ? 44 : 56, 
    backgroundColor: theme.surface, 
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border, 
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minWidth: Platform.OS === 'ios' ? 80 : 50,
    justifyContent: 'flex-start',
  },
  backButtonText: { // Only for iOS
    color: theme.primary,
    fontSize: 17,
    marginLeft: 5,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: Platform.OS === 'ios' ? '600' : '500',
    color: theme.text.primary,
    textAlign: 'center',
    flexShrink: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Add other styles as needed from LabelGenerator or for this screen
});

export default LabelPreviewScreen;
