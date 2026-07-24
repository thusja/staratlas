import { create } from 'zustand';
import type { StarPoint3D } from './types';

type DraftConstellationState = {
  stars: StarPoint3D[];
  addStar:    (star: StarPoint3D) => void;
  removeStar: (hipId: number)     => void;
  clear:      () => void;
};

export const useDraftConstellationStore = create<DraftConstellationState>((set) => ({
  stars: [],

  addStar: (star) =>
    set((s) => {
      if (s.stars.some((x) => x.hipId === star.hipId)) return s;
      return { stars: [...s.stars, star] };
    }),

  removeStar: (hipId) =>
    set((s) => ({ stars: s.stars.filter((x) => x.hipId !== hipId) })),

  clear: () => set({ stars: [] }),
}));
