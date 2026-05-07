import { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { Card } from './Card';
import { theme } from '@/constants/theme';

type TableCardProps = PropsWithChildren<{}>;

export function TableCard({ children }: TableCardProps) {
  return <Card style={styles.card}>{children}</Card>;
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
});
