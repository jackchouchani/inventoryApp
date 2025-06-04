import React, { useCallback } from 'react';
import { View, SafeAreaView, ActivityIndicator, TouchableOpacity, Text, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ STYLEFACTORY selon stylefactory-optimization.mdc
import StyleFactory from '../../../src/styles/StyleFactory';

// Composants
import { ContainerContents } from '../../../src/components/ContainerContents';
import { CommonHeader, Icon } from '../../../src/components';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';

// Hooks et Redux
import { useAllContainers } from '../../../src/hooks/useOptimizedSelectors';
import { useAppTheme } from '../../../src/contexts/ThemeContext';
import { useStockActions } from '../../../src/hooks/useStockActions';
import type { Item } from '../../../src/types/item';

const ContainerContentScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeTheme } = useAppTheme();
  
  const insets = useSafeAreaInsets();
  
  const containers = useAllContainers();
  const container = containers.find(c => c.id === parseInt(id || '0', 10));
  
  // ✅ STYLEFACTORY - Récupération des styles mis en cache
  const styles = StyleFactory.getThemedStyles(activeTheme, 'ContainerCard');

  // ✅ HOOK STOCKACTIONS - Utilisation de la vraie logique Redux
  const { handleMoveItem: moveItemAction } = useStockActions();

  const handleItemPress = useCallback((item: Item) => {
    // Navigation vers les détails de l'item avec paramètre de retour
    router.push(`/item/${item.id}/info?returnTo=/container/${container?.id}/content`);
  }, [router, container?.id]);

  const handleMoveItem = useCallback(async (itemId: number, newContainerId: number | null) => {
    console.log(`Moving item ${itemId} to container ${newContainerId}`);
    
    try {
      // ✅ Utiliser la vraie logique Redux via useStockActions
      const success = await moveItemAction(itemId.toString(), newContainerId);
      
      if (success) {
        console.log(`✅ Item ${itemId} déplacé avec succès vers container ${newContainerId}`);
        // Pas besoin de recharger manuellement, Redux se charge de la synchronisation
      } else {
        console.error(`❌ Échec du déplacement de l'item ${itemId}`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors du déplacement de l'item ${itemId}:`, error);
    }
  }, [moveItemAction]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  // État de chargement
  if (!container && containers.length === 0) {
    return (
      <View style={[styles.loadingContainer, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={activeTheme.primary} />
      </View>
    );
  }

  // Container introuvable
  if (!container) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <CommonHeader 
          title="Container Introuvable"
          onBackPress={() => router.back()}
        />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={[
        styles.container, 
        Platform.OS === 'web' ? { paddingTop: 0 } : {}
      ]}>
        {/* Header avec bouton Edit */}
        <CommonHeader 
          title={`${container.name} #${container.number}`}
          onBackPress={handleClose}
          rightComponent={
            <TouchableOpacity 
              style={[styles.headerActionButton, styles.editButton]}
              onPress={() => router.push(`/container/${container.id}/edit`)}
            >
              <Icon name="edit" size={20} color={activeTheme.primary} />
              <Text style={{ color: activeTheme.primary, marginLeft: 4, fontSize: 14 }}>
                Éditer
              </Text>
            </TouchableOpacity>
          }
        />
        
        {/* Contenu principal */}
        <View style={{ flex: 1 }}>
          <ContainerContents
            container={container}
            containers={containers}
            onItemPress={handleItemPress}
            onMoveItem={handleMoveItem}
            onClose={handleClose}
            showHeader={false}
          />
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
};

export default ContainerContentScreen; 