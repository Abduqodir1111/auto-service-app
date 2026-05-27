import { PropsWithChildren } from 'react';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../src/constants/theme';
import { useResponsive } from '../src/utils/responsive';

type Props = PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({ children, scroll = true, style, edges, refreshing, onRefresh }: Props) {
  const layout = useResponsive();
  const adaptiveContentStyle = {
    width: '100%' as const,
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center' as const,
    paddingHorizontal: layout.gutter,
    paddingVertical: layout.isSmallPhone ? 14 : layout.isTablet ? 24 : 20,
    gap: layout.isSmallPhone ? 12 : 16,
  };

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, adaptiveContentStyle, style]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
      refreshControl={
        onRefresh ? (
          <RefreshControl
            colors={[colors.accent]}
            tintColor={colors.accent}
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, adaptiveContentStyle, style]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges ?? ['top', 'right', 'bottom', 'left']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {},
});
