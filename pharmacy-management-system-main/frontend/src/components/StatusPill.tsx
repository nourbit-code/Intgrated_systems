import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

const variants = {
  New: {
    backgroundColor: '#e9eef7',
    color: theme.colors.accentDeep,
  },
  Waiting: {
    backgroundColor: '#e9eef7',
    color: theme.colors.accentDeep,
  },
  Pending: {
    backgroundColor: '#e9eef7',
    color: theme.colors.accentDeep,
  },
  Preparing: {
    backgroundColor: '#e4ecf8',
    color: theme.colors.success,
  },
  Ready: {
    backgroundColor: '#e4ecf8',
    color: theme.colors.success,
  },
  Dispensed: {
    backgroundColor: theme.colors.cardSoft,
    color: theme.colors.inkMuted,
  },
  Connected: {
    backgroundColor: '#e4ecf8',
    color: theme.colors.success,
  },
  Paid: {
    backgroundColor: '#e4ecf8',
    color: theme.colors.success,
  },
  Received: {
    backgroundColor: theme.colors.cardSoft,
    color: theme.colors.inkMuted,
  },
  Validated: {
    backgroundColor: '#e4ecf8',
    color: theme.colors.success,
  },
  Unread: {
    backgroundColor: '#edf2fb',
    color: theme.colors.accentDeep,
  },
  Read: {
    backgroundColor: theme.colors.cardSoft,
    color: theme.colors.inkMuted,
  },
  Alert: {
    backgroundColor: '#fee2e2',
    color: theme.colors.alert,
  },
  Default: {
    backgroundColor: theme.colors.cardSoft,
    color: theme.colors.inkMuted,
  },
};

export function StatusPill({ value }) {
  const style = variants[value] || variants.Default;
  return (
    <View style={[styles.pill, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.text, { color: style.color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  text: {
    fontSize: 11,
    fontFamily: theme.fonts.body,
  },
});
