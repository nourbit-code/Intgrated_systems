import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/constants/theme';

type ExportButtonProps = {
  label?: string;
  onPress?: () => void;
};

export function ExportButton({ label = 'Export', onPress }: ExportButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.ink,
  },
});
