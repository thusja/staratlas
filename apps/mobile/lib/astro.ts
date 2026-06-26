import * as Astronomy from 'astronomy-engine';
import type { Star } from '@staratlas/shared';
import type { StarPoint3D } from '../store/types';

const SPHERE_RADIUS = 100;

/**
 * 적경/적위 → 지평좌표 → 3D XYZ 변환
 * altitude < 0 (지평선 아래)는 null 반환
 */
export function starToPoint3D(
  star: Star,
  lat: number,
  lng: number,
  date: Date,
): StarPoint3D | null {
  const observer = new Astronomy.Observer(lat, lng, 0);
  const equ = new Astronomy.EquatorialCoordinates(star.ra / 15, star.dec); // RA는 시각(hour) 단위
  const hor = Astronomy.HorizonFromVector(
    Astronomy.VectorFromEquatorial(equ, date),
    observer,
  );

  if (hor.altitude < 0) return null; // 지평선 아래

  const altRad = (hor.altitude * Math.PI) / 180;
  const azRad = (hor.azimuth * Math.PI) / 180;

  return {
    hipId: star.hipId,
    x: SPHERE_RADIUS * Math.cos(altRad) * Math.sin(azRad),
    y: SPHERE_RADIUS * Math.sin(altRad),
    z: SPHERE_RADIUS * Math.cos(altRad) * Math.cos(azRad),
    magnitude: star.magnitude,
    name: star.name,
  };
}

/**
 * 별 등급 → 렌더 크기 (magnitude가 낮을수록 밝고 크게)
 */
export function magnitudeToSize(magnitude: number): number {
  if (magnitude < 1) return 4;
  if (magnitude < 3) return 2.5;
  return 1.5;
}

/**
 * 별 등급 → 불투명도
 */
export function magnitudeToOpacity(magnitude: number): number {
  if (magnitude < 1) return 1.0;
  if (magnitude < 3) return 0.85;
  return 0.6;
}
