import { UserRole } from '@stomvp/shared';
import { create } from 'zustand';

export type PendingSignUpPayload = {
  fullName: string;
  phone: string;
  password: string;
  role: UserRole;
};

type PendingSignUpState = {
  payload: PendingSignUpPayload | null;
  setPayload: (payload: PendingSignUpPayload) => void;
  clear: () => void;
};

export const usePendingSignUpStore = create<PendingSignUpState>((set) => ({
  payload: null,
  setPayload(payload) {
    set({ payload });
  },
  clear() {
    set({ payload: null });
  },
}));
