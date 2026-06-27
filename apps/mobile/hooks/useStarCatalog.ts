import { useQuery } from '@tanstack/react-query';
import type { Star, StarsResponse } from '@staratlas/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const fetchStars = async (): Promise<Star[]> => {
  const res = await fetch(`${API_URL}/api/stars?magnitude_max=5`);
  if (!res.ok) throw new Error('별 카탈로그를 불러오지 못했습니다');
  const json: StarsResponse = await res.json();
  return json.stars;
};

export const useStarCatalog = (enabled = true) =>
  useQuery({
    queryKey: ['stars', { magnitudeMax: 5 }],
    queryFn: fetchStars,
    staleTime: Infinity,  // 앱 세션 동안 재요청 안 함
    gcTime: Infinity,     // 가비지 컬렉션 없음
    retry: 2,
    enabled,              // GPS 수집 전엔 fetch 안 함
  });
