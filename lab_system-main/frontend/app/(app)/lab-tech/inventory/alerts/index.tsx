import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FiltersBar } from '@/components/ui/FiltersBar';
import { FormCard } from '@/components/ui/FormCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/SelectField';
import { theme } from '@/constants/theme';
import { useInventory } from '@/hooks/useInventory';

type SortBy = 'Highest Risk' | 'Soonest Expiry' | 'Largest Shortage';

type AlertRow = {
  id: string;
  itemName: string;
  category: string;
  supplier: string;
  unit: string;
  quantity: number;
  minStock: number;
  shortage: number;
  expiryDate: string;
  daysLeft: number;
};

const SORT_OPTIONS: SortBy[] = ['Highest Risk', 'Soonest Expiry', 'Largest Shortage'];

function daysToExpiry(value: string) {
  const now = new Date();
  const expiry = new Date(value);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

export default function InventoryAlerts() {
  const router = useRouter();
  const { items } = useInventory();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('Highest Risk');
  const [showSortPicker, setShowSortPicker] = useState(false);

  const alerts = useMemo<AlertRow[]>(() => {
    const groups = new Map<string, { item: typeof items[number]; totalQty: number; nearestExpiryDays: number }>();
    items.forEach((item) => {
      const daysLeft = daysToExpiry(item.expiryDate);
      const isExpired = daysLeft < 0;
      if (isExpired || item.isBlocked) return;
      const key = `${item.name.toLowerCase()}|${item.category.toLowerCase()}|${item.supplier.toLowerCase()}|${item.unit.toLowerCase()}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { item, totalQty: item.quantity, nearestExpiryDays: daysLeft });
        return;
      }
      groups.set(key, {
        item: existing.item,
        totalQty: existing.totalQty + item.quantity,
        nearestExpiryDays: Math.min(existing.nearestExpiryDays, daysLeft),
      });
    });

    return Array.from(groups.values())
      .filter((group) => group.totalQty <= group.item.minStock)
      .map((group) => ({
        id: group.item.id,
        itemName: group.item.name,
        category: group.item.category,
        supplier: group.item.supplier,
        unit: group.item.unit,
        quantity: group.totalQty,
        minStock: group.item.minStock,
        shortage: Math.max(1, group.item.minStock - group.totalQty + 1),
        expiryDate: group.item.expiryDate,
        daysLeft: group.nearestExpiryDays,
      }));
  }, [items]);

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = alerts.filter((row) => {
      if (!q) return true;
      const haystack = `${row.itemName} ${row.category} ${row.supplier}`.toLowerCase();
      return haystack.includes(q);
    });

    return next.sort((a, b) => {
      if (sortBy === 'Largest Shortage') return b.shortage - a.shortage;
      if (sortBy === 'Soonest Expiry') return a.daysLeft - b.daysLeft;
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
      return b.shortage - a.shortage;
    });
  }, [alerts, query, sortBy]);

  return (
    <DashboardLayout title="Low Stock Alerts">
      <FormCard>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.sectionTitle}>Alerts Center</Text>
            <InfoHint text="This page shows only low stock items." />
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/lab-tech/inventory/expired-alerts' as Href)}>
              <Text style={styles.secondaryButtonText}>Expiry Alerts</Text>
            </Pressable>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </View>
        </View>
      </FormCard>

      <FormCard>
        <FiltersBar>
          <SearchInput placeholder="Search by item, category, supplier" value={query} onChangeText={setQuery} />
          <SelectField label="Sort" value={sortBy} onPress={() => setShowSortPicker(true)} />
        </FiltersBar>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{filteredAlerts.length} alert(s) shown</Text>
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              setQuery('');
              setSortBy('Highest Risk');
            }}
          >
            <Text style={styles.clearText}>Clear Filters</Text>
          </Pressable>
        </View>
        <DataTable
          embedded
          title="Alerted Items"
          columns={['Item', 'Category', 'Qty / Min', 'Nearest Expiry', 'Alert Type', 'Action']}
          columnWidths={[190, 130, 110, 170, 160, 130]}
          rows={filteredAlerts.map((row) => ([
            row.itemName,
            row.category,
            `${row.quantity} / ${row.minStock}`,
            formatDate(row.expiryDate),
            <Text style={styles.alertTypeText}>Low Stock</Text>,
            <Pressable
              style={styles.actionButton}
              onPress={() =>
                router.push(
                  `/(app)/lab-tech/inventory/request-order?itemId=${encodeURIComponent(row.id)}&itemName=${encodeURIComponent(row.itemName)}&category=${encodeURIComponent(row.category)}&supplier=${encodeURIComponent(row.supplier)}&unit=${encodeURIComponent(row.unit)}&quantity=${encodeURIComponent(String(row.quantity))}&minStock=${encodeURIComponent(String(row.minStock))}&shortage=${encodeURIComponent(String(row.shortage))}` as Href
                )
              }
            >
              <Text style={styles.actionText}>New Order</Text>
            </Pressable>,
          ]))}
          bodyMaxHeight={460}
        />
      </FormCard>

      <OptionPickerModal
        visible={showSortPicker}
        title="Sort Alerts"
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
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
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
  secondaryButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  secondaryButtonText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  summaryRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  alertTypeText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B45309',
  },
  actionButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  actionText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
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
