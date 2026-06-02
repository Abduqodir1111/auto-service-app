import { create } from 'zustand';

type NetworkState = {
  isOffline: boolean;
  lastOfflineAt: number | null;
  markOffline: () => void;
  markOnline: () => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
  isOffline: false,
  lastOfflineAt: null,
  markOffline: () => set({ isOffline: true, lastOfflineAt: Date.now() }),
  markOnline: () => set({ isOffline: false }),
}));
