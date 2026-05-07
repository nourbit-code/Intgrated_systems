import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type StockLevelBadgeProps = {
  level: 'low' | 'medium' | 'good';
};

const levelMap = {
  low: { label: 'Low', color: '#DC2626', background: '#FEE2E2' },
  medium: { label: 'Medium', color: '#B45309', background: '#FEF3C7' },
  good: { label: 'Good', color: '#059669', background: '#D1FAE5' },
};

export function StockLevelBadge({ level }: StockLevelBadgeProps) {
  const tone = levelMap[level];
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}> 
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
