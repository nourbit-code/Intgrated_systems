import { ReactNode, useState } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

type CardProps = {
  children: ReactNode;
  variant?: 'default' | 'soft' | 'alt' | 'white';
  style?: StyleProp<ViewStyle>;
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function Card({
  children,
  variant = 'default',
  style,
  title,
  collapsible = false,
  defaultCollapsed = false,
  isCollapsed,
  onToggleCollapse,
}: CardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const collapsedValue = typeof isCollapsed === 'boolean' ? isCollapsed : collapsed;
  const effectiveCollapsed = collapsible ? collapsedValue : false;
  const handleToggle = () => {
    if (!collapsible) return;
    if (onToggleCollapse) {
      onToggleCollapse();
      return;
    }
    setCollapsed((prev) => !prev);
  };

  return (
    <View style={[styles.card, variants[variant] || variants.default, style]}>
      {title ? (
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{title}</Text>
          {collapsible ? (
            <TouchableOpacity
              onPress={handleToggle}
              style={styles.headerToggle}
              accessibilityLabel={effectiveCollapsed ? `Open ${title}` : `Close ${title}`}
            >
              <Text style={styles.headerToggleText}>{effectiveCollapsed ? 'Open' : 'Close'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {effectiveCollapsed ? null : children}
    </View>
  );
}

const whiteBase = {
  backgroundColor: theme.colors.white,
  borderColor: theme.colors.border,
};

const variants = {
  default: whiteBase,
  soft: whiteBase,
  alt: whiteBase,
  white: whiteBase,
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    shadowColor: '#0b1b2a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  headerTitle: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.ink,
    fontSize: 15,
  },
  headerToggle: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f8fbff',
  },
  headerToggleText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.ink,
    fontSize: 12,
  },
});
