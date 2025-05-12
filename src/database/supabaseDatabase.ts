import { supabase } from './supabaseClient';
import type { DatabaseInterface } from './database';
import type { Item, ItemInput, ItemUpdate } from '../types/item';
import type { Category, CategoryInput, CategoryUpdate } from '../types/category';
import type { Container, ContainerInput, ContainerUpdate } from '../types/container';
import { handleDatabaseError, handleValidationError } from '../utils/errorHandler';
import { PostgrestError } from '@supabase/supabase-js';

// Sélection optimisée des champs pour les listes
const ITEM_LIST_FIELDS = `
  id,
  name,
  description,
  status,
  selling_price,
  category_id,
  container_id,
  photo_storage_url,
  qr_code,
  created_at,
  updated_at,
  purchase_price
`;

const ITEM_DETAIL_FIELDS = `
  id,
  name,
  description,
  purchase_price,
  selling_price,
  status,
  photo_storage_url,
  container_id,
  category_id,
  qr_code,
  created_at,
  updated_at,
  sold_at
`;

export class SupabaseDatabase implements DatabaseInterface {
  async getContainers(): Promise<Container[]> {
    try {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .is('deleted', false);
      
      // Si erreur ou pas de données, retourner un tableau vide
      if (error || !data) {
        return [];
      }
      
      return data.map(container => ({
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
      console.log('Erreur dans getContainers:', error);
      return [];
    }
  }

  async getCategories(): Promise<Category[]> {
    try {
      const { data, error } = await supabase
        .from('categories') 
        .select('*')
        .is('deleted', false);

      // Si erreur ou pas de données, retourner un tableau vide
      if (error || !data) {
        console.log('Aucune catégorie trouvée ou erreur:', error);
        return [];
      }
      
      return data.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        icon: category.icon,
        createdAt: category.created_at,
        updatedAt: category.updated_at
      }));
    } catch (error) {
      console.log('Erreur dans getCategories:', error);
      return [];
    }
  }

  async getItems(): Promise<Item[]> {
    try {
      
      const { data, error } = await supabase
        .from('items')
        .select(ITEM_LIST_FIELDS)
        .is('deleted', false)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.log('Erreur lors de la récupération des items:', error);
        return [];
      }
      
      if (!data) {
        return [];
      }

      const mappedItems = data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        purchasePrice: item.purchase_price,
        sellingPrice: item.selling_price,
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.container_id,
        categoryId: item.category_id,
        qrCode: item.qr_code,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
      
      return mappedItems;
    } catch (error) {
      console.log('Erreur dans getItems:', error);
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
    if (item.photo_storage_url !== undefined) updateData.photo_storage_url = item.photo_storage_url;
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
    try {
      // Récupérer l'utilisateur actuel
      const { data: authData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', userError);
        throw new Error('Erreur d\'authentification');
      }
      
      if (!authData?.user?.id) {
        console.error('Aucun utilisateur connecté');
        throw new Error('Utilisateur non connecté');
      }

      const userId = authData.user.id;
      console.log('ID de l\'utilisateur récupéré:', userId);

      // S'assurer que le QR code est au bon format
      if (!item.qrCode || !item.qrCode.startsWith('ART_')) {
        console.error('QR code invalide ou manquant, génération d\'un nouveau code');
        // Import la fonction generateId si nécessaire
        const { generateId } = await import('../utils/identifierManager');
        item.qrCode = generateId('ITEM');
      }

      // Préparer les données de l'item
      const itemData = {
        name: item.name,
        description: item.description || '',
        purchase_price: item.purchasePrice,
        selling_price: item.sellingPrice,
        status: item.status,
        photo_storage_url: item.photo_storage_url || null,
        container_id: item.containerId || null,
        category_id: item.categoryId || null,
        qr_code: item.qrCode,  // Utilisation explicite du code QR de l'objet item
        user_id: userId,
        deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Données de l\'item à créer:', itemData);
      console.log('URL de la photo à sauvegarder:', item.photo_storage_url);
      console.log('QR code utilisé:', item.qrCode);

      // Insérer l'item dans la base de données
      const { data, error } = await supabase
        .from('items')
        .insert(itemData)
        .select('id')
        .single();

      if (error) {
        console.error('Erreur lors de la création de l\'item:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Aucun ID retourné après la création de l\'item');
      }

      return data.id;
    } catch (error) {
      console.error('Erreur lors de la création de l\'item:', error);
      console.error('Erreur complète dans addItem:', error);
      throw error;
    }
  }

  async addContainer(container: ContainerInput): Promise<number> {
    try {
      if (!container.name) {
        handleValidationError('Le nom du container est requis');
      }

      // Récupérer l'utilisateur actuel
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Utilisateur non connecté');

      // S'assurer que le QR code est au bon format
      if (!container.qrCode || !container.qrCode.startsWith('CONT_')) {
        console.error('QR code container invalide ou manquant, génération d\'un nouveau code');
        // Import la fonction generateId si nécessaire
        const { generateId } = await import('../utils/identifierManager');
        container.qrCode = generateId('CONTAINER');
      }
      
      const supabaseContainer = {
        name: container.name,
        description: container.description || '',
        number: container.number || null,
        qr_code: container.qrCode,
        user_id: user.id,
        deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Données du container à créer:', supabaseContainer);
      console.log('QR code container utilisé:', container.qrCode);

      const { data, error } = await supabase
        .from('containers')
        .insert(supabaseContainer)
        .select()
        .single();
      
      if (error) {
        console.error('Erreur lors de la création du container:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Aucune donnée retournée après la création du container');
      }

      return data.id;
    } catch (error) {
      console.error('Erreur complète dans addContainer:', error);
      handleDatabaseError(error as PostgrestError);
      throw error;
    }
  }

  async addCategory(category: CategoryInput): Promise<number> {
    try {
      // Récupérer l'utilisateur actuel
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Utilisateur non connecté');

      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...category,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted: false
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }
      return data.id;
    } catch (error) {
      console.error('Erreur Supabase:', error);
      throw error;
    }
  }

  async resetDatabase(): Promise<void> {
    try {
      console.log('Début de la réinitialisation de la base de données...');
      const { error } = await supabase.rpc('reset_database');
      
      if (error) {
        console.error('Erreur lors de la réinitialisation Supabase:', error);
        throw error;
      }
      
      console.log('Base de données réinitialisée avec succès');
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
    try {
      const { data, error } = await supabase
        .from('items')
        .select(ITEM_DETAIL_FIELDS)
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
        photo_storage_url: data.photo_storage_url,
        containerId: data.container_id,
        categoryId: data.category_id,
        qrCode: data.qr_code,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        soldAt: data.sold_at
      };
    } catch (error) {
      handleDatabaseError(error as PostgrestError);
      return null;
    }
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
    try {
      // Vérifier si la catégorie existe
      const { data: category, error: checkError } = await supabase
        .from('categories')
        .select('id')
        .eq('id', id)
        .single();

      if (checkError || !category) {
        throw new Error(`Catégorie avec l'ID ${id} n'existe pas`);
      }

      // Vérifier si la catégorie est utilisée par des éléments
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id')
        .eq('category_id', id)
        .is('deleted', false);

      if (itemsError) {
        throw new Error(`Erreur lors de la vérification des éléments liés: ${itemsError.message}`);
      }

      // Si des éléments utilisent cette catégorie, mettre à jour leur category_id à null
      if (items && items.length > 0) {
        const { error: updateItemsError } = await supabase
          .from('items')
          .update({ category_id: null })
          .eq('category_id', id);

        if (updateItemsError) {
          throw new Error(`Erreur lors de la mise à jour des éléments liés: ${updateItemsError.message}`);
        }
      }

      // Marquer la catégorie comme supprimée plutôt que de la supprimer complètement
      const { error: deleteError } = await supabase
        .from('categories')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (deleteError) {
        throw new Error(`Erreur lors de la suppression de la catégorie: ${deleteError.message}`);
      }
    } catch (error) {
      console.error('Erreur dans deleteCategory:', error);
      throw error;
    }
  }

  async storePhotoUri(_uri: string): Promise<void> {
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
        .select(ITEM_DETAIL_FIELDS)
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
        photo_storage_url: data.photo_storage_url,
        containerId: data.container_id,
        categoryId: data.category_id,
        qrCode: data.qr_code,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        soldAt: data.sold_at
      };
    } catch (error) {
      handleDatabaseError(error as PostgrestError);
      return null;
    }
  }

  async searchItems(query: string): Promise<Item[]> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select(ITEM_LIST_FIELDS)
        .is('deleted', false)
        .ilike('name', `%${query}%`)
        .limit(20);

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        purchasePrice: item.purchase_price,
        sellingPrice: item.selling_price,
        status: item.status,
        photo_storage_url: item.photo_storage_url,
        containerId: item.container_id,
        categoryId: item.category_id,
        qrCode: item.qr_code,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
    } catch (error) {
      handleDatabaseError(error as PostgrestError);
      return [];
    }
  }
}

export const database = new SupabaseDatabase();
export default database;
