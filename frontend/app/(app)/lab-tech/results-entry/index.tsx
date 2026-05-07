import { useMemo, useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, TextInput, View, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useOrders, Order } from '@/hooks/useOrders';
import { useInventory } from '@/hooks/useInventory';
import { apiRequest } from '@/utils/api';

type TemplateRow = {
  parameter: string;
  unit: string;
  min: number;
  max: number;
  criticalLow?: number;
  criticalHigh?: number;
};

type TemplateId = 'cbc' | 'glucose' | 'vitamin-d' | 'lipid';

type Template = {
  id: TemplateId;
  name: string;
  rows: TemplateRow[];
};

const templates: Template[] = [
  {
    id: 'cbc',
    name: 'Complete Blood Count (CBC)',
    rows: [
      { parameter: 'Hemoglobin', unit: 'g/dL', min: 12, max: 16, criticalLow: 7, criticalHigh: 20 },
      { parameter: 'WBC', unit: 'cells/uL', min: 4000, max: 11000, criticalLow: 2000, criticalHigh: 30000 },
      { parameter: 'Platelets', unit: 'cells/uL', min: 150000, max: 450000, criticalLow: 50000, criticalHigh: 1000000 },
    ],
  },
  {
    id: 'glucose',
    name: 'Blood Glucose',
    rows: [
      { parameter: 'Fasting Glucose', unit: 'mg/dL', min: 70, max: 99, criticalLow: 40, criticalHigh: 400 },
      { parameter: 'Random Glucose', unit: 'mg/dL', min: 70, max: 140, criticalLow: 40, criticalHigh: 400 },
    ],
  },
  {
    id: 'vitamin-d',
    name: 'Vitamin D',
    rows: [
      { parameter: '25(OH) Vitamin D', unit: 'ng/mL', min: 30, max: 100, criticalLow: 10, criticalHigh: 150 },
    ],
  },
  {
    id: 'lipid',
    name: 'Lipid Profile',
    rows: [
      { parameter: 'Total Cholesterol', unit: 'mg/dL', min: 125, max: 200, criticalHigh: 300 },
      { parameter: 'LDL', unit: 'mg/dL', min: 0, max: 130, criticalHigh: 190 },
      { parameter: 'HDL', unit: 'mg/dL', min: 40, max: 80, criticalLow: 20 },
      { parameter: 'Triglycerides', unit: 'mg/dL', min: 0, max: 150, criticalHigh: 500 },
    ],
  },
];

type ResultRow = TemplateRow & { value: string };

type Flag = 'Normal' | 'High' | 'Low' | 'Critical';

type FlagStyle = { label: Flag; color: string; background: string };

const flagMap: Record<Flag, FlagStyle> = {
  Normal: { label: 'Normal', color: '#065F46', background: '#D1FAE5' },
  High: { label: 'High', color: '#B45309', background: '#FEF3C7' },
  Low: { label: 'Low', color: '#B45309', background: '#FEF3C7' },
  Critical: { label: 'Critical', color: '#B91C1C', background: '#FEE2E2' },
};

type SpecimenDetails = {
  specimenType?: string;
  collectedAt?: string;
  fastingHours?: string;
  tubeColor?: string;
  volume?: string;
  tubes?: string;
  barcodeId?: string;
  collectionSite?: string;
  collectionMethod?: string;
  condition?: string;
  conditionNotes?: string;
  labSection?: string;
  storageTemp?: string;
};

const SPECIMEN_STORAGE_KEY = 'lab_specimen_by_order';
type ApiLabResult = { id: number; lab_test_order: number };

function flagValue(value: number | null, row: TemplateRow): Flag {
  if (value === null || Number.isNaN(value)) return 'Normal';
  if (row.criticalLow !== undefined && value <= row.criticalLow) return 'Critical';
  if (row.criticalHigh !== undefined && value >= row.criticalHigh) return 'Critical';
  if (value < row.min) return 'Low';
  if (value > row.max) return 'High';
  return 'Normal';
}

function storageKey(orderId?: string, testId?: string) {
  return `lab_result_${orderId ?? 'new'}_${testId ?? 'unknown'}`;
}

function parseLabTestOrderId(testId?: string) {
  const match = /^lab-(\d+)$/i.exec((testId ?? '').trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveTemplateId(test?: { id?: string; name?: string }): TemplateId | null {
  const id = (test?.id ?? '').trim().toLowerCase();
  const name = (test?.name ?? '').trim().toLowerCase();
  const haystack = `${id} ${name}`;
  if (id === 'cbc' || haystack.includes('complete blood count') || haystack.includes('cbc')) return 'cbc';
  if (id === 'glucose' || haystack.includes('glucose')) return 'glucose';
  if (id === 'vitamin-d' || haystack.includes('vitamin d')) return 'vitamin-d';
  if (id === 'lipid' || haystack.includes('lipid')) return 'lipid';
  return null;
}

export default function ResultsEntry() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; testId?: string; patient?: string }>();
  const { currentUser } = useAuth();
  const { orders, updateOrderStatus } = useOrders();
  const { consumeItems } = useInventory();
  const activeOrder = orders.find((order) => order.id === params.orderId) as Order | undefined;
  const activeOrderTest = activeOrder?.tests.find((test) => test.id === params.testId) ?? activeOrder?.tests[0];

  const defaultTemplateId =
    resolveTemplateId({ id: params.testId, name: activeOrderTest?.name }) ?? 'cbc';
  const [templateId, setTemplateId] = useState<TemplateId>(defaultTemplateId);
  const template = useMemo(() => templates.find((t) => t.id === templateId)!, [templateId]);
  const [rows, setRows] = useState<ResultRow[]>(
    template.rows.map((row) => ({ ...row, value: '' }))
  );
  const [showCriticalConfirm, setShowCriticalConfirm] = useState(false);
  const [notes, setNotes] = useState('');
  const [qcPassed, setQcPassed] = useState(true);
  const [verified, setVerified] = useState(true);
  const [specimenDetails, setSpecimenDetails] = useState<SpecimenDetails | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = storageKey(params.orderId, templateId);
    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ResultRow[];
        if (Array.isArray(parsed)) {
          setRows(parsed);
        }
      } catch {
        // ignore invalid cache
      }
    }
  }, [params.orderId, templateId]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!params.orderId) return;
    try {
      const stored = window.localStorage.getItem(SPECIMEN_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, SpecimenDetails>;
      const details = parsed[params.orderId];
      if (details) setSpecimenDetails(details);
    } catch {
      // ignore invalid cache
    }
  }, [params.orderId]);

  const handleTemplateChange = (nextId: TemplateId) => {
    setTemplateId(nextId);
    const nextTemplate = templates.find((t) => t.id === nextId)!;
    setRows(nextTemplate.rows.map((row) => ({ ...row, value: '' })));
  };

  const updateValue = (index: number, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, value } : row)));
  };

  const flags = rows.map((row) => {
    const numeric = row.value.trim() === '' ? null : Number(row.value);
    return flagValue(numeric, row);
  });
  const hasCritical = flags.some((flag) => flag === 'Critical');


  const persist = async () => {
    if (Platform.OS !== 'web') return;
    const key = storageKey(params.orderId, templateId);
    window.localStorage.setItem(key, JSON.stringify(rows));

    const labTestOrderId = parseLabTestOrderId(params.testId);
    if (!labTestOrderId) return;

    const payload = {
      lab_test_order: labTestOrderId,
      result_text: JSON.stringify({
        test_name: template.name,
        generated_at: new Date().toISOString(),
        rows: rows.map((row) => ({
          parameter: row.parameter,
          value: row.value ?? '',
          unit: row.unit,
          min: row.min,
          max: row.max,
          flag: flagValue(row.value.trim() === '' ? null : Number(row.value), row),
        })),
      }),
      normal_range: rows
        .map((row) => `${row.parameter}: ${row.min}-${row.max}`)
        .join(' | '),
      reported_at: new Date().toISOString(),
      source_system: 'frontend_results_entry',
    };

    const existing = await apiRequest<ApiLabResult[]>(`/api/v1/lab-results/?lab_test_order=${labTestOrderId}`);
    if (existing.length > 0) {
      await apiRequest(`/api/v1/lab-results/${existing[0].id}/`, {
        method: 'PATCH',
        body: payload,
      });
    } else {
      await apiRequest('/api/v1/lab-results/', {
        method: 'POST',
        body: payload,
      });
    }
  };

  const handleSubmit = async () => {
    if (hasCritical) {
      setShowCriticalConfirm(true);
      return;
    }
    try {
      await persist();
    } catch {
      Alert.alert('Save failed', 'Could not save results to the database. Please try again.');
    }
  };

  const confirmCritical = async () => {
    try {
      await persist();
    } catch {
      Alert.alert('Save failed', 'Could not save results to the database. Please try again.');
    }
    setShowCriticalConfirm(false);
  };

  const hasSpecimenData = Boolean(
    specimenDetails?.specimenType
    || specimenDetails?.tubeColor
    || specimenDetails?.volume
    || specimenDetails?.collectionSite
    || specimenDetails?.collectionMethod
  );

  const handleMarkCompleted = () => {
    if (!params.orderId) return;
    if (!hasSpecimenData) return;
    if (templateId === 'cbc') {
      consumeItems([{ id: 'INV01', quantity: 1 }, { id: 'INV02', quantity: 1 }, { id: 'INV03', quantity: 1 }]);
    }
    if (templateId === 'glucose') {
      consumeItems([{ id: 'INV04', quantity: 1 }, { id: 'INV03', quantity: 1 }]);
    }
    if (templateId === 'vitamin-d') {
      consumeItems([{ id: 'INV05', quantity: 1 }, { id: 'INV03', quantity: 1 }]);
    }
    if (templateId === 'lipid') {
      consumeItems([{ id: 'INV06', quantity: 1 }, { id: 'INV03', quantity: 1 }]);
    }
    updateOrderStatus(params.orderId, 'Completed', {
      completedByTechName: currentUser?.name,
      completedByTechUserId: currentUser?.id,
    });
    router.push('/lab-tech' as Href);
  };

  const orderId = params.orderId ?? activeOrder?.id ?? '1023';
  const sampleId = `SMP-${orderId}`;
  const barcodeId = specimenDetails?.barcodeId ?? `${orderId}-BLD`;
  const patientName = params.patient ?? activeOrder?.patientName ?? 'Ahmed Hassan';
  const patientId = activeOrder?.patientId ?? 'P-2041';
  const testName = template.name;
  const collectedAt = specimenDetails?.collectedAt ?? new Date().toLocaleString();

  return (
    <DashboardLayout title="Perform Test / Result Entry">
      <View style={styles.splitRow}>
        <FormCard style={styles.splitCard}>
          <Text style={styles.sectionTitle}>Test Order Information</Text>
          <View style={styles.infoGridThree}>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Order ID</Text>
              <Text style={styles.infoValue}>{`LAB-${orderId}`}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Sample ID</Text>
              <Text style={styles.infoValue}>{sampleId}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Patient</Text>
              <Text style={styles.infoValue}>{patientName}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Patient ID</Text>
              <Text style={styles.infoValue}>{patientId}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Age/Gender</Text>
              <Text style={styles.infoValue}>34 / Male</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Test</Text>
              <Text style={styles.infoValue}>{testName}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Collected</Text>
              <Text style={styles.infoValue}>{collectedAt}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Order Date</Text>
              <Text style={styles.infoValue}>{activeOrder?.date ?? '—'}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{activeOrder?.status ?? '—'}</Text>
            </View>
          </View>
        </FormCard>

        <FormCard style={styles.splitCard}>
          <Text style={styles.sectionTitle}>Specimen Details</Text>
          <View style={styles.infoGridThree}>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{specimenDetails?.specimenType ?? '—'}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Tube</Text>
              <Text style={styles.infoValue}>{specimenDetails?.tubeColor ?? '—'}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Volume</Text>
              <Text style={styles.infoValue}>
                {specimenDetails?.volume ? `${specimenDetails.volume} ml` : '—'}
              </Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Fasting</Text>
              <Text style={styles.infoValue}>
                {specimenDetails?.fastingHours ? `${specimenDetails.fastingHours} hours` : '—'}
              </Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Site</Text>
              <Text style={styles.infoValue}>{specimenDetails?.collectionSite ?? '—'}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Method</Text>
              <Text style={styles.infoValue}>{specimenDetails?.collectionMethod ?? '—'}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Condition</Text>
              <Text style={styles.infoValue}>{specimenDetails?.condition ?? '—'}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Storage</Text>
              <Text style={styles.infoValue}>{specimenDetails?.storageTemp ?? '—'}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Tubes</Text>
              <Text style={styles.infoValue}>{specimenDetails?.tubes ?? '—'}</Text>
            </View>
            <View style={styles.infoBlockThird}>
              <Text style={styles.infoLabel}>Section</Text>
              <Text style={styles.infoValue}>{specimenDetails?.labSection ?? '—'}</Text>
            </View>
          </View>
        </FormCard>
      </View>

      {!hasSpecimenData ? (
        <FormCard>
          <Text style={styles.sectionTitle}>Chain-of-Custody Hold</Text>
          <Text style={styles.holdNote}>
            Specimen details are missing. Complete Sample Collection before releasing or completing this test.
          </Text>
        </FormCard>
      ) : null}

      <FormCard>
        <Text style={styles.sectionTitle}>Test Method / Analyzer</Text>
        <View style={styles.formGrid}>
          <TextInputField label="Analyzer Machine" value="Sysmex XN-1000" />
          <TextInputField label="Test Method" value="Automated Hematology Analyzer" />
          <TextInputField label="Reagent Lot Number" value="HEM-2341" />
          <SelectField label="Calibration Status" value="Calibrated" />
          <SelectField label="Quality Control" value="Passed" />
        </View>
      </FormCard>

      <FormCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Result Entry</Text>
          <View style={styles.templatePills}>
            {templates.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleTemplateChange(item.id)}
                style={[styles.templatePill, templateId === item.id && styles.templatePillActive]}
              >
                <Text style={[styles.templateText, templateId === item.id && styles.templateTextActive]}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.tableHeader}>
          <Text style={styles.headerText}>Parameter</Text>
          <Text style={styles.headerText}>Result</Text>
          <Text style={styles.headerText}>Unit</Text>
          <Text style={styles.headerText}>Range</Text>
          <Text style={styles.headerText}>Flag</Text>
        </View>
        {rows.map((row, index) => {
          const numeric = row.value.trim() === '' ? null : Number(row.value);
          const flag = flagValue(numeric, row);
          const flagStyle = flagMap[flag];
          const isAlert = flag === 'High' || flag === 'Low';
          const isCritical = flag === 'Critical';
          return (
            <View key={row.parameter}>
              <View
                style={[
                  styles.tableRow,
                  isAlert && styles.rowAlert,
                  isCritical && styles.rowCritical,
                ]}
              >
                <Text style={styles.cellText}>{row.parameter}</Text>
                <TextInput
                  value={row.value}
                  onChangeText={(text) => updateValue(index, text)}
                  style={styles.input}
                  keyboardType="numeric"
                />
                <Text style={styles.cellText}>{row.unit}</Text>
                <Text style={styles.cellText}>
                  {row.min}-{row.max}
                </Text>
                <View style={[styles.flagBadge, { backgroundColor: flagStyle.background }]}> 
                  <Text style={[styles.flagText, { color: flagStyle.color }]}>{flagStyle.label}</Text>
                </View>
              </View>
              {flag !== 'Normal' ? (
                <Text style={[styles.flagNote, isCritical && styles.flagNoteCritical]}>
                  {flag === 'High' && `${row.parameter} is above reference range.`}
                  {flag === 'Low' && `${row.parameter} is below reference range.`}
                  {flag === 'Critical' && `${row.parameter} is critical. Immediate review required.`}
                </Text>
              ) : null}
            </View>
          );
        })}
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Technician Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={styles.notesInput}
          placeholder="Enter notes about the sample or results"
          placeholderTextColor={theme.colors.slate}
          multiline
          numberOfLines={4}
        />
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Verification / Quality Check</Text>
        <View style={styles.checkRow}>
          <Pressable style={[styles.checkItem, qcPassed && styles.checkActive]} onPress={() => setQcPassed((prev) => !prev)}>
            <Text style={[styles.checkText, qcPassed && styles.checkTextActive]}>Quality Control Passed</Text>
          </Pressable>
          <Pressable style={[styles.checkItem, verified && styles.checkActive]} onPress={() => setVerified((prev) => !prev)}>
            <Text style={[styles.checkText, verified && styles.checkTextActive]}>Result Verified</Text>
          </Pressable>
        </View>
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Technician Information</Text>
        <View style={styles.formGrid}>
          <TextInputField label="Technician Name" value={currentUser?.name || 'Lab Technician'} editable={false} />
          <TextInputField label="Technician ID" value={currentUser?.id || 'LAB-0000'} editable={false} />
          <TextInputField label="Result Entry Time" value={collectedAt} editable={false} />
        </View>
      </FormCard>

      <View style={styles.actions}>
        <PrimaryButton
          label="Save Draft"
          onPress={() => {
            void persist().catch(() => {
              Alert.alert('Save failed', 'Could not save results to the database. Please try again.');
            });
          }}
        />
        <PrimaryButton label="Submit Result" onPress={() => void handleSubmit()} />
        <PrimaryButton label="Mark Test Completed" onPress={handleMarkCompleted} disabled={!hasSpecimenData} />
      </View>

      <ConfirmModal
        visible={showCriticalConfirm}
        title="Critical Values Detected"
        message="One or more results are critical. Confirm before submitting."
        onConfirm={confirmCritical}
        onCancel={() => setShowCriticalConfirm(false)}
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  infoGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  infoBlock: {
    minWidth: 180,
    flex: 1,
    gap: 4,
  },
  infoBlockFull: {
    width: '100%',
    gap: 4,
  },
  infoGridThree: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  infoBlockThird: {
    width: '33.33%',
    gap: 2,
    paddingRight: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  splitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  splitCard: {
    flex: 1,
    minWidth: 280,
    padding: theme.spacing.md,
  },
  infoLabel: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  holdNote: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: '#B91C1C',
  },
  infoValue: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: theme.colors.ink,
  },
  formGrid: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  templatePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  templatePill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  templatePillActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  templateText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  templateTextActive: {
    color: theme.colors.ink,
  },
  tableHeader: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginTop: theme.spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowAlert: {
    backgroundColor: '#FEF3C7',
  },
  rowCritical: {
    backgroundColor: '#FEE2E2',
  },
  headerText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  cellText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  flagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  flagText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  flagNote: {
    marginTop: 4,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  flagNoteCritical: {
    color: theme.colors.danger,
  },
  notesInput: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  checkRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  checkItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  checkActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  checkText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  checkTextActive: {
    color: theme.colors.ink,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
});
