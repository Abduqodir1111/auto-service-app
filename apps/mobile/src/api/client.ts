import { AuthPayload } from '@stomvp/shared';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth-store';

const productionApiUrl = 'https://api.nedvigagregat.uz/api';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const api = axios.create({
  baseURL: configuredApiUrl ? configuredApiUrl : productionApiUrl,
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<AuthPayload> | null = null;

function shouldSkipRefresh(url?: string) {
  if (!url) {
    return false;
  }

  return [
    '/auth/login',
    '/auth/logout',
    '/auth/refresh',
    '/auth/register',
  ].some((path) => url.includes(path));
}

async function refreshSession(refreshToken: string) {
  const { data } = await axios.post<AuthPayload>(`${api.defaults.baseURL}/auth/refresh`, {
    refreshToken,
  });

  await useAuthStore.getState().setSession(data);
  return data;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().session?.accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const response = error.response;
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (
      !response ||
      !originalRequest ||
      response.status !== 401 ||
      originalRequest._retry ||
      shouldSkipRefresh(originalRequest.url)
    ) {
      throw error;
    }

    const currentSession = useAuthStore.getState().session;
    if (!currentSession?.refreshToken) {
      await useAuthStore.getState().setSession(null);
      throw error;
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= refreshSession(currentSession.refreshToken).finally(() => {
        refreshPromise = null;
      });
      const nextSession = await refreshPromise;
      originalRequest.headers = originalRequest.headers ?? {};
      (originalRequest.headers as Record<string, string>).Authorization =
        `Bearer ${nextSession.accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      await useAuthStore.getState().setSession(null);
      throw refreshError;
    }
  },
);
