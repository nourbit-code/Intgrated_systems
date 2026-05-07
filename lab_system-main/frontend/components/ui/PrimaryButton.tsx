import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/constants/theme';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'blue';
};

export function PrimaryButton({ label, onPress, disabled, tone = 'default' }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        tone === 'blue' && styles.toneBlue,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  toneBlue: {
    backgroundColor: '#2563EB',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: '#F8FAFC',
    fontFamily: theme.font.heading,
    fontSize: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
