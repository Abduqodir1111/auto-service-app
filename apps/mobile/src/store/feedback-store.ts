import { create } from 'zustand';

export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

export type ToastMessage = {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
};

export type FeedbackActionVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type FeedbackAction = {
  label: string;
  onPress: () => void;
  variant?: FeedbackActionVariant;
};

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export type ActionSheetOptions = {
  title: string;
  message?: string;
  cancelLabel?: string;
  actions: FeedbackAction[];
};

type FeedbackState = {
  toast: ToastMessage | null;
  confirm: ConfirmOptions | null;
  actionSheet: ActionSheetOptions | null;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  hideToast: () => void;
  showConfirm: (confirm: ConfirmOptions) => void;
  hideConfirm: () => void;
  showActionSheet: (actionSheet: ActionSheetOptions) => void;
  hideActionSheet: () => void;
};

export const useFeedbackStore = create<FeedbackState>((set) => ({
  toast: null,
  confirm: null,
  actionSheet: null,
  showToast: (toast) => set({ toast: { ...toast, id: Date.now() } }),
  hideToast: () => set({ toast: null }),
  showConfirm: (confirm) => set({ confirm }),
  hideConfirm: () => set({ confirm: null }),
  showActionSheet: (actionSheet) => set({ actionSheet }),
  hideActionSheet: () => set({ actionSheet: null }),
}));

export function showToast(toast: Omit<ToastMessage, 'id'>) {
  useFeedbackStore.getState().showToast(toast);
}

export function showSuccess(title: string, message?: string) {
  showToast({ title, message, tone: 'success' });
}

export function showWarning(title: string, message?: string) {
  showToast({ title, message, tone: 'warning' });
}

export function showError(title: string, message?: string) {
  showToast({ title, message, tone: 'danger' });
}

export function showConfirm(confirm: ConfirmOptions) {
  useFeedbackStore.getState().showConfirm(confirm);
}

export function showActionSheet(actionSheet: ActionSheetOptions) {
  useFeedbackStore.getState().showActionSheet(actionSheet);
}
