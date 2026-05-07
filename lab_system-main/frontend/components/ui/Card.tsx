import { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { theme } from '@/constants/theme';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, style }: CardProps) {
  return (
    <Pressable
      style={({ hovered }) => [
        styles.card,
        hovered && styles.cardHover,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 28,
    elevation: 4,
  },
  cardHover: {
    borderColor: '#D6DDE6',
    shadowOpacity: 0.1,
  },
});
