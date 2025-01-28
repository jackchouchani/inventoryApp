import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import { initDatabase, Item, Container, Category, getItems, addItem, updateItemStatus, getContainers, getCategories } from './src/database/database';
import { initPhotoStorage } from './src/utils/photoManager';
import { initBackupStorage } from './src/utils/backupManager';
import { ItemList } from './src/components/ItemList';
import { ItemForm } from './src/components/ItemForm';
import { ContainerScreen } from './src/screens/ContainerScreen';
import CategoryScreen from './src/screens/CategoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import BackupScreen from './src/screens/BackupScreen';

type RootTabParamList = {
  Stock: undefined;
  Add: undefined;
  Containers: undefined;
  Categories: undefined;
  Stats: undefined;
  Backup: undefined;
};

type StockScreenProps = {
  navigation: BottomTabNavigationProp<RootTabParamList, 'Stock'>;
};

const StockScreen: React.FC<StockScreenProps> = ({ navigation }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  // Add focus listener to refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });

    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const [loadedItems, loadedContainers, loadedCategories] = await Promise.all([
        getItems(),
        getContainers(),
        getCategories()
      ]);
      setItems(loadedItems);
      setContainers(loadedContainers);
      setCategories(loadedCategories);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleMarkAsSold = async (itemId: number) => {
    try {
      await updateItemStatus(itemId, 'sold');
      await loadData();
    } catch (error) {
      console.error('Error marking item as sold:', error);
    }
  };

  return (
    <ItemList
      items={items}
      containers={containers}
      categories={categories}
      onMarkAsSold={handleMarkAsSold}
    />
  );
};

const AddScreen: React.FC<{ navigation: BottomTabNavigationProp<RootTabParamList, 'Add'> }> = ({ navigation }) => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedContainers, loadedCategories] = await Promise.all([
        getContainers(),
        getCategories()
      ]);
      setContainers(loadedContainers);
      setCategories(loadedCategories);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please try again.');
    }
  };

  const handleSubmit = async (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => {
    setError('');
    try {
      const newItemId = await addItem(item);
      if (newItemId) {
        navigation.navigate('Stock');
      } else {
        setError('Failed to add item. Please try again.');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add item. Please try again.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {error ? (
        <Text style={{ color: 'red', padding: 10, textAlign: 'center' }}>{error}</Text>
      ) : null}
      <ItemForm
        containers={containers}
        categories={categories}
        onSubmit={handleSubmit}
      />
    </View>
  );
};


const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    Promise.all([
      initDatabase(),
      initPhotoStorage(),
      initBackupStorage()
    ])
      .then(() => console.log('App initialized successfully'))
      .catch(error => console.error('App initialization failed:', error));
  }, []);

  return (
    <Provider store={store}>
      <NavigationContainer>
        <Tab.Navigator>
          <Tab.Screen name="Stock" component={StockScreen} />
          <Tab.Screen name="Add" component={AddScreen} />
          <Tab.Screen name="Containers" component={ContainerScreen} />
          <Tab.Screen name="Categories" component={CategoryScreen} />
          <Tab.Screen name="Stats" component={StatsScreen} />
          <Tab.Screen name="Backup" component={BackupScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </Provider>
  );
}
