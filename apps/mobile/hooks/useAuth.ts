import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import type { AuthResponse } from '@staratlas/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function postAuth(path: string, body: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json() as AuthResponse & { message?: string };
  if (!res.ok) throw new Error(data.message ?? '요청에 실패했습니다.');
  return data;
}

export function useLoginMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (vars: { email: string; password: string }) => postAuth('login', vars),
    onSuccess:  (data) => setAuth(data.token, data.user),
  });
}

export function useRegisterMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (vars: { email: string; password: string }) => postAuth('register', vars),
    onSuccess:  (data) => setAuth(data.token, data.user),
  });
}
