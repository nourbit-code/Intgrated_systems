import { useMemo, useState, useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { theme } from '@/constants/theme';
import { buildUserSignature, useAuth } from '@/hooks/useAuth';
import { useInventory } from '@/hooks/useInventory';
import { useOrders, type Order } from '@/hooks/useOrders';
import { usePatients } from '@/hooks/usePatients';
import { apiRequest } from '@/utils/api';
import {
  allocateConsumption,
  buildConsumptionRowsFromTests,
  markOrderConsumptionApplied,
  readOrderConsumptionDraft,
  wasOrderConsumptionApplied,
} from '@/utils/inventoryConsumption';

type TemplateRow = {
  parameter: string;
  unit: string;
  min: number;
  max: number;
  reference?: string;
  criticalLow?: number;
  criticalHigh?: number;
};

type TemplateId = 'cbc' | 'glucose' | 'vitamin-d' | 'lipid';

type Template = {
  id: string;
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
type Sample = {
  id: string;
  specimenType?: string;
  tubeColor?: string;
  volume?: string;
  collectedAt?: string;
  fastingHours?: string;
};

type Flag = 'Normal' | 'High' | 'Low' | 'Critical';

const flagMap: Record<Flag, { color: string; background: string }> = {
  Normal: { color: '#065F46', background: '#D1FAE5' },
  High: { color: '#B45309', background: '#FEF3C7' },
  Low: { color: '#B45309', background: '#FEF3C7' },
  Critical: { color: '#B91C1C', background: '#FEE2E2' },
};

const SAMPLES_KEY = 'lab_samples_by_order';
const TESTS_BY_SAMPLE_KEY = 'lab_tests_by_sample';
const RESULTS_BY_SAMPLE_KEY = 'lab_results_by_sample';
const RESULTS_META_KEY = 'lab_results_meta_by_order';
type StoredResultMeta = { signedBy?: string; savedAt?: string };
type ApiLabResult = {
  id: number;
  lab_test_order: number;
};

function getResultMetaLookupKeys(order?: Order, fallbackOrderId?: string) {
  const keys: string[] = [];
  if (order?.id && order.patientId && order.date) {
    keys.push(`${order.id}::${order.patientId}::${order.date}`);
  }
  const orderId = order?.id ?? fallbackOrderId;
  if (orderId) {
    keys.push(orderId);
  }
  return Array.from(new Set(keys));
}

function flagValue(value: number | null, row: TemplateRow): Flag {
  if (value === null || Number.isNaN(value)) return 'Normal';
  if (row.criticalLow !== undefined && value <= row.criticalLow) return 'Critical';
  if (row.criticalHigh !== undefined && value >= row.criticalHigh) return 'Critical';
  if (value < row.min) return 'Low';
  if (value > row.max) return 'High';
  return 'Normal';
}

function sampleLabel(sample: Sample) {
  return [sample.specimenType ?? '—', sample.tubeColor ?? '—', sample.volume ? `${sample.volume} ml` : '—'].join(' · ');
}

function htmlFlag(value: string, row: TemplateRow): Flag {
  const numeric = value.trim() === '' ? null : Number(value);
  return flagValue(numeric, row);
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

function normalizeToken(value?: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseLabTestOrderId(testId: string): number | null {
  const match = /^lab-(\d+)$/i.exec(testId.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ResultsMulti() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { orders, updateOrderStatus } = useOrders();
  const { items, consumptionTemplates, consumeItems } = useInventory();
  const { patients } = usePatients();
  const order = useMemo(
    () => orders.find((item) => item.id === params.orderId) as Order | undefined,
    [orders, params.orderId],
  );
  const orderId = order?.id ?? params.orderId ?? '—';
  const patientRecord = useMemo(
    () => patients.find((item) => item.id === order?.patientId),
    [patients, order?.patientId],
  );
  const isReadOnly = order?.status === 'Completed';

  const samples = useMemo<Sample[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(SAMPLES_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as Record<string, Sample[]>;
      return parsed[orderId] ?? [];
    } catch {
      return [];
    }
  }, [orderId]);

  const testsBySample = useMemo<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = window.localStorage.getItem(TESTS_BY_SAMPLE_KEY);
      if (!stored) return {};
      return JSON.parse(stored) as Record<string, string[]>;
    } catch {
      return {};
    }
  }, []);

  const [results, setResults] = useState<Record<string, Record<string, ResultRow[]>>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(RESULTS_BY_SAMPLE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, Record<string, ResultRow[]>>;
        setResults(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const orderTests = useMemo(() => order?.tests ?? [], [order?.tests]);

  const findOrderTest = (testKey: string) => {
    const direct = orderTests.find((item) => item.id === testKey);
    if (direct) return direct;

    const keyToken = normalizeToken(testKey);
    if (!keyToken) return undefined;

    return orderTests.find((item) => {
      const idToken = normalizeToken(item.id);
      const codeToken = normalizeToken(item.code);
      const nameToken = normalizeToken(item.name);
      return (
        keyToken === idToken ||
        keyToken === codeToken ||
        keyToken === nameToken ||
        (codeToken && (codeToken.includes(keyToken) || keyToken.includes(codeToken))) ||
        (nameToken && (nameToken.includes(keyToken) || keyToken.includes(nameToken)))
      );
    });
  };

  const getTemplate = (testId: string): Template => {
    const direct = templates.find((t) => t.id === testId);
    if (direct) return direct;

    const fromOrder = findOrderTest(testId);
    const mappedId = resolveTemplateId({ id: fromOrder?.id ?? testId, name: fromOrder?.name ?? testId });
    if (mappedId) {
      const mapped = templates.find((t) => t.id === mappedId);
      if (mapped) return mapped;
    }

    return {
      id: `generic-${testId}`,
      name: fromOrder?.name ?? testId,
      rows: [
        {
          parameter: fromOrder?.name ?? 'Result',
          unit: fromOrder?.unit ?? '',
          min: typeof fromOrder?.min === 'number' ? fromOrder.min : Number.NaN,
          max: typeof fromOrder?.max === 'number' ? fromOrder.max : Number.NaN,
          reference: fromOrder?.reference ?? undefined,
        },
      ],
    };
  };

  const fallbackTestIdsBySample = useMemo<Record<string, string[]>>(() => {
    const mappedIds = (order?.tests ?? [])
      .filter((test) => test.sample !== 'Imaging')
      .map((test) => resolveTemplateId({ id: test.id, name: test.name }))
      .filter((value): value is TemplateId => Boolean(value));
    const uniqueIds = Array.from(new Set(mappedIds));
    if (uniqueIds.length === 0) return {};

    const next: Record<string, string[]> = {};
    samples.forEach((sample) => {
      next[sample.id] = uniqueIds;
    });
    return next;
  }, [order?.tests, samples]);

  const updateValue = (sampleId: string, testId: string, rowIndex: number, value: string) => {
    setResults((prev) => {
      const currentSample = prev[sampleId] ?? {};
      const currentRows = currentSample[testId] ?? getTemplate(testId).rows.map((row) => ({ ...row, value: '' }));
      const nextRows = currentRows.map((row, idx) => (idx === rowIndex ? { ...row, value } : row));
      return { ...prev, [sampleId]: { ...currentSample, [testId]: nextRows } };
    });
  };

  const persist = async () => {
    if (typeof window === 'undefined') return;

    const allTestIds = new Set<string>();
    Object.values(testsBySample).forEach((testIds) => {
      testIds.forEach((testId) => allTestIds.add(testId));
    });
    Object.values(fallbackTestIdsBySample).forEach((testIds) => {
      testIds.forEach((testId) => allTestIds.add(testId));
    });

    for (const testId of allTestIds) {
      const matchedOrderTest = findOrderTest(testId);
      const labTestOrderId = parseLabTestOrderId(testId) ?? parseLabTestOrderId(matchedOrderTest?.id ?? '');
      if (!labTestOrderId) continue;

      const template = getTemplate(testId);
      const samplePayload = samples
        .filter((sample) => {
          const sampleTests = testsBySample[sample.id] ?? fallbackTestIdsBySample[sample.id] ?? [];
          return sampleTests.includes(testId);
        })
        .map((sample) => {
          const rows = results[sample.id]?.[testId] ?? template.rows.map((row) => ({ ...row, value: '' }));
          return {
            sample_id: sample.id,
            specimen_type: sample.specimenType ?? null,
            tube_color: sample.tubeColor ?? null,
            volume_ml: sample.volume ?? null,
            rows: rows.map((row) => ({
              parameter: row.parameter,
              value: row.value ?? '',
              unit: row.unit || null,
              min: Number.isFinite(row.min) ? row.min : null,
              max: Number.isFinite(row.max) ? row.max : null,
              reference: row.reference?.trim() || null,
              flag: htmlFlag(row.value ?? '', row),
            })),
          };
        });

      const normalRangeValues = Array.from(
        new Set(
          samplePayload.flatMap((entry) =>
            entry.rows
              .map((row) => {
                if (row.reference) return row.reference;
                if (Number.isFinite(row.min as number) && Number.isFinite(row.max as number)) {
                  return `${row.min}-${row.max}`;
                }
                return '';
              })
              .filter(Boolean)
          )
        )
      );

      const payload = {
        lab_test_order: labTestOrderId,
        result_text: JSON.stringify({
          test_name: template.name,
          generated_at: new Date().toISOString(),
          samples: samplePayload,
        }),
        normal_range: normalRangeValues.join(' | ') || null,
        reported_at: new Date().toISOString(),
        source_system: 'frontend_results_multi',
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
    }

    window.localStorage.setItem(RESULTS_BY_SAMPLE_KEY, JSON.stringify(results));
    try {
      const stored = window.localStorage.getItem(RESULTS_META_KEY);
      const parsed = stored ? (JSON.parse(stored) as Record<string, StoredResultMeta>) : {};
      const metaKeys = getResultMetaLookupKeys(order, params.orderId);
      if (metaKeys.length === 0) return;
      parsed[metaKeys[0]] = {
        signedBy: buildUserSignature(currentUser),
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(RESULTS_META_KEY, JSON.stringify(parsed));
    } catch {
      // ignore
    }
  };

  const handleComplete = async () => {
    if (!params.orderId) return;
    try {
      await persist();
    } catch {
      Alert.alert('Save failed', 'Could not save results to the database. Please try again.');
      return;
    }
    if (!wasOrderConsumptionApplied(params.orderId)) {
      const templateRows = buildConsumptionRowsFromTests(
        (order?.tests ?? []).filter((test) => test.sample !== 'Imaging'),
        consumptionTemplates
      );
      const draftRows = readOrderConsumptionDraft(params.orderId);
      const rows = draftRows.length ? draftRows : templateRows;
      const plan = allocateConsumption(rows, items);
      if (plan.shortages.length === 0 && plan.entries.length > 0) {
        consumeItems(plan.entries);
      }
      markOrderConsumptionApplied(params.orderId);
    }
    updateOrderStatus(params.orderId, 'Completed', {
      completedByTechName: currentUser?.name,
      completedByTechUserId: currentUser?.id,
    });
    router.push('/lab-tech/completed-tests' as Href);
  };

  const generatePdf = (sample: Sample) => {
    if (typeof window === 'undefined') return;
    const signedBy = (() => {
      if (order?.completedByTechName?.trim()) {
        const techId = order.completedByTechUserId?.trim();
        return techId ? `${order.completedByTechName} (Lab Technician - ${techId})` : order.completedByTechName;
      }
      try {
        const stored = window.localStorage.getItem(RESULTS_META_KEY);
        const parsed = stored ? (JSON.parse(stored) as Record<string, StoredResultMeta>) : {};
        const metaKeys = getResultMetaLookupKeys(order, params.orderId);
        for (const key of metaKeys) {
          const fromMeta = parsed[key]?.signedBy?.trim();
          if (fromMeta) return fromMeta;
        }
      } catch {
        // ignore
      }
      return 'Unknown User';
    })();
    const tests = testsBySample[sample.id] ?? fallbackTestIdsBySample[sample.id] ?? [];
    const html = `
      <html>
        <head>
          <title>Lab Report - ${sample.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h2 { margin: 0 0 8px; }
            h3 { margin: 16px 0 6px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 8px; }
            .meta-item { font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border: 1px solid #ccc; padding: 6px; font-size: 12px; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Lab Report</h2>
          <div class="meta-grid">
            <div class="meta-item">Patient: ${patientRecord?.name ?? order?.patientName ?? '—'}</div>
            <div class="meta-item">Age: ${patientRecord?.age ?? '—'}</div>
            <div class="meta-item">Gender: ${patientRecord?.gender ?? '—'}</div>
            <div class="meta-item">Number: ${patientRecord?.phone ?? patientRecord?.id ?? order?.patientId ?? '—'}</div>
            <div class="meta-item">Order: ${orderId}</div>
            <div class="meta-item">Sample: ${sample.id}</div>
            <div class="meta-item">Specimen: ${sampleLabel(sample)}</div>
          </div>
          ${tests
            .map((testId) => {
              const template = getTemplate(testId);
              const rows = results[sample.id]?.[testId] ?? template.rows.map((row) => ({ ...row, value: '' }));
              return `
                <h3>${template?.name ?? testId}</h3>
                <table>
                  <tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Range</th><th>Flag</th></tr>
                  ${rows
                    .map((row) => {
                      const rangeText = row.reference?.trim()
                        ? row.reference
                        : Number.isFinite(row.min) && Number.isFinite(row.max)
                        ? `${row.min}-${row.max}`
                        : 'N/A';
                      return `<tr><td>${row.parameter}</td><td>${row.value ?? ''}</td><td>${row.unit || '-'}</td><td>${rangeText}</td><td>${htmlFlag(row.value ?? '', row)}</td></tr>`;
                    })
                    .join('')}
                </table>
              `;
            })
            .join('')}
          <div class="meta-item" style="margin-top: 12px; font-weight: 700;">Verified By: ${signedBy}</div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <DashboardLayout title="Result Entry">
      {samples.map((sample) => {
        const testIds = testsBySample[sample.id] ?? fallbackTestIdsBySample[sample.id] ?? [];
        return (
          <FormCard key={sample.id}>
            <View style={styles.sampleHeader}>
              <View>
                <Text style={styles.sampleTitle}>Sample {sample.id}</Text>
                <Text style={styles.sampleMeta}>{sampleLabel(sample)}</Text>
              </View>
              <PrimaryButton label="Generate PDF" onPress={() => generatePdf(sample)} />
            </View>

            {testIds.map((testId) => {
              const template = getTemplate(testId);
              const rows = results[sample.id]?.[testId] ?? template.rows.map((row) => ({ ...row, value: '' }));
              return (
                <View key={`${sample.id}-${testId}`} style={styles.testBlock}>
                  <Text style={styles.testTitle}>{template.name}</Text>
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
                    return (
                      <View key={`${sample.id}-${testId}-${row.parameter}`} style={styles.tableRow}>
                        <Text style={styles.cellText}>{row.parameter}</Text>
                        <TextInput
                          value={row.value}
                          onChangeText={(text) => updateValue(sample.id, testId, index, text)}
                          style={[styles.input, isReadOnly && styles.inputDisabled]}
                          keyboardType="numeric"
                          editable={!isReadOnly}
                        />
                        <Text style={styles.cellText}>{row.unit}</Text>
                        <Text style={styles.cellText}>
                          {row.reference?.trim()
                            ? row.reference
                            : Number.isFinite(row.min) && Number.isFinite(row.max)
                            ? `${row.min}-${row.max}`
                            : 'N/A'}
                        </Text>
                        <View style={[styles.flagBadge, { backgroundColor: flagStyle.background }]}>
                          <Text style={[styles.flagText, { color: flagStyle.color }]}>{flag}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </FormCard>
        );
      })}

      <View style={styles.actions}>
        <PrimaryButton
          label="Save Draft"
          onPress={() => {
            void persist().catch(() => {
              Alert.alert('Save failed', 'Could not save results to the database. Please try again.');
            });
          }}
          disabled={isReadOnly}
        />
        {!isReadOnly ? <PrimaryButton label="Mark Order Completed" onPress={() => void handleComplete()} /> : null}
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  sampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  sampleTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  sampleMeta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  testBlock: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  testTitle: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: theme.colors.ink,
  },
  tableHeader: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  headerText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  tableRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  cellText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 13,
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
    fontSize: 13,
    color: theme.colors.ink,
  },
  inputDisabled: {
    backgroundColor: theme.colors.border,
    color: theme.colors.slate,
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
    letterSpacing: 0.6,
  },
  actions: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
});



