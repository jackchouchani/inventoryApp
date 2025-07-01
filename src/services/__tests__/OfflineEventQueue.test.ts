import { OfflineEventQueue } from '../OfflineEventQueue';
import { localDB } from '../../database/localDatabase';
import { EventType, EntityType, SyncStatus } from '../../types/offline';

// Mock dependencies
jest.mock('../../database/localDatabase', () => ({
  localDB: {
    offlineEvents: {
      add: jest.fn(),
      where: jest.fn(() => ({
        equals: jest.fn(() => ({
          toArray: jest.fn()
        }))
      })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          toArray: jest.fn()
        }))
      })),
      put: jest.fn(),
      count: jest.fn(),
      delete: jest.fn()
    }
  }
}));

describe('OfflineEventQueue', () => {
  let queue: OfflineEventQueue;
  
  beforeEach(() => {
    queue = OfflineEventQueue.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset singleton instance for clean tests
    (OfflineEventQueue as any).instance = null;
  });

  describe('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = OfflineEventQueue.getInstance();
      const instance2 = OfflineEventQueue.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('addEvent', () => {
    test('should add event to database', async () => {
      const mockEvent = {
        id: 'test-id',
        type: 'CREATE' as EventType,
        entity: 'item' as EntityType,
        entityId: '123',
        data: { name: 'Test Item' },
        originalData: null,
        timestamp: new Date(),
        userId: 'user-123',
        deviceId: 'device-123',
        status: 'pending' as SyncStatus,
        syncAttempts: 0,
        metadata: {}
      };

      (localDB.offlineEvents.add as jest.Mock).mockResolvedValue('test-id');

      await queue.addEvent(mockEvent);

      expect(localDB.offlineEvents.add).toHaveBeenCalledWith(mockEvent);
    });

    test('should handle database errors gracefully', async () => {
      const mockEvent = {
        id: 'test-id',
        type: 'CREATE' as EventType,
        entity: 'item' as EntityType,
        entityId: '123',
        data: { name: 'Test Item' },
        originalData: null,
        timestamp: new Date(),
        userId: 'user-123',
        deviceId: 'device-123',
        status: 'pending' as SyncStatus,
        syncAttempts: 0,
        metadata: {}
      };

      (localDB.offlineEvents.add as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(queue.addEvent(mockEvent)).rejects.toThrow('Database error');
    });
  });

  describe('getPendingEvents', () => {
    test('should return pending events ordered by timestamp', async () => {
      const mockEvents = [
        { id: '1', status: 'pending', timestamp: new Date('2023-01-01') },
        { id: '2', status: 'pending', timestamp: new Date('2023-01-02') }
      ];

      const mockOrderBy = jest.fn(() => ({
        toArray: jest.fn().mockResolvedValue(mockEvents)
      }));

      const mockEquals = jest.fn(() => ({
        orderBy: mockOrderBy
      }));

      (localDB.offlineEvents.where as jest.Mock).mockReturnValue({
        equals: mockEquals
      });

      const result = await queue.getPendingEvents();

      expect(localDB.offlineEvents.where).toHaveBeenCalledWith('status');
      expect(mockEquals).toHaveBeenCalledWith('pending');
      expect(mockOrderBy).toHaveBeenCalledWith('timestamp');
      expect(result).toEqual(mockEvents);
    });
  });

  describe('getFailedEvents', () => {
    test('should return failed events', async () => {
      const mockEvents = [
        { id: '1', status: 'failed', syncAttempts: 3 },
        { id: '2', status: 'failed', syncAttempts: 5 }
      ];

      const mockToArray = jest.fn().mockResolvedValue(mockEvents);
      const mockEquals = jest.fn(() => ({ toArray: mockToArray }));

      (localDB.offlineEvents.where as jest.Mock).mockReturnValue({
        equals: mockEquals
      });

      const result = await queue.getFailedEvents();

      expect(localDB.offlineEvents.where).toHaveBeenCalledWith('status');
      expect(mockEquals).toHaveBeenCalledWith('failed');
      expect(result).toEqual(mockEvents);
    });
  });

  describe('updateEventStatus', () => {
    test('should update event status successfully', async () => {
      const eventId = 'test-id';
      const newStatus: SyncStatus = 'synced';

      (localDB.offlineEvents.put as jest.Mock).mockResolvedValue(undefined);

      await queue.updateEventStatus(eventId, newStatus);

      expect(localDB.offlineEvents.put).toHaveBeenCalledWith({
        id: eventId,
        status: newStatus,
        syncAttempts: expect.any(Number)
      });
    });

    test('should increment syncAttempts for failed status', async () => {
      const eventId = 'test-id';
      const newStatus: SyncStatus = 'failed';

      await queue.updateEventStatus(eventId, newStatus);

      expect(localDB.offlineEvents.put).toHaveBeenCalledWith({
        id: eventId,
        status: newStatus,
        syncAttempts: expect.any(Number)
      });
    });
  });

  describe('getEventCount', () => {
    test('should return total event count', async () => {
      (localDB.offlineEvents.count as jest.Mock).mockResolvedValue(42);

      const count = await queue.getEventCount();

      expect(localDB.offlineEvents.count).toHaveBeenCalled();
      expect(count).toBe(42);
    });
  });

  describe('clearProcessedEvents', () => {
    test('should delete synced events older than specified days', async () => {
      const daysOld = 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const mockDelete = jest.fn().mockResolvedValue(5);
      const mockAnd = jest.fn(() => ({ delete: mockDelete }));
      const mockEquals = jest.fn(() => ({ and: mockAnd }));

      (localDB.offlineEvents.where as jest.Mock).mockReturnValue({
        equals: mockEquals
      });

      const deletedCount = await queue.clearProcessedEvents(daysOld);

      expect(localDB.offlineEvents.where).toHaveBeenCalledWith('status');
      expect(mockEquals).toHaveBeenCalledWith('synced');
      expect(deletedCount).toBe(5);
    });
  });

  describe('getEventsByEntity', () => {
    test('should return events for specific entity type', async () => {
      const entityType: EntityType = 'item';
      const mockEvents = [
        { id: '1', entity: 'item' },
        { id: '2', entity: 'item' }
      ];

      const mockToArray = jest.fn().mockResolvedValue(mockEvents);
      const mockEquals = jest.fn(() => ({ toArray: mockToArray }));

      (localDB.offlineEvents.where as jest.Mock).mockReturnValue({
        equals: mockEquals
      });

      const result = await queue.getEventsByEntity(entityType);

      expect(localDB.offlineEvents.where).toHaveBeenCalledWith('entity');
      expect(mockEquals).toHaveBeenCalledWith(entityType);
      expect(result).toEqual(mockEvents);
    });
  });

  describe('getRecentEvents', () => {
    test('should return limited number of recent events', async () => {
      const limit = 10;
      const mockEvents = Array.from({ length: limit }, (_, i) => ({
        id: `event-${i}`,
        timestamp: new Date()
      }));

      const mockToArray = jest.fn().mockResolvedValue(mockEvents);
      const mockLimit = jest.fn(() => ({ toArray: mockToArray }));
      const mockOrderBy = jest.fn(() => ({ limit: mockLimit }));

      (localDB.offlineEvents.orderBy as jest.Mock).mockReturnValue({
        limit: mockLimit
      });

      const result = await queue.getRecentEvents(limit);

      expect(localDB.offlineEvents.orderBy).toHaveBeenCalledWith('timestamp');
      expect(mockLimit).toHaveBeenCalledWith(limit);
      expect(result).toEqual(mockEvents);
    });

    test('should use default limit when none provided', async () => {
      const mockToArray = jest.fn().mockResolvedValue([]);
      const mockLimit = jest.fn(() => ({ toArray: mockToArray }));

      (localDB.offlineEvents.orderBy as jest.Mock).mockReturnValue({
        limit: mockLimit
      });

      await queue.getRecentEvents();

      expect(mockLimit).toHaveBeenCalledWith(50); // Default limit
    });
  });
});