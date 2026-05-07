import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type StatusBadgeProps = {
  status: 'samples-waiting' | 'completed' | 'cancelled' | 'in-progress';
};

const statusMap = {
  'samples-waiting': { label: 'Samples Waiting', color: '#F59E0B', background: '#FEF3C7' },
  completed: { label: 'Completed', color: '#059669', background: '#D1FAE5' },
  cancelled: { label: 'Cancelled', color: '#DC2626', background: '#FEE2E2' },
  'in-progress': { label: 'In Progress', color: '#2563EB', background: '#DBEAFE' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = statusMap[status];
  return (
    <View
      style={[styles.badge, { backgroundColor: tone.background }]}
      accessible
      accessibilityLabel={`Status: ${tone.label}`}
    >
      <Text style={[styles.text, { color: tone.color }]}>{tone.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
