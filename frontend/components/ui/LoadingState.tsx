import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Loading data' }: LoadingStateProps) {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator color={theme.colors.accent} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
});
