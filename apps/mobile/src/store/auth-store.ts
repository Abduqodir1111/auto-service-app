import { AuthPayload } from '@stomvp/shared';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const STORAGE_KEY = 'stomvp-mobile-auth';

export type StoredAuthSession = Omit<AuthPayload, 'refreshToken'> & {
  refreshToken?: string;
};

type AuthState = {
  hydrated: boolean;
  session: StoredAuthSession | null;
  hydrate: () => Promise<void>;
  setSession: (session: StoredAuthSession | null) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  session: null,
  async hydrate() {
    let raw: string | null = null;
    let session: Partial<StoredAuthSession> | null = null;

    try {
      raw = await SecureStore.getItemAsync(STORAGE_KEY);
      session = raw ? (JSON.parse(raw) as Partial<StoredAuthSession>) : null;
    } catch {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      set({ hydrated: true, session: null });
      return;
    }

    if (session && (!session.accessToken || !session.user)) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      set({ hydrated: true, session: null });
      return;
    }

    set({
      hydrated: true,
      session: session ? (session as StoredAuthSession) : null,
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
