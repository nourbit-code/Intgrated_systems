import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

export function ResultsViewer() {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Results Viewer</Text>
      <View style={styles.preview} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  title: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  preview: {
    height: 180,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSoft,
  },
});
