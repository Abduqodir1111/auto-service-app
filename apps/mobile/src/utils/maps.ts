import { Linking, Platform } from 'react-native';

const DEFAULT_COORDINATES = {
  latitude: 41.311081,
  longitude: 69.240562,
};

export function getDefaultMapCoordinates() {
  return DEFAULT_COORDINATES;
}

export async function openExternalMap(
  latitude: number,
  longitude: number,
  label = 'Локация СТО',
) {
  const encodedLabel = encodeURIComponent(label);
  const iosUrl = `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`;
  const androidUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const primaryUrl = Platform.OS === 'ios' ? iosUrl : androidUrl;

  const canOpenPrimary = await Linking.canOpenURL(primaryUrl);
  return Linking.openURL(canOpenPrimary ? primaryUrl : webUrl);
}
