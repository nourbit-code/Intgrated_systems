import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { useInventory } from '@/hooks/useInventory';
import { useInventoryPurchaseOrders } from '@/hooks/useInventoryPurchaseOrders';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card'];

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function numberOnly(value: string) {
  return value.replace(/[^0-9.]/g, '');
}

export default function ReceiveInventoryOrder() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string }>();
  const requestId = readParam(params.requestId);
  const { addItem, items } = useInventory();
  const { purchaseOrders, receivePurchaseOrder } = useInventoryPurchaseOrders();

  const order = useMemo(
    () => purchaseOrders.find((entry) => entry.id === requestId),
    [purchaseOrders, requestId]
  );

  const [receivedQty, setReceivedQty] = useState(order ? String(order.qtyToOrder) : '');
  const [unitCost, setUnitCost] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const targetItem = useMemo(() => {
    if (!order) return null;
    return (
      items.find((item) => item.id === order.itemId) ??
      items.find(
        (item) =>
          item.name.trim().toLowerCase() === order.itemName.trim().toLowerCase() &&
          item.supplier.trim().toLowerCase() === order.supplier.trim().toLowerCase()
      ) ??
      null
    );
  }, [items, order]);

  if (!order) {
    return (
      <DashboardLayout title="Receive Order">
        <FormCard>
          <Text style={styles.sectionTitle}>Order request not found.</Text>
        </FormCard>
      </DashboardLayout>
    );
  }

  const totalCostPreview = (Number(receivedQty || '0') * Number(unitCost || '0')).toFixed(2);

  const parseDate = (value: string) => {
    if (!value.trim()) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };

  return (
    <DashboardLayout title="Receive Order">
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Receive Supplier Order</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          <View style={styles.cell}>
            <TextInputField label="Request Ref" value={order.requestRef} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.cell}>
            <TextInputField label="Supplier" value={order.supplier} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.cell}>
            <TextInputField label="Item" value={order.itemName} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.cell}>
            <TextInputField label="Ordered Qty" value={`${order.qtyToOrder} ${order.qtyType}`} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.cell}>
            <TextInputField
              label="Received Qty"
              value={receivedQty}
              keyboardType="decimal-pad"
              onChangeText={(value) => setReceivedQty(numberOnly(value))}
            />
          </View>
          <View style={styles.cell}>
            <TextInputField
              label="Unit Cost"
              value={unitCost}
              keyboardType="decimal-pad"
              onChangeText={(value) => setUnitCost(numberOnly(value))}
            />
          </View>
          <View style={styles.cell}>
            {Platform.OS === 'web' ? (
              <View style={styles.datePickerWrap}>
                <Text style={styles.dateLabel}>Batch Expiry Date</Text>
                <DatePicker
                  selected={parseDate(expiryDate)}
                  onChange={(date: Date | null) => setExpiryDate(date ? formatDate(date) : '')}
                  dateFormat="yyyy-MM-dd"
                  className="clinic-date-input"
                  popperPlacement="bottom-start"
                  portalId="react-datepicker-portal"
                />
              </View>
            ) : (
              <TextInputField label="Batch Expiry Date" value={expiryDate} onChangeText={setExpiryDate} />
            )}
          </View>
          <View style={styles.cell}>
            <SelectField label="Payment Method" value={paymentMethod} onPress={() => {
              const next = PAYMENT_METHODS[(PAYMENT_METHODS.indexOf(paymentMethod) + 1) % PAYMENT_METHODS.length];
              setPaymentMethod(next);
            }} />
          </View>
          <View style={styles.cell}>
            <TextInputField label="Total Cost" value={totalCostPreview} onChangeText={() => null} editable={false} />
          </View>
        </View>
      </FormCard>

      <View style={styles.actions}>
        <PrimaryButton
          label="Confirm Received"
          onPress={() => {
            const receivedQtyNumber = Number(receivedQty);
            const unitCostNumber = Number(unitCost);
            if (!Number.isFinite(receivedQtyNumber) || receivedQtyNumber <= 0) {
              Alert.alert('Invalid quantity', 'Enter a valid received quantity.');
              return;
            }
            if (!Number.isFinite(unitCostNumber) || unitCostNumber < 0) {
              Alert.alert('Invalid cost', 'Enter a valid unit cost.');
              return;
            }
            if (!parseDate(expiryDate)) {
              Alert.alert('Invalid expiry', 'Please set a valid expiry date for this received batch.');
              return;
            }
            if (!targetItem) {
              Alert.alert('Item not found', 'Could not match this request to an inventory item.');
              return;
            }

            receivePurchaseOrder(order.id, {
              receivedQty: receivedQtyNumber,
              unitCost: unitCostNumber,
              paymentMethod,
            });
            addItem({
              name: targetItem.name,
              description: targetItem.description,
              category: targetItem.category,
              quantity: receivedQtyNumber,
              unit: targetItem.unit,
              minStock: targetItem.minStock,
              expiryDate: expiryDate.trim(),
              supplier: targetItem.supplier,
            });
            Alert.alert('Saved', 'Order received, stock updated, and marked as paid.');
            router.replace('/(app)/lab-tech/inventory/order-requests' as Href);
          }}
        />
      </View>
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
  grid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  cell: {
    width: Platform.OS === 'web' ? '48%' : '100%',
  },
  datePickerWrap: {
    gap: theme.spacing.xs,
  },
  dateLabel: {
    fontFamily: theme.font.body,
    color: theme.colors.slate,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  actions: {
    alignItems: 'flex-start',
  },
});
