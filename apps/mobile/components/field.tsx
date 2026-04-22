import { Text, TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { colors } from '../src/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  multiline?: boolean;
};

export function Field({ label, error, multiline, ...props }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.multiline]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
});
