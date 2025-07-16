import itemsReducer from '../../src/store/itemsSlice';
import {
  setItems,
  addItem,
  updateItem,
  removeItem,
  setSelectedItem,
  resetState,
} from '../../src/store/itemsActions';
import { createItem, deleteItem, fetchItems, updateItem as updateItemThunk } from '../../src/store/itemsThunks';
import { Item } from '../../src/types/item';
import { itemsAdapter } from '../../src/store/itemsAdapter';

// Helper pour créer un mock d'item
const createMockItem = (id: number, overrides = {}): Item => ({
  id,
  name: `Item ${id}`,
  qr_code: `ITEM${id}`,
  container_id: 1,
  category_id: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted: false,
  purchase_price: 10,
  selling_price: 20,
  status: 'available',
  description: `Description for item ${id}`,
  ...overrides,
});

const item1 = createMockItem(1);
const item2 = createMockItem(2);
const item3 = createMockItem(3);

const initialState = itemsAdapter.getInitialState({
  status: 'idle',
  error: null,
  searchResults: [],
  selectedItem: null,
  similarItems: [],
  currentPage: 0,
  totalItems: 0,
  hasMore: false,
  offline: {
    isOffline: false,
    lastSyncTime: null,
    pendingEvents: 0,
    syncInProgress: false,
    syncErrors: []
  },
  localChanges: 0,
});

describe('itemsSlice', () => {
  describe('synchronous actions', () => {
    it('should return the initial state', () => {
      expect(itemsReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    it('should handle setItems', () => {
      const state = itemsReducer(initialState, setItems([item1, item2]));
      expect(state.entities[1]).toEqual(item1);
      expect(state.entities[2]).toEqual(item2);
      expect(state.ids.length).toBe(2);
    });

    it('should handle addItem', () => {
      let state = itemsReducer(initialState, setItems([item1]));
      state = itemsReducer(state, addItem(item2));
      expect(state.entities[2]).toEqual(item2);
      expect(state.ids.length).toBe(2);
    });

    it('should handle updateItem', () => {
      const updatedItem = { ...item1, name: 'Updated Name' };
      let state = itemsReducer(initialState, setItems([item1]));
      state = itemsReducer(state, updateItem(updatedItem));
      expect(state.entities[1]?.name).toBe('Updated Name');
    });

    it('should handle removeItem', () => {
      let state = itemsReducer(initialState, setItems([item1, item2]));
      state = itemsReducer(state, removeItem(item1.id));
      expect(state.entities[1]).toBeUndefined();
      expect(state.ids.length).toBe(1);
    });

    it('should handle setSelectedItem', () => {
      const state = itemsReducer(initialState, setSelectedItem(item1));
      expect(state.selectedItem).toEqual(item1);
    });

    it('should handle resetState', () => {
      let state = itemsReducer(initialState, setItems([item1, item2]));
      state = itemsReducer(state, resetState());
      expect(state).toEqual(initialState);
    });
  });

  describe('asynchronous thunks', () => {
    describe('fetchItems', () => {
      it('should set status to loading when pending', () => {
        const action = { type: fetchItems.pending.type };
        const state = itemsReducer(initialState, action);
        expect(state.status).toBe('loading');
      });

      it('should set items and update pagination on fulfilled (online, first page)', () => {
        const payload = { items: [item1, item2], total: 10, hasMore: true };
        const action = { type: fetchItems.fulfilled.type, payload };
        const state = itemsReducer({ ...initialState, currentPage: 0 }, action);
        
        expect(state.status).toBe('succeeded');
        expect(state.ids.length).toBe(2);
        expect(state.totalItems).toBe(10);
        expect(state.hasMore).toBe(true);
        expect(state.currentPage).toBe(1);
      });
      
      it('should add items on fulfilled (online, subsequent page)', () => {
        let state = itemsReducer(initialState, { type: fetchItems.fulfilled.type, payload: { items: [item1], total: 10, hasMore: true } });
        
        const payload = { items: [item2], total: 10, hasMore: true };
        const action = { type: fetchItems.fulfilled.type, payload };
        state = itemsReducer(state, action);

        expect(state.ids.length).toBe(2);
        expect(state.currentPage).toBe(2);
      });

      it('should set status to failed and store error on rejected', () => {
        const error = { message: 'Fetch failed' };
        const action = { type: fetchItems.rejected.type, payload: error };
        const state = itemsReducer(initialState, action);
        expect(state.status).toBe('failed');
        expect(state.error).toBe('Fetch failed');
      });
    });

    describe('CRUD thunks', () => {
      it('should add an item with createItem.fulfilled', () => {
        const action = { type: createItem.fulfilled.type, payload: item1 };
        const state = itemsReducer(initialState, action);
        expect(state.entities[1]).toEqual(item1);
        expect(state.ids.length).toBe(1);
      });

      it('should update an item with updateItemThunk.fulfilled', () => {
        let state = itemsReducer(initialState, setItems([item1]));
        const updatedItem = { ...item1, name: 'Updated Name' };
        const action = { type: updateItemThunk.fulfilled.type, payload: updatedItem };
        state = itemsReducer(state, action);
        expect(state.entities[1]?.name).toBe('Updated Name');
      });

      it('should remove an item with deleteItem.fulfilled', () => {
        let state = itemsReducer(initialState, setItems([item1, item2]));
        const action = { type: deleteItem.fulfilled.type, meta: { arg: item1.id } };
        state = itemsReducer(state, action);
        expect(state.entities[1]).toBeUndefined();
        expect(state.ids.length).toBe(1);
      });
    });
  });
});
