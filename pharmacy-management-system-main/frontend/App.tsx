import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { setApiToken } from './src/api/client';
import { AppBackground } from './src/components/AppBackground';
import { Sidebar } from './src/components/Sidebar';
import { LoginScreen } from './src/screens/LoginScreen';
import { PharmacyDashboard } from './src/screens/PharmacyDashboard';
import { theme } from './src/theme';

type UserRole =
  | 'admin';

type User = {
  name: string;
  role: UserRole;
};

type Metrics = {
  inbox: number;
  prep: number;
  prescriptions: number;
  patients: number;
  inventory: number;
  lowStock: number;
  cart: number;
  invoices: number;
};

type Badges = Record<string, number>;

type LoginPayload = {
  name: string;
  token?: string;
  role?: UserRole;
};

const ADMIN_NAV = ['Dashboard', 'Prep Queue', 'Prescriptions', 'Patients', 'Inventory', 'Invoices'];
const SESSION_STORAGE_KEY = 'pharmacy_session_v1';

function loadStoredSession(): { name: string; token: string } | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.name || !parsed?.token) return null;
    return { name: String(parsed.name), token: String(parsed.token) };
  } catch {
    return null;
  }
}

function saveStoredSession(name: string, token: string) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ name, token }));
  } catch {
    // no-op
  }
}

function clearStoredSession() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // no-op
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState('Dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [badges, setBadges] = useState<Badges>({});
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const session = loadStoredSession();
    if (!session) return;
    setApiToken(session.token);
    setUser({ name: session.name, role: 'admin' });
    setActiveSection(ADMIN_NAV[0]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }, [activeSection]);

  const handleLogin = ({ name, token }: LoginPayload) => {
    if (token) {
      setApiToken(token);
      saveStoredSession(name, token);
    }
    setUser({ name, role: 'admin' });
    setActiveSection(ADMIN_NAV[0]);
  };

  const handleLogout = () => {
    setApiToken('');
    clearStoredSession();
    setUser(null);
    setActiveSection('Dashboard');
  };

  const navigationItems = ADMIN_NAV;

  useEffect(() => {
    if (!navigationItems.includes(activeSection)) {
      setActiveSection(navigationItems[0] || 'Dashboard');
    }
  }, [activeSection, navigationItems]);

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <AppBackground />
      <View style={styles.layout}>
        <Sidebar
          items={navigationItems}
          activeItem={activeSection}
          onSelect={setActiveSection}
          user={user}
          onLogout={handleLogout}
          badges={badges}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
        <ScrollView
          ref={scrollRef}
          style={styles.contentScroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <PharmacyDashboard
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onScrollTo={(y) => scrollRef.current?.scrollTo?.({ y, animated: true })}
            onMetrics={(data: Metrics) =>
              setBadges({
                'Prep Queue': data.prep,
                Prescriptions: data.prescriptions,
                Patients: data.patients,
                Inventory: data.inventory,
                Invoices: data.invoices,
              })
            }
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    minHeight: '100%',
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 16,
    padding: 16,
    alignItems: 'stretch',
    minHeight: 0,
  },
  contentScroll: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    maxHeight: '100%',
  },
  container: {
    flexGrow: 1,
    minWidth: 280,
    padding: 4,
    paddingBottom: 80,
  },
});
