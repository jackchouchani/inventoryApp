import { supabase } from './supabaseClient';
import type { DatabaseInterface } from './database';
import type { Item, ItemInput, ItemUpdate } from '../types/item';
import type { Category, CategoryInput, CategoryUpdate } from '../types/category';
import type { Container, ContainerInput, ContainerUpdate } from '../types/container';
import { photoService } from '../services/photoService';
import { handleDatabaseError, handleValidationError } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';

export class SupabaseDatabase implements DatabaseInterface {
  async getContainers(): Promise<Container[]> {
    try {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .is('deleted', false);
      
      if (error) throw error;
      
      return (data || []).map(container => ({
        id: container.id,
        name: container.name,
        description: container.description,
        number: container.number,
        qrCode: container.qr_code,
        createdAt: container.created_at,
        updatedAt: container.updated_at,
        deleted: container.deleted,
        userId: container.user_id
      }));
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'getContainers');
      return [];
    }
  }

  async getCategories(): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories') 
        .select('*')
        .is('deleted', false);

      if (error) throw error;
      
      return (data || []).map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        createdAt: category.created_at,
        updatedAt: category.updated_at
      }));
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'getCategories');
      return [];
    }
  }

  async getItems(): Promise<Item[]> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .is('deleted', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        purchasePrice: item.purchase_price,
        sellingPrice: item.selling_price,
        status: item.status,
        photoUri: item.photo_uri,
        containerId: item.container_id,
        categoryId: item.category_id,
        qrCode: item.qr_code,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        soldAt: item.sold_at
      }));
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'getItems');
      return [];
    }
  }

  async updateItem(id: number, item: ItemUpdate): Promise<void> {
    const updateData: any = {};
    if (item.name !== undefined) updateData.name = item.name;
    if (item.description !== undefined) updateData.description = item.description;
    if (item.purchasePrice !== undefined) updateData.purchase_price = item.purchasePrice;
    if (item.sellingPrice !== undefined) updateData.selling_price = item.sellingPrice;
    if (item.status !== undefined) updateData.status = item.status;
    if (item.photoUri !== undefined) updateData.photo_uri = item.photoUri;
    if (item.containerId !== undefined) updateData.container_id = item.containerId;
    if (item.categoryId !== undefined) updateData.category_id = item.categoryId;
    if (item.qrCode !== undefined) updateData.qr_code = item.qrCode;
    if (item.soldAt !== undefined) updateData.sold_at = item.soldAt;
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('items')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  }

  async updateItemStatus(id: number, status: Item['status']): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async addItem(item: ItemInput): Promise<number> {
    const { data, error } = await supabase
      .from('items')
      .insert({
        name: item.name,
        description: item.description,
        purchase_price: item.purchasePrice,
        selling_price: item.sellingPrice,
        status: item.status,
        photo_uri: item.photoUri,
        container_id: item.containerId,
        category_id: item.categoryId,
        qr_code: item.qrCode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async addContainer(container: ContainerInput): Promise<number> {
    try {
      if (!container.name) {
        throw handleValidationError('Le nom du container est requis', 'addContainer');
      }

      const supabaseContainer = {
        name: container.name,
        description: container.description,
        number: container.number,
        qr_code: container.qrCode,
        user_id: container.userId,
        deleted: false
      };

      const { data, error } = await supabase
        .from('containers')
        .insert([supabaseContainer])
        .select()
        .single();
      
      if (error) throw error;
      return data.id;
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'addContainer');
      throw error;
    }
  }

  async addCategory(category: CategoryInput): Promise<number> {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...category,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Erreur Supabase:', error);
      throw error;
    }
    return data.id;
  }

  async resetDatabase(): Promise<void> {
    try {
      // Marquer tous les items comme supprimés
      const { error: itemsError } = await supabase
        .from('items')
        .update({ deleted: true })
        .is('deleted', false);
      if (itemsError) throw itemsError;

      // Marquer tous les containers comme supprimés
      const { error: containersError } = await supabase
        .from('containers')
        .update({ deleted: true })
        .is('deleted', false);
      if (containersError) throw containersError;

      // Marquer toutes les catégories comme supprimées
      const { error: categoriesError } = await supabase
        .from('categories')
        .update({ deleted: true })
        .is('deleted', false);
      if (categoriesError) throw categoriesError;

    } catch (error) {
      console.error('Erreur lors de la réinitialisation Supabase:', error);
      throw error;
    }
  }

  async getDatabase(): Promise<{ items: Item[], containers: Container[], categories: Category[] }> {
    const [items, containers, categories] = await Promise.all([
      this.getItems(),
      this.getContainers(),
      this.getCategories()
    ]);

    return { items, containers, categories };
  }

  async validateQRCode(type: 'ITEM' | 'CONTAINER', qrCode: string): Promise<boolean> {
    const { data } = await supabase
      .from(type === 'ITEM' ? 'items' : 'containers')
      .select('id')
      .eq('qrCode', qrCode)
      .single();
    
    return !!data;
  }

  async getItemByQRCode(qrCode: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('qr_code', qrCode)
      .single();

    if (error) throw error;
    
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      purchasePrice: data.purchase_price,
      sellingPrice: data.selling_price,
      status: data.status,
      photoUri: data.photo_uri,
      containerId: data.container_id,
      categoryId: data.category_id,
      qrCode: data.qr_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async getContainerByQRCode(qrCode: string): Promise<Container | null> {
    try {
      console.log('Recherche du container avec le QR code:', qrCode);

      // Vérifier que le QR code est au bon format
      if (!qrCode.startsWith('CONT_')) {
        console.warn('Format de QR code invalide:', qrCode);
        return null;
      }

      const { data, error } = await supabase
        .from('containers')
        .select('id, name, description, number, qr_code, created_at, updated_at, deleted, user_id')
        .eq('qr_code', qrCode)
        .is('deleted', false);

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }
      
      console.log('Résultat de la requête:', data);
      
      if (!data || data.length === 0) {
        console.log('Aucun container trouvé pour le QR code:', qrCode);
        
        // Vérifier tous les containers pour déboguer
        const { data: allContainers } = await supabase
          .from('containers')
          .select('qr_code')
          .is('deleted', false);
        
        console.log('QR codes disponibles:', allContainers?.map(c => c.qr_code));
        
        return null;
      }

      const container = data[0];
      return {
        id: container.id,
        name: container.name,
        description: container.description,
        number: container.number,
        qrCode: container.qr_code,
        createdAt: container.created_at,
        updatedAt: container.updated_at,
        deleted: container.deleted,
        userId: container.user_id
      };
    } catch (error) {
      console.error('Erreur dans getContainerByQRCode:', error);
      throw error;
    }
  }

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
  }

  async updateContainer(id: number, container: ContainerUpdate): Promise<void> {
    const { error } = await supabase
      .from('containers')
      .update(container)
      .eq('id', id);
    
    if (error) throw error;
  }

  async getCategory(id: number): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      icon: data.icon,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateCategory(id: number, data: CategoryUpdate): Promise<void> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Erreur lors de la mise à jour de la catégorie:', error);
      throw error;
    }
  }

  async deleteCategory(id: number): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async storePhotoUri(uri: string): Promise<void> {
    // Pour Supabase, cette fonction n'est probablement pas nécessaire
    // car nous utilisons déjà photoService pour gérer les photos
    console.warn('storePhotoUri not needed in Supabase implementation');
  }

  async getPhotoUris(): Promise<string[]> {
    const { data, error } = await supabase
      .from('items')
      .select('image_url')
      .not('image_url', 'is', null);

    if (error) throw error;
    return data.map(item => item.image_url).filter(Boolean);
  }

  async removePhotoUri(uri: string): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({ image_url: null })
      .eq('image_url', uri);

    if (error) throw error;
  }

  async saveDatabase(data: {
    items: Array<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>;
    containers: Array<Omit<Container, 'id' | 'createdAt' | 'updatedAt'>>;
    categories: Array<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>;
  }): Promise<void> {
    const { error: itemsError } = await supabase.from('items').upsert(data.items);
    if (itemsError) throw itemsError;

    const { error: containersError } = await supabase.from('containers').upsert(data.containers);
    if (containersError) throw containersError;

    const { error: categoriesError } = await supabase.from('categories').upsert(data.categories);
    if (categoriesError) throw categoriesError;
  }

  async getItemOrContainerByQRCode(type: 'ITEM' | 'CONTAINER', qrCode: string): Promise<boolean> {
    const { data } = await supabase
      .from(type === 'ITEM' ? 'items' : 'containers')
      .select('id')
      .eq('qrCode', qrCode)
      .single();
    
    return !!data;
  }

  async deleteItem(id: number): Promise<void> {
    const { error } = await supabase
      .from('items')
      .update({ deleted: true })
      .eq('id', id);

    if (error) throw error;
  }

  async getItem(id: number): Promise<Item | null> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        purchasePrice: data.purchase_price,
        sellingPrice: data.selling_price,
        status: data.status,
        photoUri: data.photo_uri,
        containerId: data.container_id,
        categoryId: data.category_id,
        qrCode: data.qr_code,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'getItem');
      return null;
    }
  }

  async searchItems(query: string): Promise<Item[]> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .is('deleted', false);

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        purchasePrice: item.purchase_price,
        sellingPrice: item.selling_price,
        status: item.status,
        photoUri: item.photo_uri,
        containerId: item.container_id,
        categoryId: item.category_id,
        qrCode: item.qr_code,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'searchItems');
      return [];
    }
  }
}

export const database = new SupabaseDatabase();
export default database;
