import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card } from './Card';
import { theme } from '../theme';

type Tone = 'default' | 'info' | 'warning' | 'alert';

const toneStyles: Record<Tone, { accent: ViewStyle; card: ViewStyle }> = {
  default: { accent: { backgroundColor: '#e6fbf9', borderColor: theme.colors.accentCyan }, card: {} },
  info: { accent: { backgroundColor: '#e7f1ff', borderColor: theme.colors.accent }, card: { borderColor: '#cdddf3' } },
  warning: { accent: { backgroundColor: '#fff4e6', borderColor: '#f5b971' }, card: { borderColor: '#f1d2a2' } },
  alert: { accent: { backgroundColor: '#ffe7ea', borderColor: '#e07a86' }, card: { borderColor: '#e7b0b6' } },
};

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  variant?: 'white' | 'soft' | 'alt' | 'default';
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

export function StatCard({ label, value, hint, variant = 'white', tone = 'default', style }: StatCardProps) {
  const toneStyle = toneStyles[tone] || toneStyles.default;
  return (
    <Card variant={variant} style={[styles.card, toneStyle.card, style]}>
      <View style={[styles.accent, toneStyle.accent]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    paddingTop: 12,
    paddingBottom: 12,
  },
  accent: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: '#e6fbf9',
    borderWidth: 1,
    borderColor: theme.colors.accentCyan,
  },
  label: {
    fontSize: 10,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 20,
    marginTop: 8,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
  },
  hint: {
    marginTop: 4,
    fontSize: 10,
    color: theme.colors.inkFaded,
    fontFamily: theme.fonts.body,
  },
});
