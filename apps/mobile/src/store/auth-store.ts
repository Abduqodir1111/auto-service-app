import { AuthPayload } from '@stomvp/shared';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const STORAGE_KEY = 'stomvp-mobile-auth';

type AuthState = {
  hydrated: boolean;
  session: AuthPayload | null;
  hydrate: () => Promise<void>;
  setSession: (session: AuthPayload | null) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  session: null,
  async hydrate() {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    set({
      hydrated: true,
      session: raw ? (JSON.parse(raw) as AuthPayload) : null,
    });
  },
  async setSession(session) {
    if (session) {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }

    set({ session });
  },
}));
