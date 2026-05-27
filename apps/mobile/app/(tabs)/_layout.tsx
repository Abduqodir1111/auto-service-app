import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserRole } from '@stomvp/shared';
import { useAuthStore } from '../../src/store/auth-store';
import { colors } from '../../src/constants/theme';
import { useResponsive } from '../../src/utils/responsive';

export default function TabsLayout() {
  const session = useAuthStore((state) => state.session);
  const insets = useSafeAreaInsets();
  const layout = useResponsive();
  const tabBarBaseHeight = layout.isSmallPhone ? 62 : layout.isTablet ? 74 : 68;
  const tabIconSize = layout.isSmallPhone ? 19 : 20;

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: tabBarBaseHeight + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: layout.isSmallPhone ? 11 : 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Каталог',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Карта',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Избранное',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={tabIconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: session.user.role === UserRole.MASTER ? 'Клиенты' : 'Заявки',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={tabIconSize}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={tabIconSize} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
