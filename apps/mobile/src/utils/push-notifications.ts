// Push notification setup for the MasterTop mobile app.
//
// Lifecycle:
//   - On app boot we install a handler so foreground pushes are still shown.
//   - Once the user logs in we ask for permission, fetch an Expo push token,
//     and POST it to /api/devices/register. The token is also kept in
//     auth-store so we can DELETE it on logout.
//
// In Expo Go (`Constants.appOwnership === 'expo'`) push works against
// Expo's hosted experience without any APNs/FCM credentials, which is
// great for local dev. In a production standalone build (Apple / Play
// Store), Expo's push service signs through the configured APNs key and
// the FCM project tied to `google-services.json`.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../api/client';

let handlerInstalled = false;

/**
 * Install the foreground handler. Idempotent — calling twice is fine.
 * Without this, push messages received while the app is open are
 * silently swallowed.
 */
export function installNotificationHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F4934A',
  });
}

function resolveProjectId(): string | undefined {
  // EAS-generated config (apps built via eas build).
  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return easProjectId;
}

/**
 * Returns an Expo push token for this device, or null if push is not
 * available (simulator, denied permission, etc.). Safe to call on every
 * app launch; Expo returns the same token for the same install.
 */
export async function getPushTokenForDevice(): Promise<string | null> {
  await ensureAndroidChannel();

  if (!Device.isDevice) {
    // iOS Simulator / Android emulator can't receive real push.
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.status === 'granted';

  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.status === 'granted';
  }

  if (!granted) {
    return null;
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: resolveProjectId(),
    });
    return tokenResult.data;
  } catch (err) {
    // Common reasons: project not configured for push (missing APNs key
    // or google-services.json), no network, …
    console.warn('[push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

/**
 * POSTs the token to the API so the backend can later send pushes to
 * this device for the currently logged-in user. Failures are swallowed
 * and logged — push is best-effort.
 */
export async function registerPushTokenWithServer(token: string): Promise<void> {
  try {
    await api.post('/devices/register', {
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });
  } catch (err) {
    console.warn('[push] register failed:', err);
  }
}

/**
 * Removes the token from the backend (call on logout). Failures are
 * swallowed; the backend's TTL/invalid-token cleanup will reap stale
 * rows on its own anyway.
 */
export async function unregisterPushTokenFromServer(token: string): Promise<void> {
  try {
    await api.delete(`/devices/${encodeURIComponent(token)}`);
  } catch (err) {
    console.warn('[push] unregister failed:', err);
  }
}
