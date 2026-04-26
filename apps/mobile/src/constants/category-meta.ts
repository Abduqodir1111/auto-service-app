import { Ionicons } from '@expo/vector-icons';

export const categoryIconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  localization: 'language-outline',
  'chip-tuning': 'hardware-chip-outline',
  'car-audio': 'musical-notes-outline',
  'gps-tracking': 'navigate-outline',
  soundproofing: 'volume-high-outline',
  diagnostics: 'speedometer-outline',
  electrics: 'flash-outline',
  suspension: 'car-sport-outline',
  engine: 'construct-outline',
  transmission: 'settings-outline',
  brakes: 'shield-checkmark-outline',
  'tire-service': 'disc-outline',
  'wheel-alignment': 'resize-outline',
  'air-conditioning': 'snow-outline',
  'body-repair': 'hammer-outline',
  paint: 'color-fill-outline',
  'auto-glass': 'scan-outline',
  tinting: 'color-filter-outline',
  detailing: 'sparkles-outline',
  'auto-electronics-multimedia': 'phone-portrait-outline',
  'field-service': 'car-outline',
};

export function getCategoryIcon(slug: string) {
  return categoryIconMap[slug] ?? 'sparkles-outline';
}
