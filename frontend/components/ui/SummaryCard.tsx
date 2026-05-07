import { StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { theme } from '@/constants/theme';

type SummaryCardProps = {
  title: string;
  items: { label: string; value: string }[];
};

export function SummaryCard({ title, items }: SummaryCardProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
});
