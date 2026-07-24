import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import type { Constellation, CreateConstellationRequest, ConstellationsResponse, ConstellationResponse } from '@staratlas/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function useConstellations() {
  const token = useAuthStore((s) => s.token);

  return useQuery<Constellation[]>({
    queryKey: ['constellations'],
    queryFn:  async () => {
      const res  = await fetch(`${API_BASE}/api/constellations`, { headers: authHeaders(token!) });
      const data = await res.json() as ConstellationsResponse & { message?: string };
      if (!res.ok) throw new Error(data.message ?? '목록 조회 실패');
      return data.constellations;
    },
    enabled: !!token,
  });
}

export function useConstellation(id: number | null) {
  const token = useAuthStore((s) => s.token);

  return useQuery<Constellation>({
    queryKey: ['constellation', id],
    queryFn:  async () => {
      const res  = await fetch(`${API_BASE}/api/constellations/${id}`, { headers: authHeaders(token!) });
      const data = await res.json() as ConstellationResponse & { message?: string };
      if (!res.ok) throw new Error(data.message ?? '조회 실패');
      return data.constellation;
    },
    enabled: !!token && id != null,
  });
}

export function useCreateConstellation() {
  const token       = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateConstellationRequest) => {
      const res  = await fetch(`${API_BASE}/api/constellations`, {
        method:  'POST',
        headers: authHeaders(token!),
        body:    JSON.stringify(body),
      });
      const data = await res.json() as ConstellationResponse & { message?: string };
      if (!res.ok) throw new Error(data.message ?? '저장 실패');
      return data.constellation;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['constellations'] }),
  });
}

export function useDeleteConstellation() {
  const token       = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/constellations/${id}`, {
        method:  'DELETE',
        headers: authHeaders(token!),
      });
      if (!res.ok) throw new Error('삭제 실패');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['constellations'] }),
  });
}
