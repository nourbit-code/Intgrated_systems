import { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { theme } from '@/constants/theme';
import { Card } from './Card';

type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'default' | 'accent';
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'flat';
  helperText?: string;
  helperStyle?: StyleProp<TextStyle>;
};

export function StatCard({ label, value, tone = 'default', icon, trend, helperText, helperStyle }: StatCardProps) {
  return (
    <Card style={[styles.card, tone === 'accent' && styles.accent]}>
      {icon || trend ? (
        <View style={styles.topRow}>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : <View />}
          {trend ? (
            <View style={[styles.trendPill, trend === 'down' && styles.trendDown, trend === 'flat' && styles.trendFlat]}>
              <Text style={styles.trendText}>{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '■'}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {helperText ? <Text style={[styles.helper, helperStyle]}>{helperText}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
  },
  accent: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  trendDown: {
    backgroundColor: '#FEE2E2',
  },
  trendFlat: {
    backgroundColor: '#E2E8F0',
  },
  trendText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.ink,
  },
  label: {
    fontFamily: theme.font.body,
    color: theme.colors.slate,
    fontSize: 13,
  },
  value: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    color: theme.colors.ink,
    fontSize: 24,
  },
  helper: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.slate,
  },
});
