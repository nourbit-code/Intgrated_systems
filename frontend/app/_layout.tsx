import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/hooks/useAuth';
import { InsuranceSettingsProvider } from '@/hooks/useInsuranceSettings';
import { PatientsProvider } from '@/hooks/usePatients';
import { OrdersProvider } from '@/hooks/useOrders';
import { InventoryProvider } from '@/hooks/useInventory';
import { InventoryPurchaseOrdersProvider } from '@/hooks/useInventoryPurchaseOrders';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <InsuranceSettingsProvider>
          <PatientsProvider>
            <OrdersProvider>
              <InventoryProvider>
                <InventoryPurchaseOrdersProvider>
                  <Stack>
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(app)" options={{ headerShown: false }} />
                  </Stack>
                </InventoryPurchaseOrdersProvider>
              </InventoryProvider>
            </OrdersProvider>
          </PatientsProvider>
        </InsuranceSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
