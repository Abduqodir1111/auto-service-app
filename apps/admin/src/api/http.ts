import axios from 'axios';

export const AUTH_STORAGE_KEY = 'stomvp-admin-auth';

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

http.interceptors.request.use((config) => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (raw) {
    const { accessToken } = JSON.parse(raw) as { accessToken?: string };

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  return config;
});
