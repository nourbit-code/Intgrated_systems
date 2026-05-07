import { Redirect, Slot, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LabTechSidebar } from '@/components/navigation/LabTechSidebar';
import { ReceptionistSidebar } from '@/components/navigation/ReceptionistSidebar';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

const roleHomes = {
  receptionist: '/receptionist',
  'lab-tech': '/lab-tech',
} as const;

const roleAccess: Record<keyof typeof roleHomes, string[]> = {
  receptionist: ['/receptionist', '/patients', '/appointments'],
  'lab-tech': ['/lab-tech', '/patients'],
};

export default function AppLayout() {
  const { role } = useAuth();
  const pathname = usePathname();

  if (!role) {
    return <Redirect href="/(auth)/login" />;
  }

  const allowed = roleAccess[role];
  const isAllowed = allowed.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!isAllowed) {
    return <Redirect href={roleHomes[role]} />;
  }

  const sidebar = role === 'receptionist' ? <ReceptionistSidebar /> : <LabTechSidebar />;

  return (
    <View style={styles.shell}>
      {sidebar}
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
});
