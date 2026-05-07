import { View, StyleSheet } from 'react-native';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataTable } from '@/components/ui/DataTable';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { ExportButton } from '@/components/ui/ExportButton';
import { theme } from '@/constants/theme';

export default function DailyTestsReport() {
  return (
    <DashboardLayout title="Daily Tests" subtitle="Volume across departments">
      <View style={styles.actions}>
        <DateRangePicker />
        <ExportButton />
      </View>
      <ChartCard title="Tests Per Day" subtitle="Last 7 days" />
      <DataTable
        columns={['Department', 'Tests', 'Avg Time']}
        rows={[
          ['Hematology', '42', '42m'],
          ['Radiology', '18', '58m'],
          ['Cardio', '12', '36m'],
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
