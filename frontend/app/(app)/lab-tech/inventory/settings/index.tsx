import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { TextInputField } from '@/components/ui/TextInputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { theme } from '@/constants/theme';
import { useInventory, type InventoryDropdownField } from '@/hooks/useInventory';
import { useOrders } from '@/hooks/useOrders';

type TemplateDraftRow = {
  itemName: string;
  quantity: string;
};

type OptionSectionProps = {
  title: string;
  addLabel: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (option: string) => void;
};

function OptionSection({ title, addLabel, options, value, onChange, onAdd, onRemove }: OptionSectionProps) {
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.blockTitle}>{title}</Text>
      <View style={styles.addRow}>
        <View style={styles.inputWrap}>
          <TextInputField label={addLabel} value={value} onChangeText={onChange} />
        </View>
        <PrimaryButton label="Add" onPress={onAdd} />
      </View>
      <View style={styles.optionList}>
        {options.map((option) => (
          <View key={option} style={styles.optionRow}>
            <Text style={styles.optionText}>{option}</Text>
            <Pressable style={styles.removeButton} onPress={() => onRemove(option)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {!options.length ? <Text style={styles.emptyText}>No options added yet.</Text> : null}
      </View>
    </View>
  );
}

export default function InventorySettingsPage() {
  const router = useRouter();
  const {
    items,
    dropdownSettings,
    preferences,
    consumptionTemplates,
    addDropdownOption,
    removeDropdownOption,
    setDefaultCategory,
    updateItemMinStock,
    setConsumptionTemplate,
    removeConsumptionTemplate,
  } = useInventory();
  const { orders } = useOrders();
  const [categoryInput, setCategoryInput] = useState('');
  const [unitInput, setUnitInput] = useState('');
  const [supplierInput, setSupplierInput] = useState('');
  const [minStockDrafts, setMinStockDrafts] = useState<Record<string, string>>({});
  const [selectedProfile, setSelectedProfile] = useState('');
  const [templateRows, setTemplateRows] = useState<TemplateDraftRow[]>([]);
  const numberOnly = (value: string) => value.replace(/[^0-9]/g, '');

  const stockItemNames = useMemo(
    () => Array.from(new Set(items.map((item) => item.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const profileNames = useMemo(() => {
    const fromOrders = orders.flatMap((order) => order.tests.map((test) => test.name.trim())).filter(Boolean);
    const fromTemplates = Object.keys(consumptionTemplates);
    return Array.from(new Set([...fromOrders, ...fromTemplates])).sort((a, b) => a.localeCompare(b));
  }, [orders, consumptionTemplates]);

  useEffect(() => {
    if (selectedProfile) return;
    if (!profileNames.length) return;
    setSelectedProfile(profileNames[0]);
  }, [profileNames, selectedProfile]);

  useEffect(() => {
    if (!selectedProfile) {
      setTemplateRows([]);
      return;
    }
    const saved = consumptionTemplates[selectedProfile] ?? [];
    setTemplateRows(
      saved.map((row) => ({
        itemName: row.itemName,
        quantity: String(row.quantity),
      }))
    );
  }, [selectedProfile, consumptionTemplates]);

  const addOption = (field: InventoryDropdownField, value: string, clear: () => void) => {
    if (!value.trim()) return;
    addDropdownOption(field, value);
    clear();
  };

  const cycleProfile = () => {
    if (!profileNames.length) return;
    const currentIndex = Math.max(profileNames.indexOf(selectedProfile), 0);
    const nextIndex = (currentIndex + 1) % profileNames.length;
    setSelectedProfile(profileNames[nextIndex]);
  };

  const cycleRowItem = (rowIndex: number) => {
    if (!stockItemNames.length) return;
    setTemplateRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const currentIndex = Math.max(stockItemNames.indexOf(row.itemName), 0);
        const nextIndex = (currentIndex + 1) % stockItemNames.length;
        return { ...row, itemName: stockItemNames[nextIndex] };
      })
    );
  };

  const saveTemplate = () => {
    if (!selectedProfile.trim()) return;
    const normalizedRows = templateRows
      .map((row) => ({
        itemName: row.itemName.trim(),
        quantity: Number(row.quantity),
      }))
      .filter((row) => row.itemName && Number.isFinite(row.quantity) && row.quantity > 0);
    setConsumptionTemplate(selectedProfile, normalizedRows);
    setTemplateRows(normalizedRows.map((row) => ({ itemName: row.itemName, quantity: String(row.quantity) })));
  };

  return (
    <DashboardLayout title="Inventory Settings">
      <FormCard>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.sectionTitle}>Dropdown Options</Text>
            <InfoHint text="Manage options for Category, Unit Type, and Supplier." />
          </View>
          <Pressable style={styles.backButton} onPress={() => router.push('/lab-tech/settings' as Href)}>
            <Text style={styles.backText}>Back to Settings</Text>
          </Pressable>
        </View>

        <OptionSection
          title="Categories"
          addLabel="New Category"
          options={dropdownSettings.categories}
          value={categoryInput}
          onChange={setCategoryInput}
          onAdd={() => addOption('categories', categoryInput, () => setCategoryInput(''))}
          onRemove={(option) => removeDropdownOption('categories', option)}
        />

        <OptionSection
          title="Units"
          addLabel="New Unit"
          options={dropdownSettings.units}
          value={unitInput}
          onChange={setUnitInput}
          onAdd={() => addOption('units', unitInput, () => setUnitInput(''))}
          onRemove={(option) => removeDropdownOption('units', option)}
        />

        <OptionSection
          title="Suppliers"
          addLabel="New Supplier"
          options={dropdownSettings.suppliers}
          value={supplierInput}
          onChange={setSupplierInput}
          onAdd={() => addOption('suppliers', supplierInput, () => setSupplierInput(''))}
          onRemove={(option) => removeDropdownOption('suppliers', option)}
        />

        <View style={styles.sectionBlock}>
          <Text style={styles.blockTitle}>Default Category</Text>
          <View style={styles.defaultRow}>
            <View style={styles.inputWrap}>
              <SelectField
                label="Default Category"
                value={preferences.defaultCategory}
                placeholder="Select default category"
                onPress={() => {
                  const options = dropdownSettings.categories;
                  if (!options.length) return;
                  const currentIndex = Math.max(options.indexOf(preferences.defaultCategory), 0);
                  const nextIndex = (currentIndex + 1) % options.length;
                  setDefaultCategory(options[nextIndex]);
                }}
              />
            </View>
            <Text style={styles.helperInline}>Tap to cycle category</Text>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.blockTitle}>Test/Scan Consumption Templates</Text>
          <Text style={styles.helperInline}>Set default consumables per test or scan. These are auto-used on completion.</Text>
          <View style={styles.defaultRow}>
            <View style={styles.inputWrap}>
              <SelectField
                label="Test or Scan"
                value={selectedProfile || 'No tests available'}
                placeholder="Select test/scan"
                onPress={cycleProfile}
              />
            </View>
            <Text style={styles.helperInline}>Tap to cycle</Text>
          </View>
          <View style={styles.optionList}>
            {templateRows.map((row, index) => (
              <View key={`${selectedProfile}-${index}`} style={styles.minStockRow}>
                <View style={styles.inputWrap}>
                  <SelectField
                    label="Item"
                    value={row.itemName || 'Select inventory item'}
                    onPress={() => cycleRowItem(index)}
                  />
                </View>
                <View style={styles.minStockInputWrap}>
                  <TextInputField
                    label="Qty"
                    value={row.quantity}
                    onChangeText={(value) =>
                      setTemplateRows((prev) =>
                        prev.map((entry, idx) => (idx === index ? { ...entry, quantity: numberOnly(value) } : entry))
                      )
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => setTemplateRows((prev) => prev.filter((_, idx) => idx !== index))}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
            {!templateRows.length ? <Text style={styles.emptyText}>No consumables configured for this test/scan.</Text> : null}
          </View>
          <View style={styles.addRow}>
            <PrimaryButton
              label="Add Item"
              onPress={() =>
                setTemplateRows((prev) => [
                  ...prev,
                  { itemName: stockItemNames[0] ?? '', quantity: '1' },
                ])
              }
            />
            <PrimaryButton label="Save Template" onPress={saveTemplate} />
            <Pressable
              style={styles.removeButton}
              onPress={() => {
                if (!selectedProfile) return;
                removeConsumptionTemplate(selectedProfile);
                setTemplateRows([]);
              }}
            >
              <Text style={styles.removeText}>Clear Template</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.blockTitle}>Item Minimum Stock</Text>
          <View style={styles.optionList}>
            {items.map((item) => (
              <View key={item.id} style={styles.minStockRow}>
                <View style={styles.minStockMeta}>
                  <Text style={styles.optionText}>{item.name}</Text>
                  <Text style={styles.metaText}>{`${item.id} • ${item.category}`}</Text>
                </View>
                <View style={styles.minStockInputWrap}>
                  <TextInputField
                    label="Min Stock"
                    value={minStockDrafts[item.id] ?? String(item.minStock)}
                    onChangeText={(value) =>
                      setMinStockDrafts((prev) => ({ ...prev, [item.id]: numberOnly(value) }))
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <PrimaryButton
                  label="Save"
                  onPress={() => {
                    const raw = minStockDrafts[item.id] ?? String(item.minStock);
                    const parsed = Number(raw);
                    if (!Number.isFinite(parsed) || parsed < 0) return;
                    updateItemMinStock(item.id, parsed);
                    setMinStockDrafts((prev) => ({ ...prev, [item.id]: String(parsed) }));
                  }}
                />
              </View>
            ))}
            {!items.length ? <Text style={styles.emptyText}>No items to configure yet.</Text> : null}
          </View>
        </View>
      </FormCard>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
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
    fontSize: 13,
    color: theme.colors.ink,
  },
  sectionBlock: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  blockTitle: {
    fontFamily: theme.font.heading,
    fontSize: 15,
    color: theme.colors.ink,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  inputWrap: {
    flex: 1,
  },
  optionList: {
    gap: theme.spacing.xs,
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.md,
  },
  helperInline: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    marginBottom: 10,
  },
  minStockRow: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  minStockMeta: {
    flex: 1,
    minWidth: 170,
  },
  minStockInputWrap: {
    width: 130,
  },
  metaText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    marginTop: 2,
  },
  optionRow: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: '#FEE2E2',
  },
  removeText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#991B1B',
  },
  emptyText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
});
