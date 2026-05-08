import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  createPrescription,
  createPatient,
  createInvoice,
  createClinicRequest,
  deleteInventory,
  deletePatient,
  finalizePrescriptionPreparation,
  getAlerts,
  getClinicRequests,
  getInventory,
  getInvoices,
  getPatients,
  getPharmacyOrders,
  getPrescriptionPreparation,
  getPrescriptions,
  updateClinicRequest,
  updateInventory,
  updateInvoice,
  updatePharmacyOrder,
  updatePrescription,
} from '../api/pharmacy';
import { ActionCard } from '../components/ActionCard';
import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { InputField } from '../components/InputField';
import { SecondaryButton } from '../components/Buttons';
import { Notice } from '../components/Notice';
import { SegmentedControl } from '../components/SegmentedControl';
import { Section } from '../components/Section';
import { StatCard } from '../components/StatCard';
import { StatusPill } from '../components/StatusPill';
import { theme } from '../theme';

const emptyArray = [];
const statusFlow = ['New', 'Preparing', 'Ready', 'Dispensed'];
const DASHBOARD_CACHE_KEY = 'pharmacy_dashboard_cache_v1';

type Metrics = {
  inbox: number;
  prep: number;
  prescriptions: number;
  patients: number;
  inventory: number;
  lowStock: number;
  cart: number;
  invoices: number;
};

type PharmacyDashboardProps = {
  activeSection?: string;
  onMetrics?: (data: Metrics) => void;
  onSectionChange?: (section: string) => void;
  onScrollTo?: (y: number) => void;
};

type StatTone = 'default' | 'info' | 'warning' | 'alert';

type InventoryItem = {
  id: string;
  name: string;
  category?: string;
  stock: number;
  expiry: string;
  batch: string;
  barcode: string;
  supplier: string;
  price: number;
  threshold: number;
  controlled: boolean;
};

type InvoiceItem = {
  id: string;
  patient: string;
  amount: string | number;
  status: string;
  date: string;
  orderId?: string;
};

type NotificationItem = {
  id: string;
  time: string;
  message: string;
  status: string;
  type?: string;
  related?: string;
  page?: string;
};

type PreparationItem = {
  source_name?: string;
  medicine_name: string;
  dosage?: string;
  quantity: number;
  available_quantity: number;
  unit_price: number;
  line_total: number;
  in_stock: boolean;
  notes?: string;
  sort_order: number;
  inventory_sku?: string;
  inventory_name?: string;
};

type PreparationState = {
  prescription_id: string;
  patient_name: string;
  doctor_name: string;
  order_id: string;
  order_status: string;
  prepared_notes: string;
  items: PreparationItem[];
  summary: {
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total_amount: number;
    missing_items_count: number;
    prepared_items_count?: number;
    requested_items_count?: number;
    requested_subtotal?: number;
    missing_subtotal?: number;
    requested_total_amount?: number;
  };
  invoice?: {
    id?: string;
    status?: string;
    amount?: number;
  };
};

type PreparationDraft = {
  notes: string;
  items: PreparationItem[];
  updated_at: number;
};

function parseMedicineEntries(value: string) {
  return String(value || '')
    .split(/(?:[\n,;]+|\s+[+/&|]\s+|\s+\/\s+)/)
    .map((entry) => entry.replace(/^\s*\d+[\).\-\s]+/, '').trim())
    .filter(Boolean);
}

function normalizePrescriptionTextFields(rawDoctor: unknown, rawMeds: unknown) {
  let doctor = String(rawDoctor || '').trim();
  let meds = String(rawMeds || '').trim();
  const normalizeSpace = (value: string) => value.replace(/\s+/g, ' ').trim();
  const wordsCount = (value: string) => normalizeSpace(value).split(' ').filter(Boolean).length;
  const looksLikeName = (value: string) => {
    const cleaned = normalizeSpace(value);
    if (!cleaned) return false;
    if (/\d/.test(cleaned)) return false;
    const count = wordsCount(cleaned);
    return count >= 2 && count <= 5;
  };
  const appendMeds = (value: string) => {
    const next = String(value || '').trim();
    if (!next) return;
    meds = meds ? `${meds}, ${next}` : next;
  };

  // Exact case: doctor and meds in one multi-line field
  if (!doctor && meds.includes('\n')) {
    const lines = meds
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length >= 2) {
      const first = lines[0];
      const rest = lines.slice(1).join(', ');
      if (/^dr\.?/i.test(first) || looksLikeName(first)) {
        doctor = first;
        meds = rest;
      }
    }
  }

  // If medication starts with doctor marker, split it out.
  const leadingDoctorMatch = meds.match(/^(dr\.?\s+[a-z][a-z\s.'-]*?)\s*(?:[-|:;,/]|\r?\n)\s*(.+)$/i);
  if (leadingDoctorMatch) {
    if (!doctor) doctor = leadingDoctorMatch[1].trim();
    meds = leadingDoctorMatch[2].trim();
  }

  // Generic split: "Name - Drug list" (without Dr. prefix)
  if (!doctor) {
    const genericLeading = meds.match(/^([^,;:|/()-]{3,60})\s*[-|:]\s*(.+)$/);
    if (genericLeading) {
      const candidateDoctor = normalizeSpace(genericLeading[1]);
      if (looksLikeName(candidateDoctor)) {
        doctor = candidateDoctor;
        meds = genericLeading[2].trim();
      }
    }
  }

  // If medication contains a trailing doctor marker, extract it.
  const trailingDoctorMatch = meds.match(/(?:^|[-|/,;]\s*)(dr\.?\s+[a-z][a-z\s.'-]*)$/i);
  if (trailingDoctorMatch && trailingDoctorMatch.index !== undefined) {
    if (!doctor) {
      doctor = trailingDoctorMatch[1].trim();
    }
    meds = meds.slice(0, trailingDoctorMatch.index).replace(/[-|/,;:\s]+$/, '').trim();
  }

  // Generic split: "Drug list - Name" (without Dr. prefix)
  if (!doctor) {
    const genericTrailing = meds.match(/^(.+?)\s*[-|:]\s*([^,;:|/()-]{3,60})$/);
    if (genericTrailing) {
      const candidateDoctor = normalizeSpace(genericTrailing[2]);
      if (looksLikeName(candidateDoctor)) {
        doctor = candidateDoctor;
        meds = genericTrailing[1].trim();
      }
    }
  }

  // If doctor contains appended medication text, split it out.
  const doctorWithMedsMatch = doctor.match(/^(dr\.?\s+[a-z][a-z\s.'-]*?)\s*(?:[-|:;,/]|\r?\n)\s*(.+)$/i);
  if (doctorWithMedsMatch) {
    doctor = doctorWithMedsMatch[1].trim();
    appendMeds(doctorWithMedsMatch[2]);
  } else if (/^dr\.?/i.test(doctor) && doctor.includes(',')) {
    const [doctorPart, ...possibleMeds] = doctor.split(',');
    doctor = doctorPart.trim();
    appendMeds(possibleMeds.join(','));
  }

  if (doctor && meds) {
    const escapedDoctor = doctor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    meds = meds.replace(new RegExp(`\\s*[-|/,;:]?\\s*${escapedDoctor}\\s*`, 'ig'), ' ').replace(/\s{2,}/g, ' ').trim();
  }

  const doctorKey = normalizeMedicineKey(doctor);
  const normalizedMedsList = Array.from(
    new Set(
      parseMedicineEntries(meds).filter((entry) => normalizeMedicineKey(entry) !== doctorKey)
    )
  );
  const normalizedMeds = normalizedMedsList.join(', ');

  return {
    doctor: doctor || 'Clinic Doctor',
    meds: normalizedMeds || meds || 'Pending',
  };
}

function summarizePreparedMedicines(items: any[]) {
  if (!Array.isArray(items) || !items.length) return '';
  return items
    .map((item) => String(item?.medicine_name || item?.inventory_name || item?.source_name || '').trim())
    .filter(Boolean)
    .join(', ');
}

function normalizePreparationItem(entry: any, fallbackIndex = 0): PreparationItem {
  return {
    source_name: String(entry?.source_name || entry?.medicine_name || ''),
    medicine_name: String(entry?.medicine_name || entry?.source_name || ''),
    dosage: String(entry?.dosage || ''),
    quantity: Math.max(1, Number(entry?.quantity ?? 1)),
    available_quantity: Math.max(0, Number(entry?.available_quantity ?? 0)),
    unit_price: Number(entry?.unit_price ?? 0),
    line_total: Number(entry?.line_total ?? 0),
    in_stock: Boolean(entry?.in_stock),
    notes: String(entry?.notes || ''),
    sort_order: Number(entry?.sort_order ?? fallbackIndex),
    inventory_sku: String(entry?.inventory_sku || ''),
    inventory_name: String(entry?.inventory_name || ''),
  };
}

function normalizePreparation(entry: any): PreparationState | null {
  if (!entry || typeof entry !== 'object') return null;
  const items = Array.isArray(entry.items) ? entry.items.map((item, index) => normalizePreparationItem(item, index)) : [];
  const summary = entry.summary || {};
  const liveSummary = calculatePreparationSummary(items, Number(summary.tax_rate ?? 14));
  return {
    prescription_id: String(entry.prescription_id || ''),
    patient_name: String(entry.patient_name || 'Unknown'),
    doctor_name: String(entry.doctor_name || 'Clinic Doctor'),
    order_id: String(entry.order_id || ''),
    order_status: String(entry.order_status || 'New'),
    prepared_notes: String(entry.prepared_notes || ''),
    items,
    summary: {
      subtotal: Number(summary.subtotal ?? liveSummary.subtotal),
      tax_rate: Number(summary.tax_rate ?? liveSummary.tax_rate),
      tax_amount: Number(summary.tax_amount ?? liveSummary.tax_amount),
      total_amount: Number(summary.total_amount ?? liveSummary.total_amount),
      missing_items_count: Number(summary.missing_items_count ?? liveSummary.missing_items_count),
      prepared_items_count: Number(summary.prepared_items_count ?? liveSummary.prepared_items_count ?? 0),
      requested_items_count: Number(summary.requested_items_count ?? liveSummary.requested_items_count ?? items.length),
      requested_subtotal: Number(summary.requested_subtotal ?? liveSummary.requested_subtotal ?? 0),
      missing_subtotal: Number(summary.missing_subtotal ?? liveSummary.missing_subtotal ?? 0),
      requested_total_amount: Number(summary.requested_total_amount ?? liveSummary.requested_total_amount ?? 0),
    },
    invoice: entry.invoice
      ? {
          id: entry.invoice.id ? String(entry.invoice.id) : '',
          status: String(entry.invoice.status || ''),
          amount: Number(entry.invoice.amount ?? 0),
        }
      : undefined,
  };
}

function calculatePreparationSummary(items: PreparationItem[], taxRate = 14) {
  const requestedSubtotal = items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unit_price || 0)),
    0
  );
  const subtotal = items.reduce(
    (sum, item) => (item.in_stock ? sum + Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unit_price || 0)) : sum),
    0
  );
  const missingSubtotal = Math.max(0, requestedSubtotal - subtotal);
  const taxAmount = subtotal * (taxRate / 100);
  const requestedTaxAmount = requestedSubtotal * (taxRate / 100);
  return {
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: subtotal + taxAmount,
    missing_items_count: items.filter((item) => !item.in_stock).length,
    prepared_items_count: items.filter((item) => item.in_stock).length,
    requested_items_count: items.length,
    requested_subtotal: requestedSubtotal,
    missing_subtotal: missingSubtotal,
    requested_total_amount: requestedSubtotal + requestedTaxAmount,
  };
}


function normalizeOrders(data: unknown) {
  if (!Array.isArray(data)) return emptyArray;
  return data.map((entry) => {
    const item: any = entry || {};
    const preparedItems = Array.isArray(item.items) ? item.items : [];
    const preparedSummary = summarizePreparedMedicines(preparedItems);
    return {
      id: String(item.id || item.code || item.order_id || 'PO-0000'),
      patient: String(item.patient_name || item.patient || item.patient_full_name || 'Unknown'),
      meds: String(preparedSummary || item.medication || item.medications || item.meds || item.drug_name || 'Pending'),
      status: String(item.status || 'Pending'),
      date: String(item.date || item.created_at || item.createdAt || new Date().toISOString().slice(0, 10)),
      totalAmount: Number(item.total_amount ?? 0),
      missingItemsCount: Number(item.missing_items_count ?? 0),
    };
  });
}

function normalizeInvoices(data: unknown) {
  if (!Array.isArray(data)) return emptyArray;
  return data.map((entry) => {
    const item: any = entry || {};
    return {
      id: String(item.id || item.code || 'INV-0000'),
      patient: String(item.patient_name || item.patient || 'Unknown'),
      amount: item.amount ?? '0.00',
      status: String(item.status || 'Pending'),
      date: String(item.date || item.created_at || item.createdAt || new Date().toISOString().slice(0, 10)),
      orderId: item.order_id ? String(item.order_id) : '',
    };
  });
}

function normalizeInvoiceItem(entry: unknown): InvoiceItem | null {
  const items = normalizeInvoices([entry]);
  return items.length ? (items[0] as InvoiceItem) : null;
}

function normalizeInventory(data: unknown): InventoryItem[] {
  if (!Array.isArray(data)) return [];
  return data.map((entry: any) => {
    const item = entry || {};
    return {
      id: String(item.sku || item.id || 'RX-0000'),
      name: String(item.name || item.drug_name || 'Unknown'),
      category: String(item.category || item.drug_category || inferCategory(item.name || item.drug_name || '')),
      stock: Number(item.stock ?? item.quantity ?? 0),
      expiry: String(item.expiry_date || item.expiry || item.expires || item.expiration_date || 'N/A'),
      batch: String(item.batch || item.batch_number || 'N/A'),
      barcode: String(item.barcode || item.barcode_value || ''),
      supplier: String(item.supplier || item.vendor || 'N/A'),
      price: Number(item.price ?? 0),
      threshold: Number(item.threshold ?? item.low_stock_threshold ?? 0),
      controlled: Boolean(item.controlled),
    };
  });
}

function normalizeInventoryItem(entry: unknown): InventoryItem | null {
  const items = normalizeInventory([entry]);
  return items.length ? items[0] : null;
}

function normalizePatients(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data.map((entry: any) => {
    const item = entry || {};
    return {
      id: String(item.id || ''),
      name: String(item.name || item.full_name || 'Unknown'),
      phone: String(item.phone || ''),
      age: Number(item.age ?? 0),
      allergies: String(item.allergies || 'None'),
      chronic: String(item.chronic || item.chronic_conditions || 'None'),
      history: String(item.history || item.history_notes || 'None'),
    };
  });
}

function normalizePrescriptions(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data.map((entry: any) => {
    const item = entry || {};
    const normalizedText = normalizePrescriptionTextFields(
      item.doctor_name || item.doctor || '',
      item.meds || item.medication || 'Pending'
    );
    return {
      id: String(item.id || ''),
      orderId: item.pharmacy_order_id ? String(item.pharmacy_order_id) : '',
      invoiceId: item.invoice_id ? String(item.invoice_id) : '',
      invoiceStatus: String(item.invoice_status || ''),
      patient: String(item.patient || ''),
      patientName: String(item.patient_name || item.patient || 'Unknown'),
      doctor: normalizedText.doctor,
      meds: normalizedText.meds,
      medList: parseMedicineEntries(normalizedText.meds),
      notes: String(item.notes || item.instructions || ''),
      controlled: Boolean(item.controlled),
      status: String(item.status || 'New'),
      date: String(item.created_at || new Date().toISOString()).slice(0, 10),
      quantity: 1,
    };
  });
}

function normalizeNotifications(data: unknown): NotificationItem[] {
  if (!Array.isArray(data)) return [];
  return data.map((entry: any, index) => {
    const item = entry || {};
    return {
      id: String(item.id || `alert-${index}`),
      time: String(item.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
      message: String(item.message || 'Alert'),
      status: String(item.status || item.type || 'Unread'),
      type: String(item.type || item.status || 'Unread'),
      related: item.related ? String(item.related) : undefined,
      page: item.page ? String(item.page) : undefined,
    };
  });
}

function buildInventoryNotifications(
  lowStockAlerts: InventoryItem[],
  expiryAlerts: Array<InventoryItem & { days: number | null }>,
  acknowledgedInventoryAlertIds: Set<string>
): NotificationItem[] {
  const stockNotifications = lowStockAlerts.map((item) => {
    const id = `inventory-low-${item.id}`;
    const isRead = acknowledgedInventoryAlertIds.has(id);
    return {
      id,
      time: 'Inventory',
      message: `Low stock: ${item.name} (${item.stock}/${item.threshold})`,
      status: isRead ? 'Read' : 'Alert',
      type: 'Alert',
      related: `Inventory ${item.id}`,
      page: 'Inventory',
    };
  });

  const expiryNotifications = expiryAlerts.map((item) => {
    const id = `inventory-expiry-${item.id}`;
    const isRead = acknowledgedInventoryAlertIds.has(id);
    return {
      id,
      time: 'Inventory',
      message: `Expiring soon: ${item.name} batch ${item.batch} in ${item.days} days`,
      status: isRead ? 'Read' : 'Alert',
      type: 'Alert',
      related: `Inventory ${item.id}`,
      page: 'Inventory',
    };
  });

  return [...stockNotifications, ...expiryNotifications];
}

function buildInboxRows(prescriptions: any[]) {
  return prescriptions
    .filter((item) => item.status === 'New')
    .map((item) => ({
      id: item.id,
      orderId: item.orderId,
      patient: item.patientName,
      doctor: item.doctor,
      meds: item.meds,
      notes: item.notes,
      status: item.status,
      time: '10:30',
      quantity: item.quantity || 1,
    }));
}

function buildPrepQueueRows(orders: any[]) {
  return orders
    .filter((item) => item.status !== 'Dispensed')
    .map((item) => ({
      id: item.id,
      orderId: item.id,
      patient: item.patient,
      meds: item.meds,
      quantity: 1,
      status: item.status,
      priority: item.status === 'Ready' ? 'High' : 'Normal',
      eta: item.status === 'Ready' ? '0 min' : item.status === 'Preparing' ? '10 min' : '15 min',
      time: String(item.date || '').slice(11, 16) || '10:30',
    }));
}

function getApiErrorMessage(err: any, fallback: string) {
  const detail = err?.data?.detail || err?.data?.non_field_errors?.[0];
  if (detail) return String(detail);

  const data = err?.data;
  if (data && typeof data === 'object') {
    for (const [field, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length) {
        return `${field}: ${String(value[0])}`;
      }
      if (typeof value === 'string' && value) {
        return `${field}: ${value}`;
      }
    }
  }

  if (typeof err?.message === 'string' && err.message) return err.message;
  return fallback;
}

function parseQrPrescriptionPayload(raw: string) {
  if (!raw || !raw.trim()) {
    throw new Error('Paste or scan QR content first.');
  }
  const trimmed = raw.trim();
  let payload: any = null;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    if (/^https?:\/\//i.test(trimmed)) {
      return {
        patientName: 'Walk-in Patient',
        doctorName: 'Clinic Doctor',
        diagnosis: 'Imported from patient QR prescription link',
        meds: [
          {
            name: `Prescription link: ${trimmed}`,
            duration: '',
          },
        ],
      };
    }
    throw new Error('Unsupported QR format. Expected clinic JSON payload or prescription URL.');
  }
  const isLegacy = payload?.t === 'DERMA_RX';
  const isV2 = payload?.documentType === 'DERMA_RX';
  if (!payload || (!isLegacy && !isV2)) {
    throw new Error('Unsupported QR format.');
  }
  const meds = isLegacy
    ? (Array.isArray(payload.meds) ? payload.meds : [])
    : (Array.isArray(payload.prescriptions) ? payload.prescriptions : []);
  if (!meds.length) {
    throw new Error('QR has no medications.');
  }
  if (isLegacy) {
    return {
      patientName: String(payload?.patient?.n || 'Walk-in Patient').trim() || 'Walk-in Patient',
      doctorName: String(payload?.dr || payload?.doctor || 'Clinic Doctor').trim() || 'Clinic Doctor',
      diagnosis: String(payload?.diag || payload?.notes || '').trim(),
      meds: meds.map((m: any) => ({
        name: String(m?.n || '').trim(),
        duration: String(m?.du || '').trim(),
      })),
    };
  }
  return {
    patientName: String(payload?.patient?.name || 'Walk-in Patient').trim() || 'Walk-in Patient',
    doctorName: String(payload?.doctor?.name || 'Clinic Doctor').trim() || 'Clinic Doctor',
    diagnosis: String(payload?.diagnosis?.finalDiagnosis || '').trim(),
    meds: meds.map((m: any) => ({
      name: String(m?.medication || '').trim(),
      duration: String(m?.duration || '').trim(),
    })),
  };
}

function buildQrPrescriptionPreview(raw: string) {
  const normalized = parseQrPrescriptionPayload(raw);
  const base = {
    clinicName: 'Derma Clinic',
    rxCode: '',
    timestamp: '',
    patientId: '',
    age: '',
    gender: '',
    doctorName: normalized.doctorName,
    patientName: normalized.patientName,
    diagnosis: normalized.diagnosis,
    meds: Array.isArray(normalized.meds) ? normalized.meds : [],
  };

  const trimmed = String(raw || '').trim();
  if (!trimmed) return base;
  if (!trimmed.startsWith('{')) return base;

  try {
    const payload = JSON.parse(trimmed);
    const isLegacy = payload?.t === 'DERMA_RX';
    if (isLegacy) {
      return {
        ...base,
        clinicName: String(payload?.c || base.clinicName).trim() || base.clinicName,
        rxCode: String(payload?.rx || '').trim(),
        timestamp: String(payload?.ts || '').trim(),
        patientId: String(payload?.patient?.id || '').trim(),
        age: String(payload?.patient?.a || '').trim(),
        gender: String(payload?.patient?.g || '').trim(),
        meds: (Array.isArray(payload?.meds) ? payload.meds : []).map((m: any) => ({
          name: String(m?.n || '').trim(),
          dose: String(m?.d || '').trim(),
          duration: String(m?.du || '').trim(),
          notes: String(m?.no || '').trim(),
        })),
      };
    }
    return {
      ...base,
      clinicName: String(payload?.clinic?.name || base.clinicName).trim() || base.clinicName,
      rxCode: String(payload?.rxCode || '').trim(),
      timestamp: String(payload?.issuedAt || '').trim(),
      patientId: String(payload?.patient?.id || '').trim(),
      age: String(payload?.patient?.age || '').trim(),
      gender: String(payload?.patient?.gender || '').trim(),
      meds: (Array.isArray(payload?.prescriptions) ? payload.prescriptions : []).map((m: any) => ({
        name: String(m?.medication || '').trim(),
        dose: String(m?.dose || '').trim(),
        duration: String(m?.duration || '').trim(),
        notes: String(m?.notes || '').trim(),
      })),
    };
  } catch {
    return base;
  }
}

function upsertInventoryItem(items: InventoryItem[], nextItem: InventoryItem) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) {
    return [nextItem, ...items];
  }

  const nextItems = [...items];
  nextItems[existingIndex] = nextItem;
  return nextItems;
}

function upsertInvoiceItem(items: InvoiceItem[], nextItem: InvoiceItem) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex === -1) {
    return [nextItem, ...items];
  }

  const nextItems = [...items];
  nextItems[existingIndex] = nextItem;
  return nextItems;
}

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDateInput(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  if (isValidDateInput(raw)) return raw;

  const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const month = first.padStart(2, '0');
    const day = second.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
}

function normalizeMedicineKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nextStatus(current: string) {
  const index = statusFlow.indexOf(current);
  if (index === -1) return 'New';
  return statusFlow[Math.min(index + 1, statusFlow.length - 1)];
}

function daysUntil(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function minutesSince(timeString: string) {
  const [hours, minutes] = timeString.split(':').map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  return Math.max(0, Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)) * 1440 + (now.getHours() - hours) * 60 + (now.getMinutes() - minutes));
}
function inferCategory(name: string = '') {
  const value = name.toLowerCase();
  if (value.includes('insulin') || value.includes('metformin') || value.includes('glucose')) return 'Diabetes';
  if (value.includes('amoxicillin') || value.includes('azith') || value.includes('cefa')) return 'Antibiotic';
  if (value.includes('para') || value.includes('ibuprofen') || value.includes('diclo')) return 'Painkiller';
  if (value.includes('vitamin') || value.includes('supplement')) return 'Supplement';
  if (value.includes('omeprazole') || value.includes('antacid')) return 'Gastro';
  return 'General';
}

function generateSku() {
  const suffix = String(Date.now()).slice(-4);
  return `RX-${suffix}`;
}

function loadDashboardCache() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDashboardCache(payload: {
  orders: any[];
  inventory: InventoryItem[];
  invoices: InvoiceItem[];
  prescriptions: any[];
  patients: any[];
  clinicRequests: any[];
  notifications: NotificationItem[];
}) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
}

export function PharmacyDashboard({ activeSection = 'Dashboard', onMetrics, onSectionChange, onScrollTo }: PharmacyDashboardProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [clinicRequests, setClinicRequests] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [prepQueue, setPrepQueue] = useState<any[]>([]);
  const [recentDispensed, setRecentDispensed] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [acknowledgedInventoryAlertIds, setAcknowledgedInventoryAlertIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState('info');
  const [lastSync, setLastSync] = useState('Not synced yet');
  const [syncCount, setSyncCount] = useState(0);

  const [sku, setSku] = useState('');
  const [drugName, setDrugName] = useState('');
  const [drugCategory, setDrugCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [batch, setBatch] = useState('');
  const [barcode, setBarcode] = useState('');
  const [supplier, setSupplier] = useState('');
  const [price, setPrice] = useState('');
  const [controlled, setControlled] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [restockAmount, setRestockAmount] = useState('');

  const [requestSku, setRequestSku] = useState('');
  const [requestName, setRequestName] = useState('');
  const [requestQty, setRequestQty] = useState('');
  const [requestPriority, setRequestPriority] = useState('Normal');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestBy, setRequestBy] = useState('');
  const [showClinicRequestForm, setShowClinicRequestForm] = useState(false);
  const [showAddMedicineForm, setShowAddMedicineForm] = useState(false);

  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientAllergy, setPatientAllergy] = useState('');
  const [patientChronic, setPatientChronic] = useState('');
  const [patientHistory, setPatientHistory] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [editPrescription, setEditPrescription] = useState<any | null>(null);
  const [editPrescStatus, setEditPrescStatus] = useState('');
  const [editPrescNotes, setEditPrescNotes] = useState('');
  const [preparationSidebar, setPreparationSidebar] = useState<PreparationState | null>(null);
  const [preparationLoading, setPreparationLoading] = useState(false);
  const [preparationSaving, setPreparationSaving] = useState(false);
  const [preparationNotes, setPreparationNotes] = useState('');
  const [preparationDrafts, setPreparationDrafts] = useState<Record<string, PreparationDraft>>({});
  const [preparationAutosaveStatus, setPreparationAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showPreparationInventoryPicker, setShowPreparationInventoryPicker] = useState(false);
  const [preparationInventorySearch, setPreparationInventorySearch] = useState('');
  const [prescDetailsY, setPrescDetailsY] = useState(0);
  const [prescScrollPending, setPrescScrollPending] = useState(false);
  const preparationAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [orderSearch, setOrderSearch] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('All');
  const [inventorySupplierFilter, setInventorySupplierFilter] = useState('All');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [prescSearch, setPrescSearch] = useState('');
  const [prescRange, setPrescRange] = useState('All');
  const [prescDoctorFilter, setPrescDoctorFilter] = useState('');
  const [prescPatientFilter, setPrescPatientFilter] = useState('');
  const [prescStatusFilter, setPrescStatusFilter] = useState('');
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState('All');
  const [prepFilter, setPrepFilter] = useState('All');
  const [patientSearch, setPatientSearch] = useState('');
  const [posSearch, setPosSearch] = useState('');

  const [scanBarcode, setScanBarcode] = useState('');
  const [scanPrescriptionQrText, setScanPrescriptionQrText] = useState('');
  const [showQrScannerPanel, setShowQrScannerPanel] = useState(false);
  const [cameraScanned, setCameraScanned] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const [showQrRaw, setShowQrRaw] = useState(false);
  const [lastScanPreview, setLastScanPreview] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cart, setCart] = useState<any[]>([]);
  const [posPatient, setPosPatient] = useState('');
  const [posPatientId, setPosPatientId] = useState('');
  const [posPatientPhone, setPosPatientPhone] = useState('');
  const [cashierName, setCashierName] = useState('Aisha');
  const [shiftId, setShiftId] = useState('SHIFT-02');
  const [receiptNo, setReceiptNo] = useState('RCPT-24017');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [openTableCard, setOpenTableCard] = useState<string | null>('invoice-table');
  const [openQuickAction, setOpenQuickAction] = useState<string | null>(null);

  const qrPrescriptionPreview = useMemo(() => {
    if (!scanPrescriptionQrText.trim()) return null;
    try {
      return buildQrPrescriptionPreview(scanPrescriptionQrText);
    } catch {
      return null;
    }
  }, [scanPrescriptionQrText]);

  const toast = (message: string, tone: string = 'info') => {
    setNotice(message);
    setNoticeTone(tone);
  };

  const lowStockAlerts = inventory.filter((item) => (item.threshold ?? 0) > 0 && item.stock <= item.threshold);
  const expiryAlerts = inventory
    .map((item) => ({ ...item, days: daysUntil(item.expiry) }))
    .filter((item) => item.days !== null && item.days <= 30);
  const acknowledgedInventoryAlertSet = useMemo(
    () => new Set(acknowledgedInventoryAlertIds),
    [acknowledgedInventoryAlertIds]
  );
  const inventoryNotifications = useMemo(
    () => buildInventoryNotifications(lowStockAlerts, expiryAlerts, acknowledgedInventoryAlertSet),
    [lowStockAlerts, expiryAlerts, acknowledgedInventoryAlertSet]
  );
  const allNotifications = useMemo(
    () => [...inventoryNotifications, ...notifications],
    [inventoryNotifications, notifications]
  );

  const pendingPrescriptions = inbox.filter((item) => item.status !== 'Ready' && item.status !== 'Dispensed').length;
  const readyForPickup = inbox.filter((item) => item.status === 'Ready').length;
  const totalStock = inventory.reduce((sum, item) => sum + (item.stock || 0), 0);

  const load = async () => {
    setLoading(true);
    const cached = loadDashboardCache();
    try {
      const [
        ordersResult,
        inventoryResult,
        invoicesResult,
        clinicRequestsResult,
        prescriptionsResult,
        patientsResult,
        alertsResult,
      ] = await Promise.allSettled([
        getPharmacyOrders(),
        getInventory(),
        getInvoices(),
        getClinicRequests(),
        getPrescriptions(),
        getPatients(),
        getAlerts(),
      ]);

      const allFailed = [
        ordersResult,
        inventoryResult,
        invoicesResult,
        clinicRequestsResult,
        prescriptionsResult,
        patientsResult,
        alertsResult,
      ].every((entry) => entry.status !== 'fulfilled');

      const cachedOrders = Array.isArray(cached?.orders) ? cached.orders : [];
      const cachedInventory = Array.isArray(cached?.inventory) ? cached.inventory : [];
      const cachedInvoices = Array.isArray(cached?.invoices) ? cached.invoices : [];
      const cachedClinicRequests = Array.isArray(cached?.clinicRequests) ? cached.clinicRequests : [];
      const cachedPrescriptions = Array.isArray(cached?.prescriptions) ? cached.prescriptions : [];
      const cachedPatients = Array.isArray(cached?.patients) ? cached.patients : [];
      const cachedAlerts = Array.isArray(cached?.notifications) ? cached.notifications : [];

      const normalizedOrders =
        ordersResult.status === 'fulfilled'
          ? normalizeOrders(ordersResult.value)
          : (orders.length ? orders : cachedOrders);
      const normalizedInventory =
        inventoryResult.status === 'fulfilled'
          ? normalizeInventory(inventoryResult.value)
          : (inventory.length ? inventory : cachedInventory);
      const normalizedInvoices =
        invoicesResult.status === 'fulfilled'
          ? normalizeInvoices(invoicesResult.value)
          : (invoices.length ? invoices : cachedInvoices);
      const normalizedPrescriptions =
        prescriptionsResult.status === 'fulfilled'
          ? normalizePrescriptions(prescriptionsResult.value)
          : (prescriptions.length ? prescriptions : cachedPrescriptions);
      const normalizedPatients =
        patientsResult.status === 'fulfilled'
          ? normalizePatients(patientsResult.value)
          : (patients.length ? patients : cachedPatients);
      const normalizedAlerts =
        alertsResult.status === 'fulfilled'
          ? normalizeNotifications(alertsResult.value)
          : (notifications.length ? notifications : cachedAlerts);
      const normalizedClinicRequests =
        clinicRequestsResult.status === 'fulfilled'
          ? (Array.isArray(clinicRequestsResult.value) ? clinicRequestsResult.value : [])
          : (clinicRequests.length ? clinicRequests : cachedClinicRequests);

      setOrders(normalizedOrders);
      setInventory(normalizedInventory);
      setInvoices(normalizedInvoices);
      setClinicRequests(normalizedClinicRequests);
      setPrescriptions(normalizedPrescriptions);
      setPatients(normalizedPatients);
      setInbox(buildInboxRows(normalizedPrescriptions));
      setPrepQueue(buildPrepQueueRows(normalizedOrders));
      setNotifications(normalizedAlerts);
      setAcknowledgedInventoryAlertIds([]);
      setLastSync(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      saveDashboardCache({
        orders: normalizedOrders,
        inventory: normalizedInventory,
        invoices: normalizedInvoices as InvoiceItem[],
        prescriptions: normalizedPrescriptions,
        patients: normalizedPatients,
        clinicRequests: normalizedClinicRequests,
        notifications: normalizedAlerts,
      });
      if (allFailed) {
        setNotice('Backend is temporarily unavailable. Showing last available data.');
        setNoticeTone('warning');
      }
    } catch (err) {
      if (cached) {
        const cachedOrders = Array.isArray(cached.orders) ? cached.orders : [];
        const cachedInventory = Array.isArray(cached.inventory) ? cached.inventory : [];
        const cachedInvoices = Array.isArray(cached.invoices) ? cached.invoices : [];
        const cachedPrescriptions = Array.isArray(cached.prescriptions) ? cached.prescriptions : [];
        const cachedPatients = Array.isArray(cached.patients) ? cached.patients : [];
        const cachedClinicRequests = Array.isArray(cached.clinicRequests) ? cached.clinicRequests : [];
        const cachedNotifications = Array.isArray(cached.notifications) ? cached.notifications : [];

        setOrders(cachedOrders);
        setInventory(cachedInventory);
        setInvoices(cachedInvoices);
        setPrescriptions(cachedPrescriptions);
        setPatients(cachedPatients);
        setClinicRequests(cachedClinicRequests);
        setNotifications(cachedNotifications);
        setInbox(buildInboxRows(cachedPrescriptions));
        setPrepQueue(buildPrepQueueRows(cachedOrders));
        setNotice('Backend sync is delayed. Showing last saved dashboard data.');
        setNoticeTone('warning');
      } else {
        setNotice(getApiErrorMessage(err, 'Unable to load backend data.'));
        setNoticeTone('warning');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await load();
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!onMetrics) return;
    onMetrics({
      inbox: allNotifications.length,
      prep: prepQueue.length,
      prescriptions: prescriptions.length,
      patients: patients.length,
      inventory: inventory.length,
      lowStock: lowStockAlerts.length + expiryAlerts.length,
      cart: cart.length,
      invoices: invoices.length,
    });
  }, [    allNotifications.length,
    prepQueue.length,
    prescriptions.length,
    patients.length,
    inventory.length,
    lowStockAlerts.length,
    expiryAlerts.length,
    cart.length,
    invoices.length,
    onMetrics,
  ]);

  const resetMedicineForm = () => {
    setSku('');
    setDrugName('');
    setDrugCategory('');
    setQuantity('');
    setExpiryDate('');
    setLowStockThreshold('');
    setBatch('');
    setBarcode('');
    setSupplier('');
    setPrice('');
    setControlled(false);
    setEditingId(null);
    setRestockAmount('');
  };

  const resetClinicRequestForm = () => {
    setRequestSku('');
    setRequestName('');
    setRequestQty('');
    setRequestPriority('Normal');
    setRequestNotes('');
    setRequestBy('');
  };

  const closeAddMedicineForm = () => {
    resetMedicineForm();
    setShowAddMedicineForm(false);
  };

  const openAddMedicineForm = () => {
    resetMedicineForm();
    setShowClinicRequestForm(false);
    setShowAddMedicineForm(true);
  };

  const refreshInventoryAlerts = async () => {
    const [inventoryResult, alertsResult] = await Promise.allSettled([
      getInventory(),
      getAlerts(),
    ]);

    if (inventoryResult.status === 'fulfilled') {
      setInventory(normalizeInventory(inventoryResult.value));
    }

    if (alertsResult.status === 'fulfilled') {
      setNotifications(normalizeNotifications(alertsResult.value));
    }

    if (inventoryResult.status !== 'fulfilled' && alertsResult.status !== 'fulfilled') {
      throw new Error('Unable to refresh inventory data.');
    }

    setLastSync(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  };

  const refreshInvoiceData = async () => {
    const [invoiceResult, alertsResult] = await Promise.allSettled([
      getInvoices(),
      getAlerts(),
    ]);

    let normalizedInvoices: InvoiceItem[] = [];
    if (invoiceResult.status === 'fulfilled') {
      normalizedInvoices = normalizeInvoices(invoiceResult.value) as InvoiceItem[];
      setInvoices(normalizedInvoices);
      syncSelectedInvoice(normalizedInvoices);
    }

    if (alertsResult.status === 'fulfilled') {
      setNotifications(normalizeNotifications(alertsResult.value));
    }

    if (invoiceResult.status !== 'fulfilled' && alertsResult.status !== 'fulfilled') {
      throw new Error('Unable to refresh invoice data.');
    }

    setLastSync(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    return normalizedInvoices;
  };

  const findInventoryMatchForMedicine = (medicineName: string) => {
    const key = normalizeMedicineKey(medicineName);
    if (!key) return null;
    return (
      inventoryByMedicine[key] ||
      inventory.find((item) => {
        const inventoryKey = normalizeMedicineKey(item.name);
        return inventoryKey === key || inventoryKey.includes(key) || key.includes(inventoryKey);
      }) ||
      null
    );
  };

  const buildPreparationFallback = (prescriptionRow: any): PreparationState => {
    const itemNames =
      Array.isArray(prescriptionRow?.medList) && prescriptionRow.medList.length
        ? prescriptionRow.medList
        : parseMedicineEntries(String(prescriptionRow?.meds || ''));
    const items = itemNames.map((medicineName, index) => {
      const inventoryMatch = findInventoryMatchForMedicine(medicineName);
      const quantity = 1;
      const unitPrice = Number(inventoryMatch?.price ?? 0);
      const availableQuantity = Number(inventoryMatch?.stock ?? 0);
      const inStock = availableQuantity >= quantity && Boolean(inventoryMatch);
      return normalizePreparationItem(
        {
          source_name: medicineName,
          medicine_name: medicineName,
          dosage: '',
          quantity,
          available_quantity: availableQuantity,
          unit_price: unitPrice,
          line_total: inStock ? unitPrice * quantity : 0,
          in_stock: inStock,
          notes: prescriptionRow?.notes || '',
          sort_order: index,
          inventory_sku: inventoryMatch?.id || '',
          inventory_name: inventoryMatch?.name || '',
        },
        index
      );
    });
    return {
      prescription_id: String(prescriptionRow?.id || ''),
      patient_name: String(prescriptionRow?.patientName || 'Unknown'),
      doctor_name: String(prescriptionRow?.doctor || 'Clinic Doctor'),
      order_id: String(prescriptionRow?.orderId || ''),
      order_status: String(prescriptionRow?.status || 'New'),
      prepared_notes: String(prescriptionRow?.notes || ''),
      items,
      summary: calculatePreparationSummary(items),
      invoice: undefined,
    };
  };

  const syncPreparationSidebar = (payload: unknown, fallbackPrescription?: any) => {
    const normalized = normalizePreparation(payload) || (fallbackPrescription ? buildPreparationFallback(fallbackPrescription) : null);
    setPreparationSidebar(normalized);
    setPreparationNotes(normalized?.prepared_notes || fallbackPrescription?.notes || '');
  };

  const loadPreparationSidebar = async (prescriptionRow: any) => {
    setPreparationLoading(true);
    try {
      const payload = await getPrescriptionPreparation(String(prescriptionRow.id));
      syncPreparationSidebar(payload, prescriptionRow);
      const draft = preparationDrafts[String(prescriptionRow.id)];
      if (draft) {
        const nextItems = draft.items.map((item, index) => normalizePreparationItem(item, index));
        setPreparationSidebar((current) =>
          current
            ? {
                ...current,
                prepared_notes: draft.notes,
                items: nextItems,
                summary: calculatePreparationSummary(nextItems, current.summary.tax_rate || 14),
              }
            : current
        );
        setPreparationNotes(draft.notes);
      }
    } catch (err) {
      syncPreparationSidebar(null, prescriptionRow);
      setNotice(getApiErrorMessage(err, 'Unable to load preparation details. Showing local stock estimate.'));
      setNoticeTone('warning');
    } finally {
      setPreparationLoading(false);
    }
  };

  const patchPreparationItems = (updater: (items: PreparationItem[]) => PreparationItem[]) => {
    setPreparationSidebar((current) => {
      if (!current) return current;
      const nextItems = updater(current.items).map((item, index) => {
        const inventoryMatch = findInventoryMatchForMedicine(item.medicine_name);
        const quantity = Math.max(1, Number(item.quantity || 1));
        const unitPrice = Number(item.unit_price || inventoryMatch?.price || 0);
        const availableQuantity = Number(inventoryMatch?.stock ?? item.available_quantity ?? 0);
        const inStock = Boolean(inventoryMatch) && availableQuantity >= quantity;
        return {
          ...item,
          quantity,
          available_quantity: availableQuantity,
          unit_price: unitPrice,
          line_total: inStock ? unitPrice * quantity : 0,
          in_stock: inStock,
          sort_order: index,
          inventory_sku: inventoryMatch?.id || item.inventory_sku || '',
          inventory_name: inventoryMatch?.name || item.inventory_name || '',
        };
      });
      return {
        ...current,
        prepared_notes: preparationNotes,
        items: nextItems,
        summary: calculatePreparationSummary(nextItems, current.summary.tax_rate || 14),
      };
    });
  };

  const savePreparationDraft = (prescriptionId: string, notes: string, items: PreparationItem[]) => {
    setPreparationDrafts((prev) => ({
      ...prev,
      [prescriptionId]: {
        notes,
        items: items.map((item) => ({ ...item })),
        updated_at: Date.now(),
      },
    }));
  };

  const handlePreparationSaveDraft = () => {
    if (!selectedPrescription || !preparationSidebar) {
      setNotice('Open a prescription first.');
      setNoticeTone('warning');
      return;
    }
    savePreparationDraft(String(selectedPrescription.id), preparationNotes, preparationSidebar.items);
    setPreparationAutosaveStatus('saved');
    setNotice('Preparation draft saved locally.');
    setNoticeTone('success');
  };

  const handlePreparationItemChange = (index: number, field: keyof PreparationItem, value: string) => {
    patchPreparationItems((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === 'quantity') {
          return { ...item, quantity: Math.max(1, Number.parseInt(value || '1', 10) || 1) };
        }
        if (field === 'unit_price') {
          return { ...item, unit_price: Number.parseFloat(value || '0') || 0 };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handlePreparationItemRemove = (index: number) => {
    patchPreparationItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const handlePreparationItemAdd = () => {
    patchPreparationItems((items) => [
      ...items,
      normalizePreparationItem(
        {
          source_name: '',
          medicine_name: '',
          dosage: '',
          quantity: 1,
          available_quantity: 0,
          unit_price: 0,
          line_total: 0,
          in_stock: false,
          notes: '',
          sort_order: items.length,
          inventory_sku: '',
          inventory_name: '',
        },
        items.length
      ),
    ]);
  };

  const handlePreparationInventoryAdd = (inventoryItem: InventoryItem) => {
    patchPreparationItems((items) => [
      ...items,
      normalizePreparationItem(
        {
          source_name: inventoryItem.name,
          medicine_name: inventoryItem.name,
          dosage: '',
          quantity: 1,
          available_quantity: inventoryItem.stock,
          unit_price: inventoryItem.price || 0,
          line_total: inventoryItem.stock > 0 ? Number(inventoryItem.price || 0) : 0,
          in_stock: inventoryItem.stock > 0,
          notes: '',
          sort_order: items.length,
          inventory_sku: inventoryItem.id,
          inventory_name: inventoryItem.name,
        },
        items.length
      ),
    ]);
    setShowPreparationInventoryPicker(false);
    setPreparationInventorySearch('');
  };

  const resetInvoiceFilters = () => {
    setInvoiceSearch('');
  };

  const syncSelectedInvoice = (items: InvoiceItem[]) => {
    setSelectedInvoice((current) => {
      if (!current) return current;
      return items.find((item) => item.id === current.id) || null;
    });
  };

  const resetInventoryFilters = () => {
    setInventoryCategoryFilter('All');
    setInventorySupplierFilter('All');
    setInventorySearch('');
  };

  const handleClinicRequestCreate = async () => {
    if (!requestName.trim() || !requestQty.trim()) {
      setNotice('Please provide item name and quantity.');
      setNoticeTone('warning');
      return;
    }
    const payload = {
      sku: requestSku.trim(),
      item_name: requestName.trim(),
      quantity: Number.parseInt(requestQty, 10) || 0,
      priority: requestPriority,
      notes: requestNotes.trim(),
      requested_by: requestBy.trim(),
      status: 'Requested',
    };
    try {
      await createClinicRequest(payload);
      await load();
      setNotice('Clinic request sent to pharmacy.');
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to send clinic request.'));
      setNoticeTone('warning');
    }
    resetClinicRequestForm();
    setShowClinicRequestForm(false);
  };

  const handleClinicRequestStatus = async (item, status) => {
    try {
      await updateClinicRequest(String(item.id), { status });
      await load();
      setNotice(`Clinic request ${item.id} marked ${status}.`);
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to update clinic request status.'));
      setNoticeTone('warning');
    }
  };

  const handleInventorySave = async () => {
    if (!drugName.trim()) {
      setNotice('Please provide drug name.');
      setNoticeTone('warning');
      return;
    }
    const normalizedExpiry = normalizeDateInput(expiryDate);
    if (expiryDate.trim() && !normalizedExpiry) {
      setNotice('Expiry date must use YYYY-MM-DD format.');
      setNoticeTone('warning');
      return;
    }
    const resolvedSku = sku.trim() || generateSku();
    const payload = {
      id: resolvedSku,
      name: drugName.trim(),
      category: drugCategory.trim() || inferCategory(drugName),
      stock: Number.parseInt(quantity, 10) || 0,
      expiry: normalizedExpiry || null,
      threshold: Number.parseInt(lowStockThreshold, 10) || 0,
      batch: batch.trim() || '',
      barcode: barcode.trim(),
      supplier: supplier.trim() || '',
      price: Number.parseFloat(price) || 0,
      controlled,
    };
    let savedInventory: InventoryItem | null = null;
    try {
      const savedResponse = await updateInventory(payload);
      savedInventory = normalizeInventoryItem(savedResponse);
      if (savedInventory) {
        setInventory((prev) => upsertInventoryItem(prev, savedInventory as InventoryItem));
        resetInventoryFilters();
      }
      await refreshInventoryAlerts();
      setNotice(editingId ? 'Medicine updated and synced.' : 'Medicine added and synced.');
      setNoticeTone('success');
    } catch (err) {
      if (savedInventory) {
        closeAddMedicineForm();
        setNotice(editingId ? 'Medicine saved. Alerts refresh is still syncing.' : 'Medicine added. Alerts refresh is still syncing.');
        setNoticeTone('warning');
        return;
      }
      setNotice(getApiErrorMessage(err, editingId ? 'Unable to update medicine.' : 'Unable to add medicine.'));
      setNoticeTone('warning');
      return;
    }
    closeAddMedicineForm();
  };

  const handleInventoryEdit = (item) => {
    setSku(item.id);
    setDrugName(item.name);
    setDrugCategory(item.category || inferCategory(item.name));
    setQuantity(String(item.stock));
    setExpiryDate(item.expiry || '');
    setLowStockThreshold(String(item.threshold ?? ''));
    setBatch(item.batch || '');
    setBarcode(item.barcode || '');
    setSupplier(item.supplier || '');
    setPrice(String(item.price ?? ''));
    setControlled(Boolean(item.controlled));
    setEditingId(item.id);
    setRestockAmount('');
    setShowAddMedicineForm(true);
  };

  const handleInventoryRestock = async () => {
    if (!editingId) return;
    const addQty = Number.parseInt(restockAmount, 10);
    if (Number.isNaN(addQty) || addQty <= 0) {
      setNotice('Enter a valid restock amount.');
      setNoticeTone('warning');
      return;
    }
    try {
      const currentItem = inventory.find((item) => item.id === editingId);
      if (!currentItem) {
        throw new Error('Medicine not found.');
      }
      const updatedItem = {
        ...currentItem,
        stock: (currentItem.stock || 0) + addQty,
        expiry: currentItem.expiry === 'N/A' ? null : currentItem.expiry,
        batch: currentItem.batch === 'N/A' ? '' : currentItem.batch,
        supplier: currentItem.supplier === 'N/A' ? '' : currentItem.supplier,
      };
      setQuantity(String(updatedItem.stock));
      if (updatedItem) {
        await updateInventory(updatedItem);
      }
      setRestockAmount('');
      await refreshInventoryAlerts();
      setNotice('Stock restocked and synced.');
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to restock medicine.'));
      setNoticeTone('warning');
    }
  };

  const handleInventoryDelete = async (item) => {
    try {
      await deleteInventory(String(item.id));
      await refreshInventoryAlerts();
      setNotice(`Medicine ${item.name} removed.`);
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to remove medicine.'));
      setNoticeTone('warning');
    }
  };

  const handleAcceptPrescription = async (item) => {
    if (!item.orderId) {
      setNotice('This prescription is not linked to a pharmacy order yet.');
      setNoticeTone('warning');
      return;
    }
    try {
      await updatePharmacyOrder(String(item.orderId), { status: 'Preparing' });
      await load();
      setNotice(`Prescription ${item.id} moved to prep queue.`);
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to move prescription to prep queue.'));
      setNoticeTone('warning');
    }
  };

  const handleQueueAdvance = (item) => {
    handleAdvanceStatus({ ...item, id: item.orderId || item.id, status: item.status });
  };
  const pushNotification = (message, status = 'Unread', related = null) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setNotifications((prev) =>
      [
        { id: `${Date.now()}`, message, time, status, type: status, related },
        ...prev,
      ].slice(0, 10)
    );
    };

  const markNotificationRead = (note) => {
    if (String(note?.id || '').startsWith('inventory-')) {
      setAcknowledgedInventoryAlertIds((prev) => (prev.includes(note.id) ? prev : [...prev, note.id]));
    }
    setNotifications((prev) => prev.map((entry) => (entry.id === note.id ? { ...entry, status: 'Read' } : entry)));
  };

  const openRelatedNotification = (note) => {
    if (note?.related) {
      setNotice(`Opened ${note.related}.`);
      setNoticeTone('info');
    }
  };


  const handleIncomingStatus = async (item, status) => {
    if (!item.orderId) {
      setNotice('This prescription is not linked to a pharmacy order yet.');
      setNoticeTone('warning');
      return;
    }
    try {
      await updatePharmacyOrder(String(item.orderId), { status });
      await load();
      setNotice(`Prescription ${item.id} marked ${status}.`);
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to update prescription status.'));
      setNoticeTone('warning');
    }
  };

  const handleDispense = async (item) => {
    if (!item.orderId) {
      setNotice('This prescription is not linked to a pharmacy order yet.');
      setNoticeTone('warning');
      return;
    }
    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    try {
      await updatePharmacyOrder(String(item.orderId), { status: 'Dispensed' });
      setRecentDispensed((prev) => [
        { patient: item.patient, drug: item.meds, quantity: item.quantity || 1, time },
        ...prev,
      ].slice(0, 8));
      await load();
      setNotice(`Medication dispensed for ${item.patient}.`);
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to mark medication as dispensed.'));
      setNoticeTone('warning');
    }
  };

  const handlePrescriptionView = async (row) => {
    setSelectedPrescription(row);
    setEditPrescription(null);
    setEditPrescStatus(row.status || '');
    setEditPrescNotes(row.notes || '');
    setPrescScrollPending(true);
    await loadPreparationSidebar(row);
  };

  const handlePrescriptionEdit = async (row) => {
    setSelectedPrescription(row);
    setEditPrescription(row);
    setEditPrescStatus(row.status || '');
    setEditPrescNotes(row.notes || '');
    setPrescScrollPending(true);
    await loadPreparationSidebar(row);
  };

  const handlePrescriptionSave = async () => {
    if (!selectedPrescription) return;
    try {
      await updatePrescription(String(selectedPrescription.id), {
        status: editPrescStatus || selectedPrescription.status,
        notes: editPrescNotes ?? selectedPrescription.notes,
      });
      await load();
      setNotice('Prescription updated.');
      setNoticeTone('success');
      setEditPrescription(null);
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to update prescription.'));
      setNoticeTone('warning');
    }
  };

  const buildPreparationRequestPayload = () => {
    if (!preparationSidebar) return null;
    return {
      notes: preparationNotes,
      items: preparationSidebar.items.map((item) => ({
        source_name: item.source_name || item.medicine_name,
        medicine_name: item.medicine_name,
        dosage: item.dosage || '',
        quantity: item.quantity,
        inventory_sku: item.inventory_sku || '',
        unit_price: item.unit_price,
        notes: item.notes || '',
        sort_order: item.sort_order,
      })),
    };
  };

  const persistPreparation = async () => {
    if (!selectedPrescription || !preparationSidebar) {
      throw new Error('Open a prescription first.');
    }
    if (!preparationSidebar.items.length) {
      throw new Error('Add at least one medicine before continuing.');
    }

    const payload = buildPreparationRequestPayload();
    const response = await finalizePrescriptionPreparation(String(selectedPrescription.id), payload || {});
    const normalizedPreparation = normalizePreparation(response);
    const [, refreshedInvoices] = await Promise.all([load(), refreshInvoiceData()]);

    if (normalizedPreparation?.invoice?.id) {
      const invoiceId = String(normalizedPreparation.invoice.id);
      const matchedInvoice = (refreshedInvoices || []).find((entry) => String(entry.id) === invoiceId) || null;
      if (matchedInvoice) {
        setSelectedInvoice(matchedInvoice);
        resetInvoiceFilters();
      } else {
        setSelectedInvoice({
          id: invoiceId,
          patient: selectedPrescription.patientName,
          amount: normalizedPreparation.invoice.amount || normalizedPreparation.summary.total_amount || 0,
          status: normalizedPreparation.invoice.status || 'Pending',
          date: new Date().toISOString().slice(0, 10),
          orderId: normalizedPreparation.order_id || '',
        });
        resetInvoiceFilters();
      }
    }

    syncPreparationSidebar(response, selectedPrescription);
    setSelectedPrescription((current) =>
      current
        ? {
            ...current,
            status: normalizedPreparation?.order_status || 'Ready',
            invoiceId: normalizedPreparation?.invoice?.id || current.invoiceId || '',
            invoiceStatus: normalizedPreparation?.invoice?.status || current.invoiceStatus || '',
          }
        : current
    );

    return normalizedPreparation;
  };

  const handlePreparationDone = async () => {
    if (!selectedPrescription || !preparationSidebar) {
      setNotice('Open a prescription first.');
      setNoticeTone('warning');
      return;
    }
    if (!preparationSidebar.items.length) {
      setNotice('Add at least one medicine before finishing preparation.');
      setNoticeTone('warning');
      return;
    }
    const hasStockIssue = preparationSidebar.items.some(
      (item) => !item.in_stock || Number(item.available_quantity || 0) < Number(item.quantity || 0)
    );
    if (hasStockIssue) {
      setNotice('Cannot finish preparation while one or more medicines are out of stock.');
      setNoticeTone('warning');
      return;
    }
    setPreparationSaving(true);
    try {
      const normalizedPreparation = await persistPreparation();
      setPreparationDrafts((prev) => {
        const next = { ...prev };
        delete next[String(selectedPrescription.id)];
        return next;
      });
      setNotice(
        normalizedPreparation?.summary?.missing_items_count
          ? 'Prescription prepared. The invoice is linked to this same prescription, with missing medicines kept in the sidebar summary.'
          : 'Prescription prepared and invoice linked to this prescription.'
      );
      setNoticeTone('success');
      if (onSectionChange) onSectionChange('Invoices');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to finish prescription preparation.'));
      setNoticeTone('warning');
    } finally {
      setPreparationSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedPrescription || !preparationSidebar) return;
    if (preparationAutosaveTimerRef.current) {
      clearTimeout(preparationAutosaveTimerRef.current);
    }
    setPreparationAutosaveStatus('saving');
    preparationAutosaveTimerRef.current = setTimeout(() => {
      savePreparationDraft(String(selectedPrescription.id), preparationNotes, preparationSidebar.items);
      setPreparationAutosaveStatus('saved');
    }, 600);

    return () => {
      if (preparationAutosaveTimerRef.current) {
        clearTimeout(preparationAutosaveTimerRef.current);
      }
    };
  }, [selectedPrescription, preparationNotes, preparationSidebar?.items]);

  const handlePrescriptionInvoice = async (row) => {
    try {
      let invoiceId = String(row?.invoiceId || selectedPrescription?.invoiceId || '');
      const shouldUseCurrentPreparation =
        selectedPrescription &&
        preparationSidebar &&
        String(selectedPrescription.id) === String(row?.id || selectedPrescription.id);

      if (shouldUseCurrentPreparation) {
        const normalizedPreparation = await persistPreparation();
        invoiceId = String(normalizedPreparation?.invoice?.id || invoiceId || '');
      }

      if (!invoiceId) {
        setNotice('Finish preparation first, then the invoice will be linked to this prescription.');
        setNoticeTone('warning');
        return;
      }

      const refreshedInvoices = await refreshInvoiceData();
      const matchedInvoice =
        (refreshedInvoices || []).find((entry) => String(entry.id) === invoiceId) ||
        invoices.find((entry) => String(entry.id) === invoiceId) ||
        null;

      if (!matchedInvoice) {
        setNotice(`Invoice ${invoiceId} is linked, but it is not loaded yet.`);
        setNoticeTone('warning');
        return;
      }

      handleInvoiceView(matchedInvoice);
      if (onSectionChange) onSectionChange('Invoices');
      setNotice(`Invoice ${invoiceId} is ready to print or save.`);
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to open the invoice linked to this prescription.'));
      setNoticeTone('warning');
    }
  };

  const handleAdvanceStatus = async (order) => {
    if (order.status === 'Dispensed') return;
    const newStatus = nextStatus(order.status);
    try {
      await updatePharmacyOrder(order.id, { status: newStatus });
      await load();
      setNotice(`Order ${order.id} moved to ${newStatus}.`);
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to update order status.'));
      setNoticeTone('warning');
    }
  };

  const handleSimulateSync = async () => {
    await load();
    setSyncCount((prev) => prev + 1);
    setNotice('Backend sync complete.');
    setNoticeTone('success');
  };

  const handlePatientAdd = async () => {
    if (!patientName.trim()) {
      setNotice('Patient name is required.');
      setNoticeTone('warning');
      return;
    }
    try {
      await createPatient({
        name: patientName.trim(),
        phone: patientPhone.trim(),
        age: Number.parseInt(patientAge, 10) || null,
        allergies: patientAllergy.trim(),
        chronic: patientChronic.trim(),
        history: patientHistory.trim(),
      });
      await load();
      setPatientName('');
      setPatientPhone('');
      setPatientAge('');
      setPatientAllergy('');
      setPatientChronic('');
      setPatientHistory('');
      setNotice('Patient record created.');
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to create patient record.'));
      setNoticeTone('warning');
    }
  };

  const handlePatientDelete = async (item) => {
    try {
      await deletePatient(String(item.id));
      await load();
      setNotice(`Patient ${item.name} removed.`);
      setNoticeTone('success');
    } catch (err) {
      setNotice(getApiErrorMessage(err, 'Unable to remove patient.'));
      setNoticeTone('warning');
    }
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) => (entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price || 0, qty: 1 }];
    });
  };

  const handleScanAdd = () => {
    if (!scanBarcode.trim()) return;
    const match = inventory.find((item) => item.barcode === scanBarcode.trim());
    if (!match) {
      setNotice('Barcode not found in inventory.');
      setNoticeTone('warning');
      return;
    }
    addToCart(match);
    setScanBarcode('');
  };

  const handleImportPrescriptionQr = async () => {
    try {
      const payload = parseQrPrescriptionPayload(scanPrescriptionQrText);
      const meds = Array.isArray(payload.meds) ? payload.meds : [];
      const patientName = payload.patientName;
      const doctorName = payload.doctorName;
      const diagnosis = payload.diagnosis;

      const medSummary = meds
        .map((m: any) => `${String(m?.name || '').trim()}${m?.duration ? ` (${String(m.duration).trim()})` : ''}`)
        .filter(Boolean)
        .join(', ');

      await createPrescription({
        patient: patientName,
        diagnosis: diagnosis || 'Imported from patient QR prescription',
        medication: medSummary.slice(0, 120) || 'Prescription medicines',
        dosage: 'See notes',
        notes: `Imported from QR | Doctor: ${doctorName} | Full QR meds: ${JSON.stringify(meds)}`.slice(0, 4000),
      });

      await load();
      setScanPrescriptionQrText('');
      setNotice('QR prescription imported to queue.');
      setNoticeTone('success');
      return true;
    } catch (err: any) {
      setNotice(err?.message || getApiErrorMessage(err, 'Unable to import QR prescription.'));
      setNoticeTone('warning');
      return false;
    }
  };

  const handleSaveCloseAndNextScan = async () => {
    const hasPayload = Boolean(scanPrescriptionQrText.trim());
    if (hasPayload) {
      const ok = await handleImportPrescriptionQr();
      if (!ok) return;
    }
    setShowQrRaw(false);
    setLastScanPreview('');
    setCameraScanned(false);
    setShowQrScannerPanel(false);
    setNotice('Prescription closed. Ready for next patient scan.');
    setNoticeTone('success');
  };

  const handleCameraQrScanned = ({ data }: { data: string }) => {
    if (cameraScanned) return;
    setCameraScanned(true);
    const next = String(data || '');
    setScanPrescriptionQrText(next);
    setLastScanPreview(next.slice(0, 120));
    setNotice('QR detected. Importing prescription...');
    setNoticeTone('info');
    setTimeout(() => {
      handleImportPrescriptionQr();
    }, 0);
  };

  useEffect(() => {
    if (showQrScannerPanel) {
      setCameraScanned(false);
      setLastScanPreview('');
    }
  }, [showQrScannerPanel]);

  const updateCartQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((entry) => (entry.id === id ? { ...entry, qty: Math.max(1, entry.qty + delta) } : entry))
        .filter((entry) => entry.qty > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((entry) => entry.id !== id));
  };

  const resolveCheckoutPatientValue = () => {
    const rawName = posPatient.trim();
    const rawId = posPatientId.trim();

    if (/^\d+$/.test(rawId)) {
      return rawId;
    }

    if (rawName) {
      const matchedByName = patients.find(
        (item) => String(item?.name || '').trim().toLowerCase() === rawName.toLowerCase()
      );
      if (matchedByName?.id) {
        return String(matchedByName.id);
      }
      return rawName;
    }

    if (rawId) {
      const matchedById = patients.find((item) => String(item?.id || '') === rawId);
      if (matchedById?.id) {
        return String(matchedById.id);
      }
    }

    if (selectedPatient?.id) {
      return String(selectedPatient.id);
    }

    if (selectedPrescription?.patientName) {
      const matchFromPrescription = patients.find(
        (item) =>
          String(item?.name || '').trim().toLowerCase() === String(selectedPrescription.patientName).trim().toLowerCase()
      );
      if (matchFromPrescription?.id) {
        return String(matchFromPrescription.id);
      }
      return String(selectedPrescription.patientName).trim();
    }

    if (selectedInvoice?.patient) {
      return String(selectedInvoice.patient).trim();
    }

    return '';
  };

  const nextReceiptCode = (current: string) => {
    const value = String(current || '').trim();
    const match = value.match(/^(.*?)(\d+)$/);
    if (!match) return `RCPT-${Date.now()}`;
    const [, prefix, digits] = match;
    const next = String(Number.parseInt(digits, 10) + 1).padStart(digits.length, '0');
    return `${prefix}${next}`;
  };

  const handleStartNewInvoice = () => {
    setSelectedInvoice(null);
    setCart([]);
    setScanBarcode('');
    setPosPatient('');
    setPosPatientId('');
    setPosPatientPhone('');
    setPaymentMethod('Cash');
    setReceiptNo((prev) => nextReceiptCode(prev));
    if (onScrollTo) onScrollTo(0);
    setNotice('New invoice draft is ready. Add items and patient details, then click Generate Invoice in Checkout.');
    setNoticeTone('info');
  };

  const handleRefreshInvoices = async () => {
    await load();
    setNotice('Invoices refreshed from backend.');
    setNoticeTone('success');
  };

  const handlePrintReceipt = () => {
    const content = [
      'Pharmacy Receipt',
      `Receipt No: ${receiptNo}`,
      `Cashier: ${cashierName}`,
      `Shift: ${shiftId}`,
      `Patient: ${posPatient || posPatientId || 'N/A'}`,
      `Items: ${cart.length}`,
      `Subtotal: EGP ${subtotal.toFixed(2)}`,
      `VAT: EGP ${vat.toFixed(2)}`,
      `Discount: EGP ${discountValue.toFixed(2)}`,
      `Total: EGP ${total.toFixed(2)}`,
      `Payment: ${paymentMethod}`,
      `Time: ${new Date().toLocaleString()}`,
    ].join('\n');

    const filename = `receipt-${String(receiptNo || Date.now()).replace(/\s+/g, '-')}.txt`;
    const downloaded = downloadTextFile(filename, content);
    if (!downloaded) {
      setNotice(`Receipt ${receiptNo} is ready to print.`);
      setNoticeTone('info');
      return;
    }
    setNotice(`Receipt exported as ${filename}.`);
    setNoticeTone('success');
  };

  const handleCheckout = async () => {
    const patientValue = resolveCheckoutPatientValue();
    if (!patientValue) {
      setNotice('Select a patient before checkout.');
      setNoticeTone('warning');
      return;
    }
    const preparationTotal = Number(preparationSidebar?.summary?.total_amount ?? 0);
    const invoiceAmount = cart.length ? total : Math.max(0, preparationTotal);

    let savedInvoice: InvoiceItem | null = null;
    try {
      const savedResponse = await createInvoice({
        patient: patientValue,
        amount: invoiceAmount,
        status: paymentMethod === 'Cash' ? 'Paid' : 'Pending',
      });
      savedInvoice = normalizeInvoiceItem(savedResponse);
      if (savedInvoice) {
        setInvoices((prev) => upsertInvoiceItem(prev, savedInvoice as InvoiceItem));
        setSelectedInvoice(savedInvoice);
        resetInvoiceFilters();
      }
      await refreshInvoiceData();
      if (cart.length) {
        setNotice('Invoice generated and synced.');
      } else {
        setNotice('Invoice generated (manual mode) and synced.');
      }
      setNoticeTone('success');
    } catch (err) {
      if (savedInvoice) {
        setCart([]);
        setPosPatient('');
        setPosPatientId('');
        setPosPatientPhone('');
        setNotice('Invoice saved. Invoice panel refresh is still syncing.');
        setNoticeTone('warning');
        return;
      }
      setNotice(getApiErrorMessage(err, 'Unable to generate invoice.'));
      setNoticeTone('warning');
      return;
    }
    setCart([]);
    setPosPatient('');
    setPosPatientId('');
    setPosPatientPhone('');
  };

  const handleInvoiceView = (invoice: InvoiceItem) => {
    setSelectedInvoice(invoice);
    resetInvoiceFilters();
    setNotice(`Invoice ${invoice.id} selected.`);
    setNoticeTone('info');
  };

  const handleInvoiceRefund = async (invoice: InvoiceItem) => {
    if (invoice.status === 'Refunded') {
      setNotice(`Invoice ${invoice.id} is already refunded.`);
      setNoticeTone('info');
      return;
    }

    let refundedInvoice: InvoiceItem | null = null;
    try {
      const savedResponse = await updateInvoice(invoice.id, { status: 'Refunded' });
      refundedInvoice = normalizeInvoiceItem(savedResponse);
      if (refundedInvoice) {
        setInvoices((prev) => upsertInvoiceItem(prev, refundedInvoice as InvoiceItem));
        setSelectedInvoice(refundedInvoice);
        resetInvoiceFilters();
      }
      await refreshInvoiceData();
      setNotice(`Invoice ${invoice.id} refunded.`);
      setNoticeTone('success');
    } catch (err) {
      if (refundedInvoice) {
        setNotice(`Invoice ${invoice.id} refunded. Invoice panel refresh is still syncing.`);
        setNoticeTone('warning');
        return;
      }
      setNotice(getApiErrorMessage(err, `Unable to refund invoice ${invoice.id}.`));
      setNoticeTone('warning');
    }
  };

  const buildInvoiceDocument = (invoice: InvoiceItem) => {
    const amount = Number(invoice.amount || 0).toFixed(2);
    return [
      'Pharmacy Invoice',
      `Invoice ID: ${invoice.id}`,
      `Patient: ${invoice.patient}`,
      `Amount: EGP ${amount}`,
      `Status: ${invoice.status}`,
      `Date: ${invoice.date}`,
      '',
      `Generated: ${new Date().toLocaleString()}`,
    ].join('\n');
  };

  const handleInvoicePrint = (invoice: InvoiceItem) => {
    if (typeof window === 'undefined') {
      setNotice(`Invoice ${invoice.id} is ready for printing.`);
      setNoticeTone('info');
      return;
    }

    const amount = Number(invoice.amount || 0).toFixed(2);
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=720,height=840');
    if (!printWindow) {
      setNotice('Popup blocked. Please allow popups to print invoices.');
      setNoticeTone('warning');
      return;
    }

    const html = `
      <html>
        <head>
          <title>Invoice ${invoice.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0b1b2a; }
            h1 { margin: 0 0 12px; font-size: 24px; }
            .row { margin: 8px 0; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>Pharmacy Invoice</h1>
          <div class="row"><strong>Invoice:</strong> ${invoice.id}</div>
          <div class="row"><strong>Patient:</strong> ${invoice.patient}</div>
          <div class="row"><strong>Amount:</strong> EGP ${amount}</div>
          <div class="row"><strong>Status:</strong> ${invoice.status}</div>
          <div class="row"><strong>Date:</strong> ${invoice.date}</div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setNotice(`Invoice ${invoice.id} sent to printer.`);
    setNoticeTone('success');
  };

  const handleInvoiceSave = (invoice: InvoiceItem) => {
    const content = buildInvoiceDocument(invoice);
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      setNotice(`Invoice ${invoice.id} ready to save.`);
      setNoticeTone('info');
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoice.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice(`Invoice ${invoice.id} downloaded.`);
    setNoticeTone('success');
  };

  const downloadTextFile = (filename: string, content: string, mimeType = 'text/plain;charset=utf-8') => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  };

  const handleInvoiceExportCsv = () => {
    if (!filteredInvoices.length) {
      setNotice('No invoices to export for the current filter.');
      setNoticeTone('warning');
      return;
    }

    const escapeCsv = (value: unknown) => {
      const text = String(value ?? '');
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const rows = filteredInvoices.map((invoice) => [
      invoice.id,
      invoice.patient,
      Number(invoice.amount || 0).toFixed(2),
      invoice.status,
      invoice.date,
      invoice.orderId || '',
    ]);

    const csv = [
      ['Invoice ID', 'Patient', 'Amount', 'Status', 'Date', 'Order ID'],
      ...rows,
    ]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `invoices-${stamp}.csv`;
    const downloaded = downloadTextFile(filename, csv, 'text/csv;charset=utf-8');

    setNotice(downloaded ? `Exported ${filteredInvoices.length} invoice(s) to ${filename}.` : 'CSV prepared. Please retry in web mode.');
    setNoticeTone(downloaded ? 'success' : 'warning');
  };

  const handleInvoiceSendReminders = () => {
    const reminderTargets = filteredInvoices.filter((invoice) => {
      const status = String(invoice.status || '').toLowerCase();
      return status === 'pending' || status === 'overdue';
    });

    if (!reminderTargets.length) {
      setNotice('No pending or overdue invoices found for reminders.');
      setNoticeTone('info');
      return;
    }

    const timestamp = new Date().toLocaleString();
    const reminderLog = reminderTargets
      .map(
        (invoice) =>
          `${timestamp} | Invoice ${invoice.id} | Patient: ${invoice.patient} | Amount: EGP ${Number(invoice.amount || 0).toFixed(2)} | Status: ${invoice.status}`
      )
      .join('\n');

    const filename = `payment-reminders-${new Date().toISOString().slice(0, 10)}.txt`;
    downloadTextFile(filename, reminderLog);
    setNotice(`Reminders queued for ${reminderTargets.length} invoice(s). Log downloaded as ${filename}.`);
    setNoticeTone('success');
  };

  const isTableCardCollapsed = (id: string) => openTableCard !== id;
  const toggleTableCard = (id: string) => {
    setOpenTableCard((prev) => (prev === id ? null : id));
  };
  const isQuickActionCollapsed = (id: string) => openQuickAction !== id;
  const toggleQuickAction = (id: string) => {
    setOpenQuickAction((prev) => (prev === id ? null : id));
  };

  const filteredOrders = orders.filter((item) =>
    `${item.id} ${item.patient} ${item.meds} ${item.status}`.toLowerCase().includes(orderSearch.toLowerCase())
  );
  const today = new Date().toISOString().slice(0, 10);
  const isWithinWeek = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return false;
    const diffDays = Math.ceil((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };
  const inventoryExpiring = inventory.filter((item) => {
    if (!item.expiry || item.expiry === 'N/A') return false;
    const days = daysUntil(item.expiry);
    return days !== null && days <= 30;
  });
  const inventoryCategories = Array.from(new Set(inventory.map((item) => item.category || inferCategory(item.name))));
  const inventorySuppliers = Array.from(new Set(inventory.map((item) => item.supplier || 'N/A')));
  const filteredInventory = inventory.filter((item) => {
    const searchMatch = `${item.id} ${item.name}`.toLowerCase().includes(inventorySearch.toLowerCase());
    const category = item.category || inferCategory(item.name);
    const categoryMatch = inventoryCategoryFilter === 'All' || category === inventoryCategoryFilter;
    const supplier = item.supplier || 'N/A';
    const supplierMatch = inventorySupplierFilter === 'All' || supplier === inventorySupplierFilter;
    return searchMatch && categoryMatch && supplierMatch;
  });

  const filteredPrescriptions = prescriptions.filter((item) => {
    const searchTarget = `${item.id} ${item.patientName} ${item.doctor} ${item.meds} ${item.status}`.toLowerCase();
    const matchesSearch = searchTarget.includes(prescSearch.toLowerCase());
    const matchesDoctor = prescDoctorFilter ? item.doctor.toLowerCase().includes(prescDoctorFilter.toLowerCase()) : true;
    const matchesPatient = prescPatientFilter ? item.patientName.toLowerCase().includes(prescPatientFilter.toLowerCase()) : true;
    const matchesStatus = prescStatusFilter ? item.status.toLowerCase().includes(prescStatusFilter.toLowerCase()) : true;
    const matchesRange = prescRange === 'All'
      ? true
      : prescRange === 'Today'
      ? item.date === today
      : isWithinWeek(item.date);
    return matchesSearch && matchesDoctor && matchesPatient && matchesStatus && matchesRange;
  });
  const inventoryByMedicine = useMemo(
    () =>
      inventory.reduce((acc, item) => {
        const key = normalizeMedicineKey(item.name);
        if (!key || acc[key]) return acc;
        acc[key] = item;
        return acc;
      }, {} as Record<string, InventoryItem>),
    [inventory]
  );
  const prescriptionRows = filteredPrescriptions.map((item) => {
    const medicineNames = Array.isArray(item.medList) && item.medList.length ? item.medList : parseMedicineEntries(item.meds);
    const matchedMedicines = medicineNames.map((medicineName) => {
      const key = normalizeMedicineKey(medicineName);
      const inventoryItem =
        inventoryByMedicine[key] ||
        inventory.find((stockItem) => {
          const stockKey = normalizeMedicineKey(stockItem.name);
          return stockKey === key || stockKey.includes(key) || key.includes(stockKey);
        }) ||
        null;
      return {
        medicineName,
        inventoryItem,
      };
    });
    const availableMatches = matchedMedicines.filter((entry) => entry.inventoryItem && Number(entry.inventoryItem.stock || 0) > 0);
    const missingMatches = matchedMedicines.filter((entry) => !entry.inventoryItem || Number(entry.inventoryItem.stock || 0) <= 0);
    const stock = availableMatches.reduce((sum, entry) => sum + Number(entry.inventoryItem?.stock ?? 0), 0);
    const unitPrice = availableMatches.reduce((sum, entry) => sum + Number(entry.inventoryItem?.price ?? 0), 0);
    const inStock = missingMatches.length === 0 && matchedMedicines.length > 0;
    const stockLabel = matchedMedicines.length > 1
      ? `${availableMatches.length}/${matchedMedicines.length} available`
      : inStock
      ? `${stock} in stock`
      : 'Out of stock';
    return {
      ...item,
      stock,
      unitPrice,
      inventorySku: availableMatches[0]?.inventoryItem?.id || '',
      inStock,
      stockLabel,
      availableMedicines: availableMatches.length,
      totalMedicines: matchedMedicines.length,
    };
  });
  const prescTotal = prescriptions.length;
  const prescControlledCount = prescriptions.filter((item) => item.controlled).length;
  const prescReady = prescriptions.filter((item) => item.status === 'Ready').length;
  const prescInProgress = prescriptions.filter((item) =>
    item.status === 'Received' || item.status === 'Validated' || item.status === 'Preparing'
  ).length;
  const prescOutOfStock = prescriptionRows.filter((item) => !item.inStock).length;
  const prescSummary: Array<{ label: string; value: string; hint: string; tone: StatTone }> = [
    { label: 'Total Prescriptions', value: String(prescTotal), hint: 'All time', tone: 'info' },
    { label: 'In Progress', value: String(prescInProgress), hint: 'Needs processing', tone: 'warning' },
    { label: 'Ready', value: String(prescReady), hint: 'Pickup queue', tone: 'alert' },
    { label: 'Controlled', value: String(prescControlledCount), hint: 'Requires log', tone: 'default' },
    { label: 'Out of Stock', value: String(prescOutOfStock), hint: 'Needs replenishment', tone: 'alert' },
  ];

  const filteredPatients = patients.filter((item) =>
    `${item.id} ${item.name} ${item.phone} ${item.allergies}`.toLowerCase().includes(patientSearch.toLowerCase())
  );
  const filteredPreparationInventory = inventory
    .filter((item) =>
      `${item.id} ${item.name} ${item.category || ''} ${item.supplier || ''}`
        .toLowerCase()
        .includes(preparationInventorySearch.toLowerCase())
    )
    .slice(0, 8);

  const filteredInvoices = invoices.filter((item) =>
    `${item.id} ${item.patient} ${item.status}`.toLowerCase().includes(invoiceSearch.toLowerCase())
  );
  const invoicePaid = invoices.filter((item) => item.status === 'Paid').length;
  const invoicePending = invoices.filter((item) => item.status === 'Pending').length;
  const invoiceOverdue = invoices.filter((item) => item.status === 'Overdue').length;
  const invoiceTotal = invoices.length;
  const invoiceSummary: Array<{ label: string; value: string; hint: string; tone: StatTone }> = [
    { label: 'Total Invoices', value: String(invoiceTotal), hint: 'All time', tone: 'info' },
    { label: 'Paid', value: String(invoicePaid), hint: 'Completed', tone: 'default' },
    { label: 'Pending', value: String(invoicePending), hint: 'Awaiting', tone: 'warning' },
    { label: 'Overdue', value: String(invoiceOverdue), hint: 'Follow up', tone: 'alert' },
  ];

  const lastVisitMap = prescriptions.reduce((acc, item) => {
    if (!acc[item.patient] || acc[item.patient] < item.date) {
      acc[item.patient] = item.date;
    }
    return acc;
  }, {});

  const patientsWithVisit = filteredPatients.map((item) => ({
    ...item,
    lastVisit: lastVisitMap[item.id] || '-',
  }));
  const patientProfilePrescriptions = selectedPatient
    ? prescriptions.filter((item) => item.patient === selectedPatient.id)
    : [];

  const prepQueueRows = (prepQueue.length ? prepQueue : orders)
    .filter((item) => item.status !== 'Dispensed')
    .map((item) => ({
      id: item.id,
      patient: item.patient,
      meds: item.meds,
      quantity: item.quantity || 1,
      status: item.status || 'Waiting',
      priority: item.priority || (item.status === 'Ready' ? 'Normal' : 'High'),
      eta: item.eta || (item.status === 'Ready' ? '0 min' : '15 min'),
      receivedAt: item.time || '09:40',
    }));
  const summaryCards = useMemo(
    () => [
      { label: 'Pending Prescriptions', value: String(pendingPrescriptions), hint: 'Waiting + preparing' },
      { label: 'Medicines In Stock', value: String(totalStock), hint: 'Total units available' },
      { label: 'Low Stock Drugs', value: String(lowStockAlerts.length), hint: 'Needs reorder' },
      { label: 'Ready for Pickup', value: String(readyForPickup), hint: 'Prepared orders' },
    ],
    [
      readyForPickup,
      totalStock,
      lowStockAlerts.length,
      pendingPrescriptions,
    ]
  );

  const recentDispensedRows = recentDispensed.length
    ? recentDispensed
    : [
        { patient: 'Ahmed Ali', drug: 'Amoxicillin', quantity: 10, time: '11:10' },
        { patient: 'Mona Hassan', drug: 'Paracetamol', quantity: 5, time: '11:15' },
      ];

  const avgPrepTime = prepQueueRows.length ? Math.round(10 + prepQueueRows.length * 1.5) : 10;
  const topDispensed = recentDispensedRows.length
    ? recentDispensedRows.slice(0, 3).map((item) => item.drug).join(', ')
    : '';

  const posInventory = inventory.filter((item) =>
    `${item.name} ${item.id}`.toLowerCase().includes(posSearch.toLowerCase())
  );
  const coverage = useMemo(
    () => ({
      status: 'Verified',
      provider: 'NileCare',
      memberId: posPatientId || 'PT-001',
      plan: 'Clinic Standard',
      policy: 'POL-2210',
      copay: '35.00',
      lastChecked: 'Today 10:12',
    }),
    [posPatientId]
  );

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountValue = Number(coverage.copay) || 0;
  const vat = subtotal * 0.14;
  const total = Math.max(0, subtotal + vat - discountValue);

  const filteredNotifications = allNotifications.filter((note) => {
    if (inboxFilter === 'All') return true;
    if (inboxFilter === 'Unread') return note.status === 'Unread';
    if (inboxFilter === 'Alert') return note.status === 'Alert' || note.type === 'Alert';
    return note.status === inboxFilter;
  }).filter((note) => {
    if (!inboxSearch.trim()) return true;
    const query = inboxSearch.toLowerCase();
    return `${note.message} ${note.related || ''}`.toLowerCase().includes(query);
  });

  const filteredPrepQueue = prepQueueRows.filter((item) => {
    if (prepFilter === 'All') return true;
    return (item.status || 'Waiting') === prepFilter;
  });
  const unreadNotifications = allNotifications.filter((note) =>
    note.status === 'Unread' || note.status === 'Alert' || note.type === 'Alert'
  ).length;
  const pendingRequests = inbox.filter((item) => item.status !== 'Dispensed');

  const showDashboard = activeSection === 'Dashboard';
  const inventoryTotalSkus = inventory.length;
  const inventoryTotalUnits = inventory.reduce((sum, item) => sum + (item.stock || 0), 0);
  const inventoryExpiringCount = inventoryExpiring.length;
  const inventoryLowStockCount = lowStockAlerts.length;
  const inventorySummary = [
    { label: 'Total SKUs', value: String(inventoryTotalSkus), hint: 'Active items' },
    { label: 'Total Units', value: String(inventoryTotalUnits), hint: 'Stock on hand' },
    { label: 'Low Stock', value: String(inventoryLowStockCount), hint: 'Needs reorder' },
    { label: 'Expiring Soon', value: String(inventoryExpiringCount), hint: 'Next 30 days' },
  ];
  const reorderRows = lowStockAlerts.map((item) => ({
    name: item.name,
    stock: item.stock,
    threshold: item.threshold,
    suggested: Math.max(0, (item.threshold || 0) * 2 - (item.stock || 0)),
    supplier: item.supplier || 'N/A',
  }));
  const inventoryActivityRows = [
    { time: 'Today 09:20', item: 'Amoxicillin 500mg', change: '-10', reason: 'Dispensed', user: 'Pharmacist' },
    { time: 'Today 09:45', item: 'Metformin 850mg', change: '+50', reason: 'Restock', user: 'Supply' },
    { time: 'Today 10:05', item: 'Paracetamol 500mg', change: '-5', reason: 'Clinic request', user: 'Pharmacy' },
    { time: 'Today 10:30', item: 'Omeprazole 20mg', change: '-2', reason: 'Dispensed', user: 'Pharmacist' },
    { time: 'Today 11:00', item: 'Vitamin D', change: '-1', reason: 'Expiry write-off', user: 'Inventory' },
  ];
  const inboxTotal = allNotifications.length;
  const inboxUnread = allNotifications.filter((note) => note.status === 'Unread').length;
  const inboxAlerts = allNotifications.filter((note) => note.status === 'Alert' || note.type === 'Alert').length;
  const inboxSummary: Array<{ label: string; value: string; hint: string; tone: StatTone }> = [
    { label: 'Total Messages', value: String(inboxTotal), hint: 'All notifications', tone: 'info' },
    { label: 'Unread', value: String(inboxUnread), hint: 'Needs review', tone: 'warning' },
    { label: 'Alerts', value: String(inboxAlerts), hint: 'Requires action', tone: 'alert' },
  ];

  const showInbox = activeSection === 'Inbox';
  const showPrep = activeSection === 'Prep Queue';
  const showPrescriptions = activeSection === 'Prescriptions';
  const showPatients = activeSection === 'Patients';
  const showOrders = activeSection === 'Orders';
  const showInventory = activeSection === 'Inventory';
  const showBillingWorkspace = activeSection === 'Invoices';
  const prepWaiting = prepQueueRows.filter((item) => item.status === 'Waiting').length;
  const prepPreparing = prepQueueRows.filter((item) => item.status === 'Preparing').length;
  const prepReady = prepQueueRows.filter((item) => item.status === 'Ready').length;
  const prepSummary: Array<{ label: string; value: string; hint: string; tone: StatTone }> = [
    { label: 'Waiting', value: String(prepWaiting), hint: 'Not started', tone: 'warning' },
    { label: 'Preparing', value: String(prepPreparing), hint: 'In progress', tone: 'info' },
    { label: 'Ready', value: String(prepReady), hint: 'Pickup queue', tone: 'alert' },
  ];



  return (
    <View style={styles.scrollContainer}>
      <View style={styles.inboxFloatingWrap}>
        <TouchableOpacity
          style={styles.inboxFloatingButton}
          onPress={() => setShowNotificationDrawer((prev) => !prev)}
          accessibilityLabel="Open notifications"
        >
          <Text style={styles.inboxFloatingIcon}>✉️</Text>
          {unreadNotifications > 0 ? (
            <View style={styles.inboxFloatingBadge}>
              <Text style={styles.inboxFloatingBadgeText}>{unreadNotifications}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {showNotificationDrawer ? (
        <Card variant="soft" style={styles.notificationDrawer}>
          <View style={styles.notificationDrawerHeader}>
            <Text style={styles.formTitle}>Notifications</Text>
            <SecondaryButton label="Close" onPress={() => setShowNotificationDrawer(false)} />
          </View>
          <InputField
            label="Search"
            placeholder="Search message or reference"
            value={inboxSearch}
            onChangeText={setInboxSearch}
          />
          <View style={styles.filterRow}>
            <SegmentedControl options={['All', 'Unread', 'Alert']} value={inboxFilter} onChange={setInboxFilter} />
          </View>

          <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={true}>
            <Text style={styles.drawerSectionTitle}>Requests</Text>
            {pendingRequests.length ? (
              pendingRequests.slice(0, 8).map((item) => (
                <View key={item.id} style={styles.drawerRow}>
                  <View style={styles.drawerTextBlock}>
                    <Text style={styles.alertName}>{item.patient}</Text>
                    <Text style={styles.alertMeta}>{item.meds} - {item.status}</Text>
                  </View>
                  <SecondaryButton
                    label="Open"
                    onPress={() => {
                      if (onSectionChange) onSectionChange('Prep Queue');
                      setShowNotificationDrawer(false);
                    }}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.noteMeta}>No pending requests.</Text>
            )}

            <Text style={styles.drawerSectionTitle}>Alerts and Updates</Text>
            {filteredNotifications.length ? (
              filteredNotifications.slice(0, 10).map((note) => (
                <View key={note.id} style={styles.drawerRow}>
                  <View style={styles.drawerTextBlock}>
                    <Text style={styles.alertName}>{note.message}</Text>
                    <Text style={styles.alertMeta}>{note.time} - {note.status}</Text>
                  </View>
                  <View style={styles.inlineActions}>
                    <SecondaryButton label="Read" onPress={() => markNotificationRead(note)} />
                    <SecondaryButton 
                      label="Go" 
                      onPress={() => {
                        markNotificationRead(note);
                        if (onSectionChange && note.page) onSectionChange(note.page);
                        setShowNotificationDrawer(false);
                      }} 
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noteMeta}>No alerts yet.</Text>
            )}
          </ScrollView>
        </Card>
      ) : null}

      {showDashboard ? (
        <View style={styles.dashboardHeader}>
          <View style={styles.dashboardHeaderText}>
            <Text style={styles.dashboardTitle}>Pharmacy Dashboard</Text>
          </View>
          <View style={styles.dashboardActions}>
            <SecondaryButton label="Sync Now" onPress={handleSimulateSync} />
            <SecondaryButton
              label="Open Invoices"
              onPress={() => {
                if (onSectionChange) onSectionChange('Invoices');
                toast('Opened invoices workspace.');
              }}
            />
          </View>
        </View>
      ) : null}

      {showDashboard ? (
        <View style={styles.row}>
          {summaryCards.map((item) => (
            <StatCard key={item.label} {...item} variant="alt" />
          ))}
        </View>
      ) : null}

      {showDashboard ? (
        <Section title="Incoming Prescriptions" action={<SecondaryButton label="Sync Now" onPress={handleSimulateSync} />}>
          <Card variant="soft" style={styles.sectionCard} title="Scan Patient QR Prescription">
            <View style={styles.buttonRow}>
              <SecondaryButton
                label={showQrScannerPanel ? 'Close Scan Prescription QR Page' : 'Open In-App Scanner'}
                onPress={() => setShowQrScannerPanel((prev) => !prev)}
              />
            </View>
            {showQrScannerPanel ? (
              <View style={styles.qrScannerPanel}>
                <Text style={styles.qrScannerTitle}>Scan Prescription QR Page</Text>
                {cameraPermission?.granted ? (
                  <>
                    <View style={styles.qrCameraFrame}>
                      <CameraView
                        style={styles.qrCamera}
                        facing={cameraFacing}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={cameraScanned ? undefined : handleCameraQrScanned}
                      />
                    </View>
                    <View style={styles.buttonRow}>
                      <SecondaryButton label="Scan Again" onPress={() => setCameraScanned(false)} />
                      <SecondaryButton
                        label={cameraFacing === 'back' ? 'Use Front Camera' : 'Use Back Camera'}
                        onPress={() => {
                          setCameraScanned(false);
                          setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'));
                        }}
                      />
                    </View>
                    {lastScanPreview ? (
                      <Text style={styles.noteMeta}>Last scan: {lastScanPreview}...</Text>
                    ) : (
                      <Text style={styles.noteMeta}>Point camera at patient QR. Keep steady for 1-2 seconds.</Text>
                    )}
                  </>
                ) : (
                  <View style={styles.buttonRow}>
                    <SecondaryButton label="Allow Camera" onPress={requestCameraPermission} />
                  </View>
                )}
                {qrPrescriptionPreview ? (
                  <View style={styles.qrPrescriptionPreview}>
                    <View style={styles.qrPreviewHeader}>
                      <View>
                        <Text style={styles.qrClinicName}>{qrPrescriptionPreview.clinicName}</Text>
                        <Text style={styles.qrDoctorName}>{qrPrescriptionPreview.doctorName}</Text>
                      </View>
                      <View style={styles.qrPreviewHeaderRight}>
                        <Text style={styles.qrRxCode}>{qrPrescriptionPreview.rxCode ? `#${qrPrescriptionPreview.rxCode}` : ''}</Text>
                        <Text style={styles.noteMeta}>{qrPrescriptionPreview.timestamp || ''}</Text>
                      </View>
                    </View>
                    <View style={styles.qrPatientMeta}>
                      <Text style={styles.qrMetaLine}>Name: {qrPrescriptionPreview.patientName}</Text>
                      <Text style={styles.qrMetaLine}>Patient ID: {qrPrescriptionPreview.patientId || '-'}</Text>
                      <Text style={styles.qrMetaLine}>Age: {qrPrescriptionPreview.age || '-'}</Text>
                      <Text style={styles.qrMetaLine}>Gender: {qrPrescriptionPreview.gender || '-'}</Text>
                    </View>
                    {qrPrescriptionPreview.diagnosis ? (
                      <Text style={styles.qrDiagnosis}>Final Diagnosis: {qrPrescriptionPreview.diagnosis}</Text>
                    ) : null}
                    <View style={styles.qrTableHead}>
                      <Text style={[styles.qrHeadCell, styles.qrHeadCellWide]}>Medication</Text>
                      <Text style={styles.qrHeadCell}>Dose</Text>
                      <Text style={styles.qrHeadCell}>Duration</Text>
                      <Text style={styles.qrHeadCell}>Notes</Text>
                    </View>
                    {qrPrescriptionPreview.meds.map((m: any, index: number) => (
                      <View key={`${m?.name || 'med'}-${index}`} style={styles.qrTableRow}>
                        <Text style={[styles.qrBodyCell, styles.qrHeadCellWide]}>{String(m?.name || '-')}</Text>
                        <Text style={styles.qrBodyCell}>{String(m?.dose || '-')}</Text>
                        <Text style={styles.qrBodyCell}>{String(m?.duration || '-')}</Text>
                        <Text style={styles.qrBodyCell}>{String(m?.notes || '-')}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <InputField
                    label="QR Content"
                    placeholder="Scan QR into this field (or paste JSON payload)"
                    value={scanPrescriptionQrText}
                    onChangeText={setScanPrescriptionQrText}
                    multiline
                  />
                )}
                <View style={styles.buttonRow}>
                  <SecondaryButton label="Import QR Prescription" onPress={handleImportPrescriptionQr} />
                  <SecondaryButton label="Save & Close Prescription" onPress={handleSaveCloseAndNextScan} />
                  {scanPrescriptionQrText.trim() ? (
                    <SecondaryButton
                      label={showQrRaw ? 'Hide Raw QR' : 'Show Raw QR'}
                      onPress={() => setShowQrRaw((prev) => !prev)}
                    />
                  ) : null}
                </View>
                {showQrRaw && scanPrescriptionQrText.trim() ? (
                  <InputField
                    label="Raw QR Content"
                    placeholder="Raw QR payload"
                    value={scanPrescriptionQrText}
                    onChangeText={setScanPrescriptionQrText}
                    multiline
                  />
                ) : null}
              </View>
            ) : null}
            <Text style={styles.noteMeta}>
              Use this when clinic-pharmacy sync is down or patient prefers an external pharmacy workflow.
            </Text>
          </Card>
          <Card
            variant="white"
            title="Prescription Queue"
            collapsible
            isCollapsed={isTableCardCollapsed('prescription-queue')}
            onToggleCollapse={() => toggleTableCard('prescription-queue')}
          >
            <DataTable
              columns={[
                { key: 'patient', label: 'Patient', wide: true },
                { key: 'doctor', label: 'Doctor' },
                { key: 'meds', label: 'Prescription', wide: true },
                { key: 'time', label: 'Time' },
                { key: 'status', label: 'Status' },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
                    <View style={styles.inlineActions}>
                      <SecondaryButton
                        label="View"
                        onPress={() => {
                          const patientMatch = patients.find((p) => p.name === row.patient);
                          if (patientMatch) {
                            setSelectedPatient(patientMatch);
                            if (onSectionChange) onSectionChange('Patients');
                            toast(`Opened profile for ${patientMatch.name}.`);
                          } else {
                            toast(`Patient record not found for ${row.patient}.`, 'warning');
                          }
                        }}
                      />
                      <SecondaryButton label="Preparing" onPress={() => handleIncomingStatus(row, 'Preparing')} />
                      <SecondaryButton label="Ready" onPress={() => handleIncomingStatus(row, 'Ready')} />
                      <SecondaryButton label="Dispense" onPress={() => handleDispense(row)} />
                    </View>
                  ),
                },
              ]}
              rows={inbox}
            />
          </Card>
        </Section>
      ) : null}

      {showDashboard ? (
        <Section title="Low Stock Alerts">
          <Card
            variant="white"
            title="Low Stock Table"
            collapsible
            isCollapsed={isTableCardCollapsed('low-stock-table')}
            onToggleCollapse={() => toggleTableCard('low-stock-table')}
          >
            <DataTable
              columns={[
                { key: 'name', label: 'Drug', wide: true },
                { key: 'stock', label: 'Current Stock' },
                { key: 'threshold', label: 'Minimum Level' },
              ]}
              rows={lowStockAlerts}
            />
          </Card>
        </Section>
      ) : null}
      {showDashboard ? (
        <Section title="Quick Actions">
          <View style={styles.row}>
            <ActionCard
              label="Add New Drug"
              hint="Inventory"
              isCollapsed={isQuickActionCollapsed('add-new-drug')}
              onToggleCollapse={() => toggleQuickAction('add-new-drug')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Inventory');
                toast('Inventory opened for new drug entry.');
              }}
            />
            <ActionCard
              label="Update Stock"
              hint="Restock"
              isCollapsed={isQuickActionCollapsed('update-stock')}
              onToggleCollapse={() => toggleQuickAction('update-stock')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Inventory');
                toast('Inventory opened for stock update.');
              }}
            />
            <ActionCard
              label="Search Medicine"
              hint="Inventory"
              isCollapsed={isQuickActionCollapsed('search-medicine')}
              onToggleCollapse={() => toggleQuickAction('search-medicine')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Inventory');
                toast('Inventory search ready.');
              }}
            />
            <ActionCard
              label="Create Invoice"
              hint="Invoices"
              isCollapsed={isQuickActionCollapsed('create-invoice')}
              onToggleCollapse={() => toggleQuickAction('create-invoice')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Invoices');
                toast('Invoices workspace opened.');
              }}
            />
            <ActionCard
              label="View Inventory"
              hint="Snapshot"
              isCollapsed={isQuickActionCollapsed('view-inventory')}
              onToggleCollapse={() => toggleQuickAction('view-inventory')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Inventory');
                toast('Inventory snapshot opened.');
              }}
            />
          </View>
        </Section>
      ) : null}

      {showDashboard ? (
        <Section title="Recent Activity">
          <Card variant="white" style={styles.sectionCard} title="Snapshot">
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>Top dispensed today</Text>
              <Text style={styles.snapshotValue}>{topDispensed || 'No data yet'}</Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>Average prep time</Text>
              <Text style={styles.snapshotValue}>{avgPrepTime} min</Text>
            </View>
          </Card>
          <Card
            variant="white"
            style={styles.sectionCard}
            title="Recent Dispensed"
            collapsible
            isCollapsed={isTableCardCollapsed('recent-dispensed')}
            onToggleCollapse={() => toggleTableCard('recent-dispensed')}
          >
            <DataTable
              columns={[
                { key: 'patient', label: 'Patient', wide: true },
                { key: 'drug', label: 'Drug', wide: true },
                { key: 'time', label: 'Time' },
              ]}
              rows={recentDispensedRows}
            />
          </Card>
        </Section>
      ) : null}

      {loading ? (
        <Notice
          title="Loading"
          message="Fetching pharmacy orders, inventory, and notifications from the clinic backend."
          tone="info"
        />
      ) : null}

      {notice ? (
        <Notice
          title={noticeTone === 'success' ? 'Success' : noticeTone === 'warning' ? 'Attention' : 'Update'}
          message={notice}
          tone={noticeTone}
        />
      ) : null}


      {loading ? <Notice title="Syncing" message="Fetching live pharmacy data..." tone="info" /> : null}
      {showInbox ? null : null}
      {showPrep ? (
        <Section title="Prep Queue">
          <View style={styles.row}>
            {prepSummary.map((item) => (
              <StatCard key={item.label} {...item} variant="white" />
            ))}
          </View>
          <Card variant="soft" style={styles.sectionCard} title="Queue Controls">
            <InputField
              label="Search Queue"
              placeholder="Search by patient, drug, or ID"
              value={orderSearch}
              onChangeText={setOrderSearch}
            />
            <View style={styles.filterRow}>
              <SegmentedControl options={['All', 'Waiting', 'Preparing', 'Ready']} value={prepFilter} onChange={setPrepFilter} />
            </View>
            <View style={styles.buttonRow}>
              <SecondaryButton label="Auto-Assign" onPress={() => setNotice('Prep items assigned by workload.')} />
              <SecondaryButton label="Print Labels" onPress={() => setNotice('Prep labels sent to printer.')} />
            </View>
          </Card>
          <Card
            variant="white"
            style={styles.sectionCard}
            title="Prep Orders"
            collapsible
            isCollapsed={isTableCardCollapsed('prep-orders')}
            onToggleCollapse={() => toggleTableCard('prep-orders')}
          >
            <DataTable
              columns={[
                { key: 'patient', label: 'Patient', wide: true },
                { key: 'meds', label: 'Drug', wide: true },
                { key: 'quantity', label: 'Qty' },
                { key: 'priority', label: 'Priority' },
                { key: 'eta', label: 'ETA' },
                {
                  key: 'receivedAt',
                  label: 'Waiting',
                  render: (row) => {
                    const minutes = minutesSince(row.receivedAt);
                    return <Text style={styles.flagText}>{minutes === null ? '-' : `${minutes} min`}</Text>;
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusPill value={row.status} />,
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
                    <View style={styles.inlineActions}>
                      <SecondaryButton label="Advance" onPress={() => handleQueueAdvance(row)} />
                      <SecondaryButton label="Hold" onPress={() => setNotice(`Order ${row.id} placed on hold.`)} />
                    </View>
                  ),
                },
              ]}
              rows={filteredPrepQueue.filter((item) =>
                `${item.id} ${item.patient} ${item.meds}`.toLowerCase().includes(orderSearch.toLowerCase())
              )}
            />
          </Card>
        </Section>
      ) : null}      {showPrescriptions ? (
        <Section
          title="Prescriptions"
          action={
            <SecondaryButton
              label="Upload"
              onPress={() => {
                setNotice('Prescription image uploaded (OCR ready).');
                setNoticeTone('info');
              }}
            />
          }
        >
          <View style={styles.row}>
            {prescSummary.map((item) => (
              <StatCard key={item.label} {...item} variant="white" />
            ))}
          </View>
          <Card variant="soft" style={styles.sectionCard}>
            <Text style={styles.formTitle}>Prescription Filters</Text>
            <SegmentedControl options={['All', 'Today', 'This Week']} value={prescRange} onChange={setPrescRange} />
            <InputField
              label="Search Prescriptions"
              placeholder="Search by patient, doctor, status"
              value={prescSearch}
              onChangeText={setPrescSearch}
            />
            <View style={styles.filterRow}>
              <InputField
                label="Filter by Doctor"
                placeholder="Dr. Salma"
                value={prescDoctorFilter}
                onChangeText={setPrescDoctorFilter}
              />
              <InputField
                label="Filter by Patient"
                placeholder="Mona Hassan"
                value={prescPatientFilter}
                onChangeText={setPrescPatientFilter}
              />
              <InputField
                label="Filter by Status"
                placeholder="Ready"
                value={prescStatusFilter}
                onChangeText={setPrescStatusFilter}
              />
            </View>
            <View style={styles.buttonRow}>
              <SecondaryButton label="Sync From Clinic" onPress={handleSimulateSync} />
              <SecondaryButton label="Export List" onPress={() => setNotice('Prescription list exported.')} />
              <SecondaryButton label="Print Batch" onPress={() => setNotice('Batch print started.')} />
            </View>
          </Card>
          <Card variant="white" style={styles.sectionCard}>
            <DataTable
              columns={[
                { key: 'patientName', label: 'Patient', wide: true },
                { key: 'doctor', label: 'Doctor' },
                {
                  key: 'meds',
                  label: 'Drug',
                  wide: true,
                  render: (row) => (
                    <View style={styles.medicineCell}>
                      <Text style={styles.medicineCellText}>{row.meds}</Text>
                      {!row.inStock ? <View style={styles.outOfStockDot} /> : null}
                    </View>
                  ),
                },
                {
                  key: 'controlled',
                  label: 'Type',
                  render: (row) => <StatusPill value={row.controlled ? 'Controlled' : 'Standard'} />,
                },
                { key: 'date', label: 'Date' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusPill value={row.status} />,
                },
                {
                  key: 'stockLabel',
                  label: 'Stock',
                  render: (row) => (
                    <Text style={row.inStock ? styles.stockAvailableText : styles.stockMissingText}>{row.stockLabel}</Text>
                  ),
                },
                { key: 'notes', label: 'Notes', wide: true },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
                    <View style={styles.inlineActions}>
                      <SecondaryButton
                        label="View"
                        onPress={() => handlePrescriptionView(row)}
                      />
                      <SecondaryButton label="Update" onPress={() => handlePrescriptionEdit(row)} />
                      <SecondaryButton
                        label="Print"
                        onPress={() => {
                          handlePrescriptionView(row);
                          setNotice(`Prescription ${row.id} sent to printer.`);
                          setNoticeTone('info');
                        }}
                      />
                      <SecondaryButton
                        label="Dispense"
                        onPress={() => {
                          handlePrescriptionView(row);
                          handleDispense({
                            orderId: row.orderId,
                            patient: row.patientName,
                            meds: row.meds,
                            quantity: 1,
                          });
                        }}
                      />
                      <SecondaryButton
                        label={row.invoiceId ? 'Open Invoice' : 'Invoice'}
                        onPress={() => handlePrescriptionInvoice(row)}
                      />
                      <SecondaryButton
                        label="Prepare Order"
                        onPress={() => handlePrescriptionView(row)}
                      />
                    </View>
                  ),
                },
              ]}
              rows={prescriptionRows}
            />
          </Card>
          {selectedPrescription ? (
            <View
              onLayout={(event) => {
                const y = event.nativeEvent.layout.y;
                setPrescDetailsY(y);
                if (prescScrollPending && onScrollTo) {
                  onScrollTo(y);
                  setPrescScrollPending(false);
                }
              }}
            >
              <View style={styles.prescriptionStack}>
                <View style={[styles.columnWide, styles.prescriptionStackItem]}>
                  <Card variant="soft" style={styles.sectionCard}>
                      <Text style={styles.formTitle}>Prescription Details</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Patient</Text>
                      <Text style={styles.summaryValue}>{selectedPrescription.patientName}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Doctor</Text>
                      <Text style={styles.summaryValue}>{selectedPrescription.doctor}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Medication</Text>
                      <Text style={styles.summaryValue}>{selectedPrescription.meds}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Status</Text>
                      <Text style={styles.summaryValue}>{selectedPrescription.status}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Invoice</Text>
                      <Text style={styles.summaryValue}>
                        {selectedPrescription.invoiceId
                          ? `#${selectedPrescription.invoiceId} - ${selectedPrescription.invoiceStatus || 'Pending'}`
                          : 'Not generated yet'}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Stock</Text>
                      <Text style={styles.summaryValue}>
                        {(() => {
                          const stockRow = prescriptionRows.find((item) => item.id === selectedPrescription.id);
                          return stockRow ? stockRow.stockLabel : 'Stock not checked';
                        })()}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Ready Order Total</Text>
                      <Text style={styles.summaryValue}>
                        EGP {Number(preparationSidebar?.summary.total_amount || 0).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Prepared Items</Text>
                      <Text style={styles.summaryValue}>
                        {Number(preparationSidebar?.summary.prepared_items_count || 0)} ready / {preparationSidebar?.items.length || 0} total
                      </Text>
                    </View>
                    {editPrescription ? (
                      <View>
                        <InputField
                          label="Status (pharmacy)"
                          placeholder="Received / Validated / Ready"
                          value={editPrescStatus}
                          onChangeText={setEditPrescStatus}
                        />
                        <InputField
                          label="Notes (pharmacy)"
                          placeholder="Notes"
                          value={editPrescNotes}
                          onChangeText={setEditPrescNotes}
                        />
                        <View style={styles.buttonRow}>
                          <SecondaryButton label="Save" onPress={handlePrescriptionSave} />
                          <SecondaryButton label="Cancel" onPress={() => setEditPrescription(null)} />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.buttonRow}>
                        <SecondaryButton label="Update" onPress={() => handlePrescriptionEdit(selectedPrescription)} />
                        <SecondaryButton
                          label={selectedPrescription.invoiceId ? 'Open Invoice' : 'Invoice'}
                          onPress={() => handlePrescriptionInvoice(selectedPrescription)}
                        />
                        <SecondaryButton
                          label="Refresh Prep"
                          onPress={() => loadPreparationSidebar(selectedPrescription)}
                        />
                        <SecondaryButton
                          label="Close"
                          onPress={() => {
                            setSelectedPrescription(null);
                            setPreparationSidebar(null);
                            setPreparationNotes('');
                          }}
                        />
                      </View>
                    )}
                  </Card>
                </View>
                <View style={[styles.columnNarrow, styles.prescriptionStackItem]}>
                  <Card variant="white" style={styles.sectionCard}>
                      <Text style={styles.formTitle}>Prescription</Text>
                    <Text style={styles.noteMeta}>
                      Auto-load the medicines from this prescription, then add or remove lines before sending it as a ready order.
                    </Text>
                    {preparationLoading ? (
                      <Notice title="Loading" message="Checking stock and prices for this prescription." tone="info" />
                    ) : preparationSidebar ? (
                      <View>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Order</Text>
                          <Text style={styles.summaryValue}>
                            {preparationSidebar.order_id || selectedPrescription.orderId || 'Pending'}
                          </Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Order Status</Text>
                          <Text style={styles.summaryValue}>{preparationSidebar.order_status}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Missing Medicines</Text>
                          <Text style={styles.summaryValue}>{preparationSidebar.summary.missing_items_count}</Text>
                        </View>
                        <InputField
                          label="Preparation Notes"
                          placeholder="Add pharmacist notes for shipping or follow-up"
                          value={preparationNotes}
                          onChangeText={(value) => {
                            setPreparationNotes(value);
                            setPreparationSidebar((current) => (current ? { ...current, prepared_notes: value } : current));
                          }}
                        />
                        {preparationSidebar.items.map((item, index) => (
                          <Card key={`${item.medicine_name}-${index}`} variant="soft" style={styles.preparationItemCard}>
                            <InputField
                              label={`Medicine ${index + 1}`}
                              placeholder="Medicine name"
                              value={item.medicine_name}
                              onChangeText={(value) => handlePreparationItemChange(index, 'medicine_name', value)}
                            />
                            <View style={styles.filterRow}>
                              <InputField
                                label="Qty"
                                placeholder="1"
                                value={String(item.quantity)}
                                onChangeText={(value) => handlePreparationItemChange(index, 'quantity', value)}
                              />
                              <InputField
                                label="Dosage"
                                placeholder="1 tablet"
                                value={item.dosage || ''}
                                onChangeText={(value) => handlePreparationItemChange(index, 'dosage', value)}
                              />
                            </View>
                            <InputField
                              label="Notes"
                              placeholder="Substitute, partial fill, call patient..."
                              value={item.notes || ''}
                              onChangeText={(value) => handlePreparationItemChange(index, 'notes', value)}
                            />
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Stock</Text>
                              <Text style={item.in_stock ? styles.stockAvailableText : styles.stockMissingText}>
                                {item.in_stock ? 'In stock' : 'Not in stock'}
                              </Text>
                            </View>
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Available Qty</Text>
                              <Text style={styles.summaryValue}>{Number(item.available_quantity || 0)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Unit Price</Text>
                              <Text style={styles.summaryValue}>EGP {Number(item.unit_price || 0).toFixed(2)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Line Total</Text>
                              <Text style={styles.summaryValue}>EGP {Number(item.line_total || 0).toFixed(2)}</Text>
                            </View>
                            <View style={styles.buttonRow}>
                              <SecondaryButton label="Remove" onPress={() => handlePreparationItemRemove(index)} />
                            </View>
                          </Card>
                        ))}
                        <View style={styles.buttonRow}>
                          <SecondaryButton
                            label={showPreparationInventoryPicker ? 'Hide Inventory' : 'Add Medicine'}
                            onPress={() => setShowPreparationInventoryPicker((current) => !current)}
                          />
                          <SecondaryButton label="Add Blank Line" onPress={handlePreparationItemAdd} />
                          <SecondaryButton label="Save Draft" onPress={handlePreparationSaveDraft} />
                          <SecondaryButton
                            label={preparationSaving ? 'Saving...' : 'Done'}
                            onPress={handlePreparationDone}
                          />
                        </View>
                        <Text style={styles.noteMeta}>
                          {preparationAutosaveStatus === 'saving'
                            ? 'Autosaving draft...'
                            : preparationAutosaveStatus === 'saved'
                              ? 'Draft autosaved'
                              : ''}
                        </Text>
                        {showPreparationInventoryPicker ? (
                          <Card variant="soft" style={styles.preparationInventoryPicker}>
                            <Text style={styles.formTitle}>Add From Inventory</Text>
                            <InputField
                              label="Search Inventory"
                              placeholder="Search medicine, SKU, category, supplier"
                              value={preparationInventorySearch}
                              onChangeText={setPreparationInventorySearch}
                            />
                            {filteredPreparationInventory.length ? (
                              filteredPreparationInventory.map((inventoryItem) => (
                                <View key={inventoryItem.id} style={styles.preparationInventoryRow}>
                                  <View style={styles.preparationInventoryText}>
                                    <Text style={styles.preparationInventoryName}>{inventoryItem.name}</Text>
                                    <Text style={styles.noteMeta}>
                                      {inventoryItem.id} | {inventoryItem.stock} in stock | EGP {Number(inventoryItem.price || 0).toFixed(2)}
                                    </Text>
                                  </View>
                                  <SecondaryButton
                                    label="Use"
                                    onPress={() => handlePreparationInventoryAdd(inventoryItem)}
                                  />
                                </View>
                              ))
                            ) : (
                              <Text style={styles.noteMeta}>No inventory medicine matches this search.</Text>
                            )}
                          </Card>
                        ) : null}
                        <Card variant="soft" style={styles.preparationSummaryCard}>
                          <Text style={styles.formTitle}>Ready Order Summary</Text>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Prescription Items</Text>
                            <Text style={styles.summaryValue}>{preparationSidebar.summary.requested_items_count || preparationSidebar.items.length}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Prepared Items</Text>
                            <Text style={styles.summaryValue}>{preparationSidebar.summary.prepared_items_count || 0}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Missing Items</Text>
                            <Text style={styles.summaryValue}>{preparationSidebar.summary.missing_items_count}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Prescription Subtotal</Text>
                            <Text style={styles.summaryValue}>EGP {Number(preparationSidebar.summary.requested_subtotal || 0).toFixed(2)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Ready Subtotal</Text>
                            <Text style={styles.summaryValue}>EGP {preparationSidebar.summary.subtotal.toFixed(2)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Missing Value</Text>
                            <Text style={styles.summaryValue}>EGP {Number(preparationSidebar.summary.missing_subtotal || 0).toFixed(2)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>VAT ({preparationSidebar.summary.tax_rate}%)</Text>
                            <Text style={styles.summaryValue}>EGP {preparationSidebar.summary.tax_amount.toFixed(2)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Prescription Total</Text>
                            <Text style={styles.summaryValue}>EGP {Number(preparationSidebar.summary.requested_total_amount || 0).toFixed(2)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Ready Total</Text>
                            <Text style={styles.summaryValue}>EGP {preparationSidebar.summary.total_amount.toFixed(2)}</Text>
                          </View>
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Invoice</Text>
                            <Text style={styles.summaryValue}>
                              {preparationSidebar.invoice?.id
                                ? `#${preparationSidebar.invoice.id} - ${preparationSidebar.invoice.status || 'Pending'}`
                                : 'Will be created on Done'}
                            </Text>
                          </View>
                          <View style={styles.buttonRow}>
                            <SecondaryButton
                              label={preparationSidebar.invoice?.id || selectedPrescription.invoiceId ? 'Open Invoice' : 'Generate from Done'}
                              onPress={() => handlePrescriptionInvoice(selectedPrescription)}
                            />
                          </View>
                        </Card>
                      </View>
                    ) : (
                      <Text style={styles.noteMeta}>Select a prescription to start preparing it.</Text>
                    )}
                  </Card>
                </View>
              </View>
            </View>
          ) : null}
        </Section>
      ) : null}

      {showPatients ? (
        <Section title="Patients">
          <Card variant="soft" style={styles.sectionCard}>
            <Text style={styles.formTitle}>Patient Directory</Text>
            <Text style={styles.noteMeta}>Search by name or phone.</Text>
            <InputField
              label="Search Patients"
              placeholder="Search name or phone"
              value={patientSearch}
              onChangeText={setPatientSearch}
            />
          </Card>
          <Card variant="white" style={styles.sectionCard}>
            <DataTable
              columns={[
                { key: 'name', label: 'Patient', wide: true },
                { key: 'phone', label: 'Phone' },
                { key: 'lastVisit', label: 'Last Visit' },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
                    <SecondaryButton
                      label="Profile"
                      onPress={() => {
                        setSelectedPatient(row);
                        if (onSectionChange) onSectionChange('Patients');
                        toast(`Opened profile for ${row.name}.`);
                      }}
                    />
                  ),
                },
              ]}
              rows={patientsWithVisit}
            />
          </Card>

          <Card variant="white" style={styles.sectionCard}>
            <View style={styles.dashboardHeader}>
              <View style={styles.dashboardHeaderText}>
                <Text style={styles.dashboardTitle}>{selectedPatient ? selectedPatient.name : 'Patient Profile'}</Text>
                <Text style={styles.dashboardSubtitle}>
                  {selectedPatient
                    ? 'Patient overview and prescription history.'
                    : 'Select a patient from the list above to view profile details.'}
                </Text>
              </View>
              {selectedPatient ? (
                <View style={styles.dashboardActions}>
                  <SecondaryButton
                    label="Close Profile"
                    onPress={() => {
                      setSelectedPatient(null);
                      toast('Closed patient profile.');
                    }}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.dualColumn}>
              <Card variant="soft" style={styles.columnNarrow}>
                <Text style={styles.formTitle}>Patient Details</Text>
                {selectedPatient ? (
                  <View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Patient ID</Text>
                      <Text style={styles.summaryValue}>{selectedPatient.id}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Phone</Text>
                      <Text style={styles.summaryValue}>{selectedPatient.phone}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Chronic</Text>
                      <Text style={styles.summaryValue}>{selectedPatient.chronic}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>History</Text>
                      <Text style={styles.summaryValue}>{selectedPatient.history}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.noteMeta}>No patient selected yet.</Text>
                )}
              </Card>
              <Card variant="soft" style={styles.columnWide}>
                <Text style={styles.formTitle}>Prescriptions</Text>
                <DataTable
                  columns={[
                    { key: 'id', label: 'Rx ID' },
                    { key: 'meds', label: 'Medication', wide: true },
                    { key: 'date', label: 'Date' },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (row) => <StatusPill value={row.status} />,
                    },
                  ]}
                  rows={patientProfilePrescriptions}
                />
              </Card>
            </View>
          </Card>
        </Section>
      ) : null}

      {showInventory ? (
        <Section title="Inventory Management" action={<SecondaryButton label="Refresh" onPress={load} />}>
          <View style={styles.row}>
            {inventorySummary.map((item) => (
              <StatCard key={item.label} {...item} variant="white" />
            ))}
          </View>

          <Card variant="soft" style={styles.sectionCard}>
            <Text style={styles.searchBarLabel}>Search Inventory</Text>
            <InputField
              label=""
              placeholder="Search SKU or drug name"
              value={inventorySearch}
              onChangeText={setInventorySearch}
            />
            <Text style={styles.searchBarMeta}>
              Filter details: Category {inventoryCategoryFilter} | Supplier {inventorySupplierFilter}
            </Text>

            <Text style={styles.filterLabel}>Category</Text>
            <View style={styles.filterChipWrap}>
              {['All', ...inventoryCategories].map((item) => {
                const active = inventoryCategoryFilter === item;
                return (
                  <TouchableOpacity
                    key={`cat-${item}`}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setInventoryCategoryFilter(item)}
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
                    onPress={() => setInventorySupplierFilter(item)}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          <Card variant="white" style={styles.sectionCard}>
            <DataTable
              columns={[
                { key: 'id', label: 'SKU' },
                { key: 'name', label: 'Drug', wide: true },
                { key: 'category', label: 'Category' },
                { key: 'stock', label: 'Stock' },
                { key: 'expiry', label: 'Expiry' },
                { key: 'supplier', label: 'Supplier' },
                { key: 'batch', label: 'Batch' },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
                    <View style={styles.inlineActions}>
                      <SecondaryButton label="Edit" onPress={() => handleInventoryEdit(row)} />
                      <SecondaryButton label="Delete" onPress={() => handleInventoryDelete(row)} />
                    </View>
                  ),
                },
              ]}
              rows={filteredInventory}
            />
          </Card>

          <Card variant="soft" style={styles.sectionCard}>
            <Text style={styles.formTitle}>Inventory Actions</Text>
            <View style={styles.inventoryActionBlock}>
              <SecondaryButton
                label={showAddMedicineForm ? 'Close Add Medicine' : 'Add Medicine'}
                onPress={() => {
                  if (showAddMedicineForm) {
                    closeAddMedicineForm();
                    return;
                  }
                  openAddMedicineForm();
                }}
              />
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
              ) : null}
            </View>

            <View style={styles.inventoryActionBlock}>
              <SecondaryButton
                label={showClinicRequestForm ? 'Close Log Clinic Request' : 'Log Clinic Request'}
                onPress={() => {
                  if (showClinicRequestForm) {
                    setShowClinicRequestForm(false);
                    return;
                  }
                  closeAddMedicineForm();
                  setShowClinicRequestForm(true);
                }}
              />
              {showClinicRequestForm ? (
                <Card variant="white" style={styles.inlineActionCard}>
                  <Text style={styles.formTitle}>Log Clinic Request</Text>
                  <InputField label="SKU (optional)" placeholder="RX-0000" value={requestSku} onChangeText={setRequestSku} />
                  <InputField label="Item Name" placeholder="Paracetamol 500mg" value={requestName} onChangeText={setRequestName} />
                  <InputField label="Quantity" placeholder="0" value={requestQty} onChangeText={setRequestQty} />
                  <InputField label="Priority" placeholder="Normal" value={requestPriority} onChangeText={setRequestPriority} />
                  <InputField label="Requested By" placeholder="Clinic Nurse" value={requestBy} onChangeText={setRequestBy} />
                  <InputField label="Notes" placeholder="Optional notes" value={requestNotes} onChangeText={setRequestNotes} />
                  <View style={styles.buttonRow}>
                    <SecondaryButton label="Create Request" onPress={handleClinicRequestCreate} />
                    <SecondaryButton label="Cancel" onPress={() => setShowClinicRequestForm(false)} />
                  </View>
                </Card>
              ) : null}
            </View>
          </Card>

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
                  render: (row) => <StatusPill value={row.status || 'Requested'} />,
                },
                { key: 'requested_by', label: 'Requested By' },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
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
      ) : null}

      {showBillingWorkspace ? (
        <Section title="Invoices and Billing">
          <Card variant="soft" style={styles.posHeader} title="Checkout Session">
            <View style={styles.posHeaderRow}>
              <View style={styles.posHeaderText}>
                <Text style={styles.posTitle}>Pharmacy Checkout</Text>
              </View>
              <View style={styles.posHeaderMeta}>
                <Text style={styles.posMetaLabel}>Shift</Text>
                <Text style={styles.posMetaValue}>{shiftId}</Text>
                <Text style={styles.posMetaLabel}>Cashier</Text>
                <Text style={styles.posMetaValue}>{cashierName}</Text>
              </View>
            </View>
          </Card>
          <View style={styles.posGrid}>
            <View style={styles.posColumnPrimary}>
              <Card variant="white" title="Scan Barcode">
                <InputField label="Barcode" placeholder="Scan barcode" value={scanBarcode} onChangeText={setScanBarcode} />
                <View style={styles.buttonRow}>
                  <SecondaryButton label="Add Item" onPress={handleScanAdd} />
                </View>
              </Card>

              <InputField
                label="Search Drug"
                placeholder="Search drug..."
                value={posSearch}
                onChangeText={setPosSearch}
              />
              <Card
                variant="white"
                style={styles.sectionCard}
                title="Medicine List"
                collapsible
                isCollapsed={isTableCardCollapsed('medicine-list')}
                onToggleCollapse={() => toggleTableCard('medicine-list')}
              >
                <DataTable
                  columns={[
                    { key: 'name', label: 'Drug', wide: true },
                    { key: 'stock', label: 'Stock' },
                    { key: 'price', label: 'Price' },
                    {
                      key: 'action',
                      label: 'Action',
                      render: (row) => <SecondaryButton label="Add" onPress={() => addToCart(row)} />,
                    },
                  ]}
                  rows={posInventory}
                />
              </Card>

              <Card variant="white" style={styles.sectionCard} title="Cart">
                <DataTable
                  columns={[
                    { key: 'name', label: 'Item', wide: true },
                    { key: 'qty', label: 'Qty' },
                    { key: 'price', label: 'Price' },
                    {
                      key: 'action',
                      label: 'Action',
                      render: (row) => (
                        <View style={styles.inlineActions}>
                          <SecondaryButton label="+" onPress={() => updateCartQty(row.id, 1)} />
                          <SecondaryButton label="-" onPress={() => updateCartQty(row.id, -1)} />
                          <SecondaryButton label="Remove" onPress={() => removeFromCart(row.id)} />
                        </View>
                      ),
                    },
                  ]}
                  rows={cart}
                />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>EGP {subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>VAT (14%)</Text>
                  <Text style={styles.summaryValue}>EGP {vat.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={styles.summaryValue}>EGP {discountValue.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.summaryValue}>EGP {total.toFixed(2)}</Text>
                </View>
              </Card>
            </View>
            <View style={styles.posColumnSecondary}>
              <Card variant="white" title="Sale Details">
                <InputField label="Receipt No" placeholder="RCPT-0000" value={receiptNo} onChangeText={setReceiptNo} />
                <InputField label="Cashier" placeholder="Cashier name" value={cashierName} onChangeText={setCashierName} />
                <InputField label="Shift ID" placeholder="SHIFT-01" value={shiftId} onChangeText={setShiftId} />
              </Card>
              <Card variant="white" style={styles.sectionCard} title="Patient & Coverage">
                <InputField label="Patient Name" placeholder="Patient name" value={posPatient} onChangeText={setPosPatient} />
                <InputField label="Patient ID" placeholder="PT-001" value={posPatientId} onChangeText={setPosPatientId} />
                <InputField label="Phone" placeholder="+20 1X XXX XXXX" value={posPatientPhone} onChangeText={setPosPatientPhone} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Coverage Status</Text>
                  <Text style={styles.summaryValue}>{coverage.status}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Provider</Text>
                  <Text style={styles.summaryValue}>{coverage.provider}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Member ID</Text>
                  <Text style={styles.summaryValue}>{coverage.memberId}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Plan</Text>
                  <Text style={styles.summaryValue}>{coverage.plan}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Policy</Text>
                  <Text style={styles.summaryValue}>{coverage.policy}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Copay</Text>
                  <Text style={styles.summaryValue}>EGP {coverage.copay}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Last Verified</Text>
                  <Text style={styles.summaryValue}>{coverage.lastChecked}</Text>
                </View>
                <View style={styles.buttonRow}>
                  <SecondaryButton label="Verify Coverage" onPress={() => {
                    setNotice('Insurance coverage verified with clinic system.');
                    setNoticeTone('success');
                  }} />
                </View>
              </Card>
            </View>
          </View>
          <View style={styles.posCheckoutRow}>
            <Card variant="white" style={styles.posCheckoutCardWide} title="Checkout">
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Insurance Deduction</Text>
                <Text style={styles.summaryValue}>EGP {coverage.copay}</Text>
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Payment</Text>
                <SecondaryButton
                  label={paymentMethod}
                  onPress={() => setPaymentMethod((prev) => (prev === 'Cash' ? 'Card' : 'Cash'))}
                />
              </View>
              <View style={styles.buttonRow}>
                <SecondaryButton label="Generate Invoice" onPress={handleCheckout} />
                <SecondaryButton label="Print Receipt" onPress={handlePrintReceipt} />
              </View>
            </Card>
          </View>
        </Section>
      ) : null}
      {showBillingWorkspace ? (
        <Section title="Invoices" action={<SecondaryButton label="Refresh" onPress={handleRefreshInvoices} />}>
          <View style={styles.row}>
            {invoiceSummary.map((item) => (
              <StatCard key={item.label} {...item} variant="white" />
            ))}
          </View>
          <Card variant="soft" style={styles.sectionCard} title="Invoice Controls">
            <InputField
              label="Search Invoices"
              placeholder="Search invoice or patient"
              value={invoiceSearch}
              onChangeText={setInvoiceSearch}
            />
            <View style={styles.buttonRow}>
              <SecondaryButton label="Export CSV" onPress={handleInvoiceExportCsv} />
              <SecondaryButton label="Send Reminders" onPress={handleInvoiceSendReminders} />
            </View>
          </Card>
          <Card
            variant="white"
            style={styles.sectionCard}
            title="Invoice Table"
            collapsible
            isCollapsed={isTableCardCollapsed('invoice-table')}
            onToggleCollapse={() => toggleTableCard('invoice-table')}
          >
            <DataTable
              columns={[
                { key: 'id', label: 'Invoice' },
                { key: 'patient', label: 'Patient', wide: true },
                { key: 'amount', label: 'Amount' },
                { key: 'date', label: 'Date' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusPill value={row.status} />
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
                    <View style={styles.inlineActions}>
                      <SecondaryButton label="View" onPress={() => handleInvoiceView(row)} />
                      <SecondaryButton label="Refund" onPress={() => handleInvoiceRefund(row)} />
                    </View>
                  ),
                },
              ]}
              rows={filteredInvoices}
            />
          </Card>

          {selectedInvoice ? (
            <Card variant="white" style={styles.sectionCard} title="Selected Invoice">
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Invoice</Text>
                <Text style={styles.summaryValue}>{selectedInvoice.id}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Patient</Text>
                <Text style={styles.summaryValue}>{selectedInvoice.patient}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>EGP {Number(selectedInvoice.amount || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Status</Text>
                <Text style={styles.summaryValue}>{selectedInvoice.status}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryValue}>{selectedInvoice.date}</Text>
              </View>
              <View style={styles.buttonRow}>
                <SecondaryButton
                  label="Print"
                  onPress={() => handleInvoicePrint(selectedInvoice)}
                />
                <SecondaryButton
                  label="Save"
                  onPress={() => handleInvoiceSave(selectedInvoice)}
                />
                <SecondaryButton label="Refund" onPress={() => handleInvoiceRefund(selectedInvoice)} />
              </View>
            </Card>
          ) : null}

          <Card variant="white" style={styles.sectionCard} title="Invoice Actions">
            <Text style={styles.noteMeta}>Build and review invoices in this single billing page.</Text>
            <View style={styles.buttonRow}>
              <SecondaryButton
                label="New Invoice"
                onPress={handleStartNewInvoice}
              />
              <SecondaryButton label="Generate Now" onPress={handleCheckout} />
            </View>
          </Card>
        </Section>
      ) : null}

      {showOrders ? (
        <Section title="Pharmacy Orders" action={<SecondaryButton label="Refresh" onPress={load} />}>
          <InputField
            label="Search Orders"
            placeholder="Search by patient, medication, status"
            value={orderSearch}
            onChangeText={setOrderSearch}
          />
          <Card variant="white" style={styles.sectionCard}>
            <DataTable
              columns={[
                { key: 'id', label: 'Order' },
                { key: 'patient', label: 'Patient', wide: true },
                { key: 'meds', label: 'Medication', wide: true },
                {
                  key: 'totalAmount',
                  label: 'Total',
                  render: (row) => <Text style={styles.valueText}>EGP {Number(row.totalAmount || 0).toFixed(2)}</Text>,
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusPill value={row.status} />,
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row) => (
                    <SecondaryButton
                      label={row.status === 'Dispensed' ? 'Done' : 'Advance'}
                      onPress={() => handleAdvanceStatus(row)}
                    />
                  ),
                },
              ]}
              rows={filteredOrders}
            />
          </Card>
        </Section>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    paddingBottom: 24,
    paddingTop: 60,
    position: 'relative',
  },
  inboxFloatingWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 50,
  },
  inboxFloatingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0b1b2a',
    borderWidth: 1,
    borderColor: '#1a3a5c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  inboxFloatingIcon: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  inboxFloatingBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#c81e1e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  inboxFloatingBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: theme.fonts.body,
  },
  notificationDrawer: {
    position: 'absolute',
    top: 62,
    right: 8,
    width: 420,
    maxWidth: '96%',
    maxHeight: 540,
    zIndex: 35,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.cardAlt,
  },
  drawerContent: {
    flexGrow: 0,
    maxHeight: 420,
    paddingHorizontal: 4,
  },
  notificationDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  drawerSectionTitle: {
    marginTop: 10,
    fontSize: 12,
    color: theme.colors.inkFaded,
    fontFamily: theme.fonts.body,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  drawerRow: {
    marginTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSoft,
    gap: 8,
  },
  drawerTextBlock: {
    gap: 2,
  },
  dashboardHeader: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  dashboardHeaderText: {
    flex: 1,
    minWidth: 240,
  },
  dashboardTitle: {
    fontSize: 28,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
  },
  dashboardSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.inkMuted,
    maxWidth: 540,
    fontFamily: theme.fonts.body,
    lineHeight: 20,
  },
  dashboardMeta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dashboardMetaText: {
    fontSize: 11,
    color: theme.colors.inkFaded,
    fontFamily: theme.fonts.body,
  },
  dashboardActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dualColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
      gap: 8,
    alignItems: 'stretch',
  },
  prescriptionStack: {
    flexDirection: 'column-reverse',
    gap: 12,
    alignItems: 'stretch',
  },
  prescriptionStackItem: {
    minWidth: 0,
    width: '100%',
    flexBasis: '100%',
  },
  columnWide: {
    flex: 2,
      minWidth: 200,
  },
  columnNarrow: {
    flex: 1,
      minWidth: 150,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  snapshotLabel: {
    fontSize: 11,
    color: theme.colors.inkFaded,
    fontFamily: theme.fonts.body,
    letterSpacing: 0.6,
  },
  snapshotValue: {
    fontSize: 13,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
  },
  alertRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  alertName: {
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  alertMeta: {
    marginTop: 4,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  noteMeta: {
    marginTop: 4,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  qrScannerPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  qrCameraFrame: {
    width: '100%',
    maxWidth: 560,
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: '#0f172a',
    marginBottom: 8,
  },
  qrCamera: {
    width: '100%',
    height: '100%',
  },
  qrScannerTitle: {
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
    fontSize: 13,
    marginBottom: 6,
  },
  qrPrescriptionPreview: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
  },
  qrPreviewHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  qrClinicName: {
    fontSize: 22,
    color: '#9d1358',
    fontFamily: theme.fonts.heading,
  },
  qrDoctorName: {
    marginTop: 2,
    fontSize: 13,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  qrPreviewHeaderRight: {
    alignItems: 'flex-end',
  },
  qrRxCode: {
    fontSize: 20,
    color: '#9d1358',
    fontFamily: theme.fonts.heading,
  },
  qrPatientMeta: {
    padding: 14,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSoft,
    gap: 4,
  },
  qrMetaLine: {
    fontSize: 13,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
  },
  qrDiagnosis: {
    margin: 14,
    marginTop: 0,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f2dce9',
    color: '#6c1240',
    fontFamily: theme.fonts.heading,
    fontSize: 14,
  },
  qrTableHead: {
    flexDirection: 'row',
    backgroundColor: '#9d1358',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  qrHeadCell: {
    flex: 1,
    color: '#ffffff',
    fontFamily: theme.fonts.heading,
    fontSize: 13,
  },
  qrHeadCellWide: {
    flex: 1.7,
  },
  qrTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  qrBodyCell: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  buttonRow: {
    marginTop: 16,
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  inventoryActionBlock: {
    marginTop: 10,
  },
  inlineActionCard: {
    marginTop: 10,
  },
  preparationItemCard: {
    marginTop: 12,
  },
  preparationInventoryPicker: {
    marginTop: 12,
  },
  preparationInventoryRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  preparationInventoryText: {
    flex: 1,
  },
  preparationInventoryName: {
    fontSize: 13,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
  },
  preparationSummaryCard: {
    marginTop: 12,
  },
  sectionCard: {
    marginTop: 12,
  },
  searchBarLabel: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  searchBarMeta: {
    marginTop: 8,
    color: theme.colors.inkFaded,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    lineHeight: 16,
  },
  filterLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  filterChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.white,
  },
  filterChipActive: {
    backgroundColor: theme.colors.cardSoft,
    borderColor: theme.colors.accentCyan,
  },
  filterChipText: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  filterChipTextActive: {
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
  },
  formTitle: {
    fontSize: 16,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
    marginBottom: 8,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  medicineCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  medicineCellText: {
    flexShrink: 1,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  outOfStockDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.alert,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  summaryValue: {
    fontSize: 11,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
  },
  valueText: {
    fontSize: 12,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
  },
  toggleRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  restockRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  restockField: {
    flex: 1,
  },
  restockAction: {
    paddingBottom: 2,
  },
  flagText: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  stockAvailableText: {
    fontSize: 11,
    color: theme.colors.success,
    fontFamily: theme.fonts.body,
  },
  stockMissingText: {
    fontSize: 11,
    color: theme.colors.alert,
    fontFamily: theme.fonts.body,
  },
  allergyAlert: {
    fontSize: 11,
    color: theme.colors.alert,
    fontFamily: theme.fonts.body,
  },
  allergySafe: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  posHeader: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  posHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  posHeaderText: {
    flex: 1,
    minWidth: 240,
  },
  posTitle: {
    fontSize: 24,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
  },
  posSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    lineHeight: 18,
  },
  posHeaderMeta: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    minWidth: 160,
  },
  posMetaLabel: {
    fontSize: 10,
    color: theme.colors.inkFaded,
    fontFamily: theme.fonts.body,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  posMetaValue: {
    fontSize: 13,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
    marginBottom: 8,
  },
  posGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  posColumnPrimary: {
    flex: 2,
    minWidth: 300,
    gap: 12,
  },
  posColumnSecondary: {
    flex: 1,
    minWidth: 260,
    gap: 12,
  },
  posCheckoutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  posCheckoutCard: {
    flex: 1,
    minWidth: 240,
  },
  posCheckoutCardWide: {
    flex: 1,
    minWidth: 280,
  },
});
