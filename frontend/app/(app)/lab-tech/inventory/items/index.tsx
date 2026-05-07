import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FormCard } from '@/components/ui/FormCard';
import { FiltersBar } from '@/components/ui/FiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { theme } from '@/constants/theme';
import { useInventory } from '@/hooks/useInventory';

type InventoryStatus = 'All' | 'OK' | 'Low' | 'Expiring' | 'Expired';
type SortBy = 'Expiry (Soonest)' | 'Quantity (Low to High)' | 'Name (A-Z)';

const STATUS_OPTIONS: InventoryStatus[] = ['All', 'OK', 'Low', 'Expiring', 'Expired'];
const SORT_OPTIONS: SortBy[] = ['Expiry (Soonest)', 'Quantity (Low to High)', 'Name (A-Z)'];

function getStatus(quantity: number, minStock: number, expiry: string, isBlocked?: boolean) {
  if (isBlocked) return 'Expired';
  const now = new Date();
  const exp = new Date(expiry);
  if (exp < now) return 'Expired';
  if (quantity <= minStock) return 'Low';
  const days = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 30) return 'Expiring';
  return 'OK';
}

function daysUntil(date: string) {
  const now = new Date();
  const target = new Date(date);
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

function formatDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDate(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBadgeStyles(status: Exclude<InventoryStatus, 'All'>) {
  if (status === 'OK') return { container: styles.badgeOK, text: styles.badgeTextOK };
  if (status === 'Low') return { container: styles.badgeLow, text: styles.badgeTextLow };
  if (status === 'Expiring') return { container: styles.badgeExpiring, text: styles.badgeTextExpiring };
  return { container: styles.badgeExpired, text: styles.badgeTextExpired };
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
        <Pressable style={[styles.modalCard, styles.modalCardCompact]} onPress={() => null}>
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

export default function InventoryItems() {
  const router = useRouter();
  const { items, updateItem, addStock, dropdownSettings } = useInventory();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus>('All');
  const [sortBy, setSortBy] = useState<SortBy>('Expiry (Soonest)');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showEditCategoryPicker, setShowEditCategoryPicker] = useState(false);
  const [showEditUnitPicker, setShowEditUnitPicker] = useState(false);
  const [showEditSupplierPicker, setShowEditSupplierPicker] = useState(false);
  const [stockQty, setStockQty] = useState('');

  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editMinStock, setEditMinStock] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState('');
  const numberOnly = (value: string) => value.replace(/[^0-9]/g, '');

  const categoryOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category))).sort();
    return ['All', ...unique];
  }, [items]);

  const selectedItem = selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null;

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const status = getStatus(item.quantity, item.minStock, item.expiryDate, item.isBlocked);
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (statusFilter !== 'All' && status !== statusFilter) return false;
      if (!query) return true;
      const haystack = `${item.id} ${item.name} ${item.category} ${item.supplier}`.toLowerCase();
      return haystack.includes(query);
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'Name (A-Z)') return a.name.localeCompare(b.name);
      if (sortBy === 'Quantity (Low to High)') return a.quantity - b.quantity;
      return daysUntil(a.expiryDate) - daysUntil(b.expiryDate);
    });
  }, [items, search, categoryFilter, statusFilter, sortBy]);

  const openView = (id: string) => {
    setSelectedItemId(id);
    setShowViewModal(true);
  };

  const openEdit = (id: string) => {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    setSelectedItemId(id);
    setEditName(item.name);
    setEditCategory(item.category || dropdownSettings.categories[0] || '');
    setEditUnit(item.unit || dropdownSettings.units[0] || '');
    setEditQty(String(item.quantity));
    setEditMinStock(String(item.minStock));
    setEditExpiryDate(item.expiryDate);
    setEditSupplier(item.supplier || dropdownSettings.suppliers[0] || '');
    setEditDescription(item.description ?? '');
    setEditError('');
    setShowEditModal(true);
  };

  const openAddStock = (id: string) => {
    setSelectedItemId(id);
    setStockQty('');
    setShowStockModal(true);
  };

  const saveEdit = () => {
    if (!selectedItem) return;
    if (!editName.trim()) return setEditError('Item Name is required.');
    if (!editCategory.trim()) return setEditError('Category is required.');
    if (!editUnit.trim()) return setEditError('Unit Type is required.');
    if (!editQty.trim()) return setEditError('Quantity is required.');
    if (!editMinStock.trim()) return setEditError('Minimum Stock is required.');
    if (!editExpiryDate.trim()) return setEditError('Expiry Date is required.');
    if (!editSupplier.trim()) return setEditError('Supplier is required.');

    const quantityNumber = Number(editQty);
    const minStockNumber = Number(editMinStock);
    if (!Number.isFinite(quantityNumber) || quantityNumber < 0) {
      return setEditError('Quantity must be a valid number (0 or greater).');
    }
    if (!Number.isFinite(minStockNumber) || minStockNumber < 0) {
      return setEditError('Minimum Stock must be a valid number (0 or greater).');
    }
    if (!parseDate(editExpiryDate)) return setEditError('Please choose a valid Expiry Date.');

    setEditError('');
    updateItem(selectedItem.id, {
      name: editName.trim(),
      category: editCategory.trim(),
      unit: editUnit.trim(),
      quantity: quantityNumber,
      minStock: minStockNumber,
      expiryDate: editExpiryDate.trim(),
      supplier: editSupplier.trim(),
      description: editDescription.trim() || undefined,
    });
    Alert.alert('Saved', 'Inventory item updated successfully.');
    setShowEditModal(false);
  };

  const confirmAddStock = () => {
    if (!selectedItem) return;
    const qty = Number(stockQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    addStock(selectedItem.id, qty);
    setShowStockModal(false);
  };

  return (
    <DashboardLayout title="Inventory Items">
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Items List</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <FiltersBar>
          <SearchInput
            placeholder="Search by name, category, supplier"
            value={search}
            onChangeText={setSearch}
          />
          <SelectField label="Category" value={categoryFilter} onPress={() => setShowCategoryPicker(true)} />
          <SelectField label="Status" value={statusFilter} onPress={() => setShowStatusPicker(true)} />
          <SelectField label="Sort By" value={sortBy} onPress={() => setShowSortPicker(true)} />
        </FiltersBar>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{filteredItems.length} item(s) shown</Text>
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              setSearch('');
              setCategoryFilter('All');
              setStatusFilter('All');
              setSortBy('Expiry (Soonest)');
            }}
          >
            <Text style={styles.clearText}>Clear Filters</Text>
          </Pressable>
        </View>
      </FormCard>

      <DataTable
        columns={['Item ID', 'Item Name', 'Category', 'Qty', 'Min', 'Unit', 'Expiry', 'Supplier', 'Status', 'Actions']}
        columnWidths={[80, 160, 130, 65, 65, 70, 110, 120, 120, 200]}
        rows={filteredItems.map((item) => {
          const status = getStatus(item.quantity, item.minStock, item.expiryDate);
          const normalizedStatus = getStatus(item.quantity, item.minStock, item.expiryDate, item.isBlocked);
          const badgeStyles = getBadgeStyles(normalizedStatus);
          return [
            item.id,
            item.name,
            item.category,
            String(item.quantity),
            String(item.minStock),
            item.unit,
            item.expiryDate,
            item.supplier,
            (
              <View style={[styles.badge, badgeStyles.container]}>
                <Text style={[styles.badgeText, badgeStyles.text]}>{status}</Text>
              </View>
            ),
            (
              <View style={styles.actionRow}>
                <Pressable style={styles.actionButton} onPress={() => openView(item.id)}>
                  <Text style={styles.actionText}>View</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => openEdit(item.id)}>
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => openAddStock(item.id)}>
                  <Text style={styles.actionText}>Add Stock</Text>
                </Pressable>
              </View>
            ),
          ];
        })}
      />

      <OptionPickerModal
        visible={showCategoryPicker}
        title="Category"
        options={categoryOptions}
        selected={categoryFilter}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(value) => setCategoryFilter(value)}
      />
      <OptionPickerModal
        visible={showStatusPicker}
        title="Status"
        options={STATUS_OPTIONS}
        selected={statusFilter}
        onClose={() => setShowStatusPicker(false)}
        onSelect={(value) => setStatusFilter(value as InventoryStatus)}
      />
      <OptionPickerModal
        visible={showSortPicker}
        title="Sort By"
        options={SORT_OPTIONS}
        selected={sortBy}
        onClose={() => setShowSortPicker(false)}
        onSelect={(value) => setSortBy(value as SortBy)}
      />

      <Modal visible={showViewModal} transparent animationType="fade" onRequestClose={() => setShowViewModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowViewModal(false)}>
          <Pressable style={[styles.modalCard, styles.modalCardStandard]} onPress={() => null}>
            <Text style={styles.modalTitle}>Item Details</Text>
            {selectedItem ? (
              <View style={styles.detailList}>
                <Text style={styles.detailLine}>ID: {selectedItem.id}</Text>
                <Text style={styles.detailLine}>Name: {selectedItem.name}</Text>
                <Text style={styles.detailLine}>Category: {selectedItem.category}</Text>
                <Text style={styles.detailLine}>Quantity: {selectedItem.quantity} {selectedItem.unit}</Text>
                <Text style={styles.detailLine}>Min Stock: {selectedItem.minStock}</Text>
                <Text style={styles.detailLine}>Expiry: {selectedItem.expiryDate}</Text>
                <Text style={styles.detailLine}>Supplier: {selectedItem.supplier}</Text>
                <Text style={styles.detailLine}>Description: {selectedItem.description || '-'}</Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEditModal(false)}>
          <Pressable style={[styles.modalCard, styles.modalCardLarge]} onPress={() => null}>
            <Text style={styles.modalTitle}>Edit Item</Text>
            <View style={styles.editGrid}>
              <View style={styles.fieldHalf}>
                <TextInputField label="Item Name *" value={editName} onChangeText={setEditName} />
              </View>
              <View style={styles.fieldHalf}>
                <SelectField
                  label="Category *"
                  value={editCategory || undefined}
                  placeholder="Select category"
                  onPress={() => setShowEditCategoryPicker(true)}
                />
              </View>
              <View style={styles.fieldHalf}>
                <SelectField
                  label="Unit Type *"
                  value={editUnit || undefined}
                  placeholder="Select unit"
                  onPress={() => setShowEditUnitPicker(true)}
                />
              </View>
              <View style={styles.fieldHalf}>
                <TextInputField
                  label="Quantity *"
                  value={editQty}
                  keyboardType="number-pad"
                  onChangeText={(value) => setEditQty(numberOnly(value))}
                />
              </View>
              <View style={styles.fieldHalf}>
                <TextInputField
                  label="Minimum Stock *"
                  value={editMinStock}
                  keyboardType="number-pad"
                  onChangeText={(value) => setEditMinStock(numberOnly(value))}
                />
              </View>
              <View style={styles.fieldHalf}>
                {Platform.OS === 'web' ? (
                  <View style={styles.datePickerWrap}>
                    <Text style={styles.dateLabel}>Expiry Date *</Text>
                    <DatePicker
                      selected={parseDate(editExpiryDate)}
                      onChange={(date: Date | null) => setEditExpiryDate(date ? formatDate(date) : '')}
                      dateFormat="yyyy-MM-dd"
                      className="clinic-date-input"
                      popperPlacement="bottom-start"
                      portalId="react-datepicker-portal"
                    />
                  </View>
                ) : (
                  <TextInputField label="Expiry Date *" value={editExpiryDate} onChangeText={setEditExpiryDate} />
                )}
              </View>
              <View style={styles.fieldHalf}>
                <SelectField
                  label="Supplier *"
                  value={editSupplier || undefined}
                  placeholder="Select supplier"
                  onPress={() => setShowEditSupplierPicker(true)}
                />
              </View>
              <View style={styles.fieldHalf}>
                <TextInputField label="Description" value={editDescription} onChangeText={setEditDescription} />
              </View>
            </View>
            {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
            <View style={styles.modalActions}>
              <PrimaryButton label="Save Changes" onPress={saveEdit} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showStockModal} transparent animationType="fade" onRequestClose={() => setShowStockModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowStockModal(false)}>
          <Pressable style={[styles.modalCard, styles.modalCardStandard]} onPress={() => null}>
            <Text style={styles.modalTitle}>Add Stock</Text>
            <Text style={styles.detailLine}>{selectedItem ? `${selectedItem.name} (${selectedItem.id})` : ''}</Text>
            <TextInputField
              label="Quantity to Add"
              value={stockQty}
              keyboardType="number-pad"
              onChangeText={(value) => setStockQty(numberOnly(value))}
            />
            <View style={styles.modalActions}>
              <PrimaryButton label="Confirm Add Stock" onPress={confirmAddStock} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <OptionPickerModal
        visible={showEditCategoryPicker}
        title="Edit Category"
        options={dropdownSettings.categories}
        selected={editCategory}
        onClose={() => setShowEditCategoryPicker(false)}
        onSelect={setEditCategory}
      />
      <OptionPickerModal
        visible={showEditUnitPicker}
        title="Edit Unit Type"
        options={dropdownSettings.units}
        selected={editUnit}
        onClose={() => setShowEditUnitPicker(false)}
        onSelect={setEditUnit}
      />
      <OptionPickerModal
        visible={showEditSupplierPicker}
        title="Edit Supplier"
        options={dropdownSettings.suppliers}
        selected={editSupplier}
        onClose={() => setShowEditSupplierPicker(false)}
        onSelect={setEditSupplier}
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
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
    maxHeight: '88%',
  },
  modalCardCompact: {
    maxWidth: 420,
  },
  modalCardStandard: {
    maxWidth: 620,
  },
  modalCardLarge: {
    maxWidth: 760,
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
    color: theme.colors.ink,
    fontFamily: theme.font.heading,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  badgeOK: {
    backgroundColor: '#DCFCE7',
  },
  badgeTextOK: {
    color: '#166534',
  },
  badgeLow: {
    backgroundColor: '#FEF3C7',
  },
  badgeTextLow: {
    color: '#B45309',
  },
  badgeExpiring: {
    backgroundColor: '#FFEDD5',
  },
  badgeTextExpiring: {
    color: '#C2410C',
  },
  badgeExpired: {
    backgroundColor: '#FEE2E2',
  },
  badgeTextExpired: {
    color: '#B91C1C',
  },
  detailList: {
    gap: 6,
  },
  detailLine: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  editGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  fieldHalf: {
    width: '48%',
  },
  modalActions: {
    marginTop: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  errorText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B91C1C',
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
});
