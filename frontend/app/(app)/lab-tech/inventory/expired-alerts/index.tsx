import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FormCard } from '@/components/ui/FormCard';
import { theme } from '@/constants/theme';
import { useInventory } from '@/hooks/useInventory';

type ExpiryRow = {
  id: string;
  itemName: string;
  category: string;
  qty: number;
  min: number;
  expiryDate: string;
  daysLeft: number;
  alertType: 'Expired' | 'Expiring Soon';
  isBlocked: boolean;
};

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

export default function ExpiredAlertsPage() {
  const router = useRouter();
  const { items, markItemExpired } = useInventory();

  const rows = useMemo(() => {
    return items
      .map((item) => {
        const daysLeft = daysToExpiry(item.expiryDate);
        const isExpired = daysLeft < 0;
        const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;
        if (!isExpired && !isExpiringSoon) return null;
        return {
          id: item.id,
          itemName: item.name,
          category: item.category,
          qty: item.quantity,
          min: item.minStock,
          expiryDate: item.expiryDate,
          daysLeft,
          alertType: isExpired ? 'Expired' : 'Expiring Soon',
          isBlocked: Boolean(item.isBlocked),
        } as ExpiryRow;
      })
      .filter((row): row is ExpiryRow => Boolean(row));
  }, [items]);

  return (
    <DashboardLayout title="Expiry Alerts">
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Expiry Alerts</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <Text style={styles.helperText}>
          Remove marks the batch as unusable across the system but keeps it visible here in red.
        </Text>
      </FormCard>

      <FormCard>
        <DataTable
          embedded
          title={`Expiry Items (${rows.length})`}
          columns={['Item', 'Category', 'Qty / Min', 'Expiry', 'Alert Type', 'Action']}
          columnWidths={[190, 130, 100, 160, 180, 130]}
          rows={rows.map((row) => ([
            row.itemName,
            row.category,
            `${row.qty} / ${row.min}`,
            row.daysLeft < 0 ? `Expired (${formatDate(row.expiryDate)})` : `${formatDate(row.expiryDate)} (${row.daysLeft}d)`,
            <Text style={[styles.alertTypeText, row.isBlocked && styles.alertTypeRemoved]}>
              {row.alertType}
            </Text>,
            row.isBlocked ? (
              <Text style={styles.removedText}>Removed</Text>
            ) : (
              <Pressable style={styles.removeButton} onPress={() => markItemExpired(row.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ),
          ]))}
          bodyMaxHeight={540}
        />
      </FormCard>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
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
  helperText: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  alertTypeText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B45309',
  },
  alertTypeRemoved: {
    color: '#DC2626',
    fontFamily: theme.font.heading,
  },
  removeButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
  },
  removeText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#991B1B',
  },
  removedText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#DC2626',
  },
});
