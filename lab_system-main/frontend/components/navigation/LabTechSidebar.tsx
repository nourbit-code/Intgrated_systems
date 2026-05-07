import { usePathname, useRouter, type Href } from 'expo-router';

import { SideNav, NavItem } from './SideNav';
import { useAuth } from '@/hooks/useAuth';

export function LabTechSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  const items: NavItem[] = [
    { label: 'Dashboard', path: '/lab-tech', webIcon: 'speedometer-outline', icon: { ios: 'testtube.2', android: 'science', web: 'testtube.2' } },
    { label: 'Tests', path: '/lab-tech/results-dashboard', webIcon: 'create-outline', icon: { ios: 'pencil.and.outline', android: 'edit', web: 'pencil.and.outline' } },
    { label: 'Inventory', path: '/lab-tech/inventory', webIcon: 'cube-outline', icon: { ios: 'shippingbox', android: 'inventory_2', web: 'shippingbox' } },
    { label: 'Settings', path: '/lab-tech/settings', webIcon: 'settings-outline', icon: { ios: 'gearshape', android: 'settings', web: 'gearshape' } },
    { label: 'Radiology Upload', path: '/lab-tech/radiology', webIcon: 'image-outline', icon: { ios: 'camera.viewfinder', android: 'photo_camera', web: 'camera.viewfinder' } },
    { label: 'Completed Tests', path: '/lab-tech/completed-tests', webIcon: 'checkmark-done-outline', icon: { ios: 'checkmark.seal', android: 'check_circle', web: 'checkmark.seal' } },
    { label: 'Profile', path: '/lab-tech/profile', webIcon: 'person-circle-outline', icon: { ios: 'person.crop.circle', android: 'account_circle', web: 'person.crop.circle' } },
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
