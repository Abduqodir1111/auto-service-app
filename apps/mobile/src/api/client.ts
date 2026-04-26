import axios from 'axios';
import { useAuthStore } from '../store/auth-store';

const productionApiUrl = 'https://api.nedvigagregat.uz/api';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const api = axios.create({
  baseURL: configuredApiUrl ? configuredApiUrl : productionApiUrl,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().session?.accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
