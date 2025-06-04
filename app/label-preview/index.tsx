import React from 'react';
import { View, Text, ScrollView, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../src/styles/StyleFactory';

// Composants standardisés
import { LabelGenerator } from '../../src/components/LabelGenerator'; 
import CommonHeader from '../../src/components/CommonHeader';

// Contextes
import { useAppTheme } from '../../src/contexts/ThemeContext'; 

// Define the structure of the data we expect for each label
// This should match the LabelData type in labels.tsx and be compatible with LabelGenerator's Item type
type LabelDataItem = {
  id: number;
  name: string;
  description?: string;
  sellingPrice?: number;
  number?: string;
  qrCode: string;
};

const LabelPreviewScreen = () => {
  const params = useLocalSearchParams<{ items?: string; mode?: 'items' | 'containers' }>();
  const router = useRouter(); 
  const { activeTheme } = useAppTheme(); 
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'Labels');
  
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
  }

  const handleComplete = () => {
    Alert.alert("Succès", "Les étiquettes PDF ont été générées.");
    router.back();
  };

  const handleError = (error: Error) => {
    console.error("Erreur de génération d'étiquette:", error);
    Alert.alert("Erreur", `La génération d'étiquettes a échoué: ${error.message}`);
  };

  if (itemsToDisplay.length === 0) {
    return (
      <SafeAreaView style={[
        styles.safeArea, 
        Platform.OS === 'web' ? { paddingTop: 0 } : {}
      ]}>
        <View style={styles.container}>
          {/* ✅ COMMONHEADER - Header standardisé */}
          <CommonHeader 
            title="Aperçu Étiquettes"
            onBackPress={() => router.back()}
          />

          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>Aucune étiquette à afficher.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.safeArea, 
      Platform.OS === 'web' ? { paddingTop: 0 } : {}
    ]}>
      <View style={styles.container}>
        {/* ✅ COMMONHEADER - Header standardisé */}
        <CommonHeader 
          title="Aperçu Étiquettes"
          onBackPress={() => router.back()}
        />

        <ScrollView>
          <LabelGenerator 
            items={itemsToDisplay} 
            mode={mode} 
            onComplete={handleComplete} 
            onError={handleError} 
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default LabelPreviewScreen; 