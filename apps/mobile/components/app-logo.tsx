import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../src/constants/theme';

type AppLogoProps = {
  compact?: boolean;
  /** Show only the badge icon, centered. Used on the auth screen where the
   *  badge plays the role of the app icon and the text moves to the bottom. */
  iconOnly?: boolean;
};

export function AppLogo({ compact = false, iconOnly = false }: AppLogoProps) {
  if (iconOnly) {
    return (
      <View style={styles.iconOnlyWrap}>
        <View style={styles.badgeLarge}>
          <View style={styles.badgeGlowLarge} />
          <View style={styles.badgeCoreLarge}>
            <Ionicons name="car-sport" size={44} color="#FFFFFF" />
            <View style={styles.pinBubbleLarge}>
              <Ionicons name="location" size={20} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.badge, compact && styles.badgeCompact]}>
        <View style={styles.badgeGlow} />
        <View style={styles.badgeCore}>
          <Ionicons name="car-sport" size={compact ? 20 : 26} color="#FFFFFF" />
          <View style={styles.pinBubble}>
            <Ionicons name="location" size={compact ? 12 : 14} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={[styles.brand, compact && styles.brandCompact]}>MasterTop</Text>
        <Text style={[styles.tagline, compact && styles.taglineCompact]}>
          Поиск СТО рядом
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  wrapCompact: {
    gap: 10,
  },
  badge: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: '#FFF1E7',
    borderWidth: 1,
    borderColor: '#F1D1BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCompact: {
    width: 60,
    height: 60,
    borderRadius: 22,
  },
  badgeGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 26,
    backgroundColor: 'rgba(216, 104, 42, 0.08)',
  },
  badgeCore: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBubble: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#FFF8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 2,
  },
  brand: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.text,
  },
  brandCompact: {
    fontSize: 19,
  },
  tagline: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },
  taglineCompact: {
    fontSize: 12,
  },
  // ── icon-only mode (auth screen hero) ──────────────────────────────
  iconOnlyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLarge: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: '#FFF1E7',
    borderWidth: 1,
    borderColor: '#F1D1BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlowLarge: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: 'rgba(216, 104, 42, 0.08)',
  },
  badgeCoreLarge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBubbleLarge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: '#FFF8F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
