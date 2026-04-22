import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../src/constants/theme';
import { useAuthStore } from '../src/store/auth-store';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
        <Stack.Screen name="workshop/[id]" options={{ title: 'Карточка СТО' }} />
        <Stack.Screen name="map/picker" options={{ title: 'Точка на карте' }} />
        <Stack.Screen name="map/view" options={{ title: 'Локация СТО' }} />
        <Stack.Screen name="requests/create" options={{ title: 'Новая заявка' }} />
        <Stack.Screen name="master/workshop" options={{ title: 'Объявление мастера' }} />
      </Stack>
    </QueryClientProvider>
  );
}
