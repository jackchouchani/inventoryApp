import { ConflictDetector } from '../ConflictDetector';
import { localDB } from '../../database/localDatabase';
import { ConflictType } from '../../types/offline';

// Mock dependencies
jest.mock('../../database/localDatabase', () => ({
  localDB: {
    conflicts: {
      add: jest.fn(),
      where: jest.fn(() => ({
        equals: jest.fn(() => ({
          toArray: jest.fn()
        }))
      })),
      put: jest.fn(),
      count: jest.fn(),
      delete: jest.fn()
    },
    items: {
      get: jest.fn()
    },
    categories: {
      get: jest.fn()
    },
    containers: {
      get: jest.fn()
    }
  }
}));

describe('ConflictDetector', () => {
  let detector: ConflictDetector;
  
  beforeEach(() => {
    detector = ConflictDetector.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset singleton instance for clean tests
    (ConflictDetector as any).instance = null;
  });

  describe('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = ConflictDetector.getInstance();
      const instance2 = ConflictDetector.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('detectConflict', () => {
    test('should detect UPDATE_UPDATE conflict', async () => {
      const localData = {
        id: '123',
        name: 'Local Item',
        updatedAt: '2023-01-02T00:00:00Z'
      };

      const serverData = {
        id: '123',
        name: 'Server Item',
        updatedAt: '2023-01-02T01:00:00Z'
      };

      (localDB.items.get as jest.Mock).mockResolvedValue(localData);
      (localDB.conflicts.add as jest.Mock).mockResolvedValue('conflict-id');

      const conflict = await detector.detectConflict('item', '123', serverData);

      expect(conflict).toBeDefined();
      expect(conflict?.type).toBe('UPDATE_UPDATE');
      expect(conflict?.localData).toEqual(localData);
      expect(conflict?.serverData).toEqual(serverData);
      expect(localDB.conflicts.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_UPDATE',
          entityType: 'item',
          entityId: '123'
        })
      );
    });

    test('should detect DELETE_UPDATE conflict', async () => {
      const serverData = {
        id: '123',
        name: 'Server Item',
        updatedAt: '2023-01-02T01:00:00Z'
      };

      (localDB.items.get as jest.Mock).mockResolvedValue(undefined);
      (localDB.conflicts.add as jest.Mock).mockResolvedValue('conflict-id');

      const conflict = await detector.detectConflict('item', '123', serverData);

      expect(conflict).toBeDefined();
      expect(conflict?.type).toBe('DELETE_UPDATE');
      expect(conflict?.localData).toBeNull();
      expect(conflict?.serverData).toEqual(serverData);
    });

    test('should return null when no conflict exists', async () => {
      const localData = {
        id: '123',
        name: 'Same Item',
        updatedAt: '2023-01-02T00:00:00Z'
      };

      const serverData = {
        id: '123',
        name: 'Same Item',
        updatedAt: '2023-01-02T00:00:00Z'
      };

      (localDB.items.get as jest.Mock).mockResolvedValue(localData);

      const conflict = await detector.detectConflict('item', '123', serverData);

      expect(conflict).toBeNull();
      expect(localDB.conflicts.add).not.toHaveBeenCalled();
    });

    test('should handle different entity types', async () => {
      const categoryData = {
        id: '456',
        name: 'Test Category',
        updatedAt: '2023-01-02T00:00:00Z'
      };

      (localDB.categories.get as jest.Mock).mockResolvedValue(categoryData);

      await detector.detectConflict('category', '456', {
        ...categoryData,
        name: 'Modified Category'
      });

      expect(localDB.categories.get).toHaveBeenCalledWith('456');
    });
  });

  describe('getUnresolvedConflicts', () => {
    test('should return unresolved conflicts', async () => {
      const mockConflicts = [
        {
          id: 'conflict-1',
          type: 'UPDATE_UPDATE',
          resolved: false,
          entityType: 'item'
        },
        {
          id: 'conflict-2',
          type: 'DELETE_UPDATE',
          resolved: false,
          entityType: 'category'
        }
      ];

      const mockToArray = jest.fn().mockResolvedValue(mockConflicts);
      const mockEquals = jest.fn(() => ({ toArray: mockToArray }));

      (localDB.conflicts.where as jest.Mock).mockReturnValue({
        equals: mockEquals
      });

      const result = await detector.getUnresolvedConflicts();

      expect(localDB.conflicts.where).toHaveBeenCalledWith('resolved');
      expect(mockEquals).toHaveBeenCalledWith(false);
      expect(result).toEqual(mockConflicts);
    });
  });

  describe('resolveConflict', () => {
    test('should mark conflict as resolved', async () => {
      const conflictId = 'conflict-123';
      const resolution = {
        type: 'local' as const,
        reason: 'User chose local version'
      };

      (localDB.conflicts.put as jest.Mock).mockResolvedValue(undefined);

      await detector.resolveConflict(conflictId, resolution);

      expect(localDB.conflicts.put).toHaveBeenCalledWith({
        id: conflictId,
        resolved: true,
        resolvedAt: expect.any(String),
        resolution: resolution
      });
    });
  });

  describe('getConflictsByEntity', () => {
    test('should return conflicts for specific entity type', async () => {
      const entityType = 'item';
      const mockConflicts = [
        { id: 'conflict-1', entityType: 'item' },
        { id: 'conflict-2', entityType: 'item' }
      ];

      const mockToArray = jest.fn().mockResolvedValue(mockConflicts);
      const mockEquals = jest.fn(() => ({ toArray: mockToArray }));

      (localDB.conflicts.where as jest.Mock).mockReturnValue({
        equals: mockEquals
      });

      const result = await detector.getConflictsByEntity(entityType);

      expect(localDB.conflicts.where).toHaveBeenCalledWith('entityType');
      expect(mockEquals).toHaveBeenCalledWith(entityType);
      expect(result).toEqual(mockConflicts);
    });
  });

  describe('getConflictStats', () => {
    test('should return conflict statistics', async () => {
      // Mock total conflicts
      (localDB.conflicts.count as jest.Mock).mockResolvedValue(10);

      // Mock unresolved conflicts
      const mockUnresolvedToArray = jest.fn().mockResolvedValue([
        { id: '1' }, { id: '2' }, { id: '3' }
      ]);
      const mockUnresolvedEquals = jest.fn(() => ({ 
        toArray: mockUnresolvedToArray 
      }));

      // Mock resolved conflicts  
      const mockResolvedToArray = jest.fn().mockResolvedValue([
        { id: '4' }, { id: '5' }
      ]);
      const mockResolvedEquals = jest.fn(() => ({ 
        toArray: mockResolvedToArray 
      }));

      (localDB.conflicts.where as jest.Mock)
        .mockReturnValueOnce({ equals: mockUnresolvedEquals })
        .mockReturnValueOnce({ equals: mockResolvedEquals });

      const stats = await detector.getConflictStats();

      expect(stats).toEqual({
        total: 10,
        unresolved: 3,
        resolved: 2,
        resolutionRate: 0.4 // 2/5
      });
    });

    test('should handle zero conflicts', async () => {
      (localDB.conflicts.count as jest.Mock).mockResolvedValue(0);
      
      const mockToArray = jest.fn().mockResolvedValue([]);
      const mockEquals = jest.fn(() => ({ toArray: mockToArray }));

      (localDB.conflicts.where as jest.Mock).mockReturnValue({
        equals: mockEquals
      });

      const stats = await detector.getConflictStats();

      expect(stats).toEqual({
        total: 0,
        unresolved: 0,
        resolved: 0,
        resolutionRate: 0
      });
    });
  });

  describe('clearResolvedConflicts', () => {
    test('should delete resolved conflicts older than specified days', async () => {
      const daysOld = 30;
      const mockDelete = jest.fn().mockResolvedValue(5);
      const mockAnd = jest.fn(() => ({ delete: mockDelete }));
      const mockEquals = jest.fn(() => ({ and: mockAnd }));

      (localDB.conflicts.where as jest.Mock).mockReturnValue({
        equals: mockEquals
      });

      const deletedCount = await detector.clearResolvedConflicts(daysOld);

      expect(localDB.conflicts.where).toHaveBeenCalledWith('resolved');
      expect(mockEquals).toHaveBeenCalledWith(true);
      expect(deletedCount).toBe(5);
    });
  });

  describe('areDataEqual', () => {
    test('should detect equal objects', () => {
      const data1 = { id: '123', name: 'Test', value: 42 };
      const data2 = { id: '123', name: 'Test', value: 42 };

      const isEqual = (detector as any).areDataEqual(data1, data2);

      expect(isEqual).toBe(true);
    });

    test('should detect different objects', () => {
      const data1 = { id: '123', name: 'Test', value: 42 };
      const data2 = { id: '123', name: 'Different', value: 42 };

      const isEqual = (detector as any).areDataEqual(data1, data2);

      expect(isEqual).toBe(false);
    });

    test('should ignore timestamp differences within threshold', () => {
      const data1 = { 
        id: '123', 
        name: 'Test', 
        updatedAt: '2023-01-01T12:00:00Z' 
      };
      const data2 = { 
        id: '123', 
        name: 'Test', 
        updatedAt: '2023-01-01T12:00:01Z' 
      };

      const isEqual = (detector as any).areDataEqual(data1, data2);

      expect(isEqual).toBe(true);
    });
  });
});