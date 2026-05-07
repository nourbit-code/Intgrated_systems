import { useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FiltersBar } from '@/components/ui/FiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/SelectField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { FormCard } from '@/components/ui/FormCard';
import { StatCard } from '@/components/ui/StatCard';
import { theme } from '@/constants/theme';
import { useOrders } from '@/hooks/useOrders';

function isImagingOrder(order: { tests: { sample?: string }[] }) {
  return order.tests.some((test) => test.sample === 'Imaging');
}

export default function CompletedTests() {
  const router = useRouter();
  const { orders } = useOrders();
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'This Week'>('All');

  const completed = useMemo(
    () => orders.filter((order) => order.status === 'Completed' && !isImagingOrder(order)),
    [orders],
  );
  const todayIso = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return completed.filter((order) => {
      const effectiveDate = order.completedAt ?? order.date;
      if (dateFilter === 'Today' && effectiveDate !== todayIso) return false;
      if (dateFilter === 'This Week') {
        const date = new Date(`${effectiveDate}T00:00:00`);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 0 || diff > 7 * 24 * 60 * 60 * 1000) return false;
      }
      if (!query) return true;
      const haystack = [
        order.id,
        order.patientName,
        order.tests.map((test) => test.name).join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [completed, dateFilter, search, todayIso]);

  const completedToday = useMemo(
    () => completed.filter((order) => (order.completedAt ?? order.date) === todayIso).length,
    [completed, todayIso],
  );

  return (
    <DashboardLayout title="Completed Tests">
      <View style={styles.stats}>
        <StatCard label="Completed Today" value={completedToday} />
        <StatCard label="Completed Total" value={completed.length} />
      </View>

      <FormCard>
        <Text style={styles.sectionTitle}>Filters</Text>
        <FiltersBar>
          <SearchInput placeholder="Search by patient, test, order" value={search} onChangeText={setSearch} />
          <SelectField
            label="Date"
            value={dateFilter}
            onPress={() => {
              const next = dateFilter === 'All' ? 'Today' : dateFilter === 'Today' ? 'This Week' : 'All';
              setDateFilter(next);
            }}
          />
        </FiltersBar>
      </FormCard>

      <DataTable
        columns={['Order', 'Patient', 'Tests', 'Priority', 'Completed', 'Status', 'Action']}
        columnWidths={[90, 170, 300, 110, 120, 120, 150]}
        rows={filtered.map((order) => [
          order.id,
          order.patientName,
          order.tests.map((test) => test.name).join(', '),
          order.priority ?? 'Routine',
          order.completedAt ?? order.date,
          <StatusBadge status="completed" />,
          <PrimaryButton
            label="Open Result"
            onPress={() =>
              router.push({
                pathname: `/lab-tech/results-multi/${order.id}`,
                params: { orderId: order.id, patient: order.patientName, testId: order.tests[0]?.id },
              } as Href)
            }
          />,
        ])}
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
});
