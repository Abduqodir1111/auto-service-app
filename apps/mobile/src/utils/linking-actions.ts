import * as Haptics from 'expo-haptics';
import { Linking, Platform } from 'react-native';

type ActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      title: string;
      message: string;
    };

function normalizeDialPhone(phone: string | null | undefined) {
  return phone?.trim().replace(/[^\d+]/g, '') ?? '';
}

export async function triggerImpact() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics are polish only; never block the action.
  }
}

export async function triggerSuccess() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics are polish only; never block the action.
  }
}

export async function triggerWarning() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Haptics are polish only; never block the action.
  }
}

export async function callPhone(phone: string | null | undefined): Promise<ActionResult> {
  const normalizedPhone = normalizeDialPhone(phone);

  if (!normalizedPhone) {
    await triggerWarning();
    return {
      ok: false,
      title: 'Номер не указан',
      message: 'У этого объявления пока нет номера телефона.',
    };
  }

  const url = `tel:${normalizedPhone}`;

  try {
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      await triggerWarning();
      return {
        ok: false,
        title: 'Не удалось открыть звонок',
        message: 'Телефон не смог открыть приложение для звонка.',
      };
    }

    await triggerImpact();
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    await triggerWarning();
    return {
      ok: false,
      title: 'Не удалось открыть звонок',
      message: 'Попробуйте набрать номер вручную.',
    };
  }
}

export async function openRoute(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  label = 'Локация СТО',
): Promise<ActionResult> {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    await triggerWarning();
    return {
      ok: false,
      title: 'Точка не указана',
      message: 'У этого объявления пока нет координат для маршрута.',
    };
  }

  const encodedLabel = encodeURIComponent(label);
  const iosUrl = `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`;
  const androidUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const primaryUrl = Platform.OS === 'ios' ? iosUrl : androidUrl;

  try {
    const canOpenPrimary = await Linking.canOpenURL(primaryUrl);
    await triggerImpact();
    await Linking.openURL(canOpenPrimary ? primaryUrl : webUrl);
    return { ok: true };
  } catch {
    await triggerWarning();
    return {
      ok: false,
      title: 'Маршрут не открылся',
      message: 'Проверьте интернет или откройте карту позже.',
    };
  }
}
