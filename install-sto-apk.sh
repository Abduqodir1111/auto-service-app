#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
APK_DIR="$ANDROID_DIR/app/build/outputs/apk/release"
APK_PATH="$APK_DIR/app-release.apk"
PACKAGE_NAME="uz.nedvigagregat.mastertop"

echo "== MasterTop APK build and install =="
echo "Project: $ROOT_DIR"

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "Android project was not found: $ANDROID_DIR"
  exit 1
fi

ADB_BIN="${ADB:-}"
if [[ -z "$ADB_BIN" ]]; then
  if command -v adb >/dev/null 2>&1; then
    ADB_BIN="$(command -v adb)"
  elif [[ -n "${ANDROID_HOME:-}" && -x "$ANDROID_HOME/platform-tools/adb" ]]; then
    ADB_BIN="$ANDROID_HOME/platform-tools/adb"
  elif [[ -n "${ANDROID_SDK_ROOT:-}" && -x "$ANDROID_SDK_ROOT/platform-tools/adb" ]]; then
    ADB_BIN="$ANDROID_SDK_ROOT/platform-tools/adb"
  elif [[ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]]; then
    ADB_BIN="$HOME/Library/Android/sdk/platform-tools/adb"
  else
    echo "adb was not found. Install Android Platform Tools or set ADB=/path/to/adb."
    exit 1
  fi
fi

if [[ "$ADB_BIN" != */* ]]; then
  ADB_BIN="$(command -v "$ADB_BIN" 2>/dev/null || true)"
fi

if [[ -z "$ADB_BIN" || ! -x "$ADB_BIN" ]]; then
  echo "adb is not executable. Set ADB=/path/to/adb or install Android Platform Tools."
  exit 1
fi

echo "ADB: $ADB_BIN"
"$ADB_BIN" start-server >/dev/null

DEVICE_LIST="$("$ADB_BIN" devices | awk 'NR > 1 && $2 == "device" { print $1 }')"
if [[ -z "$DEVICE_LIST" ]]; then
  echo "No authorized Android device found."
  echo "Connect the phone by USB, enable USB debugging, and approve the RSA prompt."
  echo
  "$ADB_BIN" devices
  exit 1
fi

devices=("${(@f)DEVICE_LIST}")
physical_devices=()
for serial in "${devices[@]}"; do
  if [[ "$serial" != emulator-* ]]; then
    physical_devices+=("$serial")
  fi
done

target_devices=("${physical_devices[@]}")
if (( ${#target_devices[@]} == 0 )); then
  target_devices=("${devices[@]}")
fi

echo "Target device(s): ${target_devices[*]}"

echo "Building shared package..."
cd "$ROOT_DIR"
npm run build -w @stomvp/shared

echo "Building release APK..."
cd "$ANDROID_DIR"
./gradlew --no-daemon :app:assembleRelease

if [[ ! -f "$APK_PATH" ]]; then
  echo "Release APK was not found in $APK_DIR"
  exit 1
fi

echo "APK: $APK_PATH"

for serial in "${target_devices[@]}"; do
  echo "Installing on $serial..."
  install_output="$("$ADB_BIN" -s "$serial" install -r -d "$APK_PATH" 2>&1)" || {
    echo "$install_output"
    if [[ "$install_output" == *"INSTALL_FAILED_UPDATE_INCOMPATIBLE"* || "$install_output" == *"signatures do not match"* ]]; then
      echo
      echo "The phone already has $PACKAGE_NAME installed with a different signature."
      echo "Uninstall the old app from the phone, then run this script again."
    fi
    exit 1
  }
  echo "$install_output"
done

echo "Done. MasterTop APK is installed."
echo "If you still see two MasterTop icons, uninstall the old package once from the phone."
