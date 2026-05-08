import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SecondaryButton } from './Buttons';
import { theme } from '../theme';

const navIcons: Record<string, string> = {
  Dashboard: 'view-dashboard-outline',
  'Prep Queue': 'clipboard-pulse-outline',
  Prescriptions: 'file-document-edit-outline',
  Patients: 'account-group-outline',
  Inventory: 'package-variant-closed',
  Invoices: 'receipt-text-outline',
};

export function Sidebar({ items, activeItem, onSelect, user, onLogout, collapsed = false, onToggleCollapse, badges = {} }) {
  const roleLabel = String(user?.role || 'user').replace(/_/g, ' ');

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          {collapsed ? null : (
            <View>
              <Text style={styles.brand}>PharmaDesk</Text>
              <Text style={styles.brandSub}>Pharmacy operations console</Text>
            </View>
          )}
          <TouchableOpacity style={styles.toggleButton} onPress={onToggleCollapse} accessibilityLabel="Toggle sidebar">
            <MaterialCommunityIcons name={collapsed ? 'menu-open' : 'menu'} size={20} color="#f3f8ff" />
          </TouchableOpacity>
        </View>

        <View style={styles.nav}>
          {items.map((item) => {
            const active = item === activeItem;
            const icon = navIcons[item] || 'circle-outline';
            return (
              <TouchableOpacity
                key={item}
                onPress={() => onSelect(item)}
                style={[styles.navItem, collapsed && styles.navItemCollapsed, active && styles.navItemActive]}
                accessibilityLabel={item}
              >
                <View style={[styles.iconShell, active && styles.iconShellActive]}>
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={22}
                    color={active ? '#ffffff' : '#b7c6db'}
                  />
                </View>
                {collapsed ? null : <Text style={[styles.navText, active && styles.navTextActive]}>{item}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        {collapsed ? null : <Text style={styles.userLabel}>Signed in</Text>}
        {collapsed ? null : <Text style={styles.userName}>{user?.name || 'User'}</Text>}
        {collapsed ? null : <Text style={styles.userRole}>{roleLabel}</Text>}
        {collapsed ? (
          <TouchableOpacity onPress={onLogout} style={styles.compactLogout} accessibilityLabel="Log Out">
            <MaterialCommunityIcons name="logout" size={20} color="#f3f8ff" />
          </TouchableOpacity>
        ) : (
          <SecondaryButton label="Log Out" onPress={onLogout} style={styles.logoutButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    minWidth: 190,
    maxWidth: 240,
    flexBasis: 210,
    alignSelf: 'stretch',
    backgroundColor: '#0f1a2b',
    borderWidth: 1,
    borderColor: '#1b2a42',
    borderRadius: 16,
    padding: 18,
    gap: 16,
    minHeight: '100%',
    shadowColor: '#02050a',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
    overflow: 'hidden',
  },
  sidebarCollapsed: {
    minWidth: 88,
    maxWidth: 100,
    flexBasis: 92,
    paddingHorizontal: 10,
  },
  content: {
    flex: 1,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15263d',
    borderWidth: 1,
    borderColor: '#22344f',
  },
  brand: {
    fontSize: 18,
    color: '#f3f8ff',
    fontFamily: theme.fonts.heading,
    letterSpacing: 0.6,
  },
  brandSub: {
    marginTop: 4,
    fontSize: 11,
    color: '#9fb2c9',
    fontFamily: theme.fonts.body,
  },
  nav: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
    gap: 8,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  navItemActive: {
    backgroundColor: '#15263d',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentWarm,
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconShellActive: {
    backgroundColor: 'transparent',
  },
  navText: {
    color: '#b7c6db',
    fontFamily: theme.fonts.body,
    fontSize: 12,
    flexShrink: 1,
  },
  navTextActive: {
    color: '#ffffff',
    fontFamily: theme.fonts.heading,
  },
  footer: {
    marginTop: 'auto',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#20324c',
  },
  userLabel: {
    fontSize: 11,
    color: '#92a8c3',
    fontFamily: theme.fonts.body,
  },
  userName: {
    fontSize: 13,
    color: '#ffffff',
    fontFamily: theme.fonts.body,
  },
  userRole: {
    fontSize: 11,
    color: '#9fb2c9',
    fontFamily: theme.fonts.body,
    textTransform: 'capitalize',
  },
  logoutButton: {
    marginTop: 10,
    alignSelf: 'stretch',
  },
  compactLogout: {
    marginTop: 6,
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15263d',
    borderWidth: 1,
    borderColor: '#22344f',
  },
});
