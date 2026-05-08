import { StyleSheet, View } from 'react-native';
import { theme } from '../theme';

export function AppBackground() {
  return <View style={styles.base} />;
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
});
