import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { apiRequest } from '@/utils/api';

type ApiLabType = {
  id: number;
  name: string;
  code: string;
  category: string | null;
  default_price: string;
  result_unit: string | null;
  reference_min: string | null;
  reference_max: string | null;
  reference_text: string | null;
  is_active: boolean;
};

type ApiScanType = {
  id: number;
  name: string;
  code: string;
  modality: string | null;
  default_price: string;
  is_active: boolean;
};

type CatalogEntry = {
  key: string;
  source: 'lab' | 'scan';
  apiId: number;
  idCode: string;
  name: string;
  sample: string;
  category: string;
  price: number;
  rangeText?: string;
};

const LAB_CATEGORY_OPTIONS = [
  'Hematology',
  'Clinical Chemistry',
  'Hormones',
  'Immunology',
  'Microbiology',
  'Urinalysis',
  'Laboratory',
];

const SCAN_CATEGORY_OPTIONS = [
  'Radiology / Imaging',
  'X-Ray',
  'CT',
  'MRI',
  'Ultrasound',
  'Mammography',
  'Nuclear Medicine',
];

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-');
}

export default function TestsScansSettingsPage() {
  const [labName, setLabName] = useState('');
  const [labCode, setLabCode] = useState('');
  const [labCategory, setLabCategory] = useState('Clinical Chemistry');
  const [labPrice, setLabPrice] = useState('');
  const [labUnit, setLabUnit] = useState('');
  const [labRangeMin, setLabRangeMin] = useState('');
  const [labRangeMax, setLabRangeMax] = useState('');

  const [scanName, setScanName] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scanCategory, setScanCategory] = useState('Radiology / Imaging');
  const [scanPrice, setScanPrice] = useState('');

  const [editingLabId, setEditingLabId] = useState<number | null>(null);
  const [editingScanId, setEditingScanId] = useState<number | null>(null);

  const [labTypes, setLabTypes] = useState<ApiLabType[]>([]);
  const [scanTypes, setScanTypes] = useState<ApiScanType[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [categoryPicker, setCategoryPicker] = useState<null | 'lab' | 'scan'>(null);

  const loadCatalog = async () => {
    const [labs, scans] = await Promise.all([
      apiRequest<ApiLabType[]>('/api/v1/lab-test-types/'),
      apiRequest<ApiScanType[]>('/api/v1/scan-types/'),
    ]);
    setLabTypes(labs.filter((item) => item.is_active !== false));
    setScanTypes(scans.filter((item) => item.is_active !== false));
  };

  useEffect(() => {
    void loadCatalog().catch(() => {
      setFeedback('Could not load tests and scans.');
    });
  }, []);

  const entries = useMemo<CatalogEntry[]>(
    () => [
      ...labTypes.map((item) => ({
        key: `lab-${item.id}`,
        source: 'lab' as const,
        apiId: item.id,
        idCode: item.code,
        name: item.name,
        sample: 'Blood',
        category: item.category?.trim() || 'Laboratory',
        price: Number(item.default_price || 0),
        rangeText:
          item.reference_text?.trim() ||
          (item.reference_min !== null && item.reference_max !== null
            ? `${item.reference_min}-${item.reference_max}${item.result_unit ? ` ${item.result_unit}` : ''}`
            : undefined),
      })),
      ...scanTypes.map((item) => ({
        key: `scan-${item.id}`,
        source: 'scan' as const,
        apiId: item.id,
        idCode: item.code,
        name: item.name,
        sample: 'Imaging',
        category: item.modality?.trim() || 'Radiology / Imaging',
        price: Number(item.default_price || 0),
      })),
    ],
    [labTypes, scanTypes]
  );

  const resetLabForm = () => {
    setLabName('');
    setLabCode('');
    setLabCategory('Clinical Chemistry');
    setLabPrice('');
    setLabUnit('');
    setLabRangeMin('');
    setLabRangeMax('');
    setEditingLabId(null);
  };

  const resetScanForm = () => {
    setScanName('');
    setScanCode('');
    setScanCategory('Radiology / Imaging');
    setScanPrice('');
    setEditingScanId(null);
  };

  const handleSaveLab = async () => {
    const name = labName.trim();
    const code = normalizeCode(labCode);
    const category = labCategory.trim();
    const price = Number(labPrice);
    const parsedMin = labRangeMin.trim() === '' ? null : Number(labRangeMin);
    const parsedMax = labRangeMax.trim() === '' ? null : Number(labRangeMax);
    if (!name || !code || !category || !Number.isFinite(price) || price < 0) {
      setFeedback('Please fill valid test details (Name, ID, Category, Price, and optional range).');
      return;
    }
    if (
      (parsedMin !== null && !Number.isFinite(parsedMin)) ||
      (parsedMax !== null && !Number.isFinite(parsedMax))
    ) {
      setFeedback('Range values must be valid numbers.');
      return;
    }
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      setFeedback('Range min must be less than or equal to range max.');
      return;
    }

    setSaving(true);
    setFeedback('');
    try {
      const payload = {
        name,
        code,
        category,
        default_price: price.toFixed(2),
        result_unit: labUnit.trim() || null,
        reference_min: parsedMin !== null ? parsedMin.toFixed(2) : null,
        reference_max: parsedMax !== null ? parsedMax.toFixed(2) : null,
        reference_text:
          parsedMin !== null && parsedMax !== null
            ? `${parsedMin}-${parsedMax}${labUnit.trim() ? ` ${labUnit.trim()}` : ''}`
            : null,
        turnaround_hours: 24,
        is_active: true,
      };
      if (editingLabId) {
        await apiRequest(`/api/v1/lab-test-types/${editingLabId}/`, {
          method: 'PATCH',
          body: payload,
        });
        setFeedback('Test updated successfully.');
      } else {
        await apiRequest('/api/v1/lab-test-types/', {
          method: 'POST',
          body: payload,
        });
        setFeedback('Test added successfully.');
      }
      resetLabForm();
      await loadCatalog();
    } catch {
      setFeedback('Could not save test. Make sure ID is unique.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScan = async () => {
    const name = scanName.trim();
    const code = normalizeCode(scanCode);
    const category = scanCategory.trim();
    const price = Number(scanPrice);
    if (!name || !code || !category || !Number.isFinite(price) || price < 0) {
      setFeedback('Please fill valid scan details (Name, ID, Category, Price).');
      return;
    }

    setSaving(true);
    setFeedback('');
    try {
      const payload = {
        name,
        code,
        modality: category,
        default_price: price.toFixed(2),
        turnaround_hours: 24,
        is_active: true,
      };
      if (editingScanId) {
        await apiRequest(`/api/v1/scan-types/${editingScanId}/`, {
          method: 'PATCH',
          body: payload,
        });
        setFeedback('Scan updated successfully.');
      } else {
        await apiRequest('/api/v1/scan-types/', {
          method: 'POST',
          body: payload,
        });
        setFeedback('Scan added successfully.');
      }
      resetScanForm();
      await loadCatalog();
    } catch {
      setFeedback('Could not save scan. Make sure ID is unique.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: CatalogEntry) => {
    if (entry.source === 'lab') {
      setEditingLabId(entry.apiId);
      setLabName(entry.name);
      setLabCode(entry.idCode);
      setLabCategory(entry.category);
      setLabPrice(String(entry.price));
      const lab = labTypes.find((item) => item.id === entry.apiId);
      setLabUnit(lab?.result_unit ?? '');
      setLabRangeMin(lab?.reference_min ?? '');
      setLabRangeMax(lab?.reference_max ?? '');
    } else {
      setEditingScanId(entry.apiId);
      setScanName(entry.name);
      setScanCode(entry.idCode);
      setScanCategory(entry.category);
      setScanPrice(String(entry.price));
    }
  };

  const handleDelete = async (entry: CatalogEntry) => {
    setSaving(true);
    setFeedback('');
    try {
      if (entry.source === 'lab') {
        await apiRequest(`/api/v1/lab-test-types/${entry.apiId}/`, { method: 'DELETE' });
        if (editingLabId === entry.apiId) {
          resetLabForm();
        }
      } else {
        await apiRequest(`/api/v1/scan-types/${entry.apiId}/`, { method: 'DELETE' });
        if (editingScanId === entry.apiId) {
          resetScanForm();
        }
      }
      await loadCatalog();
      setFeedback(`${entry.source === 'lab' ? 'Test' : 'Scan'} deleted successfully.`);
    } catch {
      setFeedback(`Could not delete ${entry.source === 'lab' ? 'test' : 'scan'}.`);
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = categoryPicker === 'lab' ? LAB_CATEGORY_OPTIONS : SCAN_CATEGORY_OPTIONS;

  return (
    <DashboardLayout title="Tests & Scans Settings">
      <View style={styles.formsRow}>
        <FormCard style={styles.formCard}>
          <Text style={styles.sectionTitle}>{editingLabId ? 'Edit Test' : 'Add New Test'}</Text>
          <View style={styles.grid}>
            <TextInputField label="Name" placeholder="Vitamin B12" value={labName} onChangeText={setLabName} />
            <TextInputField label="ID" placeholder="VITB12" value={labCode} onChangeText={setLabCode} />
            <SelectField
              label="Category"
              value={labCategory}
              placeholder="Select category"
              onPress={() => setCategoryPicker('lab')}
            />
            <TextInputField label="Price (EGP)" placeholder="200" value={labPrice} onChangeText={setLabPrice} keyboardType="decimal-pad" />
            <TextInputField label="Unit (Optional)" placeholder="ng/mL" value={labUnit} onChangeText={setLabUnit} />
            <View style={styles.rangeRow}>
              <View style={styles.rangeField}>
                <TextInputField
                  label="Range Min (Optional)"
                  placeholder="30"
                  value={labRangeMin}
                  onChangeText={setLabRangeMin}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.rangeField}>
                <TextInputField
                  label="Range Max (Optional)"
                  placeholder="100"
                  value={labRangeMax}
                  onChangeText={setLabRangeMax}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
          <View style={styles.formActions}>
            <PrimaryButton
              label={saving ? 'Saving...' : editingLabId ? 'Update Test' : 'Add Test'}
              onPress={() => void handleSaveLab()}
              disabled={saving}
            />
            {editingLabId ? (
              <Pressable style={styles.secondaryButton} onPress={resetLabForm}>
                <Text style={styles.secondaryButtonText}>Cancel Edit</Text>
              </Pressable>
            ) : null}
          </View>
        </FormCard>

        <FormCard style={styles.formCard}>
          <Text style={styles.sectionTitle}>{editingScanId ? 'Edit Scan' : 'Add New Scan'}</Text>
          <View style={styles.grid}>
            <TextInputField label="Name" placeholder="CT Abdomen" value={scanName} onChangeText={setScanName} />
            <TextInputField label="ID" placeholder="CTABD" value={scanCode} onChangeText={setScanCode} />
            <SelectField
              label="Category"
              value={scanCategory}
              placeholder="Select category"
              onPress={() => setCategoryPicker('scan')}
            />
            <TextInputField label="Price (EGP)" placeholder="700" value={scanPrice} onChangeText={setScanPrice} keyboardType="decimal-pad" />
          </View>
          <View style={styles.formActions}>
            <PrimaryButton
              label={saving ? 'Saving...' : editingScanId ? 'Update Scan' : 'Add Scan'}
              onPress={() => void handleSaveScan()}
              disabled={saving}
            />
            {editingScanId ? (
              <Pressable style={styles.secondaryButton} onPress={resetScanForm}>
                <Text style={styles.secondaryButtonText}>Cancel Edit</Text>
              </Pressable>
            ) : null}
          </View>
        </FormCard>
      </View>

      <FormCard>
        <Text style={styles.sectionTitle}>Catalog Entries</Text>
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
        <View style={styles.entriesGrid}>
          {entries.map((entry) => (
            <View key={entry.key} style={styles.entryCard}>
              <Text style={styles.entryTitle}>{entry.name}</Text>
              <Text style={styles.entryMeta}>ID: {entry.idCode}</Text>
              <Text style={styles.entryMeta}>Sample: {entry.sample}</Text>
              <Text style={styles.entryMeta}>Category: {entry.category}</Text>
              {entry.rangeText ? <Text style={styles.entryMeta}>Range: {entry.rangeText}</Text> : null}
              <Text style={styles.entryPrice}>Price: {entry.price} EGP</Text>
              <View style={styles.entryActions}>
                <Pressable style={styles.actionEdit} onPress={() => handleEdit(entry)}>
                  <Text style={styles.actionEditText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.actionDelete} onPress={() => void handleDelete(entry)}>
                  <Text style={styles.actionDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </FormCard>

      <Modal
        transparent
        visible={categoryPicker !== null}
        animationType="fade"
        onRequestClose={() => setCategoryPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCategoryPicker(null)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent}>
              {categoryOptions.map((item) => (
                <Pressable
                  key={`${categoryPicker}-${item}`}
                  style={styles.optionItem}
                  onPress={() => {
                    if (categoryPicker === 'lab') {
                      setLabCategory(item);
                    } else if (categoryPicker === 'scan') {
                      setScanCategory(item);
                    }
                    setCategoryPicker(null);
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  formsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  formCard: {
    flex: 1,
    minWidth: 320,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
  },
  grid: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  rangeField: {
    flex: 1,
    minWidth: 140,
  },
  formActions: {
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.card,
  },
  secondaryButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  feedback: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
    marginBottom: theme.spacing.sm,
  },
  entriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  entryCard: {
    width: 240,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    gap: theme.spacing.xs,
  },
  entryTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  entryMeta: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  entryPrice: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  entryActions: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  actionEdit: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
  },
  actionEditText: {
    fontFamily: theme.font.heading,
    fontSize: 11,
    color: '#065F46',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  actionDelete: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
  },
  actionDeleteText: {
    fontFamily: theme.font.heading,
    fontSize: 11,
    color: '#991B1B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    width: '100%',
    maxWidth: 360,
    maxHeight: 420,
    gap: theme.spacing.sm,
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  optionList: {
    maxHeight: 320,
  },
  optionListContent: {
    gap: theme.spacing.xs,
  },
  optionItem: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.card,
  },
  optionText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
});
