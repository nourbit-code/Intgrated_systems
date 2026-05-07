import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useRouter } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { INVENTORY_SUPPLIERS } from '@/constants/inventorySuppliers';
import { useInventory } from '@/hooks/useInventory';

const SUPPLIERS_STORAGE_KEY = 'lab_inventory_suppliers_custom';
const SUPPLIED_ITEM_OPTIONS_KEY = 'lab_inventory_supplier_item_options';
const SUPPLIER_CATEGORY_OPTIONS = [
  'Reagents',
  'Consumables',
  'PPE',
  'Collection Supplies',
  'Chemistry',
  'Hematology',
  'Microbiology',
  'General',
];

type SupplierRow = {
  name: string;
  phone: string;
  email: string;
  suppliedItems: string;
  categories: string;
};

type SuppliedItemEntry = {
  name: string;
  quantity: number;
};

function parseSuppliedItems(value: string): SuppliedItemEntry[] {
  const chunks = value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  return chunks
    .map((chunk) => {
      const match = chunk.match(/^(.*)\s+x(\d+)$/i);
      if (!match) return { name: chunk, quantity: 1 };
      return { name: match[1].trim(), quantity: Number(match[2]) || 1 };
    })
    .filter((entry) => entry.name && entry.quantity > 0);
}

function formatSuppliedItems(entries: SuppliedItemEntry[]) {
  return entries
    .filter((entry) => entry.name.trim() && Number.isFinite(entry.quantity) && entry.quantity > 0)
    .map((entry) => `${entry.name.trim()} x${Math.max(1, Math.floor(entry.quantity))}`)
    .join('; ');
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
  selected?: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => null}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
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
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function InventorySuppliers() {
  const router = useRouter();
  const { items } = useInventory();

  const [suppliers, setSuppliers] = useState<SupplierRow[]>(
    INVENTORY_SUPPLIERS.map((item) => ({
      name: item.name,
      phone: item.phone,
      email: item.email,
      suppliedItems: '',
      categories: '',
    }))
  );

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [suppliedItems, setSuppliedItems] = useState('');
  const [categories, setCategories] = useState('');
  const [error, setError] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [suppliedItemOptionsCustom, setSuppliedItemOptionsCustom] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSuppliedItemsModal, setShowSuppliedItemsModal] = useState(false);
  const [suppliedItemQuery, setSuppliedItemQuery] = useState('');
  const [newSuppliedItem, setNewSuppliedItem] = useState('');
  const [suppliedItemQtyMap, setSuppliedItemQtyMap] = useState<Record<string, number>>({});

  const suppliedItemOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...items.map((item) => item.name.trim()).filter(Boolean),
        ...suppliedItemOptionsCustom.map((item) => item.trim()).filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [items, suppliedItemOptionsCustom]);

  const filteredSuppliedItemOptions = useMemo(() => {
    const q = suppliedItemQuery.trim().toLowerCase();
    if (!q) return suppliedItemOptions;
    return suppliedItemOptions.filter((option) => option.toLowerCase().includes(q));
  }, [suppliedItemOptions, suppliedItemQuery]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const stored = window.localStorage.getItem(SUPPLIERS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<SupplierRow>[];
      if (!Array.isArray(parsed)) return;
      setSuppliers(
        parsed.map((item) => ({
          name: item.name?.trim() ?? '',
          phone: item.phone?.trim() ?? '',
          email: item.email?.trim() ?? '',
          suppliedItems: item.suppliedItems?.trim() ?? '',
          categories: item.categories?.trim() ?? '',
        }))
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      window.localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers));
    } catch {
      // ignore
    }
  }, [suppliers]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const stored = window.localStorage.getItem(SUPPLIED_ITEM_OPTIONS_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as string[];
      if (!Array.isArray(parsed)) return;
      setSuppliedItemOptionsCustom(parsed.map((item) => item.trim()).filter(Boolean));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      window.localStorage.setItem(SUPPLIED_ITEM_OPTIONS_KEY, JSON.stringify(suppliedItemOptionsCustom));
    } catch {
      // ignore
    }
  }, [suppliedItemOptionsCustom]);

  const normalized = useMemo(
    () => ({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      suppliedItems: suppliedItems.trim(),
      categories: categories.trim(),
    }),
    [name, phone, email, suppliedItems, categories]
  );

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setSuppliedItems('');
    setCategories('');
    setEditingIndex(null);
    setError('');
  };

  const duplicateExists = (ignoreIndex: number | null) =>
    suppliers.some((item, index) => {
      if (ignoreIndex !== null && index === ignoreIndex) return false;
      return (
        item.name.trim().toLowerCase() === normalized.name.toLowerCase() ||
        item.email.trim().toLowerCase() === normalized.email
      );
    });

  const openSuppliedItemsModal = () => {
    const initialMap: Record<string, number> = {};
    parseSuppliedItems(suppliedItems).forEach((entry) => {
      initialMap[entry.name] = Math.max(1, Math.floor(entry.quantity));
    });
    setSuppliedItemQtyMap(initialMap);
    setSuppliedItemQuery('');
    setNewSuppliedItem('');
    setShowSuppliedItemsModal(true);
  };

  const addCustomSuppliedItemOption = () => {
    const value = newSuppliedItem.trim();
    if (!value) return;

    const exists = suppliedItemOptions.some((item) => item.toLowerCase() === value.toLowerCase());
    if (!exists) {
      setSuppliedItemOptionsCustom((prev) => [...prev, value]);
    }

    setSuppliedItemQtyMap((prev) => ({
      ...prev,
      [value]: Math.max(1, prev[value] ?? 1),
    }));

    setNewSuppliedItem('');
  };

  const applySuppliedItemsSelection = () => {
    const entries = Object.entries(suppliedItemQtyMap)
      .filter(([, qty]) => qty > 0)
      .map(([itemName, qty]) => ({ name: itemName, quantity: qty }));

    setSuppliedItems(formatSuppliedItems(entries));
    setShowSuppliedItemsModal(false);
  };

  const saveSupplier = () => {
    if (!normalized.name) {
      setError('Supplier name is required.');
      return;
    }
    if (!normalized.phone) {
      setError('Phone is required.');
      return;
    }
    if (!normalized.email || !normalized.email.includes('@')) {
      setError('Valid email is required.');
      return;
    }
    if (!normalized.suppliedItems) {
      setError('Items supplied is required.');
      return;
    }
    if (duplicateExists(editingIndex)) {
      setError('Supplier with same name or email already exists.');
      return;
    }

    setError('');

    if (editingIndex === null) {
      setSuppliers((prev) => [
        ...prev,
        {
          name: normalized.name,
          phone: normalized.phone,
          email: normalized.email,
          suppliedItems: normalized.suppliedItems,
          categories: normalized.categories,
        },
      ]);
      resetForm();
      Alert.alert('Saved', 'Supplier added successfully.');
      return;
    }

    setSuppliers((prev) =>
      prev.map((item, index) =>
        index === editingIndex
          ? {
              name: normalized.name,
              phone: normalized.phone,
              email: normalized.email,
              suppliedItems: normalized.suppliedItems,
              categories: normalized.categories,
            }
          : item
      )
    );
    resetForm();
    Alert.alert('Updated', 'Supplier updated successfully.');
  };

  return (
    <DashboardLayout title="Suppliers">
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>{editingIndex === null ? 'Add Supplier' : 'Edit Supplier'}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.formGrid}>
          <View style={styles.formCell}>
            <TextInputField label="Supplier Name *" value={name} onChangeText={setName} />
          </View>
          <View style={styles.formCell}>
            <TextInputField label="Phone *" value={phone} onChangeText={setPhone} />
          </View>
          <View style={styles.formCell}>
            <TextInputField label="Email *" value={email} onChangeText={setEmail} />
          </View>

          <View style={styles.formCell}>
            <SelectField
              label="Items Supplied *"
              value={suppliedItems || 'Open combobox'}
              placeholder="Select items and quantities"
              onPress={openSuppliedItemsModal}
            />
          </View>

          <View style={styles.formCell}>
            <SelectField
              label="Categories"
              value={categories || 'Select category'}
              onPress={() => setShowCategoryPicker(true)}
            />
          </View>

          <View style={styles.formCell}>
            <View style={styles.helpChip}>
              <Text style={styles.helpText}>Items picker supports search, quantities, and adding new items.</Text>
            </View>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.formActions}>
          <PrimaryButton label={editingIndex === null ? 'Save Supplier' : 'Update Supplier'} onPress={saveSupplier} />
          {editingIndex !== null ? (
            <Pressable style={styles.cancelEditButton} onPress={resetForm}>
              <Text style={styles.cancelEditText}>Cancel Edit</Text>
            </Pressable>
          ) : null}
        </View>
      </FormCard>

      <DataTable
        columns={['Supplier', 'Phone', 'Email', 'Category', 'Items Supplied', 'Action']}
        columnWidths={[170, 140, 220, 130, 320, 180]}
        rows={suppliers.map((supplier, index) => [
          supplier.name,
          supplier.phone,
          supplier.email,
          supplier.categories || '-',
          supplier.suppliedItems || '-',
          <View key={`actions-${supplier.email}-${index}`} style={styles.rowActions}>
            <Pressable
              style={styles.editButton}
              onPress={() => {
                setEditingIndex(index);
                setName(supplier.name);
                setPhone(supplier.phone);
                setEmail(supplier.email);
                setSuppliedItems(supplier.suppliedItems ?? '');
                setCategories(supplier.categories ?? '');
                setError('');
              }}
            >
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  const ok = typeof window !== 'undefined' ? window.confirm(`Delete ${supplier.name}?`) : false;
                  if (!ok) return;
                  setSuppliers((prev) => prev.filter((_, i) => i !== index));
                  if (editingIndex === index) resetForm();
                  return;
                }

                Alert.alert('Delete Supplier', `Delete ${supplier.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      setSuppliers((prev) => prev.filter((_, i) => i !== index));
                      if (editingIndex === index) resetForm();
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>,
        ])}
      />

      <OptionPickerModal
        visible={showCategoryPicker}
        title="Select Supplier Category"
        options={SUPPLIER_CATEGORY_OPTIONS}
        selected={categories}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(value) => setCategories(value)}
      />

      {showSuppliedItemsModal ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowSuppliedItemsModal(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowSuppliedItemsModal(false)}>
            <Pressable style={styles.modalCardWide} onPress={() => null}>
              <Text style={styles.modalTitle}>Items Supplied</Text>

              <TextInput
                value={suppliedItemQuery}
                onChangeText={setSuppliedItemQuery}
                placeholder="Search items..."
                placeholderTextColor={theme.colors.slate}
                style={styles.modalSearchInput}
              />

              <View style={styles.addCustomRow}>
                <TextInput
                  value={newSuppliedItem}
                  onChangeText={setNewSuppliedItem}
                  placeholder="Add new item to list..."
                  placeholderTextColor={theme.colors.slate}
                  style={styles.modalSearchInput}
                />
                <Pressable style={styles.addCustomButton} onPress={addCustomSuppliedItemOption}>
                  <Text style={styles.addCustomText}>Add</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                {filteredSuppliedItemOptions.map((option) => {
                  const qty = suppliedItemQtyMap[option] ?? 0;
                  return (
                    <View key={option} style={styles.qtyRow}>
                      <Text style={styles.qtyLabel}>{option}</Text>
                      <View style={styles.qtyControls}>
                        <Pressable
                          style={styles.qtyButton}
                          onPress={() =>
                            setSuppliedItemQtyMap((prev) => ({
                              ...prev,
                              [option]: Math.max(0, (prev[option] ?? 0) - 1),
                            }))
                          }
                        >
                          <Text style={styles.qtyButtonText}>-</Text>
                        </Pressable>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <Pressable
                          style={styles.qtyButton}
                          onPress={() =>
                            setSuppliedItemQtyMap((prev) => ({
                              ...prev,
                              [option]: (prev[option] ?? 0) + 1,
                            }))
                          }
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelEditButton} onPress={() => setShowSuppliedItemsModal(false)}>
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.addCustomButton} onPress={applySuppliedItemsSelection}>
                  <Text style={styles.addCustomText}>Apply</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
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
  formGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  formCell: {
    width: Platform.OS === 'web' ? '31.5%' : '100%',
  },
  formActions: {
    marginTop: theme.spacing.md,
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  errorText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B91C1C',
  },
  cancelEditButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  cancelEditText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  editText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#1D4ED8',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
  },
  deleteText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#991B1B',
  },
  helpChip: {
    minHeight: 50,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  helpText: {
    fontFamily: theme.font.body,
    fontSize: 11,
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
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
  },
  modalCardWide: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 640,
    maxHeight: '85%',
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  modalList: {
    maxHeight: 320,
  },
  modalListContent: {
    gap: 4,
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
  modalSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: '#FBFCFE',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  addCustomRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  addCustomButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: '#16A34A',
  },
  addCustomText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#F8FAFC',
  },
  qtyRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  qtyLabel: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  qtyValue: {
    width: 26,
    textAlign: 'center',
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: theme.colors.ink,
  },
  modalActions: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
});
