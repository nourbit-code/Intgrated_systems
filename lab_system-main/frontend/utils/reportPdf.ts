import type { Order } from '@/hooks/useOrders';

const SAMPLES_KEY = 'lab_samples_by_order';
const TESTS_BY_SAMPLE_KEY = 'lab_tests_by_sample';
const RESULTS_BY_SAMPLE_KEY = 'lab_results_by_sample';
const RESULTS_META_KEY = 'lab_results_meta_by_order';

type ResultRow = {
  parameter: string;
  unit: string;
  min: number;
  max: number;
  criticalLow?: number;
  criticalHigh?: number;
  value: string;
};

type StoredSample = {
  id: string;
  specimenType?: string;
  tubeColor?: string;
  volume?: string;
};

type StoredPatient = {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
};

type StoredResultMeta = {
  signedBy?: string;
  savedAt?: string;
};

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

function getPatientRecord(patientId: string) {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.localStorage.getItem('clinic_patients');
    if (!stored) return undefined;
    const parsed = JSON.parse(stored) as StoredPatient[];
    return parsed.find((patient) => patient.id === patientId);
  } catch {
    return undefined;
  }
}

function getSamplesByOrder(orderId: string) {
  if (typeof window === 'undefined') return [] as StoredSample[];
  try {
    const stored = window.localStorage.getItem(SAMPLES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Record<string, StoredSample[]>;
    return parsed[orderId] ?? [];
  } catch {
    return [];
  }
}

function getResultMetaLookupKeys(order: Order) {
  const keys: string[] = [];
  if (order.id && order.patientId && order.date) {
    keys.push(`${order.id}::${order.patientId}::${order.date}`);
  }
  keys.push(order.id);
  return Array.from(new Set(keys));
}

function getStoredResultMeta(order: Order) {
  if (typeof window === 'undefined') return undefined as StoredResultMeta | undefined;
  try {
    const stored = window.localStorage.getItem(RESULTS_META_KEY);
    if (!stored) return undefined;
    const parsed = JSON.parse(stored) as Record<string, StoredResultMeta>;
    const keys = getResultMetaLookupKeys(order);
    for (const key of keys) {
      const meta = parsed[key];
      if (meta) return meta;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function sampleLabel(sample?: StoredSample) {
  if (!sample) return '-';
  const specimen = sample.specimenType ?? '-';
  const tube = sample.tubeColor ?? '-';
  const volume = sample.volume ? `${sample.volume} ml` : '-';
  return `${specimen} - ${tube} - ${volume}`;
}

function getFlag(row: ResultRow) {
  const parsed = Number(row.value);
  if (!Number.isFinite(parsed)) return '-';
  const hasRange = Number.isFinite(row.min) && Number.isFinite(row.max) && (row.min !== 0 || row.max !== 0);
  if (!hasRange) return '-';
  if (Number.isFinite(row.criticalLow) && parsed <= Number(row.criticalLow)) return 'Critical';
  if (Number.isFinite(row.criticalHigh) && parsed >= Number(row.criticalHigh)) return 'Critical';
  if (parsed < row.min) return 'Low';
  if (parsed > row.max) return 'High';
  return 'Normal';
}

function buildReportHtml(order: Order, getTestResult: (order: Order, test: Order['tests'][number]) => string) {
  const patient = getPatientRecord(order.patientId);
  const samples = getSamplesByOrder(order.id);
  const firstSample = samples[0];
  const resultMeta = getStoredResultMeta(order);
  const completedBy =
    order.completedByTechName?.trim()
      ? (
          order.completedByTechUserId?.trim()
            ? `${order.completedByTechName} (Lab Technician - ${order.completedByTechUserId})`
            : order.completedByTechName
        )
      : '';
  const verifiedBy = completedBy || resultMeta?.signedBy?.trim() || 'Unknown User';

  const testsHtml = order.tests
    .map((test) => {
      const storedRows = getStoredResultRows(order.id, test.id);
      const hasStored = storedRows.some((row) => row.value && row.value.trim() !== '');
      const rows = hasStored
        ? storedRows
        : [
            {
              parameter: test.name,
              value: getTestResult(order, test),
              unit: test.unit ?? '-',
              min: test.min ?? 0,
              max: test.max ?? 0,
            } as ResultRow,
          ];

      const body = rows
        .map((row) => {
          const range =
            Number.isFinite(row.min) && Number.isFinite(row.max) && (row.min !== 0 || row.max !== 0)
              ? `${row.min}-${row.max}`
              : '-';
          const flag = getFlag(row);
          return `
            <tr>
              <td>${row.parameter}</td>
              <td>${row.value || '-'}</td>
              <td>${row.unit || '-'}</td>
              <td>${range}</td>
              <td>${flag}</td>
            </tr>
          `;
        })
        .join('');

      return `
        <h3>${test.name}</h3>
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Result</th>
              <th>Unit</th>
              <th>Range</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            ${body}
          </tbody>
        </table>
      `;
    })
    .join('');

  return `
    <html>
      <head>
        <title>Lab Report - ${order.id}</title>
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
          <div class="meta-item">Patient: ${patient?.name ?? order.patientName}</div>
          <div class="meta-item">Age: ${patient?.age ?? '-'}</div>
          <div class="meta-item">Gender: ${patient?.gender ?? '-'}</div>
          <div class="meta-item">Number: ${patient?.phone ?? order.patientId ?? '-'}</div>
          <div class="meta-item">Order: ${order.id}</div>
          <div class="meta-item">Sample: ${firstSample?.id ?? '-'}</div>
          <div class="meta-item">Specimen: ${sampleLabel(firstSample)}</div>
        </div>
        ${testsHtml}
        <div class="meta-item" style="margin-top: 12px; font-weight: 700;">Verified By: ${verifiedBy}</div>
      </body>
    </html>
  `;
}

export function openReportPreview(order: Order, getTestResult: (order: Order, test: Order['tests'][number]) => string) {
  if (typeof window === 'undefined') return;
  const html = buildReportHtml(order, getTestResult);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

export function printReportPdf(order: Order, getTestResult: (order: Order, test: Order['tests'][number]) => string) {
  if (typeof window === 'undefined') return;
  const html = buildReportHtml(order, getTestResult);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function downloadReportPdf(order: Order, getTestResult: (order: Order, test: Order['tests'][number]) => string) {
  printReportPdf(order, getTestResult);
}

