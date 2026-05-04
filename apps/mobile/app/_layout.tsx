import { router, Stack } from 'expo-router';
import { AuthUser, ServiceCallItem, ServiceCallStatus, UserRole } from '@stomvp/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { api } from '../src/api/client';
import { colors } from '../src/constants/theme';
import { useAuthStore } from '../src/store/auth-store';
import { track } from '../src/utils/analytics';
import {
  getPushTokenForDevice,
  installNotificationHandler,
  installNotificationResponseHandler,
  registerPushTokenWithServer,
} from '../src/utils/push-notifications';

const queryClient = new QueryClient();

// Install the foreground notification handler exactly once at module load,
// before any component mounts — so the very first push received in this
// process surfaces a banner.
installNotificationHandler();
// React to taps on pushes (e.g. master taps incoming-call → navigate).
installNotificationResponseHandler();

export default function RootLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    hydrate();
    // Fire app_opened once per process start. Anonymous if user not yet
    // signed in; track() picks up userId from auth store automatically
    // after sign-in (subsequent events in this process).
    track('app_opened');
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

  // Register this device's Expo push token with the backend whenever the
  // user is logged in. Re-runs on session change (e.g. relogin as a
  // different user) so each user gets their own tokens on the server.
  useEffect(() => {
    const accessToken = session?.accessToken;
    if (!hydrated || !accessToken) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await getPushTokenForDevice();
      if (cancelled || !token) return;
      await registerPushTokenWithServer(token);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.accessToken, session?.user?.id]);

  // Master-only: poll for any ringing service call when the app comes to
  // foreground, in case the push was missed (DND, app killed, etc.). If
  // there's a live call ringing this master, jump to the swipe screen.
  const lastSeenCallId = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !session?.accessToken || session.user.role !== UserRole.MASTER) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get<ServiceCallItem | null>('/service-calls/master/active');
        if (cancelled || !data) return;
        if (
          data.status === ServiceCallStatus.SEARCHING &&
          lastSeenCallId.current !== data.id
        ) {
          lastSeenCallId.current = data.id;
          router.push(`/master/incoming-call/${data.id}`);
        }
      } catch {
        // Silent — this is best-effort.
      }
    };
    void poll();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void poll();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [hydrated, session?.accessToken, session?.user?.id, session?.user?.role]);

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
        <Stack.Screen name="call/index" options={{ title: 'Вызвать мастера' }} />
        <Stack.Screen name="call/[id]" options={{ title: 'Вызов', headerBackVisible: false }} />
        <Stack.Screen
          name="master/incoming-call/[id]"
          options={{ title: 'Срочный вызов', headerShown: false, gestureEnabled: false }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
