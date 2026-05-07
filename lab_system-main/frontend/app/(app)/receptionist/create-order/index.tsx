import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Image, TextInput, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import bwipjs from 'bwip-js';
import { Asset } from 'expo-asset';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { TextInputField } from '@/components/ui/TextInputField';
import { SelectField } from '@/components/ui/SelectField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DataTable } from '@/components/ui/DataTable';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { theme } from '@/constants/theme';
import { usePatients, type MedicalSummary } from '@/hooks/usePatients';
import { useOrders } from '@/hooks/useOrders';
import { useInsuranceSettings } from '@/hooks/useInsuranceSettings';
import { buildUserSignature, useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/utils/api';
import { downloadInvoicePdf } from '@/utils/invoice';

const appLogo = require('@/assets/images/icon.png');

type CatalogItem = {
  id: string;
  code: string;
  name: string;
  price: number;
  sample: string;
  category: string;
};

type ApiLabType = {
  id: number;
  name: string;
  code: string;
  category: string | null;
  default_price: string;
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

type MedicalFieldKey = keyof MedicalSummary;

type MedicalFieldMeta = {
  key: MedicalFieldKey;
  label: string;
  placeholder: string;
};

const medicalFieldMeta: MedicalFieldMeta[] = [
  { key: 'allergies', label: 'Allergies', placeholder: 'Penicillin' },
  { key: 'chronicConditions', label: 'Chronic Conditions', placeholder: 'Diabetes' },
  { key: 'currentMedications', label: 'Current Medications', placeholder: 'Metformin' },
  { key: 'previousSurgeries', label: 'Previous Surgeries', placeholder: 'Appendectomy' },
];

const initialFieldOptions: Record<MedicalFieldKey, string[]> = {
  allergies: ['Penicillin', 'Latex', 'Peanuts', 'Seafood', 'Dust', 'Pollen'],
  chronicConditions: ['Diabetes', 'Hypertension', 'Asthma', 'Thyroid Disorder'],
  currentMedications: ['Metformin', 'Amlodipine', 'Atorvastatin', 'Levothyroxine'],
  previousSurgeries: ['Appendectomy', 'C-section', 'Gallbladder Removal'],
};


function splitRecordValues(value?: string) {
  if (!value) return [] as string[];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeMedicalSummaryValue(baseValue?: string, addedValues: string[] = []) {
  const base = splitRecordValues(baseValue);
  const merged = Array.from(new Set([...base, ...addedValues.map((item) => item.trim()).filter(Boolean)]));
  return merged.length ? merged.join(', ') : 'None reported';
}

type MedicalFieldEditorProps = {
  fieldKey: MedicalFieldKey;
  label: string;
  placeholder: string;
  recordValue?: string;
  addedValues: string[];
  options: string[];
  onAddValue: (field: MedicalFieldKey, value: string) => void;
  onRemoveValue: (field: MedicalFieldKey, value: string) => void;
  onAddOption: (field: MedicalFieldKey, value: string) => void;
};

function MedicalFieldEditor({
  fieldKey,
  label,
  placeholder,
  recordValue,
  addedValues,
  options,
  onAddValue,
  onRemoveValue,
  onAddOption,
}: MedicalFieldEditorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setNewValue('');
    }
  }, [open]);

  const recordValues = splitRecordValues(recordValue);
  const searchValue = search.trim().toLowerCase();
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(searchValue));
  const hasSummary = recordValues.length > 0 || addedValues.length > 0;

  const addValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAddValue(fieldKey, trimmed);
    setSearch('');
    setNewValue('');
  };

  const addNewValue = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (!options.some((option) => option.toLowerCase() === trimmed.toLowerCase())) {
      onAddOption(fieldKey, trimmed);
    }
    onAddValue(fieldKey, trimmed);
    setNewValue('');
    setSearch('');
  };

  return (
    <View style={styles.summaryRow}>
      <View style={styles.readonlyBlock}>
        <View style={styles.readonlyHeader}>
          <Text style={styles.readonlyLabel}>{label}</Text>
          <Text style={styles.readonlyTag}>Summary</Text>
        </View>
        <View style={styles.chipWrap}>
          {recordValues.map((value) => (
            <View key={`record-${fieldKey}-${value}`} style={[styles.chip, styles.chipReadonly]}>
              <Text style={styles.chipText}>{value}</Text>
            </View>
          ))}
          {addedValues.map((value) => (
            <View key={`added-${fieldKey}-${value}`} style={[styles.chip, styles.chipAdded]}>
              <Text style={styles.chipText}>{value}</Text>
              <Pressable style={styles.chipRemove} onPress={() => onRemoveValue(fieldKey, value)}>
                <Text style={styles.chipRemoveText}>-</Text>
              </Pressable>
            </View>
          ))}
          {!hasSummary ? <Text style={styles.readonlyEmpty}>No data</Text> : null}
        </View>
      </View>

      <View style={styles.editableBlock}>
        <Text style={styles.addLabel}>Add</Text>
        <Pressable style={styles.comboInput} onPress={() => setOpen(true)}>
          <Text style={styles.comboValue}>Select or add...</Text>
        </Pressable>
        <Modal
          transparent
          visible={open}
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => null}>
              <TextInput
                placeholder="Search options"
                placeholderTextColor={theme.colors.slate}
                value={search}
                onChangeText={setSearch}
                style={styles.comboSearch}
              />
              <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent} keyboardShouldPersistTaps="handled">
                {filteredOptions.length === 0 ? (
                  <Text style={styles.optionEmpty}>No matches</Text>
                ) : (
                  filteredOptions.map((option) => {
                    const isSelected = recordValues.includes(option) || addedValues.includes(option);
                    return (
                      <Pressable
                        key={option}
                        style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                        onPress={() => addValue(option)}
                      >
                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <View style={styles.comboDivider} />
              <Text style={styles.comboSectionTitle}>Add new value</Text>
              <View style={styles.addRow}>
                <TextInput
                  placeholder={placeholder}
                  placeholderTextColor={theme.colors.slate}
                  value={newValue}
                  onChangeText={setNewValue}
                  style={styles.addInput}
                />
                <Pressable style={styles.addButton} onPress={addNewValue}>
                  <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}

function generateBarcodeData(text: string) {
  try {
    const canvas = document.createElement('canvas');
    bwipjs.toCanvas(canvas, {
      bcid: 'code128',
      text,
      scale: 3,
      height: 10,
      includetext: false,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function downloadPng(uri: string, filename: string) {
  if (!uri) return;
  const link = document.createElement('a');
  link.href = uri;
  link.download = filename;
  link.click();
}

function printBarcode(uri: string, label: string) {
  if (!uri) return;
  const win = window.open('', '_blank', 'width=400,height=300');
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>${label}</title>
        <style>
          body { font-family: monospace; padding: 16px; }
          img { width: 260px; }
        </style>
      </head>
      <body>
        <div>${label}</div>
        <img src="${uri}" />
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function loadImageDataUrl(uri: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve('');
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = uri;
  });
}

function computeNextOrderId(existingOrders: { id: string }[]) {
  const base = 9000;
  const maxExisting = existingOrders.reduce((maxValue, order) => {
    const numericPart = String(order.id ?? '').replace(/\D/g, '');
    if (!numericPart) return maxValue;
    const parsed = Number(numericPart);
    if (!Number.isFinite(parsed)) return maxValue;
    return Math.max(maxValue, parsed);
  }, base);
  return String(maxExisting + 1);
}

export default function CreateOrder() {
  const params = useLocalSearchParams<{ patientId?: string }>();
  const router = useRouter();
  const { patients } = usePatients();
  const { orders, addOrder } = useOrders();
  const { currentUser } = useAuth();
  const { getDiscountForProvider } = useInsuranceSettings();
  const patient = patients.find((p) => p.id === params.patientId);

  const [addedSummary, setAddedSummary] = useState<Record<MedicalFieldKey, string[]>>({
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    previousSurgeries: [],
  });
  const [optionsByField, setOptionsByField] = useState<Record<MedicalFieldKey, string[]>>(initialFieldOptions);

  useEffect(() => {
    setAddedSummary({
      allergies: [],
      chronicConditions: [],
      currentMedications: [],
      previousSurgeries: [],
    });
  }, [patient?.id]);

  const handleAddValue = (field: MedicalFieldKey, value: string) => {
    setAddedSummary((prev) => {
      if (prev[field].includes(value)) return prev;
      return { ...prev, [field]: [...prev[field], value] };
    });
  };

  const handleRemoveValue = (field: MedicalFieldKey, value: string) => {
    setAddedSummary((prev) => ({
      ...prev,
      [field]: prev[field].filter((item) => item !== value),
    }));
  };

  const handleAddOption = (field: MedicalFieldKey, value: string) => {
    setOptionsByField((prev) => {
      if (prev[field].some((option) => option.toLowerCase() === value.toLowerCase())) return prev;
      return { ...prev, [field]: [...prev[field], value] };
    });
  };

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSample, setSelectedSample] = useState<string>('All');
  const [requestSent, setRequestSent] = useState(false);
  const [showSentNotification, setShowSentNotification] = useState(false);
  const [priority, setPriority] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const [labTypes, scanTypes] = await Promise.all([
          apiRequest<ApiLabType[]>('/api/v1/lab-test-types/'),
          apiRequest<ApiScanType[]>('/api/v1/scan-types/'),
        ]);
        if (cancelled) return;

        const mappedLabs: CatalogItem[] = labTypes
          .filter((item) => item.is_active !== false)
          .map((item) => ({
            id: item.code || `LAB-${item.id}`,
            code: item.code || `LAB${String(item.id).padStart(3, '0')}`,
            name: item.name,
            sample: 'Blood',
            category: item.category?.trim() || 'Laboratory',
            price: Number(item.default_price || 0),
          }));

        const mappedScans: CatalogItem[] = scanTypes
          .filter((item) => item.is_active !== false)
          .map((item) => ({
            id: item.code || `SCAN-${item.id}`,
            code: item.code || `SCAN${String(item.id).padStart(3, '0')}`,
            name: item.name,
            sample: 'Imaging',
            category: item.modality?.trim() || 'Radiology / Imaging',
            price: Number(item.default_price || 0),
          }));

        setCatalog([...mappedLabs, ...mappedScans]);
      } catch {
        if (!cancelled) {
          setCatalog([]);
        }
      }
    };

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const insuranceProvider = patient?.insuranceProvider ?? '';
  const discountPercent = useMemo(
    () => (insuranceProvider ? getDiscountForProvider(insuranceProvider) : 0),
    [insuranceProvider, getDiscountForProvider],
  );

  const orderId = useMemo(() => computeNextOrderId(orders), [orders]);
  const invoiceId = useMemo(() => `INV-${orderId}`, [orderId]);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSample = selectedSample === 'All' || item.sample === selectedSample;
      return matchesSearch && matchesCategory && matchesSample;
    });
  }, [search, selectedCategory, selectedSample]);

  const categoryOptions = useMemo(
    () => ['All', ...Array.from(new Set(catalog.map((item) => item.category))).sort((a, b) => a.localeCompare(b))],
    [catalog]
  );

  const sampleOptions = useMemo(
    () => ['All', ...Array.from(new Set(catalog.map((item) => item.sample))).sort((a, b) => a.localeCompare(b))],
    [catalog]
  );

  const selectedTests = catalog.filter((item) => selected.includes(item.id));
  const subtotal = selectedTests.reduce((sum, item) => sum + item.price, 0);
  const discountValue = Number(((subtotal * discountPercent) / 100).toFixed(2)) || 0;
  const total = Math.max(subtotal - discountValue, 0);
  const paid = total;
  const paymentStatus = 'Paid';

  const toggleTest = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const sampleSummary = selectedTests.reduce<Record<string, string[]>>((acc, test) => {
    acc[test.sample] = acc[test.sample] ? [...acc[test.sample], test.name] : [test.name];
    return acc;
  }, {});

  const sampleCodeMap: Record<string, string> = {
    Blood: 'BLO',
    Urine: 'URI',
    Stool: 'STO',
    Saliva: 'SAL',
    Swab: 'SWB',
    Tissue: 'TIS',
    Imaging: 'IMG',
  };

  const handleSendToQueue = () => {
    if (requestSent) return;
    if (!patient || selectedTests.length === 0) return;
    const hasImaging = selectedTests.some((test) => test.sample === 'Imaging');
    const initialStatus = hasImaging ? 'In Progress' : 'Waiting for Sample';
    const bookedBySignature = buildUserSignature(currentUser);
    const medicalHistorySnapshot: MedicalSummary = {
      allergies: mergeMedicalSummaryValue(patient.medicalHistory?.allergies, addedSummary.allergies),
      chronicConditions: mergeMedicalSummaryValue(patient.medicalHistory?.chronicConditions, addedSummary.chronicConditions),
      currentMedications: mergeMedicalSummaryValue(patient.medicalHistory?.currentMedications, addedSummary.currentMedications),
      previousSurgeries: mergeMedicalSummaryValue(patient.medicalHistory?.previousSurgeries, addedSummary.previousSurgeries),
    };
    addOrder({
      id: orderId,
      invoiceId,
      patientId: patient.id,
      patientName: patient.name,
      date: today,
      status: initialStatus,
      priority,
      tests: selectedTests.map((t) => ({ id: t.id, name: t.name, price: t.price, sample: t.sample })),
      subtotal,
      discount: discountValue,
      total,
      amountPaid: paid,
      paymentStatus,
      paymentMethod,
      insurance: insuranceProvider || undefined,
      discountPercent: discountPercent || undefined,
      notes: notes || undefined,
      bookedByName: currentUser?.name,
      bookedByRole: currentUser?.role,
      bookedByUserId: currentUser?.id,
      bookedBySignature,
      medicalHistorySnapshot,
    });
    setRequestSent(true);
    setShowSentNotification(true);
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    redirectTimeoutRef.current = setTimeout(() => {
      router.replace(`/patients/${patient.id}`);
    }, 1200);
  };

  const handlePrintInvoice = async () => {
    const bookedBySignature = buildUserSignature(currentUser);
    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice ${invoiceId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0F172A; }
            h1 { font-size: 18px; margin: 0; }
            .muted { color: #64748B; font-size: 12px; }
            .section { margin-top: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { text-align: left; padding: 8px; border-bottom: 1px solid #E2E8F0; font-size: 12px; }
            .summary { margin-top: 16px; }
            .summary-row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Invoice ${invoiceId}</h1>
          <div class="muted">Order #${orderId}</div>
          <div class="muted">Date: ${today}</div>
          <div class="muted">Patient: ${patient?.name ?? 'Patient'}</div>
          <div class="muted">Booked By: ${bookedBySignature}</div>

          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Sample</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                ${selectedTests.map((test) => `
                  <tr>
                    <td>${test.name}</td>
                    <td>${test.sample}</td>
                    <td>${test.price} EGP</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="summary">
            <div class="summary-row"><span>Subtotal</span><span>${subtotal} EGP</span></div>
            <div class="summary-row"><span>Discount (${discountPercent}%)</span><span>${discountValue} EGP</span></div>
            <div class="summary-row total"><span>Total</span><span>${total} EGP</span></div>
            <div class="summary-row"><span>Payment Method</span><span>${paymentMethod}</span></div>
            <div class="summary-row"><span>Prepared By</span><span>${bookedBySignature}</span></div>
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

  return (
    <DashboardLayout title="Create Order">
      <FormCard>
        <Text style={styles.sectionTitle}>Patient Details</Text>
        <View style={styles.fieldGrid}>
          <TextInputField label="Patient" placeholder={patient?.name ?? 'Ahmed Ali'} value={patient?.name ?? ''} onChangeText={() => null} editable={false} />
          <TextInputField label="Patient ID" placeholder={patient?.id ?? '1021'} value={patient?.id ?? ''} onChangeText={() => null} editable={false} />
          <TextInputField label="Date" placeholder={today} value={today} onChangeText={() => null} editable={false} />
          <TextInputField label="Order ID" placeholder={`#${orderId}`} value={`#${orderId}`} onChangeText={() => null} editable={false} />
          <TextInputField label="Invoice" placeholder={invoiceId} value={invoiceId} onChangeText={() => null} editable={false} />
        </View>
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Medical History Summary</Text>
        <View style={styles.summaryGrid}>
          {medicalFieldMeta.map((field) => (
            <MedicalFieldEditor
              key={field.key}
              fieldKey={field.key}
              label={field.label}
              placeholder={field.placeholder}
              recordValue={patient?.medicalHistory?.[field.key]}
              addedValues={addedSummary[field.key]}
              options={optionsByField[field.key]}
              onAddValue={handleAddValue}
              onRemoveValue={handleRemoveValue}
              onAddOption={handleAddOption}
            />
          ))}
        </View>
      </FormCard>
      <FormCard>
        <Text style={styles.sectionTitle}>Test Catalog</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <TextInputField label="Search" placeholder="Search test..." value={search} onChangeText={setSearch} />
          </View>
          <Pressable style={styles.filterButton} onPress={() => setShowFilterPicker(true)}>
            <Text style={styles.filterButtonText}>Filter</Text>
          </Pressable>
        </View>
        <View style={styles.testGrid}>
          {filteredCatalog.length === 0 ? (
            <Text style={styles.emptyText}>No tests or scans found.</Text>
          ) : null}
          {filteredCatalog.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleTest(item.id)}
                style={[styles.testCard, isSelected && styles.testCardActive]}
              >
                <Text style={styles.testTitle}>{item.name}</Text>
                <Text style={styles.testMeta}>ID: {item.code}</Text>
                <Text style={styles.testMeta}>Sample: {item.sample}</Text>
                <Text style={styles.testMeta}>Category: {item.category}</Text>
                <Text style={styles.testPrice}>Price: {item.price} EGP</Text>
              </Pressable>
            );
          })}
        </View>
      </FormCard>

      <Modal
        transparent
        visible={showFilterPicker}
        animationType="fade"
        onRequestClose={() => setShowFilterPicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilterPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Filter Tests</Text>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.filterPillWrap}>
                {categoryOptions.map((category) => (
                  <Pressable
                    key={category}
                    style={[
                      styles.filterPill,
                      selectedCategory === category && styles.filterPillActive,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedCategory === category && styles.filterPillTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Sample Type</Text>
              <View style={styles.filterPillWrap}>
                {sampleOptions.map((sample) => (
                  <Pressable
                    key={sample}
                    style={[
                      styles.filterPill,
                      selectedSample === sample && styles.filterPillActive,
                    ]}
                    onPress={() => setSelectedSample(sample)}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedSample === sample && styles.filterPillTextActive,
                      ]}
                    >
                      {sample}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.filterActions}>
              <Pressable
                style={styles.filterClear}
                onPress={() => {
                  setSelectedCategory('All');
                  setSelectedSample('All');
                }}
              >
                <Text style={styles.filterClearText}>Clear Filters</Text>
              </Pressable>
              <Pressable style={styles.filterApply} onPress={() => setShowFilterPicker(false)}>
                <Text style={styles.filterApplyText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FormCard>
        <Text style={styles.sectionTitle}>Selected Tests</Text>
        <DataTable
          columns={['Test', 'Sample', 'Price']}
          rows={selectedTests.map((test) => [test.name, test.sample, `${test.price} EGP`])}
        />
      </FormCard>

      <FormCard>
        <View style={styles.priorityHeader}>
          <Text style={styles.sectionTitle}>Priority</Text>
          <View style={styles.priorityRow}>
            {(['Routine', 'Urgent', 'STAT'] as const).map((level) => (
              <Pressable
                key={level}
                style={[styles.priorityChip, priority === level && styles.priorityChipActive]}
                onPress={() => setPriority(level)}
              >
                <Text style={[styles.priorityChipText, priority === level && styles.priorityChipTextActive]}>
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Pricing & Payment</Text>
        <View style={styles.fieldGrid}>
          <TextInputField
            label="Insurance"
            placeholder="Self-pay"
            value={insuranceProvider || ''}
            onChangeText={() => null}
            editable={false}
          />
          <TextInputField
            label="Discount (%)"
            placeholder="0"
            value={insuranceProvider ? String(discountPercent) : '0'}
            onChangeText={() => null}
            editable={false}
          />
          <SelectField
            label="Payment Method"
            placeholder="Select method"
            value={paymentMethod}
            onPress={() => setShowPaymentPicker(true)}
          />
          <TextInputField label="Notes" placeholder="Add notes" value={notes} onChangeText={setNotes} />
        </View>
        <SummaryCard
          title="Order Summary"
          items={[
            { label: 'Subtotal', value: `${subtotal} EGP` },
            { label: `Discount (${discountPercent}%)`, value: `${discountValue} EGP` },
            { label: 'Total', value: `${total} EGP` },
          ]}
        />
        <View style={styles.invoiceActions}>
          <Pressable style={styles.smallButton} onPress={handlePrintInvoice}>
            <Text style={styles.smallButtonText}>Print / PDF Invoice</Text>
          </Pressable>
        </View>
      </FormCard>

      <Modal
        transparent
        visible={showPaymentPicker}
        animationType="fade"
        onRequestClose={() => setShowPaymentPicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPaymentPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            {['Cash', 'Visa'].map((method) => (
              <Pressable
                key={method}
                style={styles.paymentOption}
                onPress={() => {
                  setPaymentMethod(method);
                  setShowPaymentPicker(false);
                }}
              >
                <Text style={styles.paymentOptionText}>{method}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <FormCard>
        <Text style={styles.sectionTitle}>Barcode & Samples</Text>
        {Object.keys(sampleSummary).length === 0 ? (
          <Text style={styles.emptyText}>Select tests to generate barcodes.</Text>
        ) : (
          <View style={styles.barcodeGrid}>
            {Object.entries(sampleSummary).flatMap(([sample, tests]) => {
              const prefix = sampleCodeMap[sample] ?? sample.slice(0, 3).toUpperCase();
              return tests.map((testName, index) => {
                const tubeNumber = String(index + 1).padStart(2, '0');
                const code = `${orderId}-${prefix}-${tubeNumber}`;
                const uri = generateBarcodeData(code);
                return (
                  <View key={`${sample}-${testName}-${tubeNumber}`} style={styles.barcodeCard}>
                    <Text style={styles.barcodeTitle}>{sample}</Text>
                    <Text style={styles.barcodeMeta}>Order #{orderId}</Text>
                    {uri ? <Image source={{ uri }} style={styles.barcodeImage} /> : null}
                    <Text style={styles.barcodeCode}>{code}</Text>
                    <Text style={styles.barcodeMeta}>{testName}</Text>
                    <View style={styles.barcodeActions}>
                      <Pressable style={styles.smallButton} onPress={() => downloadPng(uri, `${code}.png`)}>
                        <Text style={styles.smallButtonText}>Download PNG</Text>
                      </Pressable>
                    <Pressable style={styles.smallButtonOutline} onPress={() => printBarcode(uri, code)}>
                      <Text style={styles.smallButtonTextAlt}>Print</Text>
                    </Pressable>
                    </View>
                  </View>
                );
              });
            })}
          </View>
        )}
      </FormCard>

      <View style={styles.actions}>
        <View style={styles.requestSentRow}>
          <PrimaryButton
            label={requestSent ? 'Request Sent' : 'Send request to the Lab'}
            onPress={handleSendToQueue}
            disabled={requestSent}
          />
          {showSentNotification ? (
            <View style={styles.requestSentBanner}>
              <Text style={styles.requestSentIcon}>OK</Text>
              <Text style={styles.requestSentText}>Request sent successfully. Redirecting to patient visit history...</Text>
            </View>
          ) : null}
        </View>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: theme.spacing.sm,
  },
  sectionSubtitle: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    marginBottom: theme.spacing.md,
  },
  fieldGrid: {
    gap: theme.spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  searchField: {
    flex: 1,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
  },
  filterButtonText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  attachGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: theme.spacing.md,
  },
  attachItem: {
    width: '24%',
  },
  summaryGrid: {
    gap: theme.spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  readonlyBlock: {
    flex: 1,
    minWidth: 260,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  readonlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readonlyLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  readonlyTag: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.slate,
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  readonlyValue: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  readonlyEmpty: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  editableBlock: {
    flex: 1,
    minWidth: 260,
  },
  addLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    marginBottom: theme.spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipReadonly: {
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  chipAdded: {
    borderColor: '#BEE3F8',
    backgroundColor: '#EBF8FF',
  },
  chipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  chipRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C53030',
  },
  chipRemoveText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 12,
  },
  comboInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  comboValue: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
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
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    maxWidth: 320,
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  filterSection: {
    gap: theme.spacing.xs,
  },
  filterLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#93C5FD',
  },
  filterPillText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  filterPillTextActive: {
    fontFamily: theme.font.heading,
    color: '#0F172A',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  filterClear: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
  },
  filterClearText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  requestSentText: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: '#065F46',
  },
  requestSentBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  requestSentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  requestSentIcon: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#047857',
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  priorityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  priorityChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  priorityChipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  priorityChipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  priorityChipTextActive: {
    color: theme.colors.ink,
  },
  filterApply: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  filterApplyText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#F8FAFC',
  },
  paymentOption: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  paymentOptionText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  comboSearch: {
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  optionList: {
    maxHeight: 120,
  },
  optionListContent: {
    paddingBottom: theme.spacing.sm,
  },
  optionItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionItemSelected: {
    backgroundColor: '#E0F2FE',
  },
  optionTextSelected: {
    color: '#0F172A',
    fontFamily: theme.font.heading,
  },
  optionText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  optionEmpty: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
    paddingVertical: 6,
  },
  comboDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  comboSectionTitle: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addRow: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  addButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  addButtonText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#F8FAFC',
  },
  testGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  testCard: {
    width: 200,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    gap: theme.spacing.xs,
  },
  testCardActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  testTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  testMeta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  testPrice: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  barcodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  barcodeCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    width: 240,
    gap: theme.spacing.xs,
  },
  barcodeTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  barcodeMeta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  barcodeCode: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  barcodeImage: {
    width: 180,
    height: 60,
    resizeMode: 'contain',
  },
  barcodeActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  smallButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  smallButtonOutline: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  smallButtonText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#F8FAFC',
  },
  smallButtonTextAlt: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.ink,
  },
  emptyText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  actions: {
    alignItems: 'flex-start',
    marginTop: theme.spacing.md,
  },
  invoiceActions: {
    marginTop: theme.spacing.md,
  },
});

