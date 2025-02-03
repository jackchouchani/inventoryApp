import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import { initDatabase, Item, Container, Category, getItems, addItem, updateItemStatus, getContainers, getCategories } from './src/database/database';
import { initPhotoStorage } from './src/utils/photoManager';
import { initBackupStorage } from './src/utils/backupManager';
import { ItemList } from './src/components/ItemList';
import ItemForm from './src/components/ItemForm';
import { ContainerScreen } from './src/screens/ContainerScreen';
import CategoryScreen from './src/screens/CategoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import BackupScreen from './src/screens/BackupScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LabelScreen from './src/screens/LabelScreen';
import { useRefreshStore } from './src/store/refreshStore';
import { ScanScreen } from './src/screens/ScanScreen';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { createStackNavigator } from '@react-navigation/stack';
import { useDispatch } from 'react-redux';
import { setItems } from './src/store/itemsSlice';

export type RootTabParamList = {
  Stock: undefined;
  Add: undefined;
  Scan: undefined;
  Containers: undefined;
  Categories: undefined;
  Stats: undefined;
  Backup: undefined;
};

type StockScreenProps = {
  navigation: BottomTabNavigationProp<RootTabParamList, 'Stock'>;
};

const StockScreen: React.FC<StockScreenProps> = ({ navigation }) => {
  const [localItems, setLocalItems] = useState<Item[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const dispatch = useDispatch();

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
      setLocalItems(loadedItems);
      setContainers(loadedContainers);
      setCategories(loadedCategories);
      dispatch(setItems(loadedItems));
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
      items={localItems}
      containers={containers}
      categories={categories}
      onMarkAsSold={handleMarkAsSold}
    />
  );
};

const AddScreen: React.FC<{ navigation: BottomTabNavigationProp<RootTabParamList, 'Add'> }> = ({ navigation }) => {
  const [containers, setContainers] = useState<Container[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const refreshTimestamp = useRefreshStore(state => state.refreshTimestamp);

  const dispatch = useDispatch();

  const loadData = async () => {
    try {
      const [loadedContainers, loadedCategories] = await Promise.all([
        getContainers(),
        getCategories()
      ]);
      setContainers(loadedContainers);
      setCategories(loadedCategories);
      dispatch(setItems(await getItems()));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Rafraîchir lors de la navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  // Rafraîchir lors du changement de refreshTimestamp
  useEffect(() => {
    loadData();
  }, [refreshTimestamp]);

  return (
    <View style={{ flex: 1 }}>
      <ItemForm 
        containers={containers} 
        categories={categories}
        onSuccess={() => navigation.navigate('Stock')}
      />
    </View>
  );
};

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Navigation principale avec les onglets
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { height: 60 },
        tabBarActiveTintColor: '#007AFF',
      }}
    >
      <Tab.Screen
        name="Stock"
        component={StockScreen}
        options={{
          tabBarIcon: ({ color }) => <MaterialIcons name="inventory" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View style={styles.scanButton}>
              <MaterialIcons name="qr-code-scanner" size={32} color={color} />
            </View>
          ),
          tabBarLabel: '',
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddScreen}
        options={{
          tabBarIcon: ({ color }) => <MaterialIcons name="add-circle" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

// Navigation principale avec la stack
const App = () => {
  useEffect(() => {
    Promise.all([
      initDatabase(),
      initPhotoStorage(),
      initBackupStorage()
    ])
      .then(() => console.log('App initialized successfully'))
      .catch(error => console.error('App initialization failed:', error));
  }, []);

  const AppContent = () => {
    const dispatch = useDispatch();

    useEffect(() => {
      const loadItems = async () => {
        try {
          const items = await getItems();
          dispatch(setItems(items));
        } catch (error) {
          console.error('Erreur chargement items:', error);
        }
      };

      loadItems();
    }, [dispatch]);

    return (
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen 
            name="Main" 
            component={TabNavigator}
            options={({ navigation }) => ({
              headerRight: () => (
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <MaterialIcons name="settings" size={24} color="#007AFF" />
                </TouchableOpacity>
              ),
              headerLeft: () => (
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={() => navigation.navigate('Stats')}
                >
                  <MaterialIcons name="bar-chart" size={24} color="#007AFF" />
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Stats" component={StatsScreen} />
          <Stack.Screen name="Labels" component={LabelScreen} />
          <Stack.Screen name="Backup" component={BackupScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  };

  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

const styles = StyleSheet.create({
  scanButton: {
    backgroundColor: '#fff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerButton: {
    padding: 10,
  },
});

export default App;
