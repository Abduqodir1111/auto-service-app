import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

type DeviceLocationResult = {
  coordinates: Coordinates | null;
  permissionDenied: boolean;
};

function isIosSimulatorSanFrancisco(location: Coordinates) {
  return (
    Platform.OS === 'ios' &&
    Constants.isDevice === false &&
    location.latitude > 37 &&
    location.latitude < 38.5 &&
    location.longitude > -123 &&
    location.longitude < -121
  );
}

function normalizeDeviceLocation(location: Coordinates, fallback: Coordinates) {
  if (isIosSimulatorSanFrancisco(location)) {
    return fallback;
  }

  return location;
}

function toCoordinates(location: Location.LocationObject, fallback: Coordinates) {
  return normalizeDeviceLocation(
    {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    },
    fallback,
  );
}

export async function getDeviceCoordinates(
  fallback: Coordinates,
): Promise<DeviceLocationResult> {
  let permission = await Location.getForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return {
      coordinates: null,
      permissionDenied: true,
    };
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 5 * 60 * 1000,
    requiredAccuracy: 3000,
  });

  if (lastKnown) {
    return {
      coordinates: toCoordinates(lastKnown, fallback),
      permissionDenied: false,
    };
  }

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    coordinates: toCoordinates(current, fallback),
    permissionDenied: false,
  };
}
