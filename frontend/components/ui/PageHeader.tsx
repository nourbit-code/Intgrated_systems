import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  textBlock: {
    flex: 1,
    minWidth: 240,
    gap: theme.spacing.xs,
  },
  action: {
    minWidth: 220,
  },
  title: {
    fontFamily: theme.font.heading,
    fontSize: 30,
    color: theme.colors.ink,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.slate,
  },
});
