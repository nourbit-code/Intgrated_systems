import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type PaginationProps = {
  current: number;
  total: number;
  onNext?: () => void;
  onPrev?: () => void;
};

export function Pagination({ current, total, onNext, onPrev }: PaginationProps) {
  return (
    <View style={styles.wrapper}>
      <Pressable onPress={onPrev} style={styles.button}>
        <Text style={styles.label}>Prev</Text>
      </Pressable>
      <Text style={styles.meta}>{current} / {total}</Text>
      <Pressable onPress={onNext} style={styles.button}>
        <Text style={styles.label}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  button: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
});
