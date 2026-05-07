import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { theme } from '@/constants/theme';
import { usePatients } from '@/hooks/usePatients';
import { Order, useOrders } from '@/hooks/useOrders';
import { API_BASE_URL, apiRequest } from '@/utils/api';

const statusMap: Record<Order['status'], 'samples-waiting' | 'completed' | 'cancelled' | 'in-progress'> = {
  'Waiting for Sample': 'samples-waiting',
  'In Progress': 'in-progress',
  Completed: 'completed',
  Cancelled: 'cancelled',
};

type ResultRow = {
  parameter: string;
  unit: string;
  min: number;
  max: number;
  value: string;
};

type RadiologyReport = {
  id: string;
  orderId?: string;
  createdAt?: string;
  notes?: string;
  diagnostic?: {
    modality?: string;
    bodyPart?: string;
    laterality?: string;
    severity?: string;
    followUp?: string;
    techName?: string;
    findings?: string;
  };
  scans?: {
    scanIds?: string[];
    images?: Array<{ scanId?: string; uri?: string }>;
    dicoms?: Array<{ scanId?: string; previewUri?: string | null }>;
  };
};

type ApiScanResult = {
  id: number;
  scan_order: number;
  finding_text: string | null;
  image_file: string | null;
  reported_at: string | null;
};

const SAMPLES_KEY = 'lab_samples_by_order';
const TESTS_BY_SAMPLE_KEY = 'lab_tests_by_sample';
const RESULTS_BY_SAMPLE_KEY = 'lab_results_by_sample';

function getStoredResultRows(orderId: string, testId: string) {
  if (typeof window === 'undefined') return [] as ResultRow[];
  try {
    const samplesStored = window.localStorage.getItem(SAMPLES_KEY);
    const testsStored = window.localStorage.getItem(TESTS_BY_SAMPLE_KEY);
    const resultsStored = window.localStorage.getItem(RESULTS_BY_SAMPLE_KEY);
    if (!samplesStored || !testsStored || !resultsStored) return [];

    const samplesByOrder = JSON.parse(samplesStored) as Record<string, { id: string }[]>;
    const testsBySample = JSON.parse(testsStored) as Record<string, string[]>;
    const resultsBySample = JSON.parse(resultsStored) as Record<string, Record<string, ResultRow[]>>;

    const samples = samplesByOrder[orderId] ?? [];
    for (const sample of samples) {
      const sampleTests = testsBySample[sample.id] ?? [];
      if (!sampleTests.includes(testId)) continue;
      const rows = resultsBySample[sample.id]?.[testId];
      if (rows && rows.length > 0) return rows;
    }
  } catch {
    return [];
  }
  return [];
}

function formatDate(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function parseScanOrderId(testId: string) {
  const match = /^scan-(\d+)$/i.exec(testId);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export default function PatientEmr() {
  const params = useLocalSearchParams<{ id?: string }>();
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id ?? 'unknown';
  const { patients } = usePatients();
  const { orders } = useOrders();
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const patient = useMemo(() => patients.find((p) => p.id === patientId), [patients, patientId]);

  const patientOrders = useMemo(
    () => orders.filter((order) => order.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date)),
    [orders, patientId],
  );
  const [scanResults, setScanResults] = useState<ApiScanResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const results = await apiRequest<ApiScanResult[]>('/api/v1/scan-results/');
        if (!cancelled) {
          setScanResults(results);
        }
      } catch {
        if (!cancelled) {
          setScanResults([]);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const reports = useMemo<RadiologyReport[]>(() => {
    if (Platform.OS !== 'web') return [];
    try {
      const stored = window.localStorage.getItem('radiology_reports_by_patient');
      if (!stored) return [];
      const parsed = JSON.parse(stored) as Record<string, RadiologyReport[]>;
      return parsed[patientId] ?? [];
    } catch {
      return [];
    }
  }, [patientId]);

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => (b?.createdAt ?? '').localeCompare(a?.createdAt ?? '')),
    [reports],
  );

  const latestReportByOrder = useMemo(() => {
    const map = new Map<string, RadiologyReport>();
    for (const report of sortedReports) {
      if (!report.orderId) continue;
      if (!map.has(report.orderId)) {
        map.set(report.orderId, report);
      }
    }
    return map;
  }, [sortedReports]);

  const latestScanResultByScanOrder = useMemo(() => {
    const map = new Map<number, ApiScanResult>();
    const sorted = [...scanResults].sort((a, b) => {
      const aValue = a.reported_at ?? '';
      const bValue = b.reported_at ?? '';
      if (aValue === bValue) return b.id - a.id;
      return bValue.localeCompare(aValue);
    });
    for (const item of sorted) {
      if (!map.has(item.scan_order)) {
        map.set(item.scan_order, item);
      }
    }
    return map;
  }, [scanResults]);

  const backendRadiologyResults = useMemo(
    () =>
      patientOrders.flatMap((order) =>
        order.tests
          .filter((test) => test.sample === 'Imaging')
          .map((test) => {
            const scanOrderId = parseScanOrderId(test.id);
            if (scanOrderId === null) return null;
            const result = latestScanResultByScanOrder.get(scanOrderId);
            if (!result) return null;
            return {
              key: `${order.id}-${test.id}`,
              orderId: order.id,
              testName: test.name,
              reportedAt: result.reported_at,
              findings: result.finding_text,
              fileUrl: toMediaUrl(result.image_file),
            };
          })
          .filter(
            (
              item
            ): item is {
              key: string;
              orderId: string;
              testName: string;
              reportedAt: string | null;
              findings: string | null;
              fileUrl: string | null;
            } => item !== null
          ),
      ),
    [patientOrders, latestScanResultByScanOrder],
  );

  const getTestResult = (
    order: Order,
    test: Order['tests'][number],
    report?: RadiologyReport,
    scanResult?: ApiScanResult
  ) => {
    if (test.sample === 'Imaging') {
      if (order.status !== 'Completed') return 'Pending';
      const findings = scanResult?.finding_text?.trim() || report?.diagnostic?.findings?.trim();
      if (findings) return 'Report available';
      if (scanResult?.image_file) return 'File uploaded';
      return report ? 'Report saved' : 'Result pending';
    }
    if (order.status !== 'Completed') return 'Pending';
    const rows = getStoredResultRows(order.id, test.id);
    if (rows.length === 0) return 'Result pending';
    const abnormal = rows.find((row) => {
      if (row.min === undefined || row.max === undefined || !row.value) return false;
      const numeric = Number(row.value);
      if (Number.isNaN(numeric)) return false;
      return numeric < row.min || numeric > row.max;
    });
    const target = abnormal ?? rows[0];
    if (!target?.value) return 'Result pending';
    const unit = target.unit ? ` ${target.unit}` : '';
    return `${target.value}${unit}`;
  };

  const getRangeLabel = (order: Order, test: Order['tests'][number]) => {
    if (test.sample === 'Imaging') return '';
    const rows = getStoredResultRows(order.id, test.id);
    if (rows.length === 0) return 'Range: N/A';
    const abnormal = rows.find((row) => {
      if (row.min === undefined || row.max === undefined || !row.value) return false;
      const numeric = Number(row.value);
      if (Number.isNaN(numeric)) return false;
      return numeric < row.min || numeric > row.max;
    });
    const target = abnormal ?? rows[0];
    if (!target || target.min === undefined || target.max === undefined || !target.unit) return 'Range: N/A';
    return `Range: ${target.min}-${target.max} ${target.unit}`;
  };

  const isAbnormalResult = (order: Order, test: Order['tests'][number]) => {
    if (test.sample === 'Imaging') return false;
    if (order.status !== 'Completed') return false;
    const rows = getStoredResultRows(order.id, test.id);
    if (rows.length === 0) return false;
    return rows.some((row) => {
      if (row.min === undefined || row.max === undefined || !row.value) return false;
      const numeric = Number(row.value);
      if (Number.isNaN(numeric)) return false;
      return numeric < row.min || numeric > row.max;
    });
  };

  return (
    <DashboardLayout title="EMR">
      <View style={styles.layout}>
        <Card style={styles.sidebar}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{patient?.name?.charAt(0).toUpperCase() ?? 'P'}</Text>
          </View>
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{patient?.name ?? 'Unknown'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Patient ID</Text>
              <Text style={styles.infoValue}>{patient?.id ?? patientId}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age</Text>
              <Text style={styles.infoValue}>{patient?.age ?? '--'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue}>{patient?.gender ?? '--'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{patient?.phone ?? '--'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{patient?.email ?? 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{patient?.address ?? 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Visit</Text>
              <Text style={styles.infoValue}>{patient?.lastVisit ?? 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.sectionHeading}>Insurance</Text>
            <Text style={styles.summaryText}>{patient?.insuranceProvider ?? 'No insurance on file'}</Text>
            <Text style={styles.summaryText}>Policy: {patient?.insurancePolicyNumber ?? 'N/A'}</Text>
            <Text style={styles.summaryText}>Member ID: {patient?.insuranceMemberId ?? 'N/A'}</Text>
            <Text style={styles.summaryText}>Expiry: {patient?.insuranceExpiry ?? 'N/A'}</Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.sectionHeading}>Medical Summary</Text>
            <Text style={styles.summaryText}>Allergies: {patient?.medicalHistory?.allergies ?? 'None reported'}</Text>
            <Text style={styles.summaryText}>
              Chronic: {patient?.medicalHistory?.chronicConditions ?? 'None reported'}
            </Text>
            <Text style={styles.summaryText}>
              Medications: {patient?.medicalHistory?.currentMedications ?? 'None reported'}
            </Text>
            <Text style={styles.summaryText}>
              Surgeries: {patient?.medicalHistory?.previousSurgeries ?? 'None reported'}
            </Text>
          </View>
        </Card>

        <View style={styles.mainColumn}>
          <Section title="Past Tests & Results">
            {patientOrders.length === 0 ? (
              <Text style={styles.emptyText}>No visits recorded yet.</Text>
            ) : (
              patientOrders.map((order, index) => (
                <Card
                  key={order.id}
                  style={[styles.visitCard, expandedVisitId === order.id && styles.visitCardActive]}
                >
                  {(() => {
                    const report = latestReportByOrder.get(order.id);
                    const scanResultsByTestId = new Map<string, ApiScanResult>();
                    for (const test of order.tests) {
                      const scanOrderId = parseScanOrderId(test.id);
                      if (scanOrderId === null) continue;
                      const item = latestScanResultByScanOrder.get(scanOrderId);
                      if (item) {
                        scanResultsByTestId.set(test.id, item);
                      }
                    }
                    return (
                      <>
                  <Pressable
                    style={styles.expandHeader}
                    onPress={() => setExpandedVisitId(expandedVisitId === order.id ? null : order.id)}
                  >
                    <View>
                      <Text style={styles.visitTitle}>Visit #{patientOrders.length - index}</Text>
                      <Text style={styles.visitMeta}>
                        {formatDate(order.date)} - {order.tests.length} tests
                      </Text>
                    </View>
                    <View style={styles.expandRight}>
                      <StatusBadge status={statusMap[order.status]} />
                      <Text style={styles.expandLabel}>
                        {expandedVisitId === order.id ? 'Hide' : 'Details'}
                      </Text>
                    </View>
                  </Pressable>
                  <Text style={styles.visitSummary}>{order.tests.map((test) => test.name).join(', ')}</Text>
                  {expandedVisitId === order.id ? (
                    <View style={styles.expandBody}>
                      {order.tests.map((test) => (
                        (() => {
                          const scanResult = scanResultsByTestId.get(test.id);
                          const fileUrl = toMediaUrl(scanResult?.image_file);
                          return (
                        <View key={test.id} style={styles.testRow}>
                          <View>
                            <Text style={styles.testName}>{test.name}</Text>
                            <Text style={styles.testMeta}>Sample: {test.sample}</Text>
                            <Text style={styles.testMeta}>Performed By: {order.completedByTechName ?? '-'}</Text>
                            {test.sample === 'Imaging' ? (
                              <Text style={styles.testMeta}>
                                Files: {report?.scans?.scanIds?.length ? report.scans.scanIds.join(', ') : 'No files'}
                              </Text>
                            ) : null}
                            {test.sample === 'Imaging' && fileUrl ? (
                              <Text style={styles.testMeta}>Saved File: {fileUrl}</Text>
                            ) : null}
                          </View>
                          <View style={styles.testRight}>
                            <Text style={styles.testMeta}>Price: {test.price}</Text>
                            <Text style={styles.testResult}>{getTestResult(order, test, report, scanResult)}</Text>
                            {test.sample !== 'Imaging' ? <Text style={styles.testMeta}>{getRangeLabel(order, test)}</Text> : null}
                            {isAbnormalResult(order, test) ? <View style={styles.flagDot} /> : null}
                          </View>
                        </View>
                          );
                        })()
                      ))}
                    </View>
                  ) : null}
                      </>
                    );
                  })()}
                </Card>
              ))
            )}
          </Section>

          <Section title="Radiology Reports">
            {sortedReports.length > 0 ? (
              sortedReports.map((report) => (
                <Card key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>Order {report.orderId ?? '-'}</Text>
                    <Text style={styles.reportMeta}>{formatDateTime(report.createdAt)}</Text>
                  </View>
                  <View style={styles.reportGrid}>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Modality</Text>
                      <Text style={styles.reportValue}>{report?.diagnostic?.modality ?? 'â€”'}</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Body Part</Text>
                      <Text style={styles.reportValue}>{report?.diagnostic?.bodyPart ?? 'â€”'}</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Severity</Text>
                      <Text style={styles.reportValue}>{report?.diagnostic?.severity ?? 'â€”'}</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Tech</Text>
                      <Text style={styles.reportValue}>{report?.diagnostic?.techName ?? 'â€”'}</Text>
                    </View>
                  </View>
                  <View style={styles.reportBlock}>
                    <Text style={styles.reportLabel}>Findings</Text>
                    <Text style={styles.reportValue}>{report?.diagnostic?.findings ?? 'â€”'}</Text>
                  </View>
                  <View style={styles.reportBlock}>
                    <Text style={styles.reportLabel}>Notes</Text>
                    <Text style={styles.reportValue}>{report?.notes ?? '-'}</Text>
                  </View>
                  <View style={styles.reportBlock}>
                    <Text style={styles.reportLabel}>Saved Files</Text>
                    <Text style={styles.reportValue}>
                      {report?.scans?.scanIds?.length ? report.scans.scanIds.join(', ') : 'No file IDs'}
                    </Text>
                  </View>
                </Card>
              ))
            ) : backendRadiologyResults.length > 0 ? (
              backendRadiologyResults.map((item) => (
                <Card key={item.key} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>Order {item.orderId}</Text>
                    <Text style={styles.reportMeta}>{formatDateTime(item.reportedAt ?? undefined)}</Text>
                  </View>
                  <View style={styles.reportBlock}>
                    <Text style={styles.reportLabel}>Test</Text>
                    <Text style={styles.reportValue}>{item.testName}</Text>
                  </View>
                  <View style={styles.reportBlock}>
                    <Text style={styles.reportLabel}>Findings</Text>
                    <Text style={styles.reportValue}>{item.findings?.trim() || 'Report saved'}</Text>
                  </View>
                  <View style={styles.reportBlock}>
                    <Text style={styles.reportLabel}>Saved Files</Text>
                    <Text style={styles.reportValue}>{item.fileUrl ?? 'No file uploaded'}</Text>
                  </View>
                </Card>
              ))
            ) : (
              <Text style={styles.emptyText}>No radiology reports yet.</Text>
            )}
          </Section>
        </View>
      </View>
    </DashboardLayout>
  );
}

type SectionProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    alignItems: 'flex-start',
  },
  sidebar: {
    width: 310,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DFEFE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.font.heading,
    fontSize: 28,
    color: '#0B5A45',
  },
  infoList: {
    gap: theme.spacing.sm,
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  infoValue: {
    fontFamily: theme.font.heading,
    fontSize: 15,
    color: theme.colors.ink,
  },
  summaryBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 6,
    backgroundColor: '#F8FAFD',
  },
  sectionHeading: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: theme.colors.ink,
  },
  summaryText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  mainColumn: {
    flex: 1,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 20,
    color: theme.colors.ink,
  },
  sectionSubtitle: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  sectionBody: {
    gap: theme.spacing.sm,
  },
  emptyText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  visitCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  visitCardActive: {
    borderColor: '#A5B4FC',
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  expandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  expandLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  visitTitle: {
    fontFamily: theme.font.heading,
    fontSize: 15,
    color: theme.colors.ink,
  },
  visitMeta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  visitSummary: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  expandBody: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    backgroundColor: '#FAFCFF',
  },
  testName: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: theme.colors.ink,
  },
  testMeta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  testRight: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 150,
  },
  testResult: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: theme.colors.ink,
  },
  flagDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#D92D20',
    marginTop: 2,
  },
  reportCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  reportTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  reportMeta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  reportRow: {
    width: '48%',
    gap: 2,
  },
  reportLabel: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  reportValue: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  reportBlock: {
    gap: 2,
  },
});






