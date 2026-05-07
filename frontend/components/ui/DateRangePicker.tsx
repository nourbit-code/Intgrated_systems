import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { DatePicker } from './DatePicker';

export function DateRangePicker() {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Date Range</Text>
      <View style={styles.row}>
        <DatePicker label="From" />
        <DatePicker label="To" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.sm,
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
});
