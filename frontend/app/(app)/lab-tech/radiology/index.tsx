import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FiltersBar } from '@/components/ui/FiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/SelectField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { FormCard } from '@/components/ui/FormCard';
import { theme } from '@/constants/theme';
import { useOrders } from '@/hooks/useOrders';

const statusOptions = ['All', 'In Progress', 'Completed', 'Cancelled'] as const;
const sortOptions = ['Newest', 'Oldest'] as const;

type StatusFilter = typeof statusOptions[number];
type SortFilter = typeof sortOptions[number];

function normalizeStatus(status: string) {
  if (status === 'Cancelled') return 'Cancelled';
  return status === 'Completed' ? 'Completed' : 'In Progress';
}

function hasImaging(order: { tests: { sample?: string }[] }) {
  return order.tests.some((test) => {
    if (test.sample === 'Imaging') return true;
    return false;
  });
}

export default function RadiologyDashboard() {
  const router = useRouter();
  const { orders } = useOrders();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortFilter, setSortFilter] = useState<SortFilter>('Newest');
  const [search, setSearch] = useState('');

  const imagingOrders = useMemo(
    () => orders.filter((order) => hasImaging(order)),
    [orders],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = imagingOrders.filter((order) => {
      const status = normalizeStatus(order.status);
      if (statusFilter !== 'All' && status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [
        order.id,
        order.patientName,
        order.tests.map((test) => test.name).join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
    return [...list].sort((a, b) => {
      if (sortFilter === 'Oldest') return (a.date ?? '').localeCompare(b.date ?? '');
      return (b.date ?? '').localeCompare(a.date ?? '');
    });
  }, [imagingOrders, search, statusFilter, sortFilter]);

  return (
    <DashboardLayout title="Uplods history">
      <FormCard>
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
          <SelectField
            label="Sort"
            value={sortFilter}
            onPress={() => {
              const currentIndex = sortOptions.indexOf(sortFilter);
              const next = sortOptions[(currentIndex + 1) % sortOptions.length];
              setSortFilter(next);
            }}
          />
        </FiltersBar>
      </FormCard>

      <DataTable
        title="Imaging Orders"
        columns={['Order', 'Patient', 'Tests', 'Status', 'Action']}
        columnWidths={[110, 190, 320, 160, 200]}
        rows={filtered.map((order) => [
          `#${order.id}`,
          order.patientName,
          order.tests.map((t) => t.name).join(', '),
          <StatusBadge
            status={normalizeStatus(order.status) === 'Completed'
              ? 'completed'
              : normalizeStatus(order.status) === 'Cancelled'
                ? 'cancelled'
                : 'in-progress'}
          />,
          <View style={styles.actionCell}>
            <PrimaryButton
              label="Open"
              onPress={() => router.push(`/lab-tech/radiology/${order.id}` as Href)}
            />
            <PrimaryButton
              label="EMR"
              tone="blue"
              onPress={() => router.push(`/patients/${order.patientId}/emr` as Href)}
            />
          </View>,
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
  actionCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
