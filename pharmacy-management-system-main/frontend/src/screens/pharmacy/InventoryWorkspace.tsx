import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { InputField } from '../../components/InputField';
import { SecondaryButton } from '../../components/Buttons';
import { Section } from '../../components/Section';
import { StatCard } from '../../components/StatCard';
import { StatusPill } from '../../components/StatusPill';
import { theme } from '../../theme';

type InventoryWorkspaceProps = {
  clinicRequests: any[];
  closeAddMedicineForm: () => void;
  controlled: boolean;
  drugName: string;
  editingId: string;
  expiryDate: string;
  filteredInventory: any[];
  handleClinicRequestCreate: () => void;
  handleClinicRequestStatus: (row: any, status: string) => void;
  handleInventoryDelete: (row: any) => void;
  handleInventoryEdit: (row: any) => void;
  handleInventoryRestock: () => void;
  handleInventorySave: () => void;
  inventoryActionRows?: any[];
  inventoryActivityRows: any[];
  inventoryCategories: string[];
  inventoryCategoryFilter: string;
  inventorySearch: string;
  inventorySummary: any[];
  inventorySupplierFilter: string;
  inventorySuppliers: string[];
  load: () => void;
  lowStockThreshold: string;
  onInventoryCategoryFilterChange: (value: string) => void;
  onInventorySearchChange: (value: string) => void;
  onInventorySupplierFilterChange: (value: string) => void;
  onRequestByChange: (value: string) => void;
  onRequestNameChange: (value: string) => void;
  onRequestNotesChange: (value: string) => void;
  onRequestPriorityChange: (value: string) => void;
  onRequestQtyChange: (value: string) => void;
  onRequestSkuChange: (value: string) => void;
  onShowClinicRequestFormChange: (next: boolean) => void;
  openAddMedicineForm: () => void;
  price: string;
  quantity: string;
  requestBy: string;
  requestName: string;
  requestNotes: string;
  requestPriority: string;
  requestQty: string;
  requestSku: string;
  reorderRows: any[];
  restockAmount: string;
  setBarcode: (value: string) => void;
  setBatch: (value: string) => void;
  setControlled: (updater: (prev: boolean) => boolean) => void;
  setDrugName: (value: string) => void;
  setExpiryDate: (value: string) => void;
  setLowStockThreshold: (value: string) => void;
  setPrice: (value: string) => void;
  setQuantity: (value: string) => void;
  setRestockAmount: (value: string) => void;
  setSupplier: (value: string) => void;
  showAddMedicineForm: boolean;
  showClinicRequestForm: boolean;
  styles: any;
  supplier: string;
  barcode: string;
  batch: string;
};

export function InventoryWorkspace({
  clinicRequests,
  closeAddMedicineForm,
  controlled,
  drugName,
  editingId,
  expiryDate,
  filteredInventory,
  handleClinicRequestCreate,
  handleClinicRequestStatus,
  handleInventoryDelete,
  handleInventoryEdit,
  handleInventoryRestock,
  handleInventorySave,
  inventoryActivityRows,
  inventoryCategories,
  inventoryCategoryFilter,
  inventorySearch,
  inventorySummary,
  inventorySupplierFilter,
  inventorySuppliers,
  load,
  lowStockThreshold,
  onInventoryCategoryFilterChange,
  onInventorySearchChange,
  onInventorySupplierFilterChange,
  onRequestByChange,
  onRequestNameChange,
  onRequestNotesChange,
  onRequestPriorityChange,
  onRequestQtyChange,
  onRequestSkuChange,
  onShowClinicRequestFormChange,
  openAddMedicineForm,
  price,
  quantity,
  requestBy,
  requestName,
  requestNotes,
  requestPriority,
  requestQty,
  requestSku,
  reorderRows,
  restockAmount,
  setBarcode,
  setBatch,
  setControlled,
  setDrugName,
  setExpiryDate,
  setLowStockThreshold,
  setPrice,
  setQuantity,
  setRestockAmount,
  setSupplier,
  showAddMedicineForm,
  showClinicRequestForm,
  styles,
  supplier,
  barcode,
  batch,
}: InventoryWorkspaceProps) {
  const urgentItems = filteredInventory
    .filter((item: any) => Number(item.stock || 0) <= Number(item.threshold || 0) || String(item.expiry || '').trim())
    .slice(0, 5);

  const normalizedRows = filteredInventory.map((item: any) => {
    const stock = Number(item.stock || 0);
    const threshold = Number(item.threshold || 0);
    const expiry = String(item.expiry || '');
    const lowStock = threshold > 0 && stock <= threshold;
    const expiringSoon = expiry && expiry !== 'N/A' && expiry !== '-';
    const status = lowStock ? 'Low Stock' : expiringSoon ? 'Watch Expiry' : 'Healthy';

    return {
      ...item,
      status,
      stockValue: `${stock}`,
      priceLabel: Number(item.price || 0).toFixed(2),
    };
  });

  return (
    <Section title="Inventory Management" action={<SecondaryButton label="Refresh" onPress={load} />}>
      <View style={styles.row}>
        {inventorySummary.map((item: any) => (
          <StatCard key={item.label} {...item} variant="white" />
        ))}
      </View>

      <View style={localStyles.topGrid}>
        <Card variant="soft" style={styles.sectionCard}>
          <Text style={styles.searchBarLabel}>Inventory Search</Text>
          <InputField
            label=""
            placeholder="Search SKU or drug name"
            value={inventorySearch}
            onChangeText={onInventorySearchChange}
          />
          <Text style={styles.searchBarMeta}>
            Category {inventoryCategoryFilter} | Supplier {inventorySupplierFilter}
          </Text>

          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.filterChipWrap}>
            {['All', ...inventoryCategories].map((item) => {
              const active = inventoryCategoryFilter === item;
              return (
                <TouchableOpacity
                  key={`cat-${item}`}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => onInventoryCategoryFilterChange(item)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.filterLabel}>Supplier</Text>
          <View style={styles.filterChipWrap}>
            {['All', ...inventorySuppliers].map((item) => {
              const active = inventorySupplierFilter === item;
              return (
                <TouchableOpacity
                  key={`sup-${item}`}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => onInventorySupplierFilterChange(item)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Card variant="white" style={styles.sectionCard} title="Needs Attention">
          {urgentItems.length ? (
            urgentItems.map((item: any) => (
              <View key={`${item.id}-urgent`} style={localStyles.attentionRow}>
                <View style={localStyles.attentionText}>
                  <Text style={localStyles.attentionName}>{item.name}</Text>
                  <Text style={localStyles.attentionMeta}>
                    SKU {item.id} | Stock {item.stock} | Supplier {item.supplier || 'N/A'}
                  </Text>
                </View>
                <StatusPill
                  value={
                    Number(item.stock || 0) <= Number(item.threshold || 0)
                      ? 'Low Stock'
                      : 'Watch Expiry'
                  }
                />
              </View>
            ))
          ) : (
            <Text style={styles.noteMeta}>No urgent stock alerts in the current filter.</Text>
          )}
        </Card>
      </View>

      <Card variant="white" style={styles.sectionCard} title="Inventory Register">
        <DataTable
          columns={[
            { key: 'id', label: 'SKU' },
            { key: 'name', label: 'Drug', wide: true },
            { key: 'category', label: 'Category' },
            { key: 'stockValue', label: 'Stock' },
            { key: 'priceLabel', label: 'Price' },
            { key: 'expiry', label: 'Expiry' },
            {
              key: 'status',
              label: 'Status',
              render: (row: any) => <StatusPill value={row.status} />,
            },
            { key: 'supplier', label: 'Supplier' },
            { key: 'batch', label: 'Batch' },
            {
              key: 'action',
              label: 'Action',
              render: (row: any) => (
                <View style={styles.inlineActions}>
                  <SecondaryButton label="Edit" onPress={() => handleInventoryEdit(row)} />
                  <SecondaryButton label="Delete" onPress={() => handleInventoryDelete(row)} />
                </View>
              ),
            },
          ]}
          rows={normalizedRows}
        />
      </Card>

      <View style={localStyles.actionGrid}>
        <Card variant="soft" style={styles.sectionCard} title="Medicine Editor">
          <View style={styles.buttonRow}>
            <SecondaryButton
              label={showAddMedicineForm ? 'Close Editor' : editingId ? 'Continue Editing' : 'Add Medicine'}
              onPress={() => {
                if (showAddMedicineForm) {
                  closeAddMedicineForm();
                  return;
                }
                openAddMedicineForm();
              }}
            />
          </View>
          {showAddMedicineForm ? (
            <Card variant="white" style={styles.inlineActionCard}>
              <Text style={styles.formTitle}>{editingId ? 'Edit Medicine' : 'Add Medicine'}</Text>
              <InputField label="Drug Name" placeholder="Paracetamol 500mg" value={drugName} onChangeText={setDrugName} />
              <InputField label="Stock Quantity" placeholder="0" value={quantity} onChangeText={setQuantity} />
              {editingId ? (
                <View style={styles.restockRow}>
                  <View style={styles.restockField}>
                    <InputField
                      label="Restock Amount"
                      placeholder="Add units"
                      value={restockAmount}
                      onChangeText={setRestockAmount}
                    />
                  </View>
                  <View style={styles.restockAction}>
                    <SecondaryButton label="Add Stock" onPress={handleInventoryRestock} />
                  </View>
                </View>
              ) : null}
              <InputField label="Expiry Date" placeholder="YYYY-MM-DD" value={expiryDate} onChangeText={setExpiryDate} />
              <InputField label="Batch Number" placeholder="B123" value={batch} onChangeText={setBatch} />
              <InputField label="Barcode" placeholder="Scan or type" value={barcode} onChangeText={setBarcode} />
              <InputField label="Supplier" placeholder="Supplier name" value={supplier} onChangeText={setSupplier} />
              <InputField label="Price" placeholder="0.00" value={price} onChangeText={setPrice} />
              <InputField
                label="Low Stock Threshold"
                placeholder="10"
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
              />
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Controlled Drug</Text>
                <SecondaryButton label={controlled ? 'Yes' : 'No'} onPress={() => setControlled((prev) => !prev)} />
              </View>
              <View style={styles.buttonRow}>
                <SecondaryButton label={editingId ? 'Save Changes' : 'Add Medicine'} onPress={handleInventorySave} />
                <SecondaryButton label="Cancel" onPress={closeAddMedicineForm} />
              </View>
            </Card>
          ) : (
            <Text style={styles.noteMeta}>Open the editor to add a new medicine or update an existing stock item.</Text>
          )}
        </Card>

        <Card variant="soft" style={styles.sectionCard} title="Clinic Requests">
          <View style={styles.buttonRow}>
            <SecondaryButton
              label={showClinicRequestForm ? 'Close Request Form' : 'New Clinic Request'}
              onPress={() => {
                if (showClinicRequestForm) {
                  onShowClinicRequestFormChange(false);
                  return;
                }
                closeAddMedicineForm();
                onShowClinicRequestFormChange(true);
              }}
            />
          </View>
          {showClinicRequestForm ? (
            <Card variant="white" style={styles.inlineActionCard}>
              <Text style={styles.formTitle}>Log Clinic Request</Text>
              <InputField label="SKU (optional)" placeholder="RX-0000" value={requestSku} onChangeText={onRequestSkuChange} />
              <InputField label="Item Name" placeholder="Paracetamol 500mg" value={requestName} onChangeText={onRequestNameChange} />
              <InputField label="Quantity" placeholder="0" value={requestQty} onChangeText={onRequestQtyChange} />
              <InputField label="Priority" placeholder="Normal" value={requestPriority} onChangeText={onRequestPriorityChange} />
              <InputField label="Requested By" placeholder="Clinic Nurse" value={requestBy} onChangeText={onRequestByChange} />
              <InputField label="Notes" placeholder="Optional notes" value={requestNotes} onChangeText={onRequestNotesChange} />
              <View style={styles.buttonRow}>
                <SecondaryButton label="Create Request" onPress={handleClinicRequestCreate} />
                <SecondaryButton label="Cancel" onPress={() => onShowClinicRequestFormChange(false)} />
              </View>
            </Card>
          ) : (
            <Text style={styles.noteMeta}>Use clinic requests to track ward demand without changing stock manually.</Text>
          )}
        </Card>
      </View>

      <Card variant="white" style={styles.sectionCard}>
        <Text style={styles.formTitle}>Reorder Suggestions</Text>
        <DataTable
          columns={[
            { key: 'name', label: 'Drug', wide: true },
            { key: 'stock', label: 'Stock' },
            { key: 'threshold', label: 'Min' },
            { key: 'suggested', label: 'Suggested' },
            { key: 'supplier', label: 'Supplier' },
          ]}
          rows={reorderRows}
        />
      </Card>
      <Card variant="white" style={styles.sectionCard}>
        <Text style={styles.formTitle}>Recent Inventory Activity</Text>
        <DataTable
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'item', label: 'Item', wide: true },
            { key: 'change', label: 'Change' },
            { key: 'reason', label: 'Reason' },
            { key: 'user', label: 'User' },
          ]}
          rows={inventoryActivityRows}
        />
      </Card>
      <Card variant="white" style={styles.sectionCard}>
        <Text style={styles.formTitle}>Clinic Supply Requests</Text>
        <DataTable
          columns={[
            { key: 'item_name', label: 'Item', wide: true },
            { key: 'quantity', label: 'Qty' },
            { key: 'priority', label: 'Priority' },
            {
              key: 'status',
              label: 'Status',
              render: (row: any) => <StatusPill value={row.status || 'Requested'} />,
            },
            { key: 'requested_by', label: 'Requested By' },
            {
              key: 'action',
              label: 'Action',
              render: (row: any) => (
                <View style={styles.inlineActions}>
                  {row.status !== 'Approved' && row.status !== 'Fulfilled' ? (
                    <SecondaryButton label="Approve" onPress={() => handleClinicRequestStatus(row, 'Approved')} />
                  ) : null}
                  {row.status !== 'Fulfilled' ? (
                    <SecondaryButton label="Fulfill" onPress={() => handleClinicRequestStatus(row, 'Fulfilled')} />
                  ) : null}
                  {row.status !== 'Rejected' && row.status !== 'Fulfilled' ? (
                    <SecondaryButton label="Reject" onPress={() => handleClinicRequestStatus(row, 'Rejected')} />
                  ) : null}
                </View>
              ),
            },
          ]}
          rows={clinicRequests}
        />
      </Card>
    </Section>
  );
}

const localStyles = StyleSheet.create({
  topGrid: {
    gap: 16,
  },
  actionGrid: {
    gap: 16,
  },
  attentionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  attentionText: {
    flex: 1,
    gap: 4,
  },
  attentionName: {
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
    fontSize: 13,
  },
  attentionMeta: {
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
});
