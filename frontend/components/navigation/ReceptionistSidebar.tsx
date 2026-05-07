import { usePathname, useRouter, type Href } from 'expo-router';

import { SideNav, NavItem } from './SideNav';
import { useAuth } from '@/hooks/useAuth';

export function ReceptionistSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  const items: NavItem[] = [
    { label: 'Dashboard', path: '/receptionist', webIcon: 'grid-outline', icon: { ios: 'person.2', android: 'people', web: 'person.2' } },
    { label: 'Patients', path: '/patients', webIcon: 'people-outline', icon: { ios: 'person.crop.rectangle', android: 'badge', web: 'person.crop.rectangle' } },
    { label: 'Add Patient', path: '/receptionist/add-patient', webIcon: 'person-add-outline', icon: { ios: 'person.badge.plus', android: 'person_add', web: 'person.badge.plus' } },
    { label: 'Orders', path: '/receptionist/orders', webIcon: 'list-outline', icon: { ios: 'tray.and.arrow.down', android: 'assignment', web: 'tray.and.arrow.down' } },
    { label: 'Billing', path: '/receptionist/billing', webIcon: 'card-outline', icon: { ios: 'creditcard', android: 'credit_card', web: 'creditcard' } },
    { label: 'User Management', path: '/receptionist/user-management', webIcon: 'people-circle-outline', icon: { ios: 'person.3', android: 'supervisor_account', web: 'person.3' } },
    { label: 'Profile', path: '/receptionist/profile', webIcon: 'person-circle-outline', icon: { ios: 'person.crop.circle', android: 'account_circle', web: 'person.crop.circle' } },
    { label: 'Insurance Settings', path: '/receptionist/insurance-settings', webIcon: 'settings-outline', icon: { ios: 'gearshape', android: 'settings', web: 'gearshape' } },
    { label: 'Reports', path: '/receptionist/reports', webIcon: 'document-text-outline', icon: { ios: 'doc.plaintext', android: 'description', web: 'doc.plaintext' } },
  ];

  return (
    <SideNav
      items={items}
      activePath={pathname}
      onNavigate={(path) => router.push(path as Href)}
      onLogout={() => {
        logout();
        router.replace('/login' as Href);
      }}
    />
  );
}
