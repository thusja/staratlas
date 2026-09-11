import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import type {
  Constellation,
  CreateConstellationRequest,
  UpdateConstellationRequest,
  ConstellationsResponse,
  ConstellationResponse,
} from '@staratlas/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const SESSION_EXPIRED_MESSAGE = '세션이 만료되었습니다. 다시 로그인해 주세요.';
let isRedirectingToAuth = false;

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseErrorMessage(res: Response): Promise<string | null> {
  try {
    const json = await res.json() as { message?: string };
    return json.message ?? null;
  } catch {
    return null;
  }
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return await res.json() as T;
  } catch {
    return null;
  }
}

async function handleUnauthorized(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  await useAuthStore.getState().clearAuth();

  // 여러 쿼리/뮤테이션이 동시에 401을 받는 경우 중복 라우팅을 막는다.
  if (!isRedirectingToAuth) {
    isRedirectingToAuth = true;
    router.replace('/auth?redirect=%2Fconstellations');
    setTimeout(() => {
      isRedirectingToAuth = false;
    }, 500);
  }

  return true;
}

export function useConstellations() {
  const token = useAuthStore((s) => s.token);

  return useQuery<Constellation[]>({
    queryKey: ['constellations'],
    queryFn:  async () => {
      const res = await fetch(`${API_BASE}/api/constellations`, { headers: authHeaders(token!) });
      if (await handleUnauthorized(res)) throw new Error(SESSION_EXPIRED_MESSAGE);
      const data = await parseJsonSafe<ConstellationsResponse & { message?: string }>(res);
      if (!res.ok) throw new Error(data?.message ?? '목록 조회 실패');
      if (!data) throw new Error('목록 조회 실패');
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
      const res = await fetch(`${API_BASE}/api/constellations/${id}`, { headers: authHeaders(token!) });
      if (await handleUnauthorized(res)) throw new Error(SESSION_EXPIRED_MESSAGE);
      const data = await parseJsonSafe<ConstellationResponse & { message?: string }>(res);
      if (!res.ok) throw new Error(data?.message ?? '조회 실패');
      if (!data) throw new Error('조회 실패');
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
      const res = await fetch(`${API_BASE}/api/constellations`, {
        method:  'POST',
        headers: authHeaders(token!),
        body:    JSON.stringify(body),
      });
      if (await handleUnauthorized(res)) throw new Error(SESSION_EXPIRED_MESSAGE);
      const data = await parseJsonSafe<ConstellationResponse & { message?: string }>(res);
      if (!res.ok) throw new Error(data?.message ?? '저장 실패');
      if (!data) throw new Error('저장 실패');
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
      if (await handleUnauthorized(res)) throw new Error(SESSION_EXPIRED_MESSAGE);
      if (!res.ok) throw new Error((await parseErrorMessage(res)) ?? '삭제 실패');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['constellations'] }),
  });
}

export function useUpdateConstellation() {
  const token       = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { id: number; body: UpdateConstellationRequest }) => {
      const res = await fetch(`${API_BASE}/api/constellations/${vars.id}`, {
        method:  'PATCH',
        headers: authHeaders(token!),
        body:    JSON.stringify(vars.body),
      });
      if (await handleUnauthorized(res)) throw new Error(SESSION_EXPIRED_MESSAGE);
      const data = await parseJsonSafe<ConstellationResponse & { message?: string }>(res);
      if (!res.ok) throw new Error(data?.message ?? '수정 실패');
      if (!data) throw new Error('수정 실패');
      return data.constellation;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['constellations'] });
      queryClient.setQueryData(['constellation', updated.id], updated);
    },
  });
}
