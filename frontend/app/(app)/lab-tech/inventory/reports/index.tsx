import { StyleSheet, Text, View, Pressable } from 'react-native';

import { useRouter } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { DataTable } from '@/components/ui/DataTable';
import { theme } from '@/constants/theme';

export default function InventoryReports() {
  const router = useRouter();
  return (
    <DashboardLayout title="Inventory Reports">
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Top Used Items</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </FormCard>
      <DataTable
        columns={['Item', 'Used']}
        columnWidths={[220, 120]}
        rows={[
          ['EDTA Tubes', '120'],
          ['Alcohol Swabs', '95'],
          ['CBC Reagent', '40'],
        ]}
      />
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Expired Items</Text>
        </View>
      </FormCard>
      <DataTable
        columns={['Item', 'Expiry']}
        columnWidths={[220, 120]}
        rows={[
          ['Hormone Kit', '2026-03-01'],
        ]}
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  backText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
});
