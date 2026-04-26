import axios from 'axios';
import Constants from 'expo-constants';
import { NativeModules } from 'react-native';
import { useAuthStore } from '../store/auth-store';

const productionApiUrl = 'https://api.nedvigagregat.uz/api';

function resolveMetroHost() {
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];

  if (expoHost) {
    return expoHost;
  }

  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;

  if (!scriptUrl) {
    return undefined;
  }

  try {
    return new URL(scriptUrl).hostname;
  } catch {
    return undefined;
  }
}

function getDefaultApiUrl() {
  const metroHost = resolveMetroHost();

  if (__DEV__ && metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
    return `http://${metroHost}:3100/api`;
  }

  return productionApiUrl;
}

const defaultApiUrl = getDefaultApiUrl();

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().session?.accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
