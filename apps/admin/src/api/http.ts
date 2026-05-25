import { AuthPayload } from '@stomvp/shared';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const AUTH_STORAGE_KEY = 'stomvp-admin-auth';
export const AUTH_CHANGED_EVENT = 'stomvp-admin-auth-changed';

const productionApiUrl = 'https://api.nedvigagregat.uz/api';

function getDefaultApiUrl() {
  if (typeof window === 'undefined') {
    return productionApiUrl;
  }

  const { hostname } = window.location;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return productionApiUrl;
  }

  if (
    hostname === 'admin.nedvigagregat.uz' ||
    hostname === 'nedvigagregat.uz' ||
    hostname === 'www.nedvigagregat.uz'
  ) {
    return productionApiUrl;
  }

  return `${window.location.protocol}//${hostname}/api`;
}

export const http = axios.create({
  baseURL: getDefaultApiUrl(),
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<AuthPayload> | null = null;

function readStoredAuth() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  const auth = raw ? (JSON.parse(raw) as Partial<AuthPayload>) : null;

  if (auth && (!auth.accessToken || !auth.refreshToken || !auth.user)) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }

  return auth ? (auth as AuthPayload) : null;
}

function writeStoredAuth(auth: AuthPayload) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

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

async function refreshAuthSession(refreshToken: string) {
  const { data } = await axios.post<AuthPayload>(`${http.defaults.baseURL}/auth/refresh`, {
    refreshToken,
  });

  writeStoredAuth(data);
  return data;
}

http.interceptors.request.use((config) => {
  const auth = readStoredAuth();

  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  return config;
});

http.interceptors.response.use(
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

    const auth = readStoredAuth();
    if (!auth?.refreshToken) {
      clearStoredAuth();
      throw error;
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= refreshAuthSession(auth.refreshToken).finally(() => {
        refreshPromise = null;
      });
      const nextAuth = await refreshPromise;
      originalRequest.headers = originalRequest.headers ?? {};
      (originalRequest.headers as Record<string, string>).Authorization =
        `Bearer ${nextAuth.accessToken}`;
      return http(originalRequest);
    } catch (refreshError) {
      clearStoredAuth();
      throw refreshError;
    }
  },
);
