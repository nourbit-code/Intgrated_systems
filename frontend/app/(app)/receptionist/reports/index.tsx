import { View, StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { FormCard } from '@/components/ui/FormCard';
import { theme } from '@/constants/theme';
import { useOrders, type Order } from '@/hooks/useOrders';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { printReportPdf } from '@/utils/reportPdf';

export default function ReceptionistReports() {
  const { orders } = useOrders();

  const hasStoredResults = (order: Order) => {
    if (typeof window === 'undefined') {
      return order.tests.some((test) => Boolean(test.result));
    }
    try {
      const samplesStored = window.localStorage.getItem('lab_samples_by_order');
      const testsStored = window.localStorage.getItem('lab_tests_by_sample');
      const resultsStored = window.localStorage.getItem('lab_results_by_sample');
      if (!samplesStored || !testsStored || !resultsStored) {
        return order.tests.some((test) => Boolean(test.result));
      }

      const samplesByOrder = JSON.parse(samplesStored) as Record<string, { id: string }[]>;
      const testsBySample = JSON.parse(testsStored) as Record<string, string[]>;
      const resultsBySample = JSON.parse(resultsStored) as Record<string, Record<string, { value: string }[]>>;

      const samples = samplesByOrder[order.id] ?? [];
      for (const sample of samples) {
        const sampleTests = testsBySample[sample.id] ?? [];
        for (const testId of sampleTests) {
          const rows = resultsBySample[sample.id]?.[testId] ?? [];
          if (rows.some((row) => row.value && row.value.trim() !== '')) {
            return true;
          }
        }
      }
    } catch {
      return order.tests.some((test) => Boolean(test.result));
    }
    return order.tests.some((test) => Boolean(test.result));
  };

  const completed = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === 'Completed' &&
          !order.tests.some((test) => test.sample === 'Imaging') &&
          hasStoredResults(order),
      ),
    [orders],
  );

  const getTestResult = (order: Order, test: Order['tests'][number]) => {
    if (order.status !== 'Completed') return 'Pending';
    if (!test.result) return 'Result ready';
    const unit = test.unit ? ` ${test.unit}` : '';
    const reference = test.reference ? ` (${test.reference})` : '';
    return `${test.result}${unit}${reference}`;
  };

  return (
    <DashboardLayout title="Reports">
      <FormCard>
        <Text style={styles.sectionTitle}>Ready to Print</Text>
      </FormCard>

      <DataTable
        columns={['Order', 'Patient', 'Test', 'Completed', 'Status', 'Action']}
        columnWidths={[90, 170, 320, 120, 120, 140]}
        rows={completed.map((order) => [
          order.id,
          order.patientName,
          order.tests.map((test) => test.name).join(', '),
          order.completedAt ?? order.date,
          <StatusBadge status="completed" />,
          <PrimaryButton label="Print" onPress={() => printReportPdf(order, getTestResult)} />,
        ])}
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
});
