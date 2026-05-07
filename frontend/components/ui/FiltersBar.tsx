import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/constants/theme';

type FiltersBarProps = PropsWithChildren<{}>;

export function FiltersBar({ children }: FiltersBarProps) {
  return <View style={styles.bar}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
});
