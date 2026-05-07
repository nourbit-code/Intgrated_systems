import { Pressable, StyleSheet, Text } from 'react-native';

import { Card } from './Card';
import { theme } from '@/constants/theme';

type ReportCardProps = {
  title: string;
  description: string;
  onPress?: () => void;
};

export function ReportCard({ title, description, onPress }: ReportCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      <Card style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minWidth: 160,
    flex: 1,
  },
  card: {
    gap: theme.spacing.xs,
  },
  title: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  description: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
});
