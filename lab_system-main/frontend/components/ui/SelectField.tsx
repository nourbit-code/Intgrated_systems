import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type SelectFieldProps = {
  label: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
};

export function SelectField({ label, value, placeholder, onPress }: SelectFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.select} onPress={onPress}>
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ?? placeholder ?? 'Select'}
        </Text>
      </Pressable>
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
  select: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  value: {
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.ink,
  },
  placeholder: {
    color: theme.colors.slate,
  },
});
