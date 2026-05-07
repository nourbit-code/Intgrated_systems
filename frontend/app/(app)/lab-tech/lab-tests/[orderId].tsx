import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useInventory } from '@/hooks/useInventory';
import { useOrders, type Order } from '@/hooks/useOrders';
import { usePatients } from '@/hooks/usePatients';
import {
  allocateConsumption,
  buildConsumptionRowsFromTests,
  getAvailableQuantity,
  markOrderConsumptionApplied,
  wasOrderConsumptionApplied,
  writeOrderConsumptionDraft,
  type ConsumptionTemplateRow,
} from '@/utils/inventoryConsumption';

const analyzerOptions = ['Cobas c 311', 'Sysmex XN-1000', 'Roche e601'] as const;
const workflowSteps = [
  { id: 'verify-patient', label: 'Verify Patient' },
  { id: 'verify-specimen', label: 'Verify Specimen' },
  { id: 'select-analyzer', label: 'Select Analyzer' },
  { id: 'start-run', label: 'Start Run' },
];
const qcChecklist = [
  { id: 'calibration', label: 'Calibration verified' },
  { id: 'reagents', label: 'Reagents within expiry' },
  { id: 'controls', label: 'QC controls passed' },
  { id: 'temperature', label: 'Temperature range stable' },
];

type RunStatus = 'Ready' | 'Running' | 'Completed';
type SpecimenDetails = {
  specimenType?: string;
  collectionTime?: string;
  fastingHours?: string;
  tubeColor?: string;
  volume?: string;
  tubes?: string;
  collectionSite?: string;
  collectionMethod?: string;
  condition?: string;
  conditionNotes?: string;
  labSection?: string;
  storageTemp?: string;
};

const SPECIMEN_STORAGE_KEY = 'lab_specimen_by_order';

function pickLabTests(order?: Order) {
  if (!order) return [];
  return order.tests.filter((test) => test.sample !== 'Imaging');
}

function StatusPill({ label }: { label: string }) {
  const tones: Record<string, { text: string; background: string; border: string }> = {
    Ready: { text: '#0F766E', background: '#CCFBF1', border: '#5EEAD4' },
    Running: { text: '#1D4ED8', background: '#DBEAFE', border: '#93C5FD' },
    Completed: { text: '#166534', background: '#DCFCE7', border: '#86EFAC' },
  };
  const tone = tones[label] ?? { text: '#475569', background: '#E2E8F0', border: '#CBD5F5' };
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.background, borderColor: tone.border }]}>
      <Text style={[styles.statusPillText, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

export default function LabTestRun() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { orders, updateOrderStatus } = useOrders();
  const { patients } = usePatients();
  const { items, consumptionTemplates, consumeItems } = useInventory();
  const [runStatus, setRunStatus] = useState<RunStatus>('Ready');
  const [selectedAnalyzer, setSelectedAnalyzer] = useState<(typeof analyzerOptions)[number]>(analyzerOptions[0]);
  const [consumptionRows, setConsumptionRows] = useState<ConsumptionTemplateRow[]>([]);
  const [hasManualConsumptionEdit, setHasManualConsumptionEdit] = useState(false);
  const [specimenDetails, setSpecimenDetails] = useState<SpecimenDetails | null>(null);
  const [qcState, setQcState] = useState<Record<string, boolean>>({
    calibration: true,
    reagents: true,
    controls: false,
    temperature: false,
  });

  const order = useMemo(
    () => orders.find((item) => item.id === params.orderId),
    [orders, params.orderId],
  );
  const patientRecord = useMemo(
    () => patients.find((patient) => patient.id === order?.patientId),
    [patients, order?.patientId],
  );
  const labTests = useMemo(() => pickLabTests(order), [order?.tests]);
  const patientName = order?.patientName ?? 'Unknown Patient';
  const orderId = order?.id ?? params.orderId ?? 'Unknown';
  const patientId = order?.patientId ?? '—';
  const patientAge = patientRecord?.age ? `${patientRecord.age}` : '—';
  const patientGender = patientRecord?.gender ?? '—';
  const sampleTypes = labTests.length
    ? Array.from(new Set(labTests.map((test) => test.sample))).join(', ')
    : '—';
  const stockItemNames = useMemo(
    () => Array.from(new Set(items.map((item) => item.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const autoConsumptionRows = useMemo(
    () => buildConsumptionRowsFromTests(labTests, consumptionTemplates),
    [labTests, consumptionTemplates]
  );
  const shortages = useMemo(
    () =>
      consumptionRows
        .filter((row) => Number(row.quantity) > 0)
        .map((row) => {
          const required = Number(row.quantity);
          const available = getAvailableQuantity(row.itemName, items);
          const missing = Math.max(0, required - available);
          return { ...row, required, available, missing };
        })
        .filter((row) => row.missing > 0),
    [consumptionRows, items]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!orderId || orderId === 'Unknown') return;
    try {
      const stored = window.localStorage.getItem(SPECIMEN_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, SpecimenDetails & { collectedAt?: string }>;
      const saved = parsed[orderId];
      if (!saved) return;
      setSpecimenDetails({
        specimenType: saved.specimenType,
        collectionTime: saved.collectedAt ?? saved.collectionTime,
        fastingHours: saved.fastingHours,
        tubeColor: saved.tubeColor,
        volume: saved.volume,
        tubes: saved.tubes,
        collectionSite: saved.collectionSite,
        collectionMethod: saved.collectionMethod,
        condition: saved.condition,
        conditionNotes: saved.conditionNotes,
        labSection: saved.labSection,
        storageTemp: saved.storageTemp,
      });
    } catch {
      // ignore
    }
  }, [orderId]);

  useEffect(() => {
    if (!order?.id) return;
    if (order.status === 'Completed') return;
    if (order.status === 'In Progress') return;
    updateOrderStatus(order.id, 'In Progress');
  }, [order?.id, order?.status, updateOrderStatus]);

  useEffect(() => {
    if (hasManualConsumptionEdit) return;
    setConsumptionRows(autoConsumptionRows);
  }, [autoConsumptionRows, hasManualConsumptionEdit]);

  useEffect(() => {
    if (!order?.id) return;
    writeOrderConsumptionDraft(
      order.id,
      consumptionRows.filter((row) => row.itemName.trim() && Number(row.quantity) > 0)
    );
  }, [order?.id, consumptionRows]);

  const handleStartRun = () => {
    setRunStatus('Running');
  };

  const handleMarkCompleted = () => {
    if (!order?.id) return;
    if (!wasOrderConsumptionApplied(order.id)) {
      const requestedRows = consumptionRows
        .map((row) => ({ itemName: row.itemName.trim(), quantity: Number(row.quantity) }))
        .filter((row) => row.itemName && Number.isFinite(row.quantity) && row.quantity > 0);
      const plan = allocateConsumption(requestedRows, items);
      if (plan.shortages.length) {
        const details = plan.shortages
          .map((shortage) => `${shortage.itemName}: need ${shortage.required}, available ${shortage.available}`)
          .join('\n');
        Alert.alert('Insufficient stock', details);
        return;
      }
      if (plan.entries.length) {
        consumeItems(plan.entries);
      }
      markOrderConsumptionApplied(order.id);
    }
    setRunStatus('Completed');
    updateOrderStatus(order.id, 'Completed', {
      completedByTechName: currentUser?.name,
      completedByTechUserId: currentUser?.id,
    });
  };

  const handleOpenResults = () => {
    if (!order?.id) return;
    router.push({
      pathname: '/lab-tech/results-entry',
      params: { orderId: order.id, patient: order.patientName, testId: order.tests[0]?.id },
    } as Href);
  };

  const handleAnalyzerCycle = () => {
    const currentIndex = analyzerOptions.indexOf(selectedAnalyzer);
    const next = analyzerOptions[(currentIndex + 1) % analyzerOptions.length];
    setSelectedAnalyzer(next);
  };

  return (
    <DashboardLayout title="Lab Test Run">
      <View style={styles.pageRow}>
        <FormCard style={styles.mainCard}>
          <Text style={styles.sectionTitle}>Test Workflow</Text>
          <View style={styles.workflowPanel}>
            {workflowSteps.map((step, index) => (
              <View key={step.id} style={styles.workflowRow}>
                <View style={styles.workflowIndex}>
                  <Text style={styles.workflowIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.workflowBody}>
                  <Text style={styles.workflowLabel}>{step.label}</Text>
                  <Text style={styles.workflowHint}>
                    {step.id === 'start-run'
                      ? 'Ensure QC is complete before starting.'
                      : 'Review the details and confirm.'}
                  </Text>
                </View>
                <StatusPill label={index < 2 ? 'Completed' : index === 2 ? 'Ready' : runStatus} />
              </View>
            ))}
          </View>

          <View style={styles.panelRow}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Analyzer</Text>
              <SelectField label="Select Analyzer" value={selectedAnalyzer} onPress={handleAnalyzerCycle} />
              <View style={styles.panelGrid}>
                <TextInputField label="Calibration Status" value="Calibrated" editable={false} />
                <TextInputField label="Last QC" value="Today 09:15" editable={false} />
                <TextInputField label="Reagent Lot" value="CHEM-2031" editable={false} />
                <TextInputField label="Remaining Tests" value="18" editable={false} />
              </View>
            </View>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>QC Checklist</Text>
              <View style={styles.qcList}>
                {qcChecklist.map((item) => {
                  const checked = qcState[item.id];
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.qcRow}
                      onPress={() => setQcState((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    >
                      <View style={[styles.qcBox, checked && styles.qcBoxChecked]}>
                        {checked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                      </View>
                      <Text style={styles.qcLabel}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>Consumption Summary</Text>
            <Text style={styles.workflowHint}>
              Auto-calculated from test templates. You can edit quantities or add extra items before completion.
            </Text>
            {shortages.length ? (
              <View style={styles.shortageBox}>
                <Text style={styles.shortageTitle}>Low stock warning</Text>
                {shortages.map((row) => (
                  <Text key={`short-${row.itemName}`} style={styles.shortageText}>
                    {`${row.itemName}: required ${row.required}, available ${row.available}`}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.panelGrid}>
              {consumptionRows.map((row, index) => (
                <View key={`cons-${index}`} style={styles.consumptionRow}>
                  <View style={styles.consumptionField}>
                    <SelectField
                      label="Item"
                      value={row.itemName || 'Select item'}
                      onPress={() => {
                        if (!stockItemNames.length) return;
                        const currentIndex = Math.max(stockItemNames.indexOf(row.itemName), 0);
                        const nextIndex = (currentIndex + 1) % stockItemNames.length;
                        setHasManualConsumptionEdit(true);
                        setConsumptionRows((prev) =>
                          prev.map((entry, idx) =>
                            idx === index ? { ...entry, itemName: stockItemNames[nextIndex] } : entry
                          )
                        );
                      }}
                    />
                  </View>
                  <View style={styles.qtyField}>
                    <TextInputField
                      label="Qty"
                      value={String(row.quantity)}
                      keyboardType="number-pad"
                      onChangeText={(value) => {
                        setHasManualConsumptionEdit(true);
                        setConsumptionRows((prev) =>
                          prev.map((entry, idx) =>
                            idx === index ? { ...entry, quantity: Number(value.replace(/[^0-9]/g, '') || '0') } : entry
                          )
                        );
                      }}
                    />
                  </View>
                  <Pressable
                    style={styles.inlineRemoveButton}
                    onPress={() => {
                      setHasManualConsumptionEdit(true);
                      setConsumptionRows((prev) => prev.filter((_, idx) => idx !== index));
                    }}
                  >
                    <Text style={styles.inlineRemoveText}>Remove</Text>
                  </Pressable>
                </View>
              ))}
              {!consumptionRows.length ? <Text style={styles.workflowHint}>No template set for these tests yet.</Text> : null}
              <View style={styles.consumptionActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setHasManualConsumptionEdit(true);
                    setConsumptionRows((prev) => [...prev, { itemName: stockItemNames[0] ?? '', quantity: 1 }]);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Add Extra Item</Text>
                </Pressable>
                <Pressable
                  style={styles.ghostButton}
                  onPress={() => {
                    setHasManualConsumptionEdit(false);
                    setConsumptionRows(autoConsumptionRows);
                  }}
                >
                  <Text style={styles.ghostButtonText}>Reset To Template</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <PrimaryButton label={runStatus === 'Running' ? 'Running' : 'Start Run'} onPress={handleStartRun} />
            <Pressable style={styles.secondaryButton} onPress={handleOpenResults}>
              <Text style={styles.secondaryButtonText}>Open Result Entry</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={handleMarkCompleted}>
              <Text style={styles.ghostButtonText}>Mark Completed</Text>
            </Pressable>
          </View>

          <DataTable
            title="Result Entry Preview"
            columns={['Test', 'Result', 'Unit', 'Reference Range', 'Flag']}
            columnWidths={[220, 120, 120, 180, 120]}
            rows={(labTests.length ? labTests : order?.tests ?? []).map((test) => [
              test.name,
              '—',
              '—',
              '—',
              <StatusPill key={`${test.id}-flag`} label="Ready" />,
            ])}
          />
        </FormCard>

        <View style={styles.rightColumn}>
          <FormCard style={styles.patientCard}>
            <Text style={styles.sectionTitle}>Patient Details</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Order ID</Text>
                <Text style={styles.infoValue}>{orderId}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Patient</Text>
                <Text style={styles.infoValue}>{patientName}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Patient ID</Text>
                <Text style={styles.infoValue}>{patientId}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Age</Text>
                <Text style={styles.infoValue}>{patientAge}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={styles.infoValue}>{patientGender}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Requested Tests</Text>
                <Text style={styles.infoValue}>{labTests.map((test) => test.name).join(', ') || '—'}</Text>
              </View>
            </View>
          </FormCard>

          <FormCard style={styles.patientCard}>
            <Text style={styles.sectionTitle}>Specimen Details</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Sample Type</Text>
                <Text style={styles.infoValue}>{specimenDetails?.specimenType ?? sampleTypes}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Collection Time</Text>
                <Text style={styles.infoValue}>{specimenDetails?.collectionTime ?? '—'}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Fasting</Text>
                <Text style={styles.infoValue}>{specimenDetails?.fastingHours ? `${specimenDetails.fastingHours} hours` : '—'}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Tube Color</Text>
                <Text style={styles.infoValue}>{specimenDetails?.tubeColor ?? '—'}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Volume</Text>
                <Text style={styles.infoValue}>{specimenDetails?.volume ? `${specimenDetails.volume} ml` : '—'}</Text>
              </View>
            </View>
          </FormCard>

        </View>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  pageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  mainCard: {
    flex: 1,
    gap: theme.spacing.lg,
  },
  rightColumn: {
    width: 360,
    gap: theme.spacing.md,
  },
  patientCard: {
    width: '100%',
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  workflowPanel: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  workflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
  },
  workflowIndex: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  workflowIndexText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: theme.colors.ink,
  },
  workflowBody: {
    flex: 1,
    gap: 4,
  },
  workflowLabel: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  workflowHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  panelRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  panelCard: {
    flex: 1,
    minWidth: 260,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  panelTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  panelGrid: {
    gap: theme.spacing.sm,
  },
  shortageBox: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: theme.radius.sm,
    backgroundColor: '#FEF2F2',
    padding: theme.spacing.sm,
    gap: 4,
  },
  shortageTitle: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#991B1B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  shortageText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B91C1C',
  },
  consumptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  consumptionField: {
    flex: 1,
  },
  qtyField: {
    width: 110,
  },
  inlineRemoveButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 3,
  },
  inlineRemoveText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#991B1B',
  },
  consumptionActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  qcList: {
    gap: theme.spacing.sm,
  },
  qcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  qcBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  qcBoxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  qcLabel: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#1D4ED8',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  ghostButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#64748B',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  infoBlock: {
    minWidth: 140,
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  statusRow: {
    marginTop: theme.spacing.xs,
  },
});

