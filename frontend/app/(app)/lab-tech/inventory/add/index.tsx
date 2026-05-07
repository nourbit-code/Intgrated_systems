import { StyleSheet, Text, View, Pressable, Modal, Platform, Alert } from 'react-native';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { TextInputField } from '@/components/ui/TextInputField';
import { SelectField } from '@/components/ui/SelectField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { theme } from '@/constants/theme';
import { useInventory } from '@/hooks/useInventory';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

export default function InventoryAddItem() {
  const router = useRouter();
  const { addItem, dropdownSettings, preferences } = useInventory();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(preferences.defaultCategory || '');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minStock, setMinStock] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [formError, setFormError] = useState('');
  const numberOnly = (value: string) => value.replace(/[^0-9]/g, '');

  useEffect(() => {
    if (!category.trim() && preferences.defaultCategory) {
      setCategory(preferences.defaultCategory);
    }
  }, [preferences.defaultCategory, category]);

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

  const handleSave = () => {
    if (!name.trim()) return setFormError('Item Name is required.');
    if (!category.trim()) return setFormError('Category is required.');
    if (!unit.trim()) return setFormError('Unit Type is required.');
    if (!quantity.trim()) return setFormError('Quantity is required.');
    if (!minStock.trim()) return setFormError('Minimum Stock is required.');
    if (!expiryDate.trim()) return setFormError('Expiry Date is required.');
    if (!supplier.trim()) return setFormError('Supplier is required.');

    const quantityNumber = Number(quantity);
    const minStockNumber = Number(minStock);
    if (!Number.isFinite(quantityNumber) || quantityNumber < 0) {
      return setFormError('Quantity must be a valid number (0 or greater).');
    }
    if (!Number.isFinite(minStockNumber) || minStockNumber < 0) {
      return setFormError('Minimum Stock must be a valid number (0 or greater).');
    }
    if (!parseDate(expiryDate)) return setFormError('Please choose a valid Expiry Date.');

    setFormError('');
    addItem({
      name: name.trim(),
      description: description.trim() || undefined,
      category: category.trim(),
      quantity: quantityNumber,
      unit: unit.trim(),
      minStock: minStockNumber,
      expiryDate: expiryDate.trim(),
      supplier: supplier.trim(),
    });
    Alert.alert('Saved', 'Inventory item saved successfully.');
    setCategory(preferences.defaultCategory || '');
    router.push('/lab-tech/inventory/items' as Href);
  };

  return (
    <DashboardLayout title="Add Inventory Item">
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.backButton} onPress={() => router.push('/lab-tech/settings' as Href)}>
              <Text style={styles.backText}>Settings</Text>
            </Pressable>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.helperText}>Fields marked with * are required.</Text>
        <View style={styles.grid}>
          <Text style={styles.blockTitle}>Required Information</Text>
          <View style={styles.fieldHalf}>
            <TextInputField label="Item Name *" value={name} onChangeText={setName} />
          </View>
          <View style={styles.fieldHalf}>
            <SelectField
              label="Category *"
              value={category || undefined}
              placeholder="Select category"
              onPress={() => setShowCategoryPicker(true)}
            />
          </View>
          <View style={styles.fieldHalf}>
            <SelectField
              label="Unit Type *"
              value={unit || undefined}
              placeholder="Select unit"
              onPress={() => setShowUnitPicker(true)}
            />
          </View>
          <View style={styles.fieldHalf}>
            <TextInputField
              label="Quantity *"
              value={quantity}
              keyboardType="number-pad"
              onChangeText={(value) => setQuantity(numberOnly(value))}
            />
          </View>
          <View style={styles.fieldHalf}>
            <TextInputField
              label="Minimum Stock *"
              value={minStock}
              keyboardType="number-pad"
              onChangeText={(value) => setMinStock(numberOnly(value))}
            />
          </View>
          <View style={styles.fieldHalf}>
            {Platform.OS === 'web' ? (
              <View style={styles.datePickerWrap}>
                <Text style={styles.dateLabel}>Expiry Date *</Text>
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
              <TextInputField label="Expiry Date *" value={expiryDate} onChangeText={setExpiryDate} />
            )}
          </View>
          <View style={styles.fieldHalf}>
            <SelectField
              label="Supplier *"
              value={supplier || undefined}
              placeholder="Select supplier"
              onPress={() => setShowSupplierPicker(true)}
            />
          </View>
          <View style={styles.fieldHalf}>
            <TextInputField label="Description" value={description} onChangeText={setDescription} />
          </View>
        </View>
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <View style={styles.actions}>
          <PrimaryButton label="Save Item" onPress={handleSave} />
        </View>
      </FormCard>

      <OptionPickerModal
        visible={showCategoryPicker}
        title="Select Category"
        options={dropdownSettings.categories}
        selected={category}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={setCategory}
      />
      <OptionPickerModal
        visible={showUnitPicker}
        title="Select Unit"
        options={dropdownSettings.units}
        selected={unit}
        onClose={() => setShowUnitPicker(false)}
        onSelect={setUnit}
      />
      <OptionPickerModal
        visible={showSupplierPicker}
        title="Select Supplier"
        options={dropdownSettings.suppliers}
        selected={supplier}
        onClose={() => setShowSupplierPicker(false)}
        onSelect={setSupplier}
      />
    </DashboardLayout>
  );
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
          {!options.length ? <Text style={styles.emptyText}>No options yet. Add options in Settings.</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
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
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  helperText: {
    marginTop: theme.spacing.md,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  grid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  fieldHalf: {
    width: '48%',
  },
  blockTitle: {
    width: '100%',
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
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
    marginTop: theme.spacing.md,
    alignItems: 'flex-start',
  },
  errorText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
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
  emptyText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
});
