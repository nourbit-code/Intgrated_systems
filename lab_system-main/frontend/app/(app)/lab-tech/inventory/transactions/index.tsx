import { useMemo, useState } from 'react';
import { StyleSheet, Text, Pressable, View, Modal } from 'react-native';

import { useRouter } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FormCard } from '@/components/ui/FormCard';
import { FiltersBar } from '@/components/ui/FiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/SelectField';
import { StatCard } from '@/components/ui/StatCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { theme } from '@/constants/theme';
import { useInventory } from '@/hooks/useInventory';

type TxTypeFilter = 'All' | 'Added' | 'Used' | 'Expired' | 'Adjusted';
type SortBy = 'Newest First' | 'Oldest First' | 'Largest Quantity';

const TYPE_OPTIONS: TxTypeFilter[] = ['All', 'Added', 'Used', 'Expired', 'Adjusted'];
const SORT_OPTIONS: SortBy[] = ['Newest First', 'Oldest First', 'Largest Quantity'];

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function OptionPickerModal({
  visible,
  title,
  options,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => null}>
          <Text style={styles.modalTitle}>{title}</Text>
          {options.map((option) => {
            const active = option === selected;
            return (
              <Pressable
                key={option}
                style={[styles.modalItem, active && styles.modalItemActive]}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
              >
                <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function InventoryTransactions() {
  const router = useRouter();
  const { transactions } = useInventory();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>('All');
  const [sortBy, setSortBy] = useState<SortBy>('Newest First');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);

  const filteredTransactions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = transactions.filter((tx) => {
      if (typeFilter !== 'All' && tx.type !== typeFilter) return false;
      if (!q) return true;
      const haystack = `${tx.itemName} ${tx.type} ${tx.performedBy}`.toLowerCase();
      return haystack.includes(q);
    });

    return next.sort((a, b) => {
      if (sortBy === 'Oldest First') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'Largest Quantity') return Math.abs(b.quantity) - Math.abs(a.quantity);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [transactions, query, typeFilter, sortBy]);

  const total = filteredTransactions.length;
  const added = filteredTransactions.filter((tx) => tx.type === 'Added').length;
  const used = filteredTransactions.filter((tx) => tx.type === 'Used').length;
  const netChange = filteredTransactions.reduce((sum, tx) => sum + tx.quantity, 0);

  return (
    <DashboardLayout title="Stock Transactions">
      <FormCard>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.sectionTitle}>Transactions Explorer</Text>
            <InfoHint text="Track all stock movement by item, type, and time." />
          </View>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </FormCard>

      <View style={styles.stats}>
        <StatCard label="Transactions" value={total} />
        <StatCard label="Added" value={added} />
        <StatCard label="Used" value={used} tone="accent" />
        <StatCard label="Net Qty Change" value={netChange > 0 ? `+${netChange}` : `${netChange}`} />
      </View>

      <FormCard>
        <FiltersBar>
          <SearchInput
            placeholder="Search by item, type, or performer"
            value={query}
            onChangeText={setQuery}
          />
          <SelectField label="Type" value={typeFilter} onPress={() => setShowTypePicker(true)} />
          <SelectField label="Sort" value={sortBy} onPress={() => setShowSortPicker(true)} />
        </FiltersBar>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{filteredTransactions.length} record(s) shown</Text>
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              setQuery('');
              setTypeFilter('All');
              setSortBy('Newest First');
            }}
          >
            <Text style={styles.clearText}>Clear Filters</Text>
          </Pressable>
        </View>
        <DataTable
          embedded
          title="Stock Movement Log"
          columns={['Date & Time', 'Item', 'Type', 'Quantity', 'Performed By']}
          columnWidths={[170, 220, 130, 120, 160]}
          rows={filteredTransactions.map((tx) => ([
            formatDate(tx.date),
            tx.itemName,
            <Text
              style={[
                styles.typePill,
                tx.type === 'Added' && styles.typeAdded,
                tx.type === 'Used' && styles.typeUsed,
                tx.type === 'Expired' && styles.typeExpired,
                tx.type === 'Adjusted' && styles.typeAdjusted,
              ]}
            >
              {tx.type}
            </Text>,
            tx.quantity > 0 ? `+${tx.quantity}` : `${tx.quantity}`,
            tx.performedBy,
          ]))}
          bodyMaxHeight={460}
        />
      </FormCard>

      {filteredTransactions.length === 0 ? (
        <FormCard>
          <Text style={styles.emptyTitle}>No transactions found</Text>
          <Text style={styles.emptyText}>Try another filter or perform stock actions to create movement logs.</Text>
        </FormCard>
      ) : null}

      <OptionPickerModal
        visible={showTypePicker}
        title="Transaction Type"
        options={TYPE_OPTIONS}
        selected={typeFilter}
        onClose={() => setShowTypePicker(false)}
        onSelect={(value) => setTypeFilter(value as TxTypeFilter)}
      />
      <OptionPickerModal
        visible={showSortPicker}
        title="Sort Transactions"
        options={SORT_OPTIONS}
        selected={sortBy}
        onClose={() => setShowSortPicker(false)}
        onSelect={(value) => setSortBy(value as SortBy)}
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
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  summaryRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  clearButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  clearText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  typePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#0F172A',
  },
  typeAdded: {
    backgroundColor: '#DCFCE7',
  },
  typeUsed: {
    backgroundColor: '#FEF3C7',
  },
  typeExpired: {
    backgroundColor: '#FEE2E2',
  },
  typeAdjusted: {
    backgroundColor: '#E2E8F0',
  },
  emptyTitle: {
    fontFamily: theme.font.heading,
    fontSize: 15,
    color: theme.colors.ink,
  },
  emptyText: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
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
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  modalItem: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalItemActive: {
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  modalItemText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  modalItemTextActive: {
    fontFamily: theme.font.heading,
    color: theme.colors.ink,
  },
});
