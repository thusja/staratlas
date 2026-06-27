import {
  Observer,
  Equator,
  Horizon,
  Body,
  AstroTime,
} from 'astronomy-engine';
import type { Star } from '@staratlas/shared';
import type { StarPoint3D } from '../store/types';

const SPHERE_RADIUS = 100;

/**
 * 적경/적위 → 지평좌표 → 3D XYZ 변환
 * altitude < 0 (지평선 아래)는 null 반환
 *
 * astronomy-engine 사용법:
 *  - Equator(): 적도좌표계 (ra/dec) 객체 반환
 *  - Horizon(): 적도좌표 → 지평좌표(azimuth, altitude) 변환
 */
export function starToPoint3D(
  star: Star,
  lat: number,
  lng: number,
  date: Date,
): StarPoint3D | null {
  const observer = new Observer(lat, lng, 0);
  const time = new AstroTime(date);

  // 적경(ra)은 도 단위로 저장되어 있으므로 시각(hour) 단위로 변환
  const raHours = star.ra / 15;

  // 지평좌표 변환 (ofdate=true: 현재 시각 기준 세차 보정 적용)
  const hor = Horizon(time, observer, raHours, star.dec, 'normal');

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
