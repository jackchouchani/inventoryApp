import React, { useMemo, useState } from 'react';
import { View, FlatList } from 'react-native';
import { 
  Text, 
  Card, 
  Title, 
  Searchbar, 
  FAB, 
  Chip,
  IconButton,
  Menu,
  Divider
} from 'react-native-paper';
import { router } from 'expo-router';
import { useSourcesOptimized } from '../../src/hooks/useSourcesOptimized';
import StyleFactory from '../../src/styles/StyleFactory';
import { useAppTheme } from '../../src/contexts/ThemeContext';
import { CommonHeader } from '../../src/components';
import type { Source } from '../../src/types/source';

export default function SourcesScreen() {
  const { activeTheme } = useAppTheme();
  const styles = StyleFactory.getThemedStyles(activeTheme, 'SourcesScreen');
  const { sources, isLoading, actions } = useSourcesOptimized();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [menuVisible, setMenuVisible] = useState(false);

  // Filtrer les sources
  const filteredSources = useMemo(() => {
    return sources.filter(source => {
      const matchesSearch = source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           source.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           source.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filterType === 'all' || source.type === filterType;
      
      return matchesSearch && matchesFilter;
    });
  }, [sources, searchQuery, filterType]);

  const sourceTypes = useMemo(() => {
    const types = new Set(sources.map(source => source.type));
    return Array.from(types);
  }, [sources]);

  const handleSourcePress = (source: Source) => {
    router.push(`/sources/${source.id}`);
  };

  const handleAddPress = () => {
    router.push('/sources/add');
  };

  const renderSourceItem = ({ item: source }: { item: Source }) => (
    <Card style={styles.sourceCard} onPress={() => handleSourcePress(source)}>
      <Card.Content>
        <View style={styles.sourceHeader}>
          <View style={styles.sourceInfo}>
            <Title style={styles.sourceName}>{source.name}</Title>
            <Text style={styles.sourceDetails}>
              {source.type}{source.city ? ` • ${source.city}` : ''}
            </Text>
          </View>
          <IconButton
            icon="chevron-right"
            size={20}
            onPress={() => handleSourcePress(source)}
          />
        </View>
        <View style={styles.sourceMetrics}>
          <Chip mode="outlined" compact style={styles.typeChip}>
            {source.type}
          </Chip>
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Aucune source trouvée</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Essayez de modifier votre recherche' : 'Commencez par ajouter une première source'}
      </Text>
    </View>
  );

  if (isLoading && sources.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement des sources...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="Sources"
        onBackPress={() => router.replace('/settings')}
      />
      
      <View style={styles.header}>
        <Searchbar
          placeholder="Rechercher une source..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="filter-variant"
              mode="outlined"
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setFilterType('all');
              setMenuVisible(false);
            }}
            title="Tous"
            leadingIcon={filterType === 'all' ? 'check' : undefined}
          />
          <Divider />
          {sourceTypes.map(type => (
            <Menu.Item
              key={type}
              onPress={() => {
                setFilterType(type);
                setMenuVisible(false);
              }}
              title={type}
              leadingIcon={filterType === type ? 'check' : undefined}
            />
          ))}
        </Menu>
      </View>

      <FlatList
        data={filteredSources}
        renderItem={renderSourceItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAddPress}
        label="Ajouter"
      />
    </View>
  );
}


