import { StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '@/constants/theme';

type TextAreaProps = {
  label: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
};

export function TextArea({ label, placeholder, value, onChangeText, editable = true }: TextAreaProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.colors.slate}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        style={styles.input}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  label: {
    fontFamily: theme.font.body,
    color: theme.colors.ink,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.ink,
    minHeight: 120,
  },
});
