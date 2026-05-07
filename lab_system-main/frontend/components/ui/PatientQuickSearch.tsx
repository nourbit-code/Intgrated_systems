import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { Card } from './Card';
import { SearchInput } from './SearchInput';

export function PatientQuickSearch() {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Quick Patient Search</Text>
      <SearchInput placeholder="Search by name or ID" />
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
});
