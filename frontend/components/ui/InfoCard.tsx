import { StyleSheet, Text } from 'react-native';

import { Card } from './Card';
import { theme } from '@/constants/theme';

type InfoCardProps = {
  title: string;
  value: string;
};

export function InfoCard({ title, value }: InfoCardProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.md,
  },
  title: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
});
