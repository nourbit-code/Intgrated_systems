import { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { findSupplierContact } from '@/constants/inventorySuppliers';
import { theme } from '@/constants/theme';
import { useInventoryPurchaseOrders } from '@/hooks/useInventoryPurchaseOrders';

function readParam(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default function InventoryRequestOrder() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itemId?: string;
    itemName?: string;
    category?: string;
    supplier?: string;
    unit?: string;
    quantity?: string;
    minStock?: string;
    shortage?: string;
  }>();

  const itemId = readParam(params.itemId, '-');
  const itemName = readParam(params.itemName, '-');
  const category = readParam(params.category, '-');
  const supplier = readParam(params.supplier, '-');
  const unit = readParam(params.unit, '');
  const shortage = readParam(params.shortage, '0');
  const { addPurchaseOrder } = useInventoryPurchaseOrders();

  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showQtyTypePicker, setShowQtyTypePicker] = useState(false);

  const requestRef = useMemo(() => `REQ-${Date.now().toString().slice(-6)}`, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const initialRequestQuantity = useMemo(() => {
    const shortageNum = Number(shortage);
    return Number.isFinite(shortageNum) && shortageNum > 0 ? String(shortageNum) : '1';
  }, [shortage]);
  const [qtyToOrder, setQtyToOrder] = useState(initialRequestQuantity);
  const normalizedUnit = unit.trim().toLowerCase();
  const qtyTypeOptions = useMemo(() => {
    const base = ['pcs', 'box', 'pair', 'kit', 'bottle', 'pack'];
    if (!normalizedUnit) return base;
    return base.includes(normalizedUnit) ? base : [normalizedUnit, ...base];
  }, [normalizedUnit]);
  const initialQtyType = normalizedUnit || 'pcs';
  const [qtyType, setQtyType] = useState(initialQtyType);

  const numberOnly = (value: string) => value.replace(/[^0-9]/g, '');
  const supplierContact = useMemo(() => findSupplierContact(supplier), [supplier]);
  const supplierEmail = supplierContact?.email ?? '';

  const buildEmailTemplate = () => {
    const subject = `Inventory Order Request ${requestRef} - ${itemName}`;
    const body = [
      `Dear ${supplierContact?.name ?? supplier},`,
      '',
      'Please process the following inventory order request:',
      '',
      `Request Ref: ${requestRef}`,
      `Request Date: ${today}`,
      `Item ID: ${itemId}`,
      `Item Name: ${itemName}`,
      `Category: ${category}`,
      `Requested Qty: ${qtyToOrder} ${qtyType}`,
      '',
      'Please confirm availability and expected delivery date.',
      '',
      'Regards,',
      'Lab Inventory Team',
    ].join('\n');
    return { subject, body };
  };

  const handleSendRequest = async () => {
    if (submitting) return;
    if (!qtyToOrder.trim()) {
      Alert.alert('Qty required', 'Please enter Qty To Order.');
      return;
    }
    if (!supplierEmail) {
      Alert.alert(
        'Supplier email not found',
        `No stored email was found for "${supplier}". Please update supplier info first.`
      );
      return;
    }

    const { subject, body } = buildEmailTemplate();
    const mailtoUrl = `mailto:${encodeURIComponent(supplierEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (!canOpen) {
        Alert.alert('Email app unavailable', 'No email client is configured on this device.');
        return;
      }
      await Linking.openURL(mailtoUrl);
      addPurchaseOrder({
        requestRef,
        requestedAt: today,
        itemId,
        itemName,
        category,
        supplier,
        supplierEmail,
        qtyToOrder: Number(qtyToOrder),
        qtyType,
      });
      setSubmitting(true);
      setShowConfirm(true);
      setTimeout(() => {
        router.replace('/(app)/lab-tech/inventory/alerts' as Href);
      }, 1200);
    } catch {
      Alert.alert('Send failed', 'Could not open the email app. Please try again.');
    }
  };

  return (
    <DashboardLayout title="Request Order">
      <FormCard>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.sectionTitle}>Order Request</Text>
            <InfoHint text="Review details, set quantity and unit type, then send supplier request email." />
          </View>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <View style={styles.fieldGrid}>
          <View style={styles.fieldCell}>
            <TextInputField label="Request Ref" value={requestRef} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.fieldCell}>
            <TextInputField label="Request Date" value={today} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.fieldCell}>
            <TextInputField label="Item ID" value={itemId} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.fieldCell}>
            <TextInputField label="Item Name" value={itemName} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.fieldCell}>
            <TextInputField label="Category" value={category} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.fieldCell}>
            <TextInputField label="Supplier" value={supplier} onChangeText={() => null} editable={false} />
          </View>
          <View style={styles.fieldCell}>
            <TextInputField
              label="Supplier Email"
              value={supplierEmail || '-'}
              onChangeText={() => null}
              editable={false}
            />
          </View>
          <View style={styles.fieldCell}>
            <TextInputField
              label="Qty To Order"
              value={qtyToOrder}
              onChangeText={(value) => setQtyToOrder(numberOnly(value))}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.fieldCell}>
            <SelectField label="Qty Type" value={qtyType} onPress={() => setShowQtyTypePicker(true)} />
          </View>
        </View>
      </FormCard>

      <View style={styles.actions}>
        <PrimaryButton
          label={submitting ? 'Request Sent' : 'Send Request'}
          disabled={submitting}
          onPress={handleSendRequest}
        />
        {showConfirm ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmIcon}>OK</Text>
            <Text style={styles.confirmText}>Request sent. Returning to Low Stock Alerts...</Text>
          </View>
        ) : null}
      </View>

      <Modal
        transparent
        visible={showQtyTypePicker}
        animationType="fade"
        onRequestClose={() => setShowQtyTypePicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowQtyTypePicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Select Qty Type</Text>
            {qtyTypeOptions.map((option) => (
              <Pressable
                key={option}
                style={[styles.modalOption, qtyType === option && styles.modalOptionActive]}
                onPress={() => {
                  setQtyType(option);
                  setShowQtyTypePicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, qtyType === option && styles.modalOptionTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
  titleWrap: {
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
  fieldGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  fieldCell: {
    width: Platform.OS === 'web' ? '48%' : '100%',
  },
  actions: {
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  confirmBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  confirmIcon: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#047857',
  },
  confirmText: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: '#065F46',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 15,
    color: theme.colors.ink,
    marginBottom: theme.spacing.xs,
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  modalOptionActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  modalOptionText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  modalOptionTextActive: {
    fontFamily: theme.font.heading,
  },
});
