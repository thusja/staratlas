export type ConstellationStarItem = {
  hipId: number;
  order: number;
};

export type Constellation = {
  id: number;
  userId: number;
  name: string;
  memo: string | null;
  lat: number;
  lng: number;
  observedAt: string; // ISO 8601
  createdAt: string;
  stars: ConstellationStarItem[];
};

export type CreateConstellationRequest = {
  name: string;
  memo?: string;
  lat: number;
  lng: number;
  observedAt: string; // ISO 8601
  stars: ConstellationStarItem[];
};

export type ConstellationsResponse = {
  constellations: Constellation[];
};

export type ConstellationResponse = {
  constellation: Constellation;
};
