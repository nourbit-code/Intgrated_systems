import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type StepHeaderProps = {
  step: string;
  title: string;
};

export function StepHeader({ step, title }: StepHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.step}>{step}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  step: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  title: {
    fontFamily: theme.font.heading,
    fontSize: 22,
    color: theme.colors.ink,
  },
});
