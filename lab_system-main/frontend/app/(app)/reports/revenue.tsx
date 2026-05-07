import { View, StyleSheet } from 'react-native';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable } from '@/components/ui/DataTable';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { ExportButton } from '@/components/ui/ExportButton';
import { theme } from '@/constants/theme';

export default function RevenueReport() {
  return (
    <DashboardLayout title="Revenue" subtitle="Financial performance">
      <View style={styles.actions}>
        <DateRangePicker />
        <ExportButton label="Export CSV" />
      </View>
      <ChartCard title="Revenue Trend" subtitle="Last 30 days" />
      <DataTable
        columns={['Department', 'Revenue', 'Change']}
        rows={[
          ['Lab', '24,300 EGP', '+12%'],
          ['Radiology', '18,100 EGP', '+7%'],
          ['Cardiology', '9,800 EGP', '+4%'],
        ]}
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: theme.spacing.md,
  },
});
