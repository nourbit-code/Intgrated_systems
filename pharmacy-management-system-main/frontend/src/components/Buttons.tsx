import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { theme } from '../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, onPress, style }: ButtonProps) {
  return (
    <TouchableOpacity style={[styles.primary, style]} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, style }: ButtonProps) {
  return (
    <TouchableOpacity style={[styles.secondary, style]} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: theme.colors.accentDeep,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    shadowColor: '#0b1b2a',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primaryText: {
    color: theme.colors.white,
    fontSize: 13,
    letterSpacing: 0.2,
    fontFamily: theme.fonts.body,
  },
  secondary: {
    backgroundColor: '#edf2fb',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c7d6ea',
  },
  secondaryText: {
    color: theme.colors.accentDeep,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
});
