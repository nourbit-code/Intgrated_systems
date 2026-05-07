import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '@/constants/theme';

export type NavItem = {
  label: string;
  path: string;
  icon: {
    ios: string;
    android: string;
    web: string;
  };
  webIcon: keyof typeof Ionicons.glyphMap;
};

type SideNavProps = {
  items: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
};

export function SideNav({ items, activePath, onNavigate, onLogout }: SideNavProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hovered && Platform.OS === 'web') {
      Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    }
  }, [hovered, fadeAnim]);

  const renderIcon = (item: NavItem) => {
    if (Platform.OS === 'web') {
      return <Ionicons name={item.webIcon} size={20} color="#E2E8F0" />;
    }
    return <SymbolView name={item.icon as any} tintColor="#E2E8F0" size={22} />;
  };

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      <View style={styles.topSection}>
        <View style={[styles.brand, collapsed && styles.brandCollapsed]}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>AL</Text>
          </View>
          {!collapsed && <Text style={styles.brandText}>AlphaLab</Text>}
        </View>
        <Pressable
          onPress={() => setCollapsed((prev) => !prev)}
          style={({ hovered: isHover }) => [styles.collapseButton, isHover && styles.collapseHover]}
        >
          <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-back'} size={16} color="#E2E8F0" />
        </Pressable>
      </View>

      <View style={[styles.menuContainer, collapsed && styles.menuCollapsed]}>
        {items.map((item) => {
          const isActive = activePath === item.path || activePath.startsWith(`${item.path}/`);
          const showTooltip = hovered === item.path;

          return (
            <View key={item.path} style={styles.iconWrapper}>
              <Pressable
                onPress={() => onNavigate(item.path)}
                onHoverIn={() => Platform.OS === 'web' && setHovered(item.path)}
                onHoverOut={() => Platform.OS === 'web' && setHovered(null)}
                style={({ hovered: isHover }) => [
                  styles.iconButton,
                  (isActive || isHover) && styles.active,
                  collapsed && styles.iconButtonCollapsed,
                ]}
              >
                {isActive && !collapsed ? <View style={styles.activeBar} /> : null}
                <View style={[styles.iconRow, collapsed && styles.iconRowCollapsed]}>
                  {renderIcon(item)}
                  {!collapsed && <Text style={styles.iconLabel}>{item.label}</Text>}
                </View>
              </Pressable>

              {Platform.OS === 'web' && showTooltip && collapsed && (
                <Animated.View style={[styles.tooltip, { opacity: fadeAnim }]}> 
                  <Text style={styles.tooltipText}>{item.label}</Text>
                </Animated.View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.iconWrapper}>
        <Pressable
          onPress={onLogout}
          onHoverIn={() => Platform.OS === 'web' && setHovered('logout')}
          onHoverOut={() => Platform.OS === 'web' && setHovered(null)}
          style={({ hovered: isHover }) => [styles.iconButton, isHover && styles.active, collapsed && styles.iconButtonCollapsed]}
        >
          {collapsed ? null : <View style={styles.activeBar} />}
          <View style={[styles.iconRow, collapsed && styles.iconRowCollapsed]}>
            {Platform.OS === 'web' ? (
              <Ionicons name="log-out-outline" size={20} color="#E2E8F0" />
            ) : (
              <SymbolView
                name={{ ios: 'arrow.backward.square', android: 'logout', web: 'arrow.backward.square' } as any}
                tintColor="#E2E8F0"
                size={22}
              />
            )}
            {!collapsed && <Text style={styles.iconLabel}>Logout</Text>}
          </View>
        </Pressable>

        {Platform.OS === 'web' && hovered === 'logout' && collapsed && (
          <Animated.View style={[styles.tooltip, { opacity: fadeAnim }]}> 
            <Text style={styles.tooltipText}>Logout</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: '#0B1324',
    paddingVertical: 20,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: '#111B2E',
    paddingHorizontal: 16,
  },
  sidebarCollapsed: {
    width: 88,
    paddingHorizontal: 12,
  },
  topSection: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  brand: {
    alignItems: 'flex-start',
    gap: 6,
  },
  brandCollapsed: {
    alignItems: 'center',
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  brandText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#E2E8F0',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  collapseButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#14203B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseHover: {
    backgroundColor: '#1A2A4A',
  },
  menuContainer: { flex: 1, alignItems: 'stretch', marginTop: theme.spacing.lg, width: '100%' },
  menuCollapsed: { alignItems: 'center' },
  iconWrapper: { position: 'relative', marginVertical: 6, width: '100%' },
  iconButton: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  iconButtonCollapsed: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconRowCollapsed: {
    justifyContent: 'center',
  },
  iconLabel: {
    fontFamily: theme.font.body,
    fontSize: 16,
    color: '#E2E8F0',
  },
  active: {
    backgroundColor: '#14203B',
  },
  activeBar: {
    position: 'absolute',
    left: 6,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  tooltip: {
    position: 'absolute',
    left: 76,
    top: '50%',
    transform: [{ translateY: -12 }],
    backgroundColor: '#0B1324',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 1000,
  },
  tooltipText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontFamily: theme.font.body,
  },
});
