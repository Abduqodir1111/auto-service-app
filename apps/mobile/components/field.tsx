import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { colors } from '../src/constants/theme';

type Props = TextInputProps & {
  label: string;
  error?: string;
  multiline?: boolean;
  /** Optional Ionicons name rendered as a soft prefix inside the input. */
  icon?: keyof typeof Ionicons.glyphMap;
};

export function Field({ label, error, multiline, icon, ...props }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null, multiline && styles.multilineRow]}>
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.muted} style={styles.icon} />
        ) : null}
        <TextInput
          multiline={multiline}
          placeholderTextColor={colors.muted}
          style={[styles.input, multiline && styles.multiline]}
          {...props}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  multilineRow: {
    alignItems: 'flex-start',
    paddingTop: 12,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginLeft: 4,
  },
});
