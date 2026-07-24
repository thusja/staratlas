import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '@staratlas/shared';

const TOKEN_KEY = 'staratlas_token';
const USER_KEY  = 'staratlas_user';

type AuthState = {
  token: string | null;
  user:  AuthUser | null;
  setAuth:   (token: string, user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadAuth:  () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user:  null,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null });
  },

  loadAuth: async () => {
    const token   = await SecureStore.getItemAsync(TOKEN_KEY);
    const userRaw = await SecureStore.getItemAsync(USER_KEY);
    if (token && userRaw) {
      set({ token, user: JSON.parse(userRaw) as AuthUser });
    }
  },
}));
