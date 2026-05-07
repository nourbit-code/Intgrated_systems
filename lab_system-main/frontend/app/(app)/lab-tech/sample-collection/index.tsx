import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, Pressable, Modal, Platform, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import bwipjs from 'bwip-js';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useInventory } from '@/hooks/useInventory';
import { useOrders, Order } from '@/hooks/useOrders';
import { usePatients } from '@/hooks/usePatients';
import {
  buildConsumptionRowsFromTests,
  getAvailableQuantity,
  writeOrderConsumptionDraft,
  type ConsumptionTemplateRow,
} from '@/utils/inventoryConsumption';

const specimenTypes = ['Whole Blood', 'Serum', 'Plasma', 'Urine', 'Swab'] as const;
const collectionSites = [
  'Left Arm',
  'Right Arm',
  'Left Hand',
  'Right Hand',
  'Finger (Left)',
  'Finger (Right)',
  'Heel',
  'Forearm',
  'Foot',
  'Urine Cup',
  'Throat',
  'Nasal',
  'Wound',
  'Catheter',
  'Other',
] as const;
const collectionMethods = [
  'Venipuncture',
  'Capillary (Fingerstick)',
  'Capillary (Heelstick)',
  'Arterial Draw',
  'Line Draw',
  'Midstream Urine',
  'Catheter Urine',
  'Swab',
  'Fine Needle Aspiration',
  'Biopsy',
  'Sputum Collection',
  'Stool Collection',
  'Saliva Collection',
] as const;
const conditionOptions = ['Normal', 'Hemolyzed', 'Insufficient', 'Contaminated', 'Clotted'] as const;
const labSections = ['Hematology', 'Chemistry', 'Microbiology', 'Pathology'] as const;
const tubeColors = [
  'Purple/Lavender (EDTA)',
  'Light Blue (Citrate)',
  'Red (Serum)',
  'Green (Heparin)',
  'Yellow/Gold (SST)',
  'Gray (Fluoride/Oxalate)',
  'Black (ESR)',
  'Pink (Blood Bank EDTA)',
  'Royal Blue (Trace Elements)',
  'White/Pearl (PPT)',
  'Tan (Lead)',
  'Orange (RST)',
  'No Tube (Swab/Container)',
] as const;

type Option = string;
const SPECIMEN_STORAGE_KEY = 'lab_specimen_by_order';
const SAMPLES_KEY = 'lab_samples_by_order';
const HISTORY_SOURCE_OPTIONS = ['Pulled from EMR', 'EMR + Addendum'] as const;

function mergeHistory(base?: string, addendum?: string, withAddendum?: boolean) {
  const baseText = (base ?? '').trim();
  const extra = (addendum ?? '').trim();
  if (!withAddendum || !extra) return baseText || 'None reported';
  if (!baseText || baseText.toLowerCase() === 'none reported') return extra;
  return `${baseText}; ${extra}`;
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

function printLabel(sampleId: string, barcode: string) {
  if (!barcode) return;
  const win = window.open('', '_blank', 'width=400,height=300');
  if (!win) return;
  win.onafterprint = () => {
    win.close();
  };
  win.document.write(`
    <html>
      <head>
        <title>Label ${sampleId}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          .id { font-size: 12px; color: #475569; }
          img { width: 240px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="id">Sample ID: ${sampleId}</div>
        <img src="${barcode}" />
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

type OptionPickerModalProps = {
  visible: boolean;
  title: string;
  options: readonly string[];
  selected?: string;
  onClose: () => void;
  onSelect: (value: string) => void;
};

function OptionPickerModal({ visible, title, options, selected, onClose, onSelect }: OptionPickerModalProps) {
  const [query, setQuery] = useState('');
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => null}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search option..."
            placeholderTextColor={theme.colors.slate}
            style={styles.modalSearchInput}
          />
          <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
            {filteredOptions.length === 0 ? (
              <Text style={styles.modalEmpty}>No matching options</Text>
            ) : (
              filteredOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.modalItem, selected === option && styles.modalItemActive]}
                  onPress={() => {
                    onSelect(option);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalItemText, selected === option && styles.modalItemTextActive]}>{option}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SampleCollection() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { updateOrderStatus, orders } = useOrders();
  const { items, consumptionTemplates } = useInventory();
  const { patients } = usePatients();
  const params = useLocalSearchParams<{ orderId?: string; testId?: string; patient?: string }>();

  const activeOrder = orders.find((order) => order.id === params.orderId) as Order | undefined;
  const patientRecord = patients.find((patient) => patient.id === activeOrder?.patientId);
  const orderMedicalHistory = activeOrder?.medicalHistorySnapshot;
  const orderId = params.orderId ?? activeOrder?.id ?? '1042';
  const patientName = params.patient ?? activeOrder?.patientName ?? 'Ahmed Hassan';
  const patientId = patientRecord?.externalId ?? activeOrder?.patientId ?? 'P-2041';
  const ageGenderText = patientRecord ? `${patientRecord.age} / ${patientRecord.gender}` : 'N/A';
  const tests = activeOrder?.tests?.map((t) => t.name).join(', ') ?? 'CBC';
  const orderDate = activeOrder?.date ?? '2026-03-17';
  const nonImagingTests = useMemo(
    () => (activeOrder?.tests ?? []).filter((test) => test.sample !== 'Imaging'),
    [activeOrder?.tests]
  );
  const stockItemNames = useMemo(
    () => Array.from(new Set(items.map((item) => item.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const autoConsumptionRows = useMemo(
    () => buildConsumptionRowsFromTests(nonImagingTests, consumptionTemplates),
    [nonImagingTests, consumptionTemplates]
  );

  const [specimenType, setSpecimenType] = useState<Option>('Whole Blood');
  const [collectionSite, setCollectionSite] = useState<Option>('Left Arm');
  const [collectionMethod, setCollectionMethod] = useState<Option>('Venipuncture');
  const [volume, setVolume] = useState('3');
  const [tubes, setTubes] = useState('1');
  const [condition, setCondition] = useState<Option>('Normal');
  const [conditionNotes, setConditionNotes] = useState('');
  const [labSection, setLabSection] = useState<Option>('Hematology');
  const [storageTemp] = useState<Option>('Room Temp');
  const [historySourceMode, setHistorySourceMode] = useState<(typeof HISTORY_SOURCE_OPTIONS)[number]>(
    HISTORY_SOURCE_OPTIONS[0]
  );
  const [allergiesAddendum, setAllergiesAddendum] = useState('');
  const [conditionsAddendum, setConditionsAddendum] = useState('');
  const [medicationsAddendum, setMedicationsAddendum] = useState('');
  const [tubeColor, setTubeColor] = useState<Option>('Purple (EDTA)');
  const [fastingHours, setFastingHours] = useState('8');
  const [showTubePicker, setShowTubePicker] = useState(false);
  const [consumptionRows, setConsumptionRows] = useState<ConsumptionTemplateRow[]>([]);
  const [hasManualConsumptionEdit, setHasManualConsumptionEdit] = useState(false);
  const [samples, setSamples] = useState<Array<{
    id: string;
    barcodeId: string;
    specimenType: string;
    collectionSite: string;
    collectionMethod: string;
    volume: string;
    tubes: string;
    collectedAt: string;
    condition: string;
    conditionNotes: string;
    labSection: string;
    storageTemp: string;
    tubeColor: string;
    fastingHours: string;
  }>>([]);

  const [showSpecimenPicker, setShowSpecimenPicker] = useState(false);
  const [showSitePicker, setShowSitePicker] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const [showConsumptionItemPicker, setShowConsumptionItemPicker] = useState(false);
  const [activeConsumptionRow, setActiveConsumptionRow] = useState<number | null>(null);
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
  const withHistoryAddendum = historySourceMode === 'EMR + Addendum';

  const collectedAt = useMemo(() => new Date().toLocaleString(), []);
  const nextSampleIndex = samples.length + 1;
  const nextSampleId = `SMP-${orderId}-${String(nextSampleIndex).padStart(2, '0')}`;
  const nextBarcodeId = `${orderId}-BLD-${String(nextSampleIndex).padStart(2, '0')}`;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!orderId) return;
    try {
      const stored = window.localStorage.getItem(SAMPLES_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, typeof samples>;
      if (parsed[orderId]) setSamples(parsed[orderId]);
    } catch {
      // ignore
    }
  }, [orderId]);

  useEffect(() => {
    if (hasManualConsumptionEdit) return;
    setConsumptionRows(autoConsumptionRows);
  }, [autoConsumptionRows, hasManualConsumptionEdit]);

  useEffect(() => {
    if (!orderId) return;
    writeOrderConsumptionDraft(
      orderId,
      consumptionRows.filter((row) => row.itemName.trim() && Number(row.quantity) > 0)
    );
  }, [orderId, consumptionRows]);

  const persistSpecimen = () => {
    if (!orderId) return;
    if (Platform.OS !== 'web') return;
    const payload = {
      specimenType,
      collectionSite,
      collectionMethod,
      volume,
      tubes,
      collectedAt,
      condition,
      conditionNotes,
      labSection,
      storageTemp,
      tubeColor,
      fastingHours,
      sampleId: nextSampleId,
      barcodeId: nextBarcodeId,
    };
    try {
      const stored = window.localStorage.getItem(SPECIMEN_STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as Record<string, typeof payload>) : {};
      parsed[orderId] = payload;
      window.localStorage.setItem(SPECIMEN_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore
    }
  };

  const persistSamples = (nextSamples: typeof samples) => {
    if (!orderId) return;
    if (Platform.OS !== 'web') return;
    try {
      const stored = window.localStorage.getItem(SAMPLES_KEY);
      const parsed = stored ? (JSON.parse(stored) as Record<string, typeof samples>) : {};
      parsed[orderId] = nextSamples;
      window.localStorage.setItem(SAMPLES_KEY, JSON.stringify(parsed));
    } catch {
      // ignore
    }
  };

  const handleAddSample = () => {
    const sampleId = nextSampleId;
    const barcodeId = nextBarcodeId;
    const next = [
      ...samples,
      {
        id: sampleId,
        barcodeId,
        specimenType,
        collectionSite,
        collectionMethod,
        volume,
        tubes,
        collectedAt,
        condition,
        conditionNotes,
        labSection,
        storageTemp,
        tubeColor,
        fastingHours,
      },
    ];
    setSamples(next);
    persistSamples(next);
    persistSpecimen();
  };

  const handleCollected = () => {
    if (!orderId) return;
    persistSpecimen();
    persistSamples(samples);
    updateOrderStatus(orderId, 'In Progress');
  };

  const handleSendToLab = () => {
    if (!orderId) return;
    persistSpecimen();
    persistSamples(samples);
    updateOrderStatus(orderId, 'In Progress');
    const testId = params.testId ?? activeOrder?.tests[0]?.id ?? '';
    const nextPath = `/lab-tech/test-selection/${encodeURIComponent(orderId)}?testId=${encodeURIComponent(testId)}&patient=${encodeURIComponent(patientName)}`;
    router.push(nextPath as Href);
  };

  return (
    <DashboardLayout title="Sample Collection">
      <View style={styles.pageGrid}>
        <View style={styles.mainColumn}>
          <FormCard>
            <Text style={styles.sectionTitle}>Order / Request Information</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Order ID</Text>
                <Text style={styles.infoValue}>{`LAB-${orderId}`}</Text>
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
                <Text style={styles.infoLabel}>Age / Gender</Text>
                <Text style={styles.infoValue}>{ageGenderText}</Text>
              </View>
              <View style={styles.infoBlockFull}>
                <Text style={styles.infoLabel}>Requested Tests</Text>
                <Text style={styles.infoValue}>{tests}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Order Date</Text>
                <Text style={styles.infoValue}>{orderDate}</Text>
              </View>
            </View>
          </FormCard>

          <FormCard>
            <Text style={styles.sectionTitle}>Medical History Summary</Text>
            <View style={styles.historyModeRow}>
              {HISTORY_SOURCE_OPTIONS.map((option) => {
                const active = historySourceMode === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.historyModeChip, active && styles.historyModeChipActive]}
                    onPress={() => setHistorySourceMode(option)}
                  >
                    <Text style={[styles.historyModeChipText, active && styles.historyModeChipTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.infoGrid}>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Allergies</Text>
                <Text style={styles.infoValue}>
                  {mergeHistory(
                    orderMedicalHistory?.allergies ?? patientRecord?.medicalHistory?.allergies,
                    allergiesAddendum,
                    withHistoryAddendum
                  )}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Chronic Conditions</Text>
                <Text style={styles.infoValue}>
                  {mergeHistory(
                    orderMedicalHistory?.chronicConditions ?? patientRecord?.medicalHistory?.chronicConditions,
                    conditionsAddendum,
                    withHistoryAddendum
                  )}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Current Medications</Text>
                <Text style={styles.infoValue}>
                  {mergeHistory(
                    orderMedicalHistory?.currentMedications ?? patientRecord?.medicalHistory?.currentMedications,
                    medicationsAddendum,
                    withHistoryAddendum
                  )}
                </Text>
              </View>
            </View>
            {withHistoryAddendum ? (
              <View style={styles.addendumGrid}>
                <View style={styles.formCell}>
                  <TextInputField
                    label="Allergies Addendum"
                    value={allergiesAddendum}
                    onChangeText={setAllergiesAddendum}
                    placeholder="Add extra details"
                  />
                </View>
                <View style={styles.formCell}>
                  <TextInputField
                    label="Conditions Addendum"
                    value={conditionsAddendum}
                    onChangeText={setConditionsAddendum}
                    placeholder="Add extra details"
                  />
                </View>
                <View style={styles.formCell}>
                  <TextInputField
                    label="Medications Addendum"
                    value={medicationsAddendum}
                    onChangeText={setMedicationsAddendum}
                    placeholder="Add extra details"
                  />
                </View>
              </View>
            ) : null}
          </FormCard>

          <FormCard>
            <Text style={styles.sectionTitle}>Test Details</Text>
            <View style={styles.detailGrid}>
              <View style={styles.formCell}>
                <TextInputField label="Test Name" value={tests} editable={false} />
              </View>
              <View style={styles.formCell}>
                <TextInputField label="Specimen Type" value={specimenType} editable={false} />
              </View>
              <View style={styles.formCell}>
                <SelectField label="Tube Color" value={tubeColor} onPress={() => setShowTubePicker(true)} />
              </View>
              <View style={styles.formCell}>
                <TextInputField label="Required Volume" value="3 ml" editable={false} />
              </View>
              <View style={styles.formCell}>
                <TextInputField label="Container Type" value="EDTA Tube (Purple)" editable={false} />
              </View>
              <View style={styles.formCell}>
                <TextInputField label="Special Instructions" value="Mix gently after collection" editable={false} />
              </View>
            </View>
          </FormCard>

          <FormCard>
            <Text style={styles.sectionTitle}>Sample Collection Form</Text>
            <View style={styles.formGrid}>
              <View style={styles.formCell}>
                <SelectField label="Collection Site" value={collectionSite} onPress={() => setShowSitePicker(true)} />
              </View>
              <View style={styles.formCell}>
                <SelectField label="Collection Method" value={collectionMethod} onPress={() => setShowMethodPicker(true)} />
              </View>
              <View style={styles.formCell}>
                <TextInputField label="Fasting (hours)" value={fastingHours} onChangeText={setFastingHours} />
              </View>
              <View style={styles.formCell}>
                <TextInputField label="Number of Tubes" value={tubes} onChangeText={setTubes} />
              </View>
              <View style={styles.formCell}>
                <TextInputField label="Collection Date & Time" value={collectedAt} editable={false} />
              </View>
            </View>
            <View style={styles.actions}>
              <PrimaryButton label="Add Sample" onPress={handleAddSample} />
            </View>
          </FormCard>

          <FormCard>
            <Text style={styles.sectionTitle}>Barcode & Sample Labeling</Text>
            {samples.length === 0 ? (
              <Text style={styles.emptyText}>Add a sample to generate barcodes.</Text>
            ) : (
              samples.map((sample) => (
                <View key={sample.id} style={styles.barcodeRow}>
                  <View style={styles.barcodeMeta}>
                    <Text style={styles.infoLabel}>Sample ID</Text>
                    <Text style={styles.infoValue}>{sample.id}</Text>
                  </View>
                  <View style={styles.barcodeMeta}>
                    <Text style={styles.infoLabel}>Barcode ID</Text>
                    <Text style={styles.infoValue}>{sample.barcodeId ?? sample.id}</Text>
                  </View>
                  <Pressable
                    style={styles.printButton}
                    onPress={() =>
                      printLabel(
                        sample.id,
                        Platform.OS === 'web' ? generateBarcodeData(sample.barcodeId ?? sample.id) : '',
                      )
                    }
                  >
                    <Text style={styles.printButtonText}>Print Label</Text>
                  </Pressable>
                </View>
              ))
            )}
          </FormCard>

          <FormCard>
            <Text style={styles.sectionTitle}>Sample Condition</Text>
            <View style={styles.chipRow}>
              {conditionOptions.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setCondition(item)}
                  style={[styles.chip, condition === item && styles.chipActive]}
                >
                  <Text style={[styles.chipText, condition === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.notesRow}>
              <TextInputField label="Condition Notes" value={conditionNotes} onChangeText={setConditionNotes} />
            </View>
          </FormCard>

          <FormCard>
            <Text style={styles.sectionTitle}>Technician Information</Text>
            <View style={styles.techGrid}>
              <View style={styles.techCell}>
                <TextInputField label="Technician Name" value={currentUser?.name || 'Lab Technician'} editable={false} />
              </View>
              <View style={styles.techCell}>
                <TextInputField label="Technician ID" value={currentUser?.id || 'LAB-0000'} editable={false} />
              </View>
              <View style={styles.techCell}>
                <TextInputField label="Collection Time" value={collectedAt} editable={false} />
              </View>
            </View>
          </FormCard>

          <View style={styles.actions}>
            <PrimaryButton label="Select Tests" onPress={handleSendToLab} />
            <Pressable style={styles.cancelButton} onPress={() => router.back()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sideColumn}>
          <FormCard>
            <Text style={styles.sectionTitle}>Samples Added</Text>
            <View style={styles.sampleList}>
              {samples.length === 0 ? (
                <Text style={styles.alertText}>No samples added yet.</Text>
              ) : (
                samples.map((sample) => (
                  <View key={sample.id} style={styles.sampleRow}>
                    <Text style={styles.sampleId}>{sample.id}</Text>
                    <Text style={styles.sampleMeta}>
                      {sample.specimenType} · {sample.tubeColor} · {sample.volume} ml
                    </Text>
                  </View>
                ))
              )}
            </View>
          </FormCard>

          <FormCard>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tests</Text>
              <Text style={styles.summaryValue}>{activeOrder?.tests?.length ?? 1}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Specimens</Text>
              <Text style={styles.summaryValue}>{samples.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Priority</Text>
              <Text style={styles.summaryValue}>Routine</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Collection Status</Text>
              <StatusBadge status="samples-waiting" />
            </View>
          </FormCard>

          <FormCard>
            <Text style={styles.sectionTitle}>Consumption Summary</Text>
            {shortages.length ? (
              <View style={styles.shortageBox}>
                <Text style={styles.shortageTitle}>Low stock warning</Text>
                {shortages.map((row) => (
                  <Text key={`s-short-${row.itemName}`} style={styles.shortageText}>
                    {`${row.itemName}: required ${row.required}, available ${row.available}`}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.consumptionList}>
              {consumptionRows.map((row, index) => (
                <View key={`s-cons-${index}`} style={styles.consumptionRow}>
                  <View style={styles.consumptionItemField}>
                    <SelectField
                      label="Item"
                      value={row.itemName || 'Select item'}
                      onPress={() => {
                        setActiveConsumptionRow(index);
                        setShowConsumptionItemPicker(true);
                      }}
                    />
                  </View>
                  <View style={styles.consumptionQtyField}>
                    <TextInputField
                      label="Qty"
                      value={String(row.quantity)}
                      keyboardType="number-pad"
                      onChangeText={(value) => {
                        setHasManualConsumptionEdit(true);
                        setConsumptionRows((prev) =>
                          prev.map((entry, idx) =>
                            idx === index
                              ? { ...entry, quantity: Number(value.replace(/[^0-9]/g, '') || '0') }
                              : entry
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
              {!consumptionRows.length ? <Text style={styles.alertText}>No template set for these tests yet.</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  style={styles.smallActionButton}
                  onPress={() => {
                    setHasManualConsumptionEdit(true);
                    setConsumptionRows((prev) => [...prev, { itemName: stockItemNames[0] ?? '', quantity: 1 }]);
                  }}
                >
                  <Text style={styles.smallActionText}>Add Extra Item</Text>
                </Pressable>
                <Pressable
                  style={styles.smallActionButton}
                  onPress={() => {
                    setHasManualConsumptionEdit(false);
                    setConsumptionRows(autoConsumptionRows);
                  }}
                >
                  <Text style={styles.smallActionText}>Reset Template</Text>
                </Pressable>
              </View>
            </View>
          </FormCard>

        </View>
      </View>

      <OptionPickerModal
        visible={showSpecimenPicker}
        title="Specimen Type"
        options={specimenTypes}
        selected={specimenType}
        onClose={() => setShowSpecimenPicker(false)}
        onSelect={setSpecimenType}
      />

      <OptionPickerModal
        visible={showSitePicker}
        title="Collection Site"
        options={collectionSites}
        selected={collectionSite}
        onClose={() => setShowSitePicker(false)}
        onSelect={setCollectionSite}
      />

      <OptionPickerModal
        visible={showMethodPicker}
        title="Collection Method"
        options={collectionMethods}
        selected={collectionMethod}
        onClose={() => setShowMethodPicker(false)}
        onSelect={setCollectionMethod}
      />

      <OptionPickerModal
        visible={showSectionPicker}
        title="Lab Section"
        options={labSections}
        selected={labSection}
        onClose={() => setShowSectionPicker(false)}
        onSelect={setLabSection}
      />

      <OptionPickerModal
        visible={showTubePicker}
        title="Tube Color"
        options={tubeColors}
        selected={tubeColor}
        onClose={() => setShowTubePicker(false)}
        onSelect={setTubeColor}
      />

      <OptionPickerModal
        visible={showConsumptionItemPicker}
        title="Select Inventory Item"
        options={stockItemNames}
        selected={activeConsumptionRow === null ? undefined : (consumptionRows[activeConsumptionRow]?.itemName ?? '')}
        onClose={() => {
          setShowConsumptionItemPicker(false);
          setActiveConsumptionRow(null);
        }}
        onSelect={(value) => {
          if (activeConsumptionRow === null) return;
          setHasManualConsumptionEdit(true);
          setConsumptionRows((prev) =>
            prev.map((entry, idx) => (idx === activeConsumptionRow ? { ...entry, itemName: value } : entry))
          );
        }}
      />
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  pageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
  },
  mainColumn: {
    flex: 1,
    minWidth: 320,
    gap: theme.spacing.lg,
  },
  sideColumn: {
    width: Platform.OS === 'web' ? 360 : '100%',
    gap: theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  infoGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoBlock: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: Platform.OS === 'web' ? '31.5%' : '100%',
    minWidth: Platform.OS === 'web' ? 220 : 170,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  infoBlockFull: {
    flexBasis: Platform.OS === 'web' ? '31.5%' : '100%',
    width: Platform.OS === 'web' ? '31.5%' : '100%',
    minWidth: Platform.OS === 'web' ? 220 : 170,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
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
    fontSize: 15,
    color: theme.colors.ink,
  },
  detailGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  techGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  techCell: {
    width: Platform.OS === 'web' ? '31.5%' : '100%',
  },
  formGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  formCell: {
    width: Platform.OS === 'web' ? '31.5%' : '100%',
  },
  addendumGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  historyModeRow: {
    marginTop: theme.spacing.sm,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 0,
  },
  historyModeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  historyModeChipActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  historyModeChipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  historyModeChipTextActive: {
    color: theme.colors.ink,
  },
  barcodeRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  barcodeMeta: {
    minWidth: 140,
    gap: 4,
  },
  printButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  printButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#F8FAFC',
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  chipRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  chipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  chipTextActive: {
    color: theme.colors.ink,
  },
  notesRow: {
    marginTop: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  summaryRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    fontFamily: theme.font.heading,
    fontSize: 13,
    color: theme.colors.ink,
  },
  sampleList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  sampleRow: {
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  sampleId: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: theme.colors.ink,
  },
  sampleMeta: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.slate,
  },
  alertText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B45309',
  },
  shortageBox: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: theme.radius.sm,
    backgroundColor: '#FEF2F2',
    padding: theme.spacing.sm,
    gap: 4,
    marginTop: theme.spacing.sm,
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
  consumptionList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  consumptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  consumptionItemField: {
    width: '100%',
  },
  consumptionQtyField: {
    width: 120,
  },
  inlineRemoveButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 3,
    alignSelf: 'flex-end',
  },
  inlineRemoveText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#991B1B',
  },
  smallActionButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  smallActionText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
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
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
    backgroundColor: '#F8FAFC',
  },
  modalList: {
    width: '100%',
  },
  modalListContent: {
    paddingBottom: theme.spacing.xs,
    gap: 6,
  },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  modalItemActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  modalItemText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  modalItemTextActive: {
    fontFamily: theme.font.heading,
  },
  modalEmpty: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
    paddingVertical: theme.spacing.sm,
    textAlign: 'center',
  },
});
