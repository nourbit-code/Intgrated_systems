import { ReactNode, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';

type SectionProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export function Section({
  title,
  children,
  action,
  collapsible = false,
  defaultCollapsed = false,
}: SectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsible ? collapsed : false;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.titleBar} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.actions}>
          {action || null}
          {collapsible ? (
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setCollapsed((prev) => !prev)}
              accessibilityLabel={isCollapsed ? `Open ${title}` : `Close ${title}`}
            >
              <Text style={styles.toggleText}>{isCollapsed ? 'Open' : 'Close'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {isCollapsed ? null : children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
    flexWrap: 'wrap',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  titleBar: {
    width: 8,
    height: 22,
    borderRadius: 6,
    backgroundColor: theme.colors.accentWarm,
  },
  title: {
    fontSize: 18,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
    letterSpacing: 0.4,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#f8fbff',
  },
  toggleText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.ink,
    fontSize: 12,
  },
});
