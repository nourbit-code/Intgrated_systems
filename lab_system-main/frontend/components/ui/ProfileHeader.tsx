import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

export function ProfileHeader() {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.name}>Amina Hassan</Text>
      <Text style={styles.meta}>ID 2844 · 32 years · F</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  name: {
    fontFamily: theme.font.heading,
    fontSize: 22,
    color: theme.colors.ink,
  },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
});
