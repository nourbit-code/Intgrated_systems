import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FiltersBar } from '@/components/ui/FiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/SelectField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormCard } from '@/components/ui/FormCard';
import { theme } from '@/constants/theme';
import { useOrders } from '@/hooks/useOrders';

const statusOptions = ['All', 'Samples Waiting', 'In Progress', 'Completed'] as const;

type StatusFilter = typeof statusOptions[number];

function isImagingOrder(order: { tests: { sample?: string }[] }) {
  return order.tests.some((test) => test.sample === 'Imaging');
}

function normalizeStatus(order: { status: string; tests: { sample?: string }[] }) {
  if (isImagingOrder(order)) {
    return order.status;
  }
  if (order.status === 'Waiting for Sample') return 'Samples Waiting';
  return order.status;
}

function getActionLabel(order: { status: string; tests: { sample?: string }[] }) {
  if (isImagingOrder(order)) return 'Open Upload';
  if (order.status === 'Completed') return 'Open Result';
  return 'Add Samples';
}

function getStartPath(order: { id: string; status: string; tests: { sample?: string }[] }) {
  if (isImagingOrder(order)) {
    return `/lab-tech/radiology/${order.id}`;
  }
  if (order.status === 'Completed') {
    return `/lab-tech/results-multi/${order.id}`;
  }
  return '/lab-tech/sample-collection';
}

export default function ResultsDashboard() {
  const router = useRouter();
  const { orders } = useOrders();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (order.status === 'Cancelled') return false;
      if (isImagingOrder(order)) return false;
      const status = normalizeStatus(order);
      if (statusFilter !== 'All' && status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [
        order.id,
        order.patientName,
        order.tests.map((test) => test.name).join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [orders, search, statusFilter]);

  return (
    <DashboardLayout title="Tests">
      <FormCard>
        <Text style={styles.sectionTitle}>Test Filters</Text>
        <FiltersBar>
          <SearchInput placeholder="Search by patient, test, order" value={search} onChangeText={setSearch} />
          <SelectField
            label="Status"
            value={statusFilter}
            onPress={() => {
              const currentIndex = statusOptions.indexOf(statusFilter);
              const next = statusOptions[(currentIndex + 1) % statusOptions.length];
              setStatusFilter(next);
            }}
          />
        </FiltersBar>
      </FormCard>

      <DataTable
        title="Tests"
        columns={['Order', 'Patient', 'Tests', 'Status', 'Action']}
        columnWidths={[90, 170, 320, 160, 150]}
        rows={filtered.map((order) => [
          order.id,
          order.patientName,
          order.tests.map((t) => t.name).join(', '),
          <StatusBadge status={normalizeStatus(order) === 'Completed' ? 'completed' : 'in-progress'} />,
          <Pressable
            onPress={() =>
              router.push({
                pathname: getStartPath(order),
                params: { orderId: order.id, patient: order.patientName, testId: order.tests[0]?.id },
              } as Href)
            }
            style={styles.startButton}
          >
            <Text style={styles.startButtonText}>{getActionLabel(order)}</Text>
          </Pressable>,
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
  startButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#F8FAFC',
    fontFamily: theme.font.heading,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
