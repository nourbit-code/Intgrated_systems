import { ReactNode, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as dicomParser from 'dicom-parser';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { buildUserSignature, useAuth } from '@/hooks/useAuth';
import { usePatients } from '@/hooks/usePatients';
import { Order, useOrders } from '@/hooks/useOrders';
import { API_BASE_URL, apiRequest } from '@/utils/api';
import { downloadReportPdf, openReportPreview } from '@/utils/reportPdf';

const accent = theme.colors.accent;
const accentSoft = theme.colors.accentSoft;
const accentDeep = '#0B5A45';

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
  scans?: {
    images?: Array<{ uri?: string }>;
    dicoms?: Array<{ previewUri?: string | null; sourceUri?: string | null }>;
  };
};

type ApiScanResult = {
  id: number;
  scan_order: number;
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

function getStoredPrimaryRow(orderId: string, testId: string) {
  const rows = getStoredResultRows(orderId, testId);
  if (rows.length === 0) return undefined;
  return rows[0];
}

function isImagingTest(test: Order['tests'][number]) {
  const sample = String(test.sample ?? '').trim().toLowerCase();
  const id = String(test.id ?? '').trim().toLowerCase();
  const name = String(test.name ?? '').trim().toLowerCase();
  return (
    sample.includes('imaging') ||
    sample.includes('scan') ||
    sample.includes('radiology') ||
    id.startsWith('scan-') ||
    name.includes('scan') ||
    name.includes('x-ray') ||
    name.includes('xray') ||
    name.includes('mri') ||
    name.includes('ct')
  );
}

function isImagingOrder(order: Order) {
  return order.tests.some((test) => isImagingTest(test));
}

function parseScanOrderId(testId: string) {
  const match = /^scan-(\d+)$/i.exec(testId);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || /^data:/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function isPreviewableImageUri(uri: string) {
  const normalized = uri.trim().toLowerCase();
  if (normalized.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(normalized);
}

function isDicomUri(uri: string) {
  const normalized = uri.trim().toLowerCase();
  return (
    normalized.startsWith('data:application/dicom') ||
    normalized.startsWith('data:application/octet-stream') ||
    /\.dcm(\?|#|$)/i.test(normalized) ||
    /\.dicom(\?|#|$)/i.test(normalized)
  );
}

async function renderDicomToPreviewUri(uri: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));
    const rows = dataSet.uint16('x00280010') ?? 0;
    const cols = dataSet.uint16('x00280011') ?? 0;
    const pixelElement = dataSet.elements.x7fe00010;
    if (!pixelElement || !rows || !cols) return null;
    const bitsAllocated = dataSet.uint16('x00280100') ?? 16;
    const slope = parseFloat(dataSet.string('x00281053') ?? '1');
    const intercept = parseFloat(dataSet.string('x00281052') ?? '0');
    const wc = parseFloat(dataSet.string('x00281050') ?? '40');
    const ww = parseFloat(dataSet.string('x00281051') ?? '120');
    const pixelBuffer = dataSet.byteArray.buffer.slice(
      pixelElement.dataOffset,
      pixelElement.dataOffset + pixelElement.length,
    );
    const pixels = bitsAllocated === 16 ? new Uint16Array(pixelBuffer) : new Uint8Array(pixelBuffer);
    const min = wc - ww / 2;
    const max = wc + ww / 2;
    const range = Math.max(max - min, 1);

    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imgData = ctx.createImageData(cols, rows);
    const total = rows * cols;
    for (let i = 0; i < total; i += 1) {
      const raw = Number(pixels[i] ?? 0) * slope + intercept;
      const clamped = Math.min(max, Math.max(min, raw));
      const value = Math.round(((clamped - min) / range) * 255);
      const idx = i * 4;
      imgData.data[idx] = value;
      imgData.data[idx + 1] = value;
      imgData.data[idx + 2] = value;
      imgData.data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}


const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function PatientHistory() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { role, currentUser } = useAuth();
  const { patients, updatePatient } = usePatients();
  const { orders } = useOrders();
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [scanPreviewUri, setScanPreviewUri] = useState<string | null>(null);

  const patientId = Array.isArray(params.id) ? params.id[0] : params.id ?? 'unknown';
  const patient = patients.find((item) => item.id === patientId);

  const patientOrders = useMemo(() => {
    return orders
      .filter((order) => order.patientId === patientId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, patientId]);

  const completedOrders = useMemo(
    () => patientOrders.filter((order) => order.status === 'Completed'),
    [patientOrders],
  );

  const latestReadyReport = completedOrders[0];
  const pastReports = completedOrders.slice(1);
  const activeOrders = patientOrders.filter(
    (order) => order.status !== 'Completed' && order.status !== 'Cancelled',
  );

  const latestVisit = patientOrders[0];

  const getResultLabel = (order: Order) => {
    if (order.status === 'Completed') return 'Result ready';
    if (order.status === 'Cancelled') return 'Cancelled';
    return 'Pending';
  };

  const getTestResult = (order: Order, test: Order['tests'][number]) => {
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
    if (isImagingTest(test)) return '';
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

  const openReport = (order: Order) => {
    if (role === 'lab-tech') {
      router.push(`/lab-tech/results-multi/${order.id}`);
      return;
    }
    router.push('/receptionist/reports');
  };

  const downloadReport = (order: Order) => {
    downloadReportPdf(order, getTestResult);
  };

  const printResult = (order: Order) => {
    downloadReportPdf(order, getTestResult);
  };

  const viewScan = async (order: Order) => {
    if (typeof window !== 'undefined') {
      const openUri = async (uri: string) => {
        if (isDicomUri(uri)) {
          const preview = await renderDicomToPreviewUri(uri);
          if (preview) {
            setScanPreviewUri(preview);
            return true;
          }
          return false;
        }
        if (isPreviewableImageUri(uri)) {
          setScanPreviewUri(uri);
          return true;
        }
        window.open(uri, '_blank', 'noopener,noreferrer');
        return true;
      };

      try {
        const orderStored = window.localStorage.getItem('radiology_reports_by_order');
        const patientStored = window.localStorage.getItem('radiology_reports_by_patient');
        const orderReports = orderStored
          ? (JSON.parse(orderStored) as Record<string, RadiologyReport[]>)[order.id] ?? []
          : [];
        const patientReports = patientStored
          ? (JSON.parse(patientStored) as Record<string, RadiologyReport[]>)[patientId] ?? []
          : [];
        const localReports = [...orderReports, ...patientReports.filter((report) => report.orderId === order.id)];
        const localUris = localReports.flatMap((report) => [
          ...(report.scans?.dicoms?.map((item) => item.sourceUri ?? item.previewUri ?? null).filter(Boolean) as string[]),
          ...(report.scans?.images?.map((item) => item.uri).filter(Boolean) as string[]),
        ]);
        for (const uri of localUris) {
          const opened = await openUri(uri);
          if (opened) return;
        }
      } catch {
        // ignore and continue to backend lookup
      }

      try {
        const scanOrderIds = order.tests
          .map((test) => parseScanOrderId(test.id))
          .filter((value): value is number => value !== null);
        if (scanOrderIds.length > 0) {
          const responses = await Promise.all(
            scanOrderIds.map((scanOrderId) => apiRequest<ApiScanResult[]>(`/api/v1/scan-results/?scan_order=${scanOrderId}`)),
          );
          const backendUris = responses
            .flat()
            .sort((a, b) => (b.reported_at ?? '').localeCompare(a.reported_at ?? ''))
            .map((item) => toMediaUrl(item.image_file))
            .filter((uri): uri is string => !!uri);
          for (const uri of backendUris) {
            const opened = await openUri(uri);
            if (opened) return;
          }
        }
      } catch {
        // ignore and show feedback below
      }
    }

    Alert.alert('No scan file found', 'No uploaded scan is saved for this patient order yet.');
  };

  const viewReport = (order: Order) => {
    openReportPreview(order, getTestResult);
  };

  const printInvoice = (order: Order) => {
    if (typeof window === 'undefined') return;
    const preparedBy = order.bookedBySignature || buildUserSignature(currentUser);
    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice ${order.invoiceId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0F172A; }
            h1 { font-size: 18px; margin: 0; }
            .muted { color: #64748B; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #E2E8F0; font-size: 12px; }
            .summary { margin-top: 16px; }
            .summary-row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Invoice ${order.invoiceId}</h1>
          <div class="muted">Order #${order.id}</div>
          <div class="muted">Date: ${order.date}</div>
          <div class="muted">Patient: ${order.patientName}</div>
          <div class="muted">Prepared By: ${preparedBy}</div>

          <table>
            <thead>
              <tr><th>Test</th><th>Sample</th><th>Price</th></tr>
            </thead>
            <tbody>
              ${order.tests.map((test) => `
                <tr>
                  <td>${test.name}</td>
                  <td>${test.sample}</td>
                  <td>${test.price} EGP</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row"><span>Subtotal</span><span>${order.subtotal} EGP</span></div>
            <div class="summary-row"><span>Discount (${order.discountPercent ?? 0}%)</span><span>${order.discount} EGP</span></div>
            <div class="summary-row total"><span>Total</span><span>${order.total} EGP</span></div>
            <div class="summary-row"><span>Payment Method</span><span>${order.paymentMethod}</span></div>
            <div class="summary-row"><span>Prepared By</span><span>${preparedBy}</span></div>
          </div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(invoiceHtml);
    win.document.close();
    win.focus();
    win.print();
  };

  const headerAction = (
    <View style={styles.headerActions}>
      {role === 'lab-tech' ? (
        <PrimaryButton label="New Visit" onPress={() => router.push('/lab-tech/results-dashboard')} />
      ) : null}
      <PrimaryButton
        label="New Order"
        onPress={() =>
          router.push({
            pathname: '/receptionist/create-order',
            params: { patientId },
          })
        }
      />
      <PrimaryButton label="Return to Patients History" onPress={() => router.push('/patients')} />
    </View>
  );

  return (
    <DashboardLayout title="Patient Visit History" headerAction={headerAction}>
      <View style={styles.layout}>
        <Card style={styles.sidebar}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{patient?.name?.charAt(0).toUpperCase() ?? 'P'}</Text>
          </View>
          <Pressable
            style={styles.editButton}
            onPress={() => {
              setEditPhone(patient?.phone ?? '');
              setEditEmail(patient?.email ?? '');
              setEditAddress(patient?.address ?? '');
              setIsEditing(true);
            }}
          >
            <Text style={styles.editButtonText}>Edit Info</Text>
          </Pressable>
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{patient?.name ?? 'Unknown'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Patient ID</Text>
              <Text style={styles.infoValue}>{patient?.externalId ?? patient?.id ?? patientId}</Text>
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
              <Text style={styles.infoValue}>{formatDate(latestVisit?.date)}</Text>
            </View>
          </View>

          {role === 'receptionist' ? (
            <View style={styles.summaryBox}>
              <Text style={styles.sectionHeading}>Insurance</Text>
              <Text style={styles.summaryText}>{patient?.insuranceProvider ?? 'No insurance on file'}</Text>
              <Text style={styles.summaryText}>Policy: {patient?.insurancePolicyNumber ?? 'N/A'}</Text>
              <Text style={styles.summaryText}>Member ID: {patient?.insuranceMemberId ?? 'N/A'}</Text>
              <Text style={styles.summaryText}>Expiry: {patient?.insuranceExpiry ?? 'N/A'}</Text>
            </View>
          ) : null}

          {role === 'lab-tech' && patient?.medicalHistory ? (
            <View style={styles.summaryBox}>
              <Text style={styles.sectionHeading}>Medical Summary</Text>
              <Text style={styles.summaryText}>Allergies: {patient.medicalHistory.allergies}</Text>
              <Text style={styles.summaryText}>Chronic: {patient.medicalHistory.chronicConditions}</Text>
              <Text style={styles.summaryText}>Medications: {patient.medicalHistory.currentMedications}</Text>
              <Text style={styles.summaryText}>Surgeries: {patient.medicalHistory.previousSurgeries}</Text>
            </View>
          ) : null}
        </Card>

        <View style={styles.mainColumn}>
          <Section title="Visit History">
            {patientOrders.length === 0 ? (
              <Text style={styles.emptyText}>No visits recorded yet.</Text>
            ) : (
              patientOrders.map((order, index) => (
                <Card
                  key={order.id}
                  style={[styles.visitCard, expandedVisitId === order.id && styles.visitCardActive]}
                >
                  <Pressable
                    style={styles.expandHeader}
                    onPress={() => setExpandedVisitId(expandedVisitId === order.id ? null : order.id)}
                  >
                    <View>
                      <Text style={styles.visitTitle}>Visit #{patientOrders.length - index}</Text>
                      <Text style={styles.visitMeta}>{formatDate(order.date)} - {order.tests.length} tests</Text>
                    </View>
                    <View style={styles.expandRight}>
                      <StatusBadge status={statusMap[order.status]} />
                      <Text style={styles.expandLabel}>{expandedVisitId === order.id ? 'Hide' : 'Details'}</Text>
                    </View>
                  </Pressable>
                  <Text style={styles.visitSummary}>{order.tests.map((test) => test.name).join(', ')}</Text>
                  {expandedVisitId === order.id ? (
                    <View style={styles.expandBody}>
                      {order.tests.map((test) => {
                        const rangeLabel = getRangeLabel(order, test);
                        return (
                          <View key={test.id} style={styles.testRow}>
                            <View>
                              <Text style={styles.testName}>{test.name}</Text>
                              <Text style={styles.testMeta}>Sample: {test.sample}</Text>
                            </View>
                            <View style={styles.testRight}>
                              <Text style={styles.testMeta}>Price: {test.price}</Text>
                              <Text style={styles.testResult}>{getTestResult(order, test)}</Text>
                              {rangeLabel ? <Text style={styles.testMeta}>{rangeLabel}</Text> : null}
                              {isAbnormalResult(order, test) ? <View style={styles.flagDot} /> : null}
                            </View>
                          </View>
                        );
                      })}
                      {role === 'receptionist' ? (
                        <View style={styles.invoiceActions}>
                          <Pressable
                            style={styles.outlineAction}
                            onPress={() => router.push({ pathname: '/receptionist/billing', params: { invoiceId: order.invoiceId } })}
                          >
                            <Text style={styles.outlineActionText}>View Invoice</Text>
                          </Pressable>
                          {isImagingOrder(order) ? (
                            <Pressable style={styles.solidAction} onPress={() => void viewScan(order)}>
                              <Text style={styles.solidActionText}>View Scan</Text>
                            </Pressable>
                          ) : (
                            <Pressable style={styles.solidAction} onPress={() => printResult(order)}>
                              <Text style={styles.solidActionText}>Print Result</Text>
                            </Pressable>
                          )}
                          <Pressable style={styles.solidAction} onPress={() => printInvoice(order)}>
                            <Text style={styles.solidActionText}>Print Invoice</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </Section>

          {role === 'lab-tech' ? (
            <Section title="Lab Orders" subtitle="Active samples and diagnostics">
              {activeOrders.length === 0 ? (
                <Text style={styles.emptyText}>No active lab orders right now.</Text>
              ) : (
                activeOrders.map((order) => (
                  <Card key={order.id} style={styles.orderCard}>
                    <View style={styles.visitHeader}>
                      <Text style={styles.visitTitle}>{order.invoiceId}</Text>
                      <StatusBadge status={statusMap[order.status]} />
                    </View>
                    <Text style={styles.visitMeta}>{formatDate(order.date)}</Text>
                    <Text style={styles.visitSummary}>{order.tests.map((test) => test.name).join(', ')}</Text>
                  </Card>
                ))
              )}
            </Section>
          ) : null}

          <Section title="Ready Reports">
            {!latestReadyReport ? (
              <Text style={styles.emptyText}>No ready reports yet.</Text>
            ) : (
              <Card style={styles.reportCard}>
                <View style={styles.reportRow}>
                  <View>
                    <Text style={styles.reportTitle}>
                      {latestReadyReport.tests.map((test) => test.name).join(', ')}
                    </Text>
                    <Text style={styles.reportMeta}>
                      {formatDate(latestReadyReport.date)} - {latestReadyReport.invoiceId}
                    </Text>
                    <Text style={styles.reportMeta}>Latest result: {getResultLabel(latestReadyReport)}</Text>
                  </View>
                  <View />
                </View>
                <View style={styles.reportActions}>
                  <Pressable
                    style={styles.reportButton}
                    onPress={() =>
                      isImagingOrder(latestReadyReport)
                        ? void viewScan(latestReadyReport)
                        : viewReport(latestReadyReport)
                    }
                  >
                    <Text style={styles.reportButtonText}>View</Text>
                  </Pressable>
                  <Pressable style={styles.solidAction} onPress={() => downloadReport(latestReadyReport)}>
                    <Text style={styles.solidActionText}>Download</Text>
                  </Pressable>
                </View>
              </Card>
            )}
          </Section>

          {role === 'lab-tech' ? (
            <Section title="Past Reports" subtitle="Historical diagnostics">
              {pastReports.length === 0 ? (
                <Text style={styles.emptyText}>No past reports yet.</Text>
              ) : (
                pastReports.map((order) => (
                  <Card key={order.id} style={styles.reportCard}>
                    <View style={styles.reportRow}>
                      <View>
                        <Text style={styles.reportTitle}>{order.tests.map((test) => test.name).join(', ')}</Text>
                        <Text style={styles.reportMeta}>{formatDate(order.date)} - {order.invoiceId}</Text>
                      </View>
                      <View style={styles.reportActionsInline}>
                        <Pressable
                          style={styles.reportButtonOutline}
                          onPress={() => (isImagingOrder(order) ? void viewScan(order) : viewReport(order))}
                        >
                          <Text style={styles.reportButtonOutlineText}>View</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </Section>
          ) : null}

        </View>
      </View>

      <Modal visible={!!scanPreviewUri} transparent animationType="fade" onRequestClose={() => setScanPreviewUri(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setScanPreviewUri(null)}>
          <Pressable style={styles.scanPreviewCard} onPress={() => null}>
            <View style={styles.scanPreviewHeader}>
              <Text style={styles.modalTitle}>Scan Preview</Text>
              <Pressable style={styles.scanPreviewClose} onPress={() => setScanPreviewUri(null)}>
                <Text style={styles.scanPreviewCloseText}>Close</Text>
              </Pressable>
            </View>
            {scanPreviewUri ? (
              <Image source={{ uri: scanPreviewUri }} style={styles.scanPreviewImage} resizeMode="contain" />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isEditing} transparent animationType="fade" onRequestClose={() => setIsEditing(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsEditing(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Edit Patient Info</Text>
            <TextInputField
              label="Phone Number"
              placeholder="Enter phone number"
              value={editPhone}
              onChangeText={setEditPhone}
            />
            <TextInputField
              label="Email"
              placeholder="Enter email address"
              value={editEmail}
              onChangeText={setEditEmail}
            />
            <TextInputField
              label="Address"
              placeholder="Enter address"
              value={editAddress}
              onChangeText={setEditAddress}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setIsEditing(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <PrimaryButton
                label="Save"
                onPress={() => {
                  if (patient?.id) {
                    updatePatient(patient.id, {
                      phone: editPhone.trim() || patient.phone,
                      email: editEmail.trim() || undefined,
                      address: editAddress.trim() || undefined,
                    });
                  }
                  setIsEditing(false);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerGhost: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: accent,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  headerGhostText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: accent,
  },
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
  },
  sidebar: {
    width: 320,
    alignSelf: 'flex-start',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: accentSoft,
    borderWidth: 2,
    borderColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  avatarText: {
    fontFamily: theme.font.heading,
    fontSize: 30,
    color: accent,
  },
  editButton: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: accent,
    paddingVertical: 10,
    alignItems: 'center',
  },
  editButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: accent,
  },
  infoList: {
    gap: theme.spacing.sm,
  },
  infoRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  infoLabel: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: accent,
  },
  infoValue: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
    textAlign: 'right',
    flex: 1,
  },
  summaryBox: {
    backgroundColor: accentSoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 6,
  },
  sectionHeading: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: accentDeep,
  },
  summaryText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: accentDeep,
  },
  mainColumn: {
    flex: 1,
    minWidth: 320,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  sectionSubtitle: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  sectionBody: {
    gap: theme.spacing.sm,
  },
  visitCard: {
    padding: theme.spacing.md,
  },
  visitCardActive: {
    backgroundColor: accentSoft,
    borderColor: '#BFE6D7',
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visitTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
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
    marginTop: 6,
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  expandRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expandLabel: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: accent,
  },
  expandBody: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  testRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
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
    marginTop: 2,
  },
  testRight: {
    alignItems: 'flex-end',
  },
  testResult: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: accentDeep,
    marginTop: 2,
  },
  flagDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  orderCard: {
    padding: theme.spacing.md,
  },
  reportCard: {
    padding: theme.spacing.md,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  reportActionsInline: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  reportResults: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 8,
  },
  reportActions: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
  },
  reportResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  reportResultName: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  reportResultValue: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: theme.colors.ink,
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
    marginTop: 4,
  },
  reportButton: {
    backgroundColor: accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
  },
  reportButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  reportButtonOutline: {
    borderWidth: 1,
    borderColor: accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
  },
  reportButtonOutlineText: {
    fontFamily: theme.font.heading,
    fontSize: 11,
    color: accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  invoiceActions: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
  },
  solidAction: {
    backgroundColor: accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
  },
  solidActionText: {
    fontFamily: theme.font.heading,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  outlineAction: {
    borderWidth: 1,
    borderColor: accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
  },
  outlineActionText: {
    fontFamily: theme.font.heading,
    fontSize: 11,
    color: accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 760,
    maxHeight: '88%',
  },
  scanPreviewCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 980,
    height: '88%',
  },
  scanPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  scanPreviewClose: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  scanPreviewCloseText: {
    fontFamily: theme.font.heading,
    fontSize: 11,
    color: theme.colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scanPreviewImage: {
    flex: 1,
    width: '100%',
    backgroundColor: '#EEF2F7',
    borderRadius: theme.radius.md,
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  emptyText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
});
