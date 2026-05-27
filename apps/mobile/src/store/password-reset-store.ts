import { create } from 'zustand';

type PasswordResetState = {
  phone: string | null;
  verificationToken: string | null;
  setPhone: (phone: string) => void;
  setVerificationToken: (verificationToken: string) => void;
  clear: () => void;
};

export const usePasswordResetStore = create<PasswordResetState>((set) => ({
  phone: null,
  verificationToken: null,
  setPhone(phone) {
    set({ phone, verificationToken: null });
  },
  setVerificationToken(verificationToken) {
    set({ verificationToken });
  },
  clear() {
    set({ phone: null, verificationToken: null });
  },
}));
