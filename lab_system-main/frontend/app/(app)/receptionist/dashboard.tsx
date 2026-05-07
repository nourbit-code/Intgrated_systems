import { useMemo, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Modal } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormCard } from '@/components/ui/FormCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { theme } from '@/constants/theme';
import { useOrders, Order } from '@/hooks/useOrders';
import { firstName, useAuth } from '@/hooks/useAuth';

const statusOptions = ['All', 'Samples Waiting', 'In Progress', 'Completed', 'Cancelled'] as const;
const priorityOptions = ['All', 'Routine', 'Urgent', 'STAT'] as const;

type StatusFilter = typeof statusOptions[number];
type PriorityFilter = typeof priorityOptions[number];

type BadgeStatus = 'samples-waiting' | 'completed' | 'cancelled' | 'in-progress';

function isImagingOrder(order: Order) {
  return order.tests.some((test) => test.sample === 'Imaging');
}

function normalizeStatus(order: Order) {
  if (isImagingOrder(order)) {
    return order.status;
  }
  if (order.status === 'Waiting for Sample') return 'Samples Waiting';
  return order.status;
}

function mapStatusToBadge(status: string): BadgeStatus {
  if (status === 'Samples Waiting') return 'samples-waiting';
  if (status === 'In Progress') return 'in-progress';
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  return 'samples-waiting';
}

function getPriorityTone(priority: 'Routine' | 'Urgent' | 'STAT') {
  if (priority === 'STAT') return { chip: styles.priorityChipStat, text: styles.priorityTextStat };
  if (priority === 'Urgent') return { chip: styles.priorityChipUrgent, text: styles.priorityTextUrgent };
  return { chip: styles.priorityChipRoutine, text: styles.priorityTextRoutine };
}

export default function ReceptionistDashboard() {
  const router = useRouter();
  const { orders } = useOrders();
  const { currentUser } = useAuth();
  const welcomeName = firstName(currentUser?.name) || 'Receptionist';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const ordersToday = useMemo(
    () => orders.filter((order) => order.date === todayIso),
    [orders, todayIso],
  );

  const statusCounts = useMemo(() => {
    const counts = {
      samplesWaiting: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((order) => {
      const status = normalizeStatus(order);
      if (status === 'Samples Waiting') counts.samplesWaiting += 1;
      if (status === 'In Progress') counts.inProgress += 1;
      if (status === 'Completed') counts.completed += 1;
      if (status === 'Cancelled') counts.cancelled += 1;
    });
    return counts;
  }, [orders]);


  const paymentsReceived = useMemo(
    () => orders.reduce((sum, order) => sum + (order.amountPaid || 0), 0),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const status = normalizeStatus(order);
      if (statusFilter !== 'All' && status !== statusFilter) return false;
      const priority = order.priority ?? 'Routine';
      if (priorityFilter !== 'All' && priority !== priorityFilter) return false;
      if (query) {
        const haystack = [
          order.id,
          order.patientName,
          order.patientId,
          order.tests.map((test) => test.name).join(' '),
          order.date,
          status,
        ].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, priorityFilter, search]);

  const patientRows = useMemo(() => {
    return filteredOrders.map((order) => {
      const priority = order.priority ?? 'Routine';
      const priorityTone = getPriorityTone(priority);
      return [
        `#${order.id}`,
        order.patientName,
        order.tests.map((test) => test.name).join(', '),
        (
          <View style={[styles.priorityChip, priorityTone.chip]}>
            <Text style={[styles.priorityText, priorityTone.text]}>{priority}</Text>
          </View>
        ),
        <StatusBadge status={mapStatusToBadge(normalizeStatus(order))} />,
        order.date,
        order.bookedByName || 'Reception',
        normalizeStatus(order) === 'Completed' ? (order.completedByTechName || 'Lab Technician') : '-',
      ];
    });
  }, [filteredOrders]);

  return (
    <DashboardLayout
      title={`Welcome Receptionist, ${welcomeName}`}
    >
      <FormCard>
        <Text style={styles.sectionTitle}>Today's Snapshot</Text>
        <View style={styles.stats}>
          <StatCard
            label="Today's Appointments"
            value={ordersToday.length}
            icon={<Ionicons name="calendar-outline" size={18} color={theme.colors.accent} />}
          />
          <StatCard
            label="Samples Waiting"
            value={statusCounts.samplesWaiting}
            tone="accent"
            icon={<Ionicons name="hourglass-outline" size={18} color={theme.colors.accent} />}
          />
          <StatCard
            label="In Progress Tests"
            value={statusCounts.inProgress}
            icon={<Ionicons name="pulse-outline" size={18} color={theme.colors.accent} />}
          />
          <StatCard
            label="Completed Tests"
            value={statusCounts.completed}
            icon={<Ionicons name="checkmark-done-outline" size={18} color={theme.colors.accent} />}
          />
          <StatCard
            label="Payments Received"
            value={`${paymentsReceived} EGP`}
            icon={<Ionicons name="card-outline" size={18} color={theme.colors.accent} />}
          />
        </View>
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {[
            { label: 'Add Patient', path: '/receptionist/add-patient', primary: true },
            { label: 'Create Lab Request', path: '/receptionist/create-order', primary: true },
            { label: 'Search Patient', path: '/patients', primary: true },
            { label: 'Billing', path: '/receptionist/billing', primary: true },
            { label: 'Reports', path: '/receptionist/reports', primary: true },
          ].map((action) => (
            <Pressable
              key={action.label}
              style={[styles.actionButton, action.primary && styles.actionButtonPrimary]}
              onPress={() => router.push(action.path as Href)}
            >
              <Text style={[styles.actionButtonText, action.primary && styles.actionButtonTextPrimary]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </FormCard>

      <FormCard>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Patient Overview</Text>
          </View>
          <View style={styles.searchWrap}>
            <SearchInput
              placeholder="Search orders: patient / order / test"
              value={search}
              onChangeText={setSearch}
              enableVoice
            />
          </View>
          <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Text style={styles.filterButtonText}>Filters</Text>
          </Pressable>
        </View>
      </FormCard>

      <DataTable
        columns={['Order', 'Patient', 'Tests', 'Priority', 'Status', 'Date', 'By', 'Tech']}
        columnWidths={[90, 160, 260, 110, 150, 120, 140, 140]}
        rows={patientRows}
        rowKeys={filteredOrders.map((order) => order.id)}
        onRowPress={(index) => {
          const order = filteredOrders[index];
          if (order) router.push(`/patients/${order.patientId}` as Href);
        }}
      />

      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilters(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Filters</Text>

            <Text style={styles.sectionLabel}>Status</Text>
            <View style={styles.filterRow}>
              {statusOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setStatusFilter(option)}
                  style={[styles.filterChip, statusFilter === option && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, statusFilter === option && styles.filterChipTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Priority</Text>
            <View style={styles.filterRow}>
              {priorityOptions.map((option) => {
                const tone = option === 'Routine'
                  ? { chip: styles.priorityChipRoutine, text: styles.priorityTextRoutine }
                  : option === 'Urgent'
                    ? { chip: styles.priorityChipUrgent, text: styles.priorityTextUrgent }
                    : option === 'STAT'
                      ? { chip: styles.priorityChipStat, text: styles.priorityTextStat }
                      : null;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setPriorityFilter(option)}
                    style={[styles.filterChip, tone?.chip, priorityFilter === option && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, tone?.text, priorityFilter === option && styles.filterChipTextActive]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  setStatusFilter('All');
                  setPriorityFilter('All');
                }}
              >
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
              <Pressable style={styles.applyButton} onPress={() => setShowFilters(false)}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>


    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  stats: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  sectionTitleWrap: {
    minWidth: 180,
  },
  searchWrap: {
    flex: 1,
    minWidth: 300,
    maxWidth: 620,
    marginHorizontal: theme.spacing.sm,
  },
  actionsRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: 160,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  actionButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: theme.colors.ink,
  },
  actionButtonTextPrimary: {
    color: '#F8FAFC',
  },
  filterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  filterButtonText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  filterChipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  filterChipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  filterChipTextActive: {
    color: theme.colors.ink,
  },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  priorityChipRoutine: {
    backgroundColor: '#E2E8F0',
  },
  priorityChipUrgent: {
    backgroundColor: '#FEF3C7',
  },
  priorityChipStat: {
    backgroundColor: '#FEE2E2',
  },
  priorityTextRoutine: {
    color: '#334155',
  },
  priorityTextUrgent: {
    color: '#B45309',
  },
  priorityTextStat: {
    color: '#B91C1C',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 760,
    maxHeight: '88%',
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  sectionLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  clearButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clearText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  applyButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  applyButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#F8FAFC',
  },
});
