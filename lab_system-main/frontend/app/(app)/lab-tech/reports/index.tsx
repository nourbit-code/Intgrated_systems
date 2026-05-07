import { View, StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { FormCard } from '@/components/ui/FormCard';
import { theme } from '@/constants/theme';
import { useOrders } from '@/hooks/useOrders';
import { StatusBadge } from '@/components/ui/StatusBadge';

function isImagingOrder(order: { tests: { sample?: string }[] }) {
  return order.tests.some((test) => test.sample === 'Imaging');
}

export default function LabReports() {
  const router = useRouter();
  const { orders } = useOrders();

  const completed = useMemo(
    () => orders.filter((order) => order.status === 'Completed' && !isImagingOrder(order)),
    [orders],
  );
  const completedRows = completed.map((order) => [
    order.id,
    order.patientName,
    order.tests.map((test) => test.name).join(', '),
    order.priority ?? 'Routine',
    order.completedAt ?? order.date,
    <StatusBadge status="completed" />,
    <Text
      style={styles.openLink}
      onPress={() =>
        router.push({
          pathname: `/lab-tech/results-multi/${order.id}`,
          params: { orderId: order.id, patient: order.patientName, testId: order.tests[0]?.id },
        } as Href)
      }
    >
      Open
    </Text>,
  ]);

  return (
    <DashboardLayout title="Technician Reports">
      <View style={styles.stats}>
        <StatCard label="Tests Completed" value={completed.length} />
        <StatCard label="Avg Processing" value="22 min" tone="accent" />
        <StatCard label="Retests" value={3} />
      </View>

      <FormCard>
        <Text style={styles.sectionTitle}>Completed Results</Text>
      </FormCard>
      <DataTable
        columns={['Order', 'Patient', 'Tests', 'Priority', 'Completed', 'Status', 'Action']}
        columnWidths={[90, 170, 300, 110, 120, 120, 120]}
        rows={completedRows}
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  openLink: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: theme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
