import { Stack } from 'expo-router';
import { AuthUser } from '@stomvp/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { api } from '../src/api/client';
import { colors } from '../src/constants/theme';
import { useAuthStore } from '../src/store/auth-store';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const accessToken = session?.accessToken;

    if (!hydrated || !accessToken) {
      return;
    }

    let cancelled = false;

    void api
      .get<AuthUser>('/auth/me')
      .then(async ({ data }) => {
        if (cancelled) {
          return;
        }

        const latestSession = useAuthStore.getState().session;
        if (!latestSession || latestSession.accessToken !== accessToken) {
          return;
        }

        const needsUpdate =
          latestSession.user.id !== data.id ||
          latestSession.user.fullName !== data.fullName ||
          latestSession.user.phone !== data.phone ||
          latestSession.user.email !== data.email ||
          latestSession.user.role !== data.role ||
          latestSession.user.isBlocked !== data.isBlocked ||
          latestSession.user.createdAt !== data.createdAt;

        if (needsUpdate) {
          await setSession({
            ...latestSession,
            user: data,
          });
        }
      })
      .catch(() => {
        return;
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.accessToken, setSession]);

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: colors.text,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-up-verify" options={{ headerShown: false }} />
        <Stack.Screen name="workshop/[id]" options={{ title: 'Карточка СТО' }} />
        <Stack.Screen name="map/picker" options={{ title: 'Точка на карте' }} />
        <Stack.Screen name="map/view" options={{ title: 'Локация СТО' }} />
        <Stack.Screen name="requests/create" options={{ title: 'Новая заявка' }} />
        <Stack.Screen name="master/workshop" options={{ title: 'Объявление мастера' }} />
      </Stack>
    </QueryClientProvider>
  );
}
