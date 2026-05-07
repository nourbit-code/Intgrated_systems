import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type TabbedViewProps = {
  tabs: string[];
  activeIndex?: number;
};

export function TabbedView({ tabs, activeIndex = 0 }: TabbedViewProps) {
  return (
    <View style={styles.wrapper}>
      {tabs.map((tab, index) => (
        <View key={tab} style={[styles.tab, index === activeIndex && styles.activeTab]}>
          <Text style={[styles.label, index === activeIndex && styles.activeLabel]}>{tab}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeTab: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  activeLabel: {
    color: theme.colors.ink,
  },
});
