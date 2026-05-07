import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { FormCard } from '@/components/ui/FormCard';
import { DataTable } from '@/components/ui/DataTable';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { useInventory } from '@/hooks/useInventory';

function isExpiringSoon(date: string) {
  const expiry = new Date(date);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days <= 30 && days >= 0;
}

function isExpired(date: string) {
  return new Date(date) < new Date();
}

function isUsableForStock(date: string, isBlocked?: boolean) {
  if (isBlocked) return false;
  return !isExpired(date);
}

function daysToExpiry(date: string) {
  const expiry = new Date(date);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type StockFilter = 'All' | 'Low Stock' | 'Expiring Soon' | 'Expired';

export default function InventoryDashboard() {
  const router = useRouter();
  const { items, transactions } = useInventory();
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('All');

  const lowStock = items.filter((item) => isUsableForStock(item.expiryDate, item.isBlocked) && item.quantity <= item.minStock);
  const expiringSoon = items.filter((item) => !item.isBlocked && !isExpired(item.expiryDate) && isExpiringSoon(item.expiryDate));
  const usedToday = transactions.filter((tx) => {
    if (tx.type !== 'Used') return false;
    const d = new Date(tx.date).toDateString();
    return d === new Date().toDateString();
  });

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const low = item.quantity <= item.minStock;
      const expSoon = !item.isBlocked && !isExpired(item.expiryDate) && isExpiringSoon(item.expiryDate);
      const expired = item.isBlocked || isExpired(item.expiryDate);
      const lowUsable = isUsableForStock(item.expiryDate, item.isBlocked) && low;
      if (stockFilter === 'Low Stock' && !lowUsable) return false;
      if (stockFilter === 'Expiring Soon' && !expSoon) return false;
      if (stockFilter === 'Expired' && !expired) return false;
      if (!q) return true;
      const haystack = `${item.id} ${item.name} ${item.category} ${item.supplier}`.toLowerCase();
      return haystack.includes(q);
    });

    return filtered.sort((a, b) => {
      const aExpired = isExpired(a.expiryDate);
      const bExpired = isExpired(b.expiryDate);
      if (aExpired !== bExpired) return aExpired ? -1 : 1;
      const aLow = a.quantity <= a.minStock;
      const bLow = b.quantity <= b.minStock;
      if (aLow !== bLow) return aLow ? -1 : 1;
      const aDays = daysToExpiry(a.expiryDate);
      const bDays = daysToExpiry(b.expiryDate);
      return aDays - bDays;
    });
  }, [items, query, stockFilter]);

  return (
    <DashboardLayout title="Inventory">
      <View style={styles.stats}>
        <StatCard label="Total Items" value={items.length} />
        <StatCard label="Low Stock" value={lowStock.length} tone="accent" />
        <StatCard label="Expiring Soon" value={expiringSoon.length} />
        <StatCard label="Used Today" value={usedToday.length} />
      </View>

      <FormCard>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.actionRow}>
          {[
            { label: 'Items List', path: '/lab-tech/inventory/items' },
            { label: 'Add Item', path: '/lab-tech/inventory/add' },
            { label: 'Transactions', path: '/lab-tech/inventory/transactions' },
            { label: 'Low Stock Alerts', path: '/lab-tech/inventory/alerts' },
            { label: 'Expiry Alerts', path: '/lab-tech/inventory/expired-alerts' },
            { label: 'Order Requests', path: '/lab-tech/inventory/order-requests' },
            { label: 'Suppliers', path: '/lab-tech/inventory/suppliers' },
            { label: 'Reports', path: '/lab-tech/inventory/reports' },
            { label: 'Settings', path: '/lab-tech/inventory/settings' },
          ].map((item) => (
            <Pressable key={item.label} style={styles.actionButton} onPress={() => router.push(item.path as Href)}>
              <Text style={styles.actionText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Inventory Explorer</Text>
        <View style={styles.searchRow}>
          <TextInputField label="Search" value={query} onChangeText={setQuery} placeholder="INV01 / EDTA / BioLab" />
        </View>
        <View style={styles.filterChips}>
          {(['All', 'Low Stock', 'Expiring Soon', 'Expired'] as StockFilter[]).map((option) => (
            <Pressable
              key={option}
              onPress={() => setStockFilter(option)}
              style={[styles.filterChip, stockFilter === option && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, stockFilter === option && styles.filterChipTextActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tableWrap}>
          <DataTable
            title={`Inventory Items (${filteredItems.length})`}
            columns={['Item ID', 'Item Name', 'Category', 'Qty', 'Min', 'Unit', 'Expiry', 'Status', 'Supplier']}
            columnWidths={[80, 170, 130, 70, 70, 70, 110, 130, 140]}
            rows={filteredItems.map((item) => [
              item.id,
              item.name,
              item.category,
              String(item.quantity),
              String(item.minStock),
              item.unit,
              item.expiryDate,
              item.isBlocked || isExpired(item.expiryDate)
                ? 'Expired'
                : item.quantity <= item.minStock
                  ? 'Low Stock'
                  : isExpiringSoon(item.expiryDate)
                    ? 'Expiring Soon'
                    : 'Healthy',
              item.supplier,
            ])}
          />
        </View>
      </FormCard>
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
  actionRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  actionButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: '#16A34A',
  },
  actionText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#F8FAFC',
  },
  searchRow: {
    marginTop: theme.spacing.md,
  },
  filterChips: {
    marginTop: theme.spacing.md,
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
  tableWrap: {
    marginTop: theme.spacing.md,
  },
});
