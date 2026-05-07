import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/constants/theme';

type ReportsGridProps = PropsWithChildren<{}>;

export function ReportsGrid({ children }: ReportsGridProps) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
});
