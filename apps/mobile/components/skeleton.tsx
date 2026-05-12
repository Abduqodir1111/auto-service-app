import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../src/constants/theme';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/**
 * Subtle pulsing block used as a placeholder while real content loads.
 * Same width/height as the real element it stands in for, so the user
 * sees the layout immediately instead of a blank screen.
 */
export function Skeleton({ width, height, radius = 10, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.9],
  });

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

/** Skeleton stand-in for a WorkshopCard in the catalog list. */
export function WorkshopCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={188} radius={22} />
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="90%" height={14} />
        </View>
        <Skeleton width={40} height={40} radius={14} />
      </View>
      <Skeleton width="100%" height={14} />
      <Skeleton width="60%" height={14} />
      <View style={styles.chipRow}>
        <Skeleton width={80} height={26} radius={999} />
        <Skeleton width={96} height={26} radius={999} />
        <Skeleton width={72} height={26} radius={999} />
      </View>
    </View>
  );
}

/** Skeleton stand-in for the workshop detail screen. */
export function WorkshopDetailSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 10 }}>
        <Skeleton width="80%" height={26} />
        <Skeleton width="60%" height={16} />
      </View>

      <Skeleton height={220} radius={24} />

      <View style={styles.chipRow}>
        <Skeleton width={90} height={28} radius={999} />
        <Skeleton width={110} height={28} radius={999} />
        <Skeleton width={84} height={28} radius={999} />
      </View>

      <View style={{ gap: 8 }}>
        <Skeleton width="100%" height={14} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="70%" height={14} />
      </View>

      <Skeleton height={48} radius={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#E5DFD5',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
