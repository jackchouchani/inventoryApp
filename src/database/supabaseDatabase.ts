import { supabase } from '../config/supabase';
import { DatabaseInterface, Item, Container, Category } from './types';
import { photoService } from '../services/photoService';
import { handleDatabaseError, handleValidationError } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';

const supabaseDatabase: DatabaseInterface = {
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
        number: container.number,
        description: container.description,
        qrCode: container.qr_code,
        createdAt: container.created_at,
        updatedAt: container.updated_at
      }));
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'getContainers');
      return [];
    }
  },

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
        createdAt: category.created_at,
        updatedAt: category.updated_at
      }));
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'getCategories');
      return [];
    }
  },

  async updateItem(id: number, item: Omit<Item, "id">): Promise<void> {
    try {
      if (!id) {
        throw handleValidationError('ID de l\'item manquant', 'updateItem');
      }

      const supabaseItem = {
        name: item.name,
        description: item.description,
        purchase_price: item.purchasePrice,
        selling_price: item.sellingPrice,
        status: item.status,
        photo_uri: item.photoUri,
        container_id: item.containerId,
        category_id: item.categoryId,
        qr_code: item.qrCode
      };

      const { error } = await supabase
        .from('items')
        .update(supabaseItem)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'updateItem');
      throw error;
    }
  },

  async updateItemStatus(itemId: number, status: string): Promise<void> {
    try {
      if (!itemId) {
        throw handleValidationError('ID de l\'item manquant', 'updateItemStatus');
      }

      const { error } = await supabase
        .from('items')
        .update({ status })
        .eq('id', itemId);

      if (error) throw error;
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'updateItemStatus');
      throw error;
    }
  },

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
        updatedAt: item.updated_at
      }));
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'getItems');
      return [];
    }
  },

  async addItem(item: Omit<Item, "id" | "createdAt" | "updatedAt">): Promise<number> {
    try {
      if (!item.name) {
        throw handleValidationError('Le nom de l\'item est requis', 'addItem');
      }

      // Vérification de l'authentification
      const { data: sessionData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Erreur d\'authentification:', authError);
        throw handleValidationError('Erreur d\'authentification', 'addItem');
      }

      if (!sessionData.session?.user?.id) {
        console.error('Utilisateur non authentifié');
        throw handleValidationError('Utilisateur non authentifié', 'addItem');
      }

      const userId = sessionData.session.user.id;

      // Construction de l'objet à insérer
      const supabaseItem = {
        name: item.name,
        description: item.description || null,
        purchase_price: item.purchasePrice || 0,
        selling_price: item.sellingPrice || 0,
        status: item.status || 'available',
        photo_uri: item.photoUri || null,
        container_id: item.containerId || null,
        category_id: item.categoryId || null,
        qr_code: item.qrCode || null,
        user_id: userId,
        created_by: userId,
        deleted: false
      };

      console.log('Données à insérer:', supabaseItem);

      // Insertion avec gestion d'erreur détaillée
      const { data, error } = await supabase
        .from('items')
        .insert(supabaseItem)
        .select('*')
        .single();
      
      if (error) {
        console.error('Erreur Supabase détaillée:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      if (!data) {
        throw handleValidationError('Aucune donnée retournée après l\'insertion', 'addItem');
      }

      return data.id;
    } catch (error) {
      console.error('Erreur complète:', error);
      handleDatabaseError(error as PostgrestError, 'addItem');
      throw error;
    }
  },

  async addContainer(container: Omit<Container, "id" | "createdAt" | "updatedAt">): Promise<number> {
    try {
      if (!container.name) {
        throw handleValidationError('Le nom du container est requis', 'addContainer');
      }

      const supabaseContainer = {
        name: container.name,
        number: container.number,
        description: container.description,
        qr_code: container.qrCode,
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
  },

  async addCategory(category: Omit<Category, "id" | "createdAt" | "updatedAt">): Promise<number> {
    // Convertir les noms de colonnes pour correspondre à la structure Supabase
    const supabaseCategory = {
      name: category.name,
      description: category.description
    };

    const { data, error } = await supabase
      .from('categories')
      .insert([supabaseCategory])
      .select()
      .single();
    
    if (error) {
      console.error('Erreur Supabase:', error);
      throw error;
    }
    return data.id;
  },

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
  },

  async getContainerByQRCode(qrCode: string): Promise<Container | null> {
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('qr_code', qrCode)
      .single();

    if (error) throw error;
    
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      number: data.number,
      description: data.description,
      qrCode: data.qr_code,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
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
  },

  async deleteItem(id: number): Promise<void> {
    try {
      if (!id) {
        throw handleValidationError('ID de l\'item manquant', 'deleteItem');
      }

      const { error } = await supabase
        .from('items')
        .update({ deleted: true })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      handleDatabaseError(error as PostgrestError, 'deleteItem');
      throw error;
    }
  }
};

export default supabaseDatabase;
