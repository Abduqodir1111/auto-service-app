import { PropsWithChildren, ReactNode } from 'react';
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
  footer?: ReactNode;
}>;

export function Screen({ children, scroll = true, style, edges, refreshing, onRefresh, footer }: Props) {
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
      style={styles.scroller}
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
        <View style={styles.body}>
          {content}
          {footer ? (
            <View
              style={[
                styles.footer,
                {
                  paddingHorizontal: layout.gutter,
                  paddingTop: layout.isSmallPhone ? 10 : 12,
                  paddingBottom: layout.isSmallPhone ? 10 : 12,
                },
              ]}
            >
              <View style={[styles.footerInner, { maxWidth: layout.contentMaxWidth }]}>
                {footer}
              </View>
            </View>
          ) : null}
        </View>
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
  scroller: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerInner: {
    width: '100%',
    alignSelf: 'center',
  },
});
