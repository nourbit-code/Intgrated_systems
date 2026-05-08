import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme';

export function InputField({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.colors.inkFaded}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: 12,
    width: '100%',
  },
  label: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    flexWrap: 'wrap',
    maxWidth: '100%',
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
    color: theme.colors.ink,
    backgroundColor: theme.colors.white,
    fontFamily: theme.fonts.body,
    width: '100%',
  },
});
