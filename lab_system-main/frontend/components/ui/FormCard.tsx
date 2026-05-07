import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { Card } from './Card';
import { theme } from '@/constants/theme';

type FormCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function FormCard({ children, style }: FormCardProps) {
  return <Card style={[styles.card, style]}>{children}</Card>;
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
});
