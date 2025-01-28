import { create } from 'zustand';

interface RefreshStore {
  refreshTimestamp: number;
  triggerRefresh: () => void;
}

export const useRefreshStore = create<RefreshStore>((set) => ({
  refreshTimestamp: Date.now(),
  triggerRefresh: () => set({ refreshTimestamp: Date.now() }),
}));