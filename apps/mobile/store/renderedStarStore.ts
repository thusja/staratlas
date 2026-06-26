import { create } from 'zustand';
import type { RenderedStarState } from './types';

export const useRenderedStarStore = create<RenderedStarState>((set) => ({
  renderedStars: [],
  setRenderedStars: (stars) => set({ renderedStars: stars }),
  clear: () => set({ renderedStars: [] }),
}));
