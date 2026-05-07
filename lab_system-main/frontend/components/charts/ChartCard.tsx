import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { Card } from '../ui/Card';

type ChartCardProps = {
  title: string;
  subtitle?: string;
};

export function ChartCard({ title, subtitle }: ChartCardProps) {
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.placeholder} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  placeholder: {
    marginTop: theme.spacing.lg,
    height: 140,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSoft,
  },
});
