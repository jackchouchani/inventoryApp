import { localDB, ConflictRecord, OfflineEvent } from '../database/localDatabase';
import { ConflictType, EntityType } from '../types/offline';
import { v4 as uuidv4 } from 'uuid';

export interface MockItem {
  id: string;
  name: string;
  description?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  status: 'active' | 'sold' | 'lost';
  categoryId?: string;
  containerId?: string;
  qrCode?: string;
  updatedAt: Date;
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  conflictType: ConflictType;
  entity: EntityType;
}

/**
 * Service pour créer et gérer des conflits de test
 * ATTENTION: N'affecte QUE IndexedDB local, jamais Supabase
 */
export class TestConflictService {
  private static instance: TestConflictService;
  private isTestModeActive = false;
  private testDataPrefix = 'TEST_';

  private constructor() {}

  public static getInstance(): TestConflictService {
    if (!TestConflictService.instance) {
      TestConflictService.instance = new TestConflictService();
    }
    return TestConflictService.instance;
  }

  /**
   * Active/désactive le mode test
   */
  setTestMode(active: boolean): void {
    this.isTestModeActive = active;
    console.log(`[TestConflictService] Mode test: ${active ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  }

  isInTestMode(): boolean {
    return this.isTestModeActive;
  }

  /**
   * Génère un ID de test unique
   */
  private generateTestId(): string {
    return this.testDataPrefix + uuidv4();
  }

  /**
   * Génère un timestamp légèrement différent pour simuler des modifications concurrentes
   */
  private generateTimestamp(offsetMinutes: number = 0): Date {
    const now = new Date();
    return new Date(now.getTime() + (offsetMinutes * 60 * 1000));
  }

  /**
   * Crée des données de base pour les tests
   */
  private createMockItem(overrides: Partial<MockItem> = {}): MockItem {
    return {
      id: this.generateTestId(),
      name: 'Item de Test',
      description: 'Description de test',
      purchasePrice: 10.99,
      sellingPrice: 15.99,
      status: 'active',
      qrCode: this.testDataPrefix + Math.random().toString(36).substring(7),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * Scénario 1: UPDATE_UPDATE - Modifications simultanées
   */
  async simulateUpdateUpdateConflict(): Promise<ConflictRecord> {
    if (!this.isTestModeActive) {
      throw new Error('Mode test non activé');
    }

    console.log('[TestConflictService] Simulation UPDATE_UPDATE...');

    // Créer un item de base
    const baseItem = this.createMockItem({
      name: 'iPhone de Test',
      description: 'Item avec conflit UPDATE_UPDATE'
    });

    // Version locale (utilisateur modifie le prix)
    const localData = {
      ...baseItem,
      sellingPrice: 20.99,
      updatedAt: this.generateTimestamp(-2) // Il y a 2 minutes
    };

    // Version serveur (autre utilisateur modifie la description)
    const serverData = {
      ...baseItem,
      description: 'Description modifiée par un autre utilisateur',
      updatedAt: this.generateTimestamp(-1) // Il y a 1 minute
    };

    // Créer l'événement offline
    const offlineEvent: OfflineEvent = {
      id: this.generateTestId(),
      type: 'update',
      entity: 'item',
      entityId: baseItem.id,
      data: localData,
      timestamp: localData.updatedAt,
      status: 'conflict',
      userId: 'test-user-1',
      deviceId: 'test-device'
    };

    // Créer le conflit
    const conflict: ConflictRecord = {
      id: this.generateTestId(),
      type: 'UPDATE_UPDATE',
      entity: 'item',
      entityId: baseItem.id,
      eventId: offlineEvent.id,
      localData,
      serverData,
      localTimestamp: localData.updatedAt,
      serverTimestamp: serverData.updatedAt,
      detectedAt: new Date(),
      resolution: null
    };

    // Sauvegarder dans IndexedDB
    await localDB.offlineEvents.put(offlineEvent);
    await localDB.conflicts.put(conflict);

    console.log('[TestConflictService] Conflit UPDATE_UPDATE créé:', conflict.id);
    return conflict;
  }

  /**
   * Scénario 2: DELETE_UPDATE - Suppression vs Modification
   */
  async simulateDeleteUpdateConflict(): Promise<ConflictRecord> {
    if (!this.isTestModeActive) {
      throw new Error('Mode test non activé');
    }

    console.log('[TestConflictService] Simulation DELETE_UPDATE...');

    const baseItem = this.createMockItem({
      name: 'MacBook de Test',
      description: 'Item avec conflit DELETE_UPDATE'
    });

    // Version locale (utilisateur supprime)
    const localData = null; // Suppression

    // Version serveur (autre utilisateur modifie)
    const serverData = {
      ...baseItem,
      status: 'sold' as const,
      sellingPrice: 800.00,
      updatedAt: this.generateTimestamp(-1)
    };

    const offlineEvent: OfflineEvent = {
      id: this.generateTestId(),
      type: 'delete',
      entity: 'item',
      entityId: baseItem.id,
      data: { id: baseItem.id },
      timestamp: this.generateTimestamp(-2),
      status: 'conflict',
      userId: 'test-user-1',
      deviceId: 'test-device'
    };

    const conflict: ConflictRecord = {
      id: this.generateTestId(),
      type: 'DELETE_UPDATE',
      entity: 'item',
      entityId: baseItem.id,
      eventId: offlineEvent.id,
      localData,
      serverData,
      localTimestamp: this.generateTimestamp(-2),
      serverTimestamp: serverData.updatedAt,
      detectedAt: new Date(),
      resolution: null
    };

    await localDB.offlineEvents.put(offlineEvent);
    await localDB.conflicts.put(conflict);

    console.log('[TestConflictService] Conflit DELETE_UPDATE créé:', conflict.id);
    return conflict;
  }

  /**
   * Scénario 3: CREATE_CREATE - Créations dupliquées (même QR code)
   */
  async simulateCreateCreateConflict(): Promise<ConflictRecord> {
    if (!this.isTestModeActive) {
      throw new Error('Mode test non activé');
    }

    console.log('[TestConflictService] Simulation CREATE_CREATE...');

    const duplicatedQrCode = this.testDataPrefix + 'DUPLICATE_QR';

    // Version locale
    const localData = this.createMockItem({
      name: 'Souris Gaming Local',
      description: 'Créé localement',
      qrCode: duplicatedQrCode,
      updatedAt: this.generateTimestamp(-3)
    });

    // Version serveur (même QR code)
    const serverData = this.createMockItem({
      id: this.generateTestId(),
      name: 'Souris Gaming Serveur', 
      description: 'Créé sur le serveur',
      qrCode: duplicatedQrCode,
      updatedAt: this.generateTimestamp(-1)
    });

    const offlineEvent: OfflineEvent = {
      id: this.generateTestId(),
      type: 'create',
      entity: 'item',
      entityId: localData.id,
      data: localData,
      timestamp: localData.updatedAt,
      status: 'conflict',
      userId: 'test-user-1',
      deviceId: 'test-device'
    };

    const conflict: ConflictRecord = {
      id: this.generateTestId(),
      type: 'CREATE_CREATE',
      entity: 'item',
      entityId: localData.id,
      eventId: offlineEvent.id,
      localData,
      serverData,
      localTimestamp: localData.updatedAt,
      serverTimestamp: serverData.updatedAt,
      detectedAt: new Date(),
      resolution: null
    };

    await localDB.offlineEvents.put(offlineEvent);
    await localDB.conflicts.put(conflict);

    console.log('[TestConflictService] Conflit CREATE_CREATE créé:', conflict.id);
    return conflict;
  }

  /**
   * Scénario 4: MOVE_MOVE - Déplacements simultanés
   */
  async simulateMoveConflict(): Promise<ConflictRecord> {
    if (!this.isTestModeActive) {
      throw new Error('Mode test non activé');
    }

    console.log('[TestConflictService] Simulation MOVE_MOVE...');

    const baseItem = this.createMockItem({
      name: 'Clavier de Test',
      description: 'Item avec conflit de déplacement',
      containerId: this.testDataPrefix + 'container_original'
    });

    // Version locale (déplacé vers container A)
    const localData = {
      ...baseItem,
      containerId: this.testDataPrefix + 'container_A',
      updatedAt: this.generateTimestamp(-2)
    };

    // Version serveur (déplacé vers container B)
    const serverData = {
      ...baseItem,
      containerId: this.testDataPrefix + 'container_B',
      updatedAt: this.generateTimestamp(-1)
    };

    const offlineEvent: OfflineEvent = {
      id: this.generateTestId(),
      type: 'update',
      entity: 'item',
      entityId: baseItem.id,
      data: localData,
      timestamp: localData.updatedAt,
      status: 'conflict',
      userId: 'test-user-1',
      deviceId: 'test-device'
    };

    const conflict: ConflictRecord = {
      id: this.generateTestId(),
      type: 'MOVE_MOVE',
      entity: 'item',
      entityId: baseItem.id,
      eventId: offlineEvent.id,
      localData,
      serverData,
      localTimestamp: localData.updatedAt,
      serverTimestamp: serverData.updatedAt,
      detectedAt: new Date(),
      resolution: null
    };

    await localDB.offlineEvents.put(offlineEvent);
    await localDB.conflicts.put(conflict);

    console.log('[TestConflictService] Conflit MOVE_MOVE créé:', conflict.id);
    return conflict;
  }

  /**
   * Crée tous les scénarios de test en une fois
   */
  async createAllTestScenarios(): Promise<ConflictRecord[]> {
    if (!this.isTestModeActive) {
      throw new Error('Mode test non activé');
    }

    console.log('[TestConflictService] Création de tous les scénarios de test...');

    const conflicts: ConflictRecord[] = [];

    try {
      conflicts.push(await this.simulateUpdateUpdateConflict());
      conflicts.push(await this.simulateDeleteUpdateConflict());
      conflicts.push(await this.simulateCreateCreateConflict());
      conflicts.push(await this.simulateMoveConflict());

      console.log(`[TestConflictService] ${conflicts.length} conflits de test créés`);
      return conflicts;
    } catch (error) {
      console.error('[TestConflictService] Erreur lors de la création des scénarios:', error);
      throw error;
    }
  }

  /**
   * Liste tous les scénarios disponibles
   */
  getAvailableScenarios(): TestScenario[] {
    return [
      {
        id: 'update_update',
        name: 'Modifications simultanées',
        description: 'Deux utilisateurs modifient le même item en même temps',
        conflictType: 'UPDATE_UPDATE',
        entity: 'item'
      },
      {
        id: 'delete_update',
        name: 'Suppression vs Modification',
        description: 'Un utilisateur supprime pendant qu\'un autre modifie',
        conflictType: 'DELETE_UPDATE',
        entity: 'item'
      },
      {
        id: 'create_create',
        name: 'Créations dupliquées',
        description: 'Deux items créés avec le même QR code',
        conflictType: 'CREATE_CREATE',
        entity: 'item'
      },
      {
        id: 'move_move',
        name: 'Déplacements simultanés',
        description: 'Item déplacé vers différents containers',
        conflictType: 'MOVE_MOVE',
        entity: 'item'
      }
    ];
  }

  /**
   * Compte les données de test
   */
  async getTestDataCount(): Promise<{ conflicts: number; events: number }> {
    const testConflicts = await localDB.conflicts
      .filter(c => c.id.startsWith(this.testDataPrefix))
      .count();

    const testEvents = await localDB.offlineEvents
      .filter(e => e.id.startsWith(this.testDataPrefix))
      .count();

    return { conflicts: testConflicts, events: testEvents };
  }

  /**
   * Nettoie toutes les données de test
   * SÉCURITÉ: Supprime UNIQUEMENT les données préfixées TEST_
   */
  async cleanup(): Promise<void> {
    console.log('[TestConflictService] Nettoyage des données de test...');

    try {
      // Supprimer les conflits de test
      const testConflicts = await localDB.conflicts
        .filter(c => c.id.startsWith(this.testDataPrefix))
        .toArray();

      for (const conflict of testConflicts) {
        await localDB.conflicts.delete(conflict.id);
      }

      // Supprimer les événements de test
      const testEvents = await localDB.offlineEvents
        .filter(e => e.id.startsWith(this.testDataPrefix))
        .toArray();

      for (const event of testEvents) {
        await localDB.offlineEvents.delete(event.id);
      }

      console.log(`[TestConflictService] Nettoyage terminé: ${testConflicts.length} conflits et ${testEvents.length} événements supprimés`);
    } catch (error) {
      console.error('[TestConflictService] Erreur lors du nettoyage:', error);
      throw error;
    }
  }

  /**
   * Vérifie si des données de test existent
   */
  async hasTestData(): Promise<boolean> {
    const count = await this.getTestDataCount();
    return count.conflicts > 0 || count.events > 0;
  }
}