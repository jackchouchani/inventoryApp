import { supabase } from '../config/supabase';
import { DatabaseInterface, Item, Container, Category } from './types';
import { photoService } from '../services/photoService';

const supabaseDatabase: DatabaseInterface = {
  async initDatabase(): Promise<void> {
    // Vérifier la connexion à Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Non authentifié');
  },

  async getContainers(): Promise<Container[]> {
    const { data, error } = await supabase
      .from('containers')
      .select('*');
    
    if (error) throw error;
    return data || [];
  },

  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories') 
      .select('*');

    if (error) throw error;
    return data || [];
  },

  async updateItem(id: number, item: Omit<Item, "id">): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update(item)
      .eq('id', id);

    if (error) throw error;
  },

  async updateItemStatus(itemId: number, status: string): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({ status })
      .eq('id', itemId);

    if (error) throw error;
  },

  async getItems(): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async addItem(item: Omit<Item, "id" | "createdAt" | "updatedAt">): Promise<number> {
    const { data, error } = await supabase
      .from('items')
      .insert([item])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async addContainer(container: Omit<Container, "id" | "createdAt" | "updatedAt">): Promise<number> {
    const { data, error } = await supabase
      .from('containers')
      .insert([container])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async addCategory(category: Omit<Category, "id" | "createdAt" | "updatedAt">): Promise<number> {
    const { data, error } = await supabase
      .from('categories')
      .insert([category])
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  },

  async resetDatabase(): Promise<void> {
    const { error: itemsError } = await supabase
      .from('items')
      .delete()
      .neq('id', 0); // Supprime tous les items
    if (itemsError) throw itemsError;

    const { error: containersError } = await supabase
      .from('containers')
      .delete()
      .neq('id', 0); // Supprime tous les containers
    if (containersError) throw containersError;

    const { error: categoriesError } = await supabase
      .from('categories')
      .delete()
      .neq('id', 0); // Supprime toutes les catégories
    if (categoriesError) throw categoriesError;
  },

  async getDatabase(): Promise<{ items: Item[], containers: Container[], categories: Category[] }> {
    const [items, containers, categories] = await Promise.all([
      this.getItems(),
      this.getContainers(),
      this.getCategories()
    ]);

    return { items, containers, categories };
  },

  async validateQRCode(type: 'ITEM' | 'CONTAINER', qrCode: string): Promise<boolean> {
    const { data } = await supabase
      .from(type === 'ITEM' ? 'items' : 'containers')
      .select('id')
      .eq('qrCode', qrCode)
      .single();
    
    return !!data;
  },

  async getItemByQRCode(qrCode: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('qrCode', qrCode)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getContainerByQRCode(qrCode: string): Promise<Container | null> {
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('qrCode', qrCode)
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteContainer(containerId: number): Promise<void> {
    const { error: itemsError } = await supabase
      .from('items')
      .update({ containerId: null })
      .eq('containerId', containerId);

    if (itemsError) throw itemsError;

    const { error: containerError } = await supabase
      .from('containers')
      .delete()
      .eq('id', containerId);

    if (containerError) throw containerError;
  },

  async updateContainer(containerId: number, containerData: Omit<Container, "id">): Promise<void> {
    const { error } = await supabase
      .from('containers')
      .update(containerData)
      .eq('id', containerId);

    if (error) throw error;
  },

  async getCategory(id: number): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateCategory(id: number, name: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteCategory(id: number): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async storePhotoUri(uri: string): Promise<void> {
    // Pour Supabase, cette fonction n'est probablement pas nécessaire
    // car nous utilisons déjà photoService pour gérer les photos
    console.warn('storePhotoUri not needed in Supabase implementation');
  },

  async getPhotoUris(): Promise<string[]> {
    const { data, error } = await supabase
      .from('items')
      .select('photoUri')
      .not('photoUri', 'is', null);

    if (error) throw error;
    return data.map(item => item.photoUri).filter(Boolean);
  },

  async removePhotoUri(uri: string): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({ photoUri: null })
      .eq('photoUri', uri);

    if (error) throw error;
  },

  async saveDatabase(data: {
    items: Item[],
    containers: Container[],
    categories: Category[]
  }): Promise<void> {
    // Implémentation de la sauvegarde complète de la base de données
    const { error: itemsError } = await supabase
      .from('items')
      .upsert(data.items);
    if (itemsError) throw itemsError;

    const { error: containersError } = await supabase
      .from('containers')
      .upsert(data.containers);
    if (containersError) throw containersError;

    const { error: categoriesError } = await supabase
      .from('categories')
      .upsert(data.categories);
    if (categoriesError) throw categoriesError;
  },

  async getItemOrContainerByQRCode(type: 'ITEM' | 'CONTAINER', qrCode: string): Promise<boolean> {
    const { data } = await supabase
      .from(type === 'ITEM' ? 'items' : 'containers')
      .select('id')
      .eq('qrCode', qrCode)
      .single();
    
    return !!data;
  }
};

export default supabaseDatabase;
