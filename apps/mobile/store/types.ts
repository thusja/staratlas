export type ObserverState = {
  lat: number | null;
  lng: number | null;
  timestamp: number | null;
  setObserver: (lat: number, lng: number, timestamp: number) => void;
  reset: () => void;
};

export type StarPoint3D = {
  hipId: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
  name: string | null;
};

export type RenderedStarState = {
  renderedStars: StarPoint3D[];
  setRenderedStars: (stars: StarPoint3D[]) => void;
  clear: () => void;
};
