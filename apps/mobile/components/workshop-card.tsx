import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { WorkshopSummary } from '@stomvp/shared';
import { getCategoryIcon } from '../src/constants/category-meta';
import { colors } from '../src/constants/theme';
import { clamp, useResponsive } from '../src/utils/responsive';

type Props = {
  workshop: WorkshopSummary;
  favoriteAction?: {
    label: string;
    onPress: () => void;
    isDanger?: boolean;
    disabled?: boolean;
  };
};

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} м`;
  }
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} км` : `${Math.round(km)} км`;
}

export function WorkshopCard({ workshop, favoriteAction }: Props) {
  const layout = useResponsive();
  const coverPhoto = workshop.photos.find((photo) => photo.isPrimary) ?? workshop.photos[0];
  const hasCoordinates = workshop.latitude != null && workshop.longitude != null;
  const compact = layout.isSmallPhone;
  const coverHeight = clamp(layout.contentWidth * (compact ? 0.52 : 0.5), compact ? 148 : 170, layout.isTablet ? 260 : 210);
  const actionSize = compact ? 38 : 40;
  const iconSize = compact ? 16 : 18;

  return (
    <Pressable
      onPress={() => router.push(`/workshop/${workshop.id}`)}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: compact ? 22 : 28,
          padding: compact ? 12 : 14,
          gap: compact ? 12 : 14,
        },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.cover, { height: coverHeight, borderRadius: compact ? 18 : 22 }]}>
        {coverPhoto ? (
          <Image source={{ uri: coverPhoto.url }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="car-sport-outline" size={compact ? 30 : 34} color={colors.accentDark} />
            <Text style={styles.coverPlaceholderText}>Фото объявления</Text>
          </View>
        )}

        <View
          style={[
            styles.ratingBadge,
            {
              top: compact ? 10 : 12,
              right: compact ? 10 : 12,
              minWidth: compact ? 52 : 58,
              paddingHorizontal: compact ? 10 : 12,
              paddingVertical: compact ? 8 : 10,
            },
          ]}
        >
          <Text style={[styles.ratingText, { fontSize: layout.font(18, 0.25, 16, 19) }]}>
            {workshop.averageRating.toFixed(1)}
          </Text>
        </View>
      </View>

      <View style={[styles.header, { gap: compact ? 8 : 12 }]}>
        <View style={styles.titleWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { fontSize: layout.font(18, 0.25, 16, 19) }]}>
              {workshop.title}
            </Text>
            {workshop.isVerifiedMaster ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
                <Text style={styles.verifiedBadgeText}>Проверен</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle}>
            {workshop.city} • {workshop.addressLine}
            {typeof workshop.distanceMeters === 'number'
              ? ` • ${formatDistance(workshop.distanceMeters)}`
              : ''}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {hasCoordinates ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                router.push({
                  pathname: '/map/view',
                  params: {
                    latitude: String(workshop.latitude),
                    longitude: String(workshop.longitude),
                    title: workshop.title,
                    address: `${workshop.city}, ${workshop.addressLine}`,
                  },
                });
              }}
              style={[
                styles.locationButton,
                { width: actionSize, height: actionSize, borderRadius: compact ? 13 : 14 },
              ]}
            >
              <Ionicons name="location-outline" size={iconSize} color={colors.accentDark} />
            </Pressable>
          ) : null}

          {favoriteAction ? (
            <Pressable
              disabled={favoriteAction.disabled}
              onPress={(event) => {
                event.stopPropagation();
                favoriteAction.onPress();
              }}
              style={({ pressed }) => [
                styles.favoriteButton,
                {
                  height: actionSize,
                  paddingHorizontal: compact ? 10 : 12,
                  borderRadius: compact ? 13 : 14,
                  gap: compact ? 5 : 6,
                },
                favoriteAction.isDanger && styles.favoriteButtonDanger,
                pressed && styles.buttonPressed,
                favoriteAction.disabled && styles.favoriteButtonDisabled,
              ]}
            >
              <Ionicons
                name={favoriteAction.isDanger ? 'heart' : 'heart-outline'}
                size={iconSize}
                color={favoriteAction.isDanger ? '#FFFFFF' : colors.accentDark}
              />
              <Text
                style={[
                  styles.favoriteButtonText,
                  { fontSize: layout.font(12, 0.2, 11, 13) },
                  favoriteAction.isDanger && styles.favoriteButtonTextDanger,
                ]}
              >
                {favoriteAction.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text
        numberOfLines={2}
        style={[styles.description, { fontSize: layout.font(14, 0.2, 13, 15) }]}
      >
        {workshop.description}
      </Text>

      <View style={styles.chips}>
        {workshop.categories.slice(0, 3).map((category) => (
          <View
            key={category.id}
            style={[
              styles.chip,
              {
                paddingHorizontal: compact ? 8 : 10,
                paddingVertical: compact ? 5 : 6,
                gap: compact ? 5 : 6,
              },
            ]}
          >
            <Ionicons
              name={getCategoryIcon(category.slug)}
              size={compact ? 12 : 13}
              color={colors.success}
            />
            <Text style={[styles.chipText, { fontSize: layout.font(12, 0.2, 11, 13) }]}>
              {category.name}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.meta}>
        {workshop.reviewsCount} отзывов • {workshop.favoritesCount} в избранном
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.94,
  },
  cover: {
    height: 188,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFF1E7',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF1E7',
  },
  coverPlaceholderText: {
    color: colors.accentDark,
    fontWeight: '700',
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 253, 249, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ratingText: {
    color: colors.accentDark,
    fontWeight: '800',
    fontSize: 18,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  verifiedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    marginTop: 4,
    lineHeight: 19,
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFF0E5',
    borderWidth: 1,
    borderColor: '#F1D1BC',
  },
  favoriteButtonDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  favoriteButtonDisabled: {
    opacity: 0.55,
  },
  favoriteButtonText: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteButtonTextDanger: {
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.92,
  },
  description: {
    color: colors.text,
    lineHeight: 21,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EAF4F1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
});
