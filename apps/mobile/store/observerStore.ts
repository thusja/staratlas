import { create } from 'zustand';
import type { ObserverState } from './types';

export const useObserverStore = create<ObserverState>((set) => ({
  lat: null,
  lng: null,
  timestamp: null,
  setObserver: (lat, lng, timestamp) => set({ lat, lng, timestamp }),
  reset: () => set({ lat: null, lng: null, timestamp: null }),
}));
