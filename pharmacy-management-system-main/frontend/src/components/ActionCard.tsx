import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from './Card';
import { SecondaryButton } from './Buttons';
import { theme } from '../theme';

type ActionCardProps = {
  label: string;
  hint: string;
  onPress: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function ActionCard({ label, hint, onPress, isCollapsed, onToggleCollapse }: ActionCardProps) {
  const accordionMode = typeof isCollapsed === 'boolean' && typeof onToggleCollapse === 'function';

  if (accordionMode) {
    return (
      <View style={styles.wrapper}>
        <Card
          variant="white"
          style={styles.card}
          title={label}
          collapsible
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
        >
          <Text style={styles.hint}>{hint}</Text>
          <View style={styles.ctaRow}>
            <SecondaryButton label="Open" onPress={onPress} />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} style={styles.wrapper} activeOpacity={0.85}>
      <Card variant="white" style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.dot} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.hint}>{hint}</Text>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
    minWidth: 180,
  },
  card: {
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentCyan,
  },
  ctaRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.accentWarm,
  },
  label: {
    fontSize: 13,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
  },
  hint: {
    marginTop: 6,
    fontSize: 11,
    color: theme.colors.inkFaded,
    fontFamily: theme.fonts.body,
  },
});
