import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FormCard } from '@/components/ui/FormCard';
import { theme } from '@/constants/theme';
import { useInventoryPurchaseOrders } from '@/hooks/useInventoryPurchaseOrders';

export default function InventoryOrderRequests() {
  const router = useRouter();
  const { purchaseOrders } = useInventoryPurchaseOrders();

  const formatAmount = (value?: number) => {
    if (typeof value !== 'number') return '-';
    return `${value.toFixed(2)} EGP`;
  };

  return (
    <DashboardLayout title="Order Requests">
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Supplier Order Requests</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </FormCard>

      <FormCard>
        <DataTable
          embedded
          title={`Requests (${purchaseOrders.length})`}
          columns={['Ref', 'Item', 'Supplier', 'Qty', 'Status', 'Payment', 'Total', 'Action']}
          columnWidths={[120, 170, 140, 90, 95, 95, 100, 110]}
          rows={purchaseOrders.map((order) => ([
            order.requestRef,
            order.itemName,
            order.supplier,
            `${order.qtyToOrder} ${order.qtyType}`,
            order.status,
            order.status === 'Received' ? 'Paid' : 'Pending',
            formatAmount(order.totalCost),
            order.status === 'Requested' ? (
              <Pressable
                style={styles.actionButton}
                onPress={() => router.push(`/lab-tech/inventory/order-requests/${order.id}` as Href)}
              >
                <Text style={styles.actionText}>Receive</Text>
              </Pressable>
            ) : (
              <Text style={styles.doneText}>Received</Text>
            ),
          ]))}
          bodyMaxHeight={520}
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
  actionButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    backgroundColor: theme.colors.card,
  },
  actionText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  doneText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#166534',
  },
});
