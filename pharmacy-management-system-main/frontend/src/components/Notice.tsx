import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

const tones = {
  info: {
    backgroundColor: '#e9f0fb',
    borderColor: '#c7d6ea',
    color: theme.colors.accentDeep,
  },
  success: {
    backgroundColor: '#e4ecf8',
    borderColor: '#c7d6ea',
    color: theme.colors.success,
  },
  warning: {
    backgroundColor: '#edf2fb',
    borderColor: '#c7d6ea',
    color: theme.colors.accentDeep,
  },
};

export function Notice({ title, message, tone = 'info' }) {
  const style = tones[tone] || tones.info;
  return (
    <View style={[styles.notice, { backgroundColor: style.backgroundColor, borderColor: style.borderColor }]}
    >
      <Text style={[styles.title, { color: style.color }]}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  title: {
    fontSize: 12,
    fontFamily: theme.fonts.heading,
  },
  message: {
    marginTop: 6,
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
});
