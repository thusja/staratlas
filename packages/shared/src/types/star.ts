export type Star = {
  hipId: number;
  ra: number;      // 적경 (도, 0~360)
  dec: number;     // 적위 (도, -90~90)
  magnitude: number;
  name: string | null;
};

export type StarsResponse = {
  stars: Star[];
  total: number;
  magnitudeMax: number;
};

export type ErrorResponse = {
  error: string;
  message: string;
};
