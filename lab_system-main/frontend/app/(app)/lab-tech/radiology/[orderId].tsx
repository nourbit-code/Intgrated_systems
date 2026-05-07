import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as dicomParser from 'dicom-parser';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FileUpload } from '@/components/ui/FileUpload';
import { FormCard } from '@/components/ui/FormCard';
import { TextArea } from '@/components/ui/TextArea';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextInputField } from '@/components/ui/TextInputField';
import { SelectField } from '@/components/ui/SelectField';
import { theme } from '@/constants/theme';
import { buildUserSignature, useAuth } from '@/hooks/useAuth';
import { useInventory } from '@/hooks/useInventory';
import { useOrders, Order } from '@/hooks/useOrders';
import { usePatients } from '@/hooks/usePatients';
import { API_BASE_URL, apiRequest } from '@/utils/api';
import {
  allocateConsumption,
  buildConsumptionRowsFromTests,
  getAvailableQuantity,
  markOrderConsumptionApplied,
  wasOrderConsumptionApplied,
  type ConsumptionTemplateRow,
} from '@/utils/inventoryConsumption';

type ApiScanResult = {
  id: number;
  scan_order: number;
  finding_text: string | null;
  image_file: string | null;
  reported_at: string | null;
};

function pickImagingTests(order?: Order) {
  if (!order) return [];
  return order.tests.filter((test) => {
    if (test.sample === 'Imaging') return true;
    return false;
  });
}

function ViewerSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(1);
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));

  const updateValue = (x: number) => {
    const next = min + Math.min(1, Math.max(0, x / trackWidth)) * (max - min);
    onChange(next);
  };

  return (
    <View style={styles.viewerControlRow}>
      <Text style={styles.viewerFooter}>{label}</Text>
      <View
        style={styles.viewerSliderTrack}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width || 1)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => updateValue(event.nativeEvent.locationX ?? 0)}
        onResponderMove={(event) => updateValue(event.nativeEvent.locationX ?? 0)}
      >
        <View style={[styles.viewerSliderThumb, { left: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

export default function RadiologyUploadDetail() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const { orders, updateOrderStatus } = useOrders();
  const { currentUser } = useAuth();
  const { items, consumptionTemplates, consumeItems } = useInventory();
  const { patients } = usePatients();
  const [dicomImageUri, setDicomImageUri] = useState<string | null>(null);
  const [dicomMeta, setDicomMeta] = useState<{ rows: number; cols: number } | null>(null);
  const [dicomFrames, setDicomFrames] = useState(1);
  const [dicomFrameIndex, setDicomFrameIndex] = useState(0);
  const [dicomItems, setDicomItems] = useState<
    Array<{
      id: string;
      scanId: string;
      fingerprint: string;
      name: string;
      sourceUri: string;
      pixels: Uint16Array | Uint8Array;
      info: { rows: number; cols: number; slope: number; intercept: number; frames: number };
      meta: { rows: number; cols: number };
      previewUri: string | null;
      windowCenter: number;
      windowWidth: number;
    }>
  >([]);
  const [dicomIndex, setDicomIndex] = useState(0);
  const [rightDicomIndex, setRightDicomIndex] = useState<number | null>(null);
  const [uploadImages, setUploadImages] = useState<
    Array<{
      id: string;
      fingerprint: string;
      uri: string;
      scanId: string;
    }>
  >([]);
  const maxUploadItems = 10;
  const [uploadLimitNote, setUploadLimitNote] = useState<string | null>(null);
  const [uploadImageIndex, setUploadImageIndex] = useState(0);
  const [rightImageIndex, setRightImageIndex] = useState<number | null>(null);
  const [uploadKind, setUploadKind] = useState<'dicom' | 'image' | null>(null);
  const [compareTarget, setCompareTarget] = useState<'left' | 'right'>('left');
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  const [rightViewerSize, setRightViewerSize] = useState({ width: 0, height: 0 });
  const [fullViewerSize, setFullViewerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [rightImageSize, setRightImageSize] = useState({ width: 0, height: 0 });
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; value: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rightZoom, setRightZoom] = useState(1);
  const [rightPan, setRightPan] = useState({ x: 0, y: 0 });
  const [activeViewer, setActiveViewer] = useState<'left' | 'right'>('left');
  const [fullZoom, setFullZoom] = useState(1);
  const [fullPan, setFullPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [rightBrightness, setRightBrightness] = useState(1);
  const [rightContrast, setRightContrast] = useState(1);
  const [pinMode, setPinMode] = useState(false);
  const [pinsByScan, setPinsByScan] = useState<Record<string, Array<{ id: string; x: number; y: number }>>>({});
  const [savedPinsByScan, setSavedPinsByScan] = useState<Record<string, { savedAt: number; count: number }>>({});
  const [fullScreenViewer, setFullScreenViewer] = useState<'left' | 'right' | null>(null);
  const [modality, setModality] = useState<string>('CT');
  const [bodyPart, setBodyPart] = useState<string>('Brain');
  const [laterality, setLaterality] = useState<string>('N/A');
  const [severity, setSeverity] = useState<string>('Normal');
  const [followUp, setFollowUp] = useState<string>('None');
  const [findings, setFindings] = useState<string>('');
  const [consumptionRows, setConsumptionRows] = useState<ConsumptionTemplateRow[]>([]);
  const [hasManualConsumptionEdit, setHasManualConsumptionEdit] = useState(false);
  const [activeConsumptionRow, setActiveConsumptionRow] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [reportSaved, setReportSaved] = useState<string | null>(null);
  const [selectModal, setSelectModal] = useState<{
    field: 'modality' | 'bodyPart' | 'laterality' | 'severity' | 'followUp' | 'consumptionItem' | null;
    label: string;
    options: string[];
  }>({ field: null, label: '', options: [] });
  const [windowCenter, setWindowCenter] = useState(40);
  const [windowWidth, setWindowWidth] = useState(120);
  const viewerRef = useRef<View>(null);
  const rightViewerRef = useRef<View>(null);
  const fullViewerRef = useRef<View>(null);
  const dicomKeyRef = useRef(0);
  const scanIdMapRef = useRef<Record<string, string>>({});
  const scanIdCounterRef = useRef<Record<string, number>>({});
  const updateStatusRef = useRef<(id: string, status: Order['status']) => void>(() => {});
  const dicomPixelsRef = useRef<Uint16Array | Uint8Array | null>(null);
  const dicomInfoRef = useRef<{ rows: number; cols: number; slope: number; intercept: number; frames: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const dragDistanceRef = useRef(0);
  const skipNextClickRef = useRef(false);
  const rightIsDraggingRef = useRef(false);
  const rightDragStartRef = useRef({ x: 0, y: 0 });
  const rightPanStartRef = useRef({ x: 0, y: 0 });
  const rightDragDistanceRef = useRef(0);
  const rightSkipNextClickRef = useRef(false);
  const fullIsDraggingRef = useRef(false);
  const fullDragStartRef = useRef({ x: 0, y: 0 });
  const fullPanStartRef = useRef({ x: 0, y: 0 });
  const fullDragDistanceRef = useRef(0);
  const statusSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    updateStatusRef.current = updateOrderStatus;
  }, [updateOrderStatus]);

  const order = useMemo(
    () => orders.find((item) => item.id === params.orderId),
    [orders, params.orderId],
  );

  useEffect(() => {
    if (!order?.id) return;
    if (order.status === 'Completed') return;
    if (order.status === 'In Progress') return;
    if (statusSetRef.current.has(order.id)) return;
    statusSetRef.current.add(order.id);
    updateStatusRef.current(order.id, 'In Progress');
  }, [order?.id, order?.status]);

  const patientRecord = useMemo(
    () => patients.find((patient) => patient.id === order?.patientId),
    [patients, order?.patientId],
  );
  const imagingTests = useMemo(() => pickImagingTests(order), [order?.tests]);
  const stockItemNames = useMemo(
    () => Array.from(new Set(items.map((item) => item.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );
  const autoConsumptionRows = useMemo(
    () => buildConsumptionRowsFromTests(imagingTests, consumptionTemplates),
    [imagingTests, consumptionTemplates]
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
    if (hasManualConsumptionEdit) return;
    setConsumptionRows(autoConsumptionRows);
  }, [autoConsumptionRows, hasManualConsumptionEdit]);
  const patientName = order?.patientName ?? 'Unknown Patient';
  const techName = currentUser?.name?.trim() || 'Lab Technician';
  const orderId = order?.id ?? params.orderId ?? 'Unknown';
  const isCompleted = order?.status === 'Completed';
  const patientId = order?.patientId ?? '—';
  const patientAge = patientRecord?.age ? `${patientRecord.age}` : '—';
  const patientGender = patientRecord?.gender ?? '—';
  const reportTimestamp = useMemo(
    () =>
      new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );
  const modalityOptions = ['X-Ray', 'CT', 'MRI', 'US', 'Other'];
  const bodyPartOptions = ['Chest', 'Brain', 'Knee', 'Spine', 'Abdomen', 'Pelvis', 'Other'];
  const lateralityOptions = ['Left', 'Right', 'Bilateral', 'N/A'];
  const severityOptions = ['Normal', 'Mild', 'Moderate', 'Severe', 'Critical'];
  const followUpOptions = ['None', 'Repeat Imaging', 'Clinical Correlation', 'Specialist Referral'];
  const openSelect = (field: typeof selectModal.field, label: string, options: string[]) =>
    setSelectModal({ field, label, options });
  const closeSelect = () => {
    setSelectModal({ field: null, label: '', options: [] });
    setActiveConsumptionRow(null);
  };
  const commitSelect = (value: string) => {
    switch (selectModal.field) {
      case 'modality':
        setModality(value);
        break;
      case 'bodyPart':
        setBodyPart(value);
        break;
      case 'laterality':
        setLaterality(value);
        break;
      case 'severity':
        setSeverity(value);
        break;
      case 'followUp':
        setFollowUp(value);
        break;
      case 'consumptionItem':
        if (activeConsumptionRow !== null) {
          setHasManualConsumptionEdit(true);
          setConsumptionRows((prev) =>
            prev.map((entry, idx) => (idx === activeConsumptionRow ? { ...entry, itemName: value } : entry))
          );
        }
        break;
      default:
        break;
    }
    closeSelect();
  };

  const updateImageSize = (width: number, height: number) => {
    if (!width || !height) return;
    setImageSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const renderDicomToDataUrl = (
    pixels: Uint16Array | Uint8Array,
    info: { rows: number; cols: number; slope: number; intercept: number },
    frameIndex: number,
    wc: number,
    ww: number,
  ) => {
    if (Platform.OS !== 'web') return;
    const { rows, cols, slope, intercept } = info;
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.createImageData(cols, rows);

    const min = wc - ww / 2;
    const max = wc + ww / 2;
    const range = Math.max(max - min, 1);
    const frameOffset = frameIndex * rows * cols;

    for (let i = 0; i < rows * cols; i += 1) {
      const raw = pixels[frameOffset + i] * slope + intercept;
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
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (uploadKind !== 'dicom') return;
    const current = dicomItems[dicomIndex];
    if (!current) return;
    const uri = renderDicomToDataUrl(current.pixels, current.info, dicomFrameIndex, windowCenter, windowWidth);
    if (uri) setDicomImageUri(uri);
  }, [dicomFrameIndex, uploadKind, windowCenter, windowWidth, dicomIndex, dicomItems]);

  const currentUploadImageUri = uploadKind === 'image' ? uploadImages[uploadImageIndex]?.uri ?? null : null;
  const secondaryImageUri =
    uploadKind === 'image'
      ? (rightImageIndex === null ? null : uploadImages[rightImageIndex]?.uri ?? null)
      : uploadKind === 'dicom'
        ? (rightDicomIndex === null ? null : dicomItems[rightDicomIndex]?.previewUri ?? null)
        : null;
  // secondary is explicit right selection now

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRightZoom(1);
    setRightPan({ x: 0, y: 0 });
    setBrightness(1);
    setContrast(1);
    setRightBrightness(1);
    setRightContrast(1);
    setRightImageSize({ width: 0, height: 0 });
    setFullZoom(1);
    setFullPan({ x: 0, y: 0 });
    setHoverInfo(null);
  }, [currentUploadImageUri, dicomImageUri, uploadKind]);

  useEffect(() => {
    if (!fullScreenViewer) return;
    setFullZoom(1);
    setFullPan({ x: 0, y: 0 });
  }, [fullScreenViewer]);

  useEffect(() => {
    if (uploadKind !== 'dicom') return;
    if (rightDicomIndex === null) return;
    const meta = dicomItems[rightDicomIndex]?.meta;
    if (meta?.cols && meta?.rows) {
      setRightImageSize({ width: meta.cols, height: meta.rows });
    }
  }, [rightDicomIndex, uploadKind, dicomItems]);

  const getFilterStyle = (target: 'left' | 'right') => {
    if (Platform.OS !== 'web') return null;
    const b = target === 'left' ? brightness : rightBrightness;
    const c = target === 'left' ? contrast : rightContrast;
    return { filter: `brightness(${b}) contrast(${c})` } as any;
  };

  const getImageTransform = (target: 'left' | 'right' | 'full') => {
    if (target === 'full') {
      const isLeft = fullScreenViewer === 'left';
      const info = isLeft ? dicomInfoRef.current : dicomItems[rightDicomIndex ?? -1]?.info ?? null;
      const meta = isLeft ? dicomMeta : dicomItems[rightDicomIndex ?? -1]?.meta ?? null;
      const size = isLeft ? imageSize : rightImageSize;
      const viewer = fullViewerSize.width ? fullViewerSize : viewerSize;
      const cols = info?.cols ?? meta?.cols ?? size.width;
      const rows = info?.rows ?? meta?.rows ?? size.height;
      const imgW = size.width || cols || 0;
      const imgH = size.height || rows || 0;
      if (!imgW || !imgH || !viewer.width || !viewer.height) return null;
      const scale = Math.min(viewer.width / imgW, viewer.height / imgH);
      const offsetX = (viewer.width - imgW * scale) / 2 + fullPan.x;
      const offsetY = (viewer.height - imgH * scale) / 2 + fullPan.y;
      const originX = offsetX - (imgW * scale * (fullZoom - 1)) / 2;
      const originY = offsetY - (imgH * scale * (fullZoom - 1)) / 2;
      return { scale, offsetX, offsetY, originX, originY, imgW, imgH, zoom: fullZoom };
    }
    const isLeft = target === 'left';
    const info = isLeft ? dicomInfoRef.current : dicomItems[rightDicomIndex ?? -1]?.info ?? null;
    const meta = isLeft ? dicomMeta : dicomItems[rightDicomIndex ?? -1]?.meta ?? null;
    const size = isLeft ? imageSize : rightImageSize;
    const viewer = isLeft ? viewerSize : (rightViewerSize.width ? rightViewerSize : viewerSize);
    const panState = isLeft ? pan : rightPan;
    const zoomState = isLeft ? zoom : rightZoom;
    const cols = info?.cols ?? meta?.cols ?? size.width;
    const rows = info?.rows ?? meta?.rows ?? size.height;
    const imgW = size.width || cols || 0;
    const imgH = size.height || rows || 0;
    if (!imgW || !imgH || !viewer.width || !viewer.height) return null;
    const scale = Math.min(viewer.width / imgW, viewer.height / imgH);
    const offsetX = (viewer.width - imgW * scale) / 2 + panState.x;
    const offsetY = (viewer.height - imgH * scale) / 2 + panState.y;
    const originX = offsetX - (imgW * scale * (zoomState - 1)) / 2;
    const originY = offsetY - (imgH * scale * (zoomState - 1)) / 2;
    return { scale, offsetX, offsetY, originX, originY, imgW, imgH, zoom: zoomState };
  };

  const getImageCoordsFromEvent = (target: 'left' | 'right' | 'full', event: any) => {
    const transform = getImageTransform(target);
    if (!transform) return null;
    const { scale, originX, originY, imgW, imgH, zoom: localZoom } = transform;
    const displayW = imgW * scale * localZoom;
    const displayH = imgH * scale * localZoom;
    let localX = 0;
    let localY = 0;
    if (Platform.OS === 'web') {
      const rect =
        (target === 'left'
          ? viewerRef.current
          : target === 'right'
            ? rightViewerRef.current
            : fullViewerRef.current) as any;
      const bounds = rect?.getBoundingClientRect?.();
      const clientX = event?.clientX ?? event?.nativeEvent?.pageX ?? 0;
      const clientY = event?.clientY ?? event?.nativeEvent?.pageY ?? 0;
      if (bounds) {
        localX = clientX - bounds.left - originX;
        localY = clientY - bounds.top - originY;
      } else {
        localX = (event.nativeEvent?.locationX ?? event.nativeEvent?.offsetX ?? 0) - originX;
        localY = (event.nativeEvent?.locationY ?? event.nativeEvent?.offsetY ?? 0) - originY;
      }
    } else {
      localX = (event.nativeEvent?.locationX ?? event.nativeEvent?.offsetX ?? 0) - originX;
      localY = (event.nativeEvent?.locationY ?? event.nativeEvent?.offsetY ?? 0) - originY;
    }
    if (localX < 0 || localY < 0 || localX > displayW || localY > displayH) return null;
    const x = Math.floor(localX / (scale * zoom));
    const y = Math.floor(localY / (scale * zoom));
    if (x < 0 || y < 0 || x >= imgW || y >= imgH) return null;
    return { x, y };
  };

  const getCurrentScanKey = (target: 'left' | 'right') => {
    if (uploadKind === 'image') {
      const index = target === 'left' ? uploadImageIndex : rightImageIndex;
      const item = index === null ? null : uploadImages[index ?? -1];
      return item ? `image:${item.scanId}` : null;
    }
    if (uploadKind === 'dicom') {
      const index = target === 'left' ? dicomIndex : rightDicomIndex;
      const item = index === null ? null : dicomItems[index ?? -1];
      return item ? `dicom:${item.scanId}` : null;
    }
    return null;
  };

  const addPinFromEvent = (target: 'left' | 'right' | 'full', event?: any) => {
    if (!pinMode || !event) return;
    if ((target === 'left' ? skipNextClickRef.current : rightSkipNextClickRef.current)) {
      if (target === 'left') skipNextClickRef.current = false;
      else if (target === 'right') rightSkipNextClickRef.current = false;
      return;
    }
    const key = getCurrentScanKey(target === 'full' ? (fullScreenViewer ?? 'left') : target);
    if (!key) return;
    const coords = getImageCoordsFromEvent(target, event);
    if (!coords) return;
    const pin = { id: `${Date.now()}-${Math.random()}`, x: coords.x, y: coords.y };
    setPinsByScan((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), pin],
    }));
  };

  const removePin = (target: 'left' | 'right' | 'full', pinId: string) => {
    const key = getCurrentScanKey(target === 'full' ? (fullScreenViewer ?? 'left') : target);
    if (!key) return;
    if (target === 'left') skipNextClickRef.current = true;
    else if (target === 'right') rightSkipNextClickRef.current = true;
    setPinsByScan((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((pin) => pin.id !== pinId),
    }));
  };

  const handleSavePins = () => {
    const key = getCurrentScanKey(activeViewer);
    if (!key) return;
    const count = (pinsByScan[key] ?? []).length;
    setSavedPinsByScan((prev) => ({
      ...prev,
      [key]: { savedAt: Date.now(), count },
    }));
  };

  const handleResetPins = () => {
    const key = getCurrentScanKey(activeViewer);
    if (!key) return;
    setPinsByScan((prev) => ({ ...prev, [key]: [] }));
    setSavedPinsByScan((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const buildReportPayload = () => {
    const signedBy = buildUserSignature(currentUser);
    const scanIds = Array.from(
      new Set([
        ...uploadImages.map((item) => item.scanId),
        ...dicomItems.map((item) => item.scanId),
      ]),
    );
    return {
      id: `RPT-${Date.now()}`,
      createdAt: new Date().toISOString(),
      orderId,
      patientId,
      patientName,
      patientAge,
      patientGender,
      imagingTests: imagingTests.map((t) => t.name),
      diagnostic: {
        modality,
        bodyPart,
        laterality,
        findings,
        severity,
        followUp,
        techName,
        techUserId: currentUser?.id,
        techRole: currentUser?.role,
        signedBy,
        timestamp: reportTimestamp,
      },
      scans: {
        scanIds,
        images: uploadImages.map((item) => ({ scanId: item.scanId, uri: item.uri })),
        dicoms: dicomItems.map((item) => ({ scanId: item.scanId, previewUri: item.previewUri, sourceUri: item.sourceUri })),
      },
      pins: {
        byScan: pinsByScan,
        saved: savedPinsByScan,
      },
      notes,
    };
  };

  const handleSubmitReport = async () => {
    if (isCompleted) return;
    if (order?.id && !wasOrderConsumptionApplied(order.id)) {
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
    try {
      await persistRadiologyToBackend();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save radiology result to backend.';
      Alert.alert('Save failed', message);
      return;
    }

    const payload = buildReportPayload();
    if (Platform.OS === 'web') {
      const orderKey = 'radiology_reports_by_order';
      const patientKey = 'radiology_reports_by_patient';
      const upsert = (key: string, id: string) => {
        const stored = window.localStorage.getItem(key);
        const parsed = stored ? (JSON.parse(stored) as Record<string, any[]>) : {};
        const list = parsed[id] ?? [];
        parsed[id] = [payload, ...list];
        window.localStorage.setItem(key, JSON.stringify(parsed));
      };
      upsert(orderKey, orderId);
      upsert(patientKey, patientId);
      setReportSaved(`Report saved for Order ${orderId} and Patient ${patientId}.`);
      if (order?.id) {
        updateOrderStatus(order.id, 'Completed', {
          completedByTechName: currentUser?.name,
          completedByTechUserId: currentUser?.id,
        });
      }
      return;
    }
    setReportSaved('Report saved.');
    if (order?.id) {
      updateOrderStatus(order.id, 'Completed', {
        completedByTechName: currentUser?.name,
        completedByTechUserId: currentUser?.id,
      });
    }
  };

  const readCookie = (name: string) => {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
  };

  const ensureCsrfCookie = async () => {
    await fetch(`${API_BASE_URL}/api/v1/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
    });
  };

  const dataUrlToFile = async (dataUrl: string, filename: string) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  };

  const multipartRequest = async (path: string, method: 'POST' | 'PATCH', body: FormData) => {
    let token = readCookie('csrftoken');
    if (!token) {
      await ensureCsrfCookie();
      token = readCookie('csrftoken');
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: token ? { 'X-CSRFToken': token } : undefined,
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Multipart ${method} ${path} failed (${response.status}): ${text || response.statusText}`);
    }
    return response;
  };

  const persistRadiologyToBackend = async () => {
    const scanOrderIds = imagingTests
      .map((test) => {
        const match = /^scan-(\d+)$/i.exec(test.id);
        if (!match) return null;
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value): value is number => value !== null);

    if (scanOrderIds.length === 0) return;

    const mediaSources = [
      ...uploadImages.map((item) => ({ scanId: item.scanId, dataUrl: item.uri, fileName: `${item.scanId}.png` })),
      ...dicomItems
        .filter((item) => !!item.sourceUri)
        .map((item) => ({ scanId: item.scanId, dataUrl: item.sourceUri, fileName: item.name || `${item.scanId}.dcm` })),
    ];

    for (let index = 0; index < scanOrderIds.length; index += 1) {
      const scanOrderId = scanOrderIds[index];
      const media = mediaSources[index] ?? mediaSources[0] ?? null;
      const findingText = [findings.trim(), notes.trim()].filter(Boolean).join('\n\n') || null;

      const existing = await apiRequest<ApiScanResult[]>(`/api/v1/scan-results/?scan_order=${scanOrderId}`);
      const formData = new FormData();
      formData.append('scan_order', String(scanOrderId));
      formData.append('finding_text', findingText ?? '');
      formData.append('reported_at', new Date().toISOString());
      formData.append('source_system', 'frontend_radiology');
      formData.append('external_ref', String(orderId));
      if (currentUser?.id) {
        formData.append('reported_by', String(currentUser.id));
      }
      if (media?.dataUrl) {
        const fallbackName = `${media.scanId || `scan-${scanOrderId}`}.dcm`;
        const file = await dataUrlToFile(media.dataUrl, media.fileName || fallbackName);
        formData.append('image_file', file);
      }

      if (existing.length > 0) {
        await multipartRequest(`/api/v1/scan-results/${existing[0].id}/`, 'PATCH', formData);
      } else {
        await multipartRequest('/api/v1/scan-results/', 'POST', formData);
      }

      await apiRequest(`/api/v1/scan-orders/${scanOrderId}/`, {
        method: 'PATCH',
        body: {
          status: 'completed',
          performed_at: new Date().toISOString(),
        },
      });
    }
  };

  const getScanIdForFingerprint = (fingerprint: string, orderKey: string) => {
    if (!fingerprint) return `SC-${orderKey}-00`;
    const existing = scanIdMapRef.current[fingerprint];
    if (existing && existing.startsWith(`SC-${orderKey}-`)) return existing;
    const current = scanIdCounterRef.current[orderKey] ?? 0;
    const next = current + 1;
    scanIdCounterRef.current = { ...scanIdCounterRef.current, [orderKey]: next };
    const scanId = `SC-${orderKey}-${String(next).padStart(2, '0')}`;
    scanIdMapRef.current[fingerprint] = scanId;
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem('radiology_scan_id_counters', JSON.stringify(scanIdCounterRef.current));
        window.localStorage.setItem('radiology_scan_id_map', JSON.stringify(scanIdMapRef.current));
      } catch {
        // ignore storage errors
      }
    }
    return scanId;
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const storedCounter = window.localStorage.getItem('radiology_scan_id_counters');
      const storedMap = window.localStorage.getItem('radiology_scan_id_map');
      if (storedCounter) scanIdCounterRef.current = JSON.parse(storedCounter) || {};
      if (storedMap) scanIdMapRef.current = JSON.parse(storedMap) || {};
    } catch {
      // ignore storage errors
    }
  }, []);

  const removeImageAt = (index: number) => {
    setUploadImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (uploadImageIndex === index) {
        setUploadImageIndex(Math.max(0, Math.min(index - 1, next.length - 1)));
      } else if (uploadImageIndex > index) {
        setUploadImageIndex((current) => Math.max(0, current - 1));
      }
      if (rightImageIndex === index) {
        setRightImageIndex(next.length > 1 ? Math.min(index, next.length - 1) : null);
      } else if (rightImageIndex !== null && rightImageIndex > index) {
        setRightImageIndex((current) => (current === null ? null : Math.max(0, current - 1)));
      }
      if (next.length === 0 && uploadKind === 'image') {
        setUploadKind(dicomItems.length > 0 ? 'dicom' : null);
      }
      return next;
    });
  };

  const removeDicomAt = (index: number) => {
    setDicomItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (dicomIndex === index) {
        const nextIndex = Math.max(0, Math.min(index - 1, next.length - 1));
        setDicomIndex(nextIndex);
        const nextItem = next[nextIndex];
        if (nextItem) {
          setDicomFrameIndex(0);
          setDicomFrames(nextItem.info.frames);
          setDicomMeta(nextItem.meta);
          updateImageSize(nextItem.meta.cols, nextItem.meta.rows);
          setWindowCenter(nextItem.windowCenter);
          setWindowWidth(nextItem.windowWidth);
          dicomPixelsRef.current = nextItem.pixels;
          dicomInfoRef.current = nextItem.info;
          setDicomImageUri(nextItem.previewUri);
        } else {
          setDicomMeta(null);
          setDicomFrames(1);
          setDicomFrameIndex(0);
          setDicomImageUri(null);
        }
      } else if (dicomIndex > index) {
        setDicomIndex((current) => Math.max(0, current - 1));
      }
      if (rightDicomIndex === index) {
        setRightDicomIndex(next.length > 1 ? Math.min(index, next.length - 1) : null);
      } else if (rightDicomIndex !== null && rightDicomIndex > index) {
        setRightDicomIndex((current) => (current === null ? null : Math.max(0, current - 1)));
      }
      if (next.length === 0 && uploadKind === 'dicom') {
        setUploadKind(uploadImages.length > 0 ? 'image' : null);
      }
      return next;
    });
  };

  const handleUpload = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dcm,.dicom,.png,.jpg,.jpeg,application/dicom,application/octet-stream,image/png,image/jpeg,*/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      setUploadLimitNote(null);
      const isDicomFile = (file: File) => {
        const lowerName = file.name.toLowerCase();
        return file.type === 'application/dicom' || /\.dcm$|\.dicom$/.test(lowerName);
      };
      const isImageFile = (file: File) => {
        const lowerName = file.name.toLowerCase();
        return file.type.startsWith('image/') || /\.(png|jpg|jpeg)$/.test(lowerName);
      };

      const dicomFile = files.find(isDicomFile);
      const imageFiles = files.filter((file) => isImageFile(file) && !isDicomFile(file));

      if (!dicomFile && imageFiles.length) {
        const readAsDataUrl = (file: File) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read image'));
            reader.readAsDataURL(file);
          });

        const uris = await Promise.all(imageFiles.map(readAsDataUrl));
        const newItems = imageFiles.map((file, index) => {
          const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
          return {
            id: `${file.name}-${file.lastModified}-${index}`,
            fingerprint,
            uri: uris[index],
            scanId: getScanIdForFingerprint(fingerprint, orderId),
          };
        });
        const existingFingerprints = new Set(uploadImages.map((item) => item.fingerprint));
        const appendItems = newItems.filter((item) => !existingFingerprints.has(item.fingerprint));
        const remainingSlots = Math.max(0, maxUploadItems - uploadImages.length);
        const limitedItems = appendItems.slice(0, remainingSlots);
        if (!limitedItems.length) {
          setUploadLimitNote(`Maximum ${maxUploadItems} images reached.`);
          return;
        }
        if (appendItems.length > remainingSlots) {
          setUploadLimitNote(`Only ${remainingSlots} images were added (max ${maxUploadItems}).`);
        }
        const nextImageCount = uploadImages.length + limitedItems.length;
        setUploadImages((prev) => [...prev, ...limitedItems]);
        if (uploadImages.length === 0) setUploadImageIndex(0);
        if (rightImageIndex === null && nextImageCount > 1) {
          setRightImageIndex(uploadImages.length === 0 ? 1 : uploadImages.length);
        }
        if (!uploadKind) setUploadKind('image');
        setImageSize({ width: 0, height: 0 });
        setDicomFrames(1);
        setDicomFrameIndex(0);
        setDicomMeta(null);
        return;
      }

      const dicomFiles = files.filter(isDicomFile);
      if (!dicomFiles.length) return;

      const readAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read image'));
          reader.readAsDataURL(file);
        });

      if (imageFiles.length) {
        const uris = await Promise.all(imageFiles.map(readAsDataUrl));
        const newItems = imageFiles.map((file, index) => {
          const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
          return {
            id: `${file.name}-${file.lastModified}-${index}`,
            fingerprint,
            uri: uris[index],
            scanId: getScanIdForFingerprint(fingerprint, orderId),
          };
        });
        const existingFingerprints = new Set(uploadImages.map((item) => item.fingerprint));
        const appendItems = newItems.filter((item) => !existingFingerprints.has(item.fingerprint));
        const remainingSlots = Math.max(0, maxUploadItems - uploadImages.length);
        const limitedItems = appendItems.slice(0, remainingSlots);
        if (limitedItems.length) {
          const nextImageCount = uploadImages.length + limitedItems.length;
          setUploadImages((prev) => [...prev, ...limitedItems]);
          if (uploadImages.length === 0) setUploadImageIndex(0);
          if (rightImageIndex === null && nextImageCount > 1) {
            setRightImageIndex(uploadImages.length === 0 ? 1 : uploadImages.length);
          }
          if (appendItems.length > remainingSlots) {
            setUploadLimitNote(`Only ${remainingSlots} images were added (max ${maxUploadItems}).`);
          }
        }
      } else {
        // keep existing images when uploading only DICOMs
      }

      dicomPixelsRef.current = null;
      dicomInfoRef.current = null;
      const parsedItems = await Promise.all(
        dicomFiles.map(async (file, index) => {
          const uniqueSuffix = dicomKeyRef.current++;
          const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
          const sourceUri = await readAsDataUrl(file);
          const buffer = await file.arrayBuffer();
          const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));
          const rows = dataSet.uint16('x00280010') ?? 0;
          const cols = dataSet.uint16('x00280011') ?? 0;
          const pixelElement = dataSet.elements.x7fe00010;
          if (!pixelElement) return null;
          const bitsAllocated = dataSet.uint16('x00280100') ?? 16;
          const slope = parseFloat(dataSet.string('x00281053') ?? '1');
          const intercept = parseFloat(dataSet.string('x00281052') ?? '0');
          const tagFrames = parseInt(dataSet.string('x00280008') ?? '1', 10) || 1;
          const wc = parseFloat(dataSet.string('x00281050') ?? `${windowCenter}`);
          const ww = parseFloat(dataSet.string('x00281051') ?? `${windowWidth}`);
          const pixelBuffer = dataSet.byteArray.buffer.slice(
            pixelElement.dataOffset,
            pixelElement.dataOffset + pixelElement.length,
          );
          const pixels = bitsAllocated === 16 ? new Uint16Array(pixelBuffer) : new Uint8Array(pixelBuffer);
          const pixelCount = pixels.length;
          const framePixels = rows * cols || 1;
          const inferredFrames = Math.max(1, Math.floor(pixelCount / framePixels));
          const frames = tagFrames > 1 ? tagFrames : inferredFrames;
          const info = { rows, cols, slope, intercept, frames };
          const safeWc = Number.isFinite(wc) ? wc : windowCenter;
          const safeWw = Number.isFinite(ww) ? ww : windowWidth;
          const previewUri = renderDicomToDataUrl(pixels, info, 0, safeWc, safeWw) ?? null;
          return {
            id: `${file.name}-${Date.now()}-${uniqueSuffix}`,
            scanId: getScanIdForFingerprint(fingerprint, orderId),
            fingerprint,
            name: file.name,
            sourceUri,
            pixels,
            info,
            meta: { rows, cols },
            previewUri,
            windowCenter: safeWc,
            windowWidth: safeWw,
          };
        }),
      );

      const items = parsedItems.filter(Boolean) as typeof dicomItems;
      if (!items.length) return;
      const hadDicom = dicomItems.length > 0;
      const existingFingerprints = new Set(dicomItems.map((item) => item.fingerprint));
      const newItems = items.filter((item) => !existingFingerprints.has(item.fingerprint));
      const remainingDicomSlots = Math.max(0, maxUploadItems - dicomItems.length);
      const limitedDicoms = newItems.slice(0, remainingDicomSlots);
      if (!limitedDicoms.length) {
        setUploadLimitNote(`Maximum ${maxUploadItems} DICOM files reached.`);
        return;
      }
      if (newItems.length > remainingDicomSlots) {
        setUploadLimitNote(`Only ${remainingDicomSlots} DICOM files were added (max ${maxUploadItems}).`);
      }
      setDicomItems((prev) => [...prev, ...limitedDicoms]);
      if (!hadDicom) {
        setDicomIndex(0);
        setDicomFrameIndex(0);
        setDicomMeta(newItems[0].meta);
        updateImageSize(newItems[0].meta.cols, newItems[0].meta.rows);
        setDicomFrames(newItems[0].info.frames);
        setWindowCenter(newItems[0].windowCenter);
        setWindowWidth(newItems[0].windowWidth);
        dicomPixelsRef.current = newItems[0].pixels;
        dicomInfoRef.current = newItems[0].info;
        setDicomImageUri(newItems[0].previewUri);
      }
      const totalDicoms = dicomItems.length + limitedDicoms.length;
      if (rightDicomIndex === null && totalDicoms > 1) {
        setRightDicomIndex(dicomItems.length === 0 ? 1 : dicomItems.length);
      }
      if (!uploadKind) setUploadKind(imageFiles.length ? 'image' : 'dicom');
    };
    input.click();
  };

  const handleWheel = (event: any, target: 'left' | 'right') => {
    if (Platform.OS !== 'web') return;
    const delta = event?.deltaY ?? event?.nativeEvent?.deltaY ?? 0;
    if (!delta) return;
    event.preventDefault?.();
    if (target === 'left') {
      const next = Math.max(1, Math.min(4, zoom - delta * 0.001));
      setZoom(next);
      if (next === 1) setPan({ x: 0, y: 0 });
    } else {
      const next = Math.max(1, Math.min(4, rightZoom - delta * 0.001));
      setRightZoom(next);
      if (next === 1) setRightPan({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (event: any) => {
    if (Platform.OS !== 'web') return;
    if (zoom <= 1) return;
    isDraggingRef.current = true;
    dragDistanceRef.current = 0;
    dragStartRef.current = { x: event.clientX ?? event.nativeEvent?.pageX ?? 0, y: event.clientY ?? event.nativeEvent?.pageY ?? 0 };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (event: any) => {
    if (Platform.OS !== 'web') return;
    if (isDraggingRef.current) {
      const currentX = event.clientX ?? event.nativeEvent?.pageX ?? 0;
      const currentY = event.clientY ?? event.nativeEvent?.pageY ?? 0;
      const dx = currentX - dragStartRef.current.x;
      const dy = currentY - dragStartRef.current.y;
      dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.hypot(dx, dy));
      setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
    }

    if (uploadKind !== 'dicom' || !dicomInfoRef.current || !dicomPixelsRef.current) {
      setHoverInfo(null);
      return;
    }

    const coords = getImageCoordsFromEvent('left', event);
    if (!coords || !dicomInfoRef.current || !dicomPixelsRef.current) {
      setHoverInfo(null);
      return;
    }
    const { rows, cols } = dicomInfoRef.current;
    const { x, y } = coords;
    if (x >= cols || y >= rows) {
      setHoverInfo(null);
      return;
    }
    const frameOffset = dicomFrameIndex * rows * cols;
    const raw = dicomPixelsRef.current[frameOffset + y * cols + x] ?? 0;
    const info = dicomInfoRef.current;
    const slope = info?.slope ?? 1;
    const intercept = info?.intercept ?? 0;
    const min = windowCenter - windowWidth / 2;
    const max = windowCenter + windowWidth / 2;
    const range = Math.max(max - min, 1);
    const scaled = Number(raw) * slope + intercept;
    const clamped = Math.min(max, Math.max(min, scaled));
    const gray = Math.round(((clamped - min) / range) * 255);
    setHoverInfo({ x, y, value: gray });
  };

  const handleMouseUp = (event?: any) => {
    const wasDragging = isDraggingRef.current;
    isDraggingRef.current = false;
    if (Platform.OS !== 'web') return;
    if (!pinMode) return;
    if (wasDragging && dragDistanceRef.current > 3) return;
    addPinFromEvent('left', event);
  };

  const handleLeftClick = (event?: any) => {
    if (Platform.OS !== 'web') return;
    if (!pinMode) return;
    if (dragDistanceRef.current > 3) return;
    addPinFromEvent('left', event);
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setHoverInfo(null);
  };

  const handleRightMouseDown = (event: any) => {
    if (Platform.OS !== 'web') return;
    if (rightZoom <= 1) return;
    rightIsDraggingRef.current = true;
    rightDragDistanceRef.current = 0;
    rightDragStartRef.current = { x: event.clientX ?? event.nativeEvent?.pageX ?? 0, y: event.clientY ?? event.nativeEvent?.pageY ?? 0 };
    rightPanStartRef.current = { ...rightPan };
  };

  const handleRightMouseMove = (event: any) => {
    if (Platform.OS !== 'web') return;
    if (rightIsDraggingRef.current) {
      const currentX = event.clientX ?? event.nativeEvent?.pageX ?? 0;
      const currentY = event.clientY ?? event.nativeEvent?.pageY ?? 0;
      const dx = currentX - rightDragStartRef.current.x;
      const dy = currentY - rightDragStartRef.current.y;
      rightDragDistanceRef.current = Math.max(rightDragDistanceRef.current, Math.hypot(dx, dy));
      setRightPan({ x: rightPanStartRef.current.x + dx, y: rightPanStartRef.current.y + dy });
    }
  };

  const handleRightMouseUp = (event?: any) => {
    const wasDragging = rightIsDraggingRef.current;
    rightIsDraggingRef.current = false;
    if (Platform.OS !== 'web') return;
    if (!pinMode) return;
    if (wasDragging && rightDragDistanceRef.current > 3) return;
    addPinFromEvent('right', event);
  };

  const handleRightClick = (event?: any) => {
    if (Platform.OS !== 'web') return;
    if (!pinMode) return;
    if (rightDragDistanceRef.current > 3) return;
    addPinFromEvent('right', event);
  };

  const handleFullWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    const delta = event?.deltaY ?? event?.nativeEvent?.deltaY ?? 0;
    if (!delta) return;
    event.preventDefault?.();
    const next = Math.max(1, Math.min(4, fullZoom - delta * 0.001));
    setFullZoom(next);
    if (next === 1) setFullPan({ x: 0, y: 0 });
  };

  const handleFullMouseDown = (event: any) => {
    if (Platform.OS !== 'web') return;
    if (fullZoom <= 1) return;
    fullIsDraggingRef.current = true;
    fullDragDistanceRef.current = 0;
    fullDragStartRef.current = { x: event.clientX ?? event.nativeEvent?.pageX ?? 0, y: event.clientY ?? event.nativeEvent?.pageY ?? 0 };
    fullPanStartRef.current = { ...fullPan };
  };

  const handleFullMouseMove = (event: any) => {
    if (Platform.OS !== 'web') return;
    if (fullIsDraggingRef.current) {
      const currentX = event.clientX ?? event.nativeEvent?.pageX ?? 0;
      const currentY = event.clientY ?? event.nativeEvent?.pageY ?? 0;
      const dx = currentX - fullDragStartRef.current.x;
      const dy = currentY - fullDragStartRef.current.y;
      fullDragDistanceRef.current = Math.max(fullDragDistanceRef.current, Math.hypot(dx, dy));
      setFullPan({ x: fullPanStartRef.current.x + dx, y: fullPanStartRef.current.y + dy });
    }
  };

  const handleFullMouseUp = (event?: any) => {
    const wasDragging = fullIsDraggingRef.current;
    fullIsDraggingRef.current = false;
    if (Platform.OS !== 'web') return;
    if (!pinMode) return;
    if (wasDragging && fullDragDistanceRef.current > 3) return;
    addPinFromEvent('full', event);
  };

  const handleFullClick = (event?: any) => {
    if (Platform.OS !== 'web') return;
    if (!pinMode) return;
    if (fullDragDistanceRef.current > 3) return;
    addPinFromEvent('full', event);
  };

  const handleFullMouseLeave = () => {
    fullIsDraggingRef.current = false;
  };

  const enterFullScreen = (target: 'left' | 'right') => {
    if (Platform.OS !== 'web') return;
    setFullScreenViewer(target);
  };
  const exitFullScreen = () => {
    if (Platform.OS !== 'web') return;
    setFullScreenViewer(null);
  };

  const handleRightMouseLeave = () => {
    rightIsDraggingRef.current = false;
  };

  const leftViewerWebHandlers = (Platform.OS === 'web'
    ? {
        onWheel: (event: any) => handleWheel(event, 'left'),
        onMouseDown: (event: any) => {
          setActiveViewer('left');
          handleMouseDown(event);
        },
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onClick: handleLeftClick,
        onMouseLeave: handleMouseLeave,
      }
    : {}) as any;

  const rightViewerWebHandlers = (Platform.OS === 'web'
    ? {
        onWheel: (event: any) => handleWheel(event, 'right'),
        onMouseDown: (event: any) => {
          setActiveViewer('right');
          handleRightMouseDown(event);
        },
        onMouseMove: handleRightMouseMove,
        onMouseUp: handleRightMouseUp,
        onClick: handleRightClick,
        onMouseLeave: handleRightMouseLeave,
      }
    : {}) as any;

  const fullViewerWebHandlers = (Platform.OS === 'web'
    ? {
        onWheel: handleFullWheel,
        onMouseDown: handleFullMouseDown,
        onMouseMove: handleFullMouseMove,
        onMouseUp: handleFullMouseUp,
        onClick: handleFullClick,
        onMouseLeave: handleFullMouseLeave,
      }
    : {}) as any;

  return (
    <DashboardLayout title="Radiology Upload">
      <View style={styles.pageRow}>
        <FormCard style={styles.viewerCard}>
          <Text style={styles.sectionTitle}>Imaging Viewer</Text>
          <View style={styles.viewerFrameRow}>
          <View
            ref={viewerRef}
            style={styles.viewerFrame}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setViewerSize({ width, height });
            }}
            {...leftViewerWebHandlers}
            onStartShouldSetResponder={() => true}
            onResponderGrant={() => setActiveViewer('left')}
          >
            <View style={[styles.viewerFrameBadge, activeViewer === 'left' && styles.viewerFrameBadgeActive]}>
              <Text style={styles.viewerFrameBadgeText}>Left</Text>
            </View>
            <Pressable style={styles.viewerFullButton} onPress={() => enterFullScreen('left')}>
              <Ionicons name="expand" size={14} color="#E2E8F0" />
            </Pressable>
            {uploadKind === 'image' && currentUploadImageUri ? (
              <View style={[styles.viewerImageWrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }] }]}>
                <Image
                  source={{ uri: currentUploadImageUri }}
                  style={[styles.viewerImage, getFilterStyle('left')]}
                  resizeMode="contain"
                  onLoad={(event) => {
                    const source = event.nativeEvent?.source;
                    if (source?.width && source?.height) {
                      updateImageSize(source.width, source.height);
                    }
                  }}
                />
              </View>
            ) : uploadKind === 'dicom' && dicomImageUri ? (
              <View style={[styles.viewerImageWrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }] }]}>
                <Image
                  source={{ uri: dicomImageUri }}
                  style={[styles.viewerImage, getFilterStyle('left')]}
                  resizeMode="contain"
                  onLoad={() => {
                    if (dicomMeta) updateImageSize(dicomMeta.cols, dicomMeta.rows);
                  }}
                />
              </View>
            ) : (
              <Text style={styles.viewerPlaceholder}>Upload DICOM or images to preview</Text>
            )}
            {Platform.OS === 'web' && (() => {
              const key = getCurrentScanKey('left');
              const pins = key ? pinsByScan[key] ?? [] : [];
              if (!pins.length) return null;
              const transform = getImageTransform('left');
              if (!transform) return null;
                const { scale, originX, originY, zoom: localZoom } = transform;
                return (
                  <View style={styles.viewerPins} pointerEvents="box-none">
                    {pins.map((pin) => (
                      <Pressable
                        key={pin.id}
                        onPress={() => removePin('left', pin.id)}
                        style={[
                          styles.viewerPin,
                          {
                            left: originX + pin.x * scale * localZoom - 6,
                            top: originY + pin.y * scale * localZoom - 6,
                          },
                        ]}
                      />
                    ))}
                  </View>
                );
              })()}
          </View>
          <View
            style={styles.viewerFrame}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              if (width && height) setRightViewerSize({ width, height });
            }}
          >
            <View style={[styles.viewerFrameBadge, activeViewer === 'right' && styles.viewerFrameBadgeActive]}>
              <Text style={styles.viewerFrameBadgeText}>Right</Text>
            </View>
            <Pressable style={styles.viewerFullButton} onPress={() => enterFullScreen('right')}>
              <Ionicons name="expand" size={14} color="#E2E8F0" />
            </Pressable>
            <View
              ref={rightViewerRef}
              style={styles.viewerFrameFill}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setRightViewerSize({ width, height });
              }}
              {...rightViewerWebHandlers}
              onStartShouldSetResponder={() => true}
              onResponderGrant={() => setActiveViewer('right')}
            >
              {secondaryImageUri ? (
                <View style={[styles.viewerImageWrap, { transform: [{ translateX: rightPan.x }, { translateY: rightPan.y }, { scale: rightZoom }] }]}>
                  <Image
                    source={{ uri: secondaryImageUri }}
                    style={[styles.viewerImage, getFilterStyle('right')]}
                    resizeMode="contain"
                    onLoad={(event) => {
                      const source = event.nativeEvent?.source;
                      if (source?.width && source?.height) {
                        setRightImageSize({ width: source.width, height: source.height });
                      }
                    }}
                  />
                </View>
              ) : (
                <Text style={styles.viewerPlaceholder}>Upload another scan to compare</Text>
              )}
              {Platform.OS === 'web' && (() => {
                const key = getCurrentScanKey('right');
                const pins = key ? pinsByScan[key] ?? [] : [];
                if (!pins.length) return null;
                const transform = getImageTransform('right');
                if (!transform) return null;
                const { scale, originX, originY, zoom: localZoom } = transform;
                return (
                  <View style={styles.viewerPins} pointerEvents="box-none">
                    {pins.map((pin) => (
                      <Pressable
                        key={pin.id}
                        onPress={() => removePin('right', pin.id)}
                        style={[
                          styles.viewerPin,
                          {
                            left: originX + pin.x * scale * localZoom - 6,
                            top: originY + pin.y * scale * localZoom - 6,
                          },
                        ]}
                      />
                    ))}
                  </View>
                );
              })()}
            </View>
          </View>
        </View>
        {fullScreenViewer ? (
          <View style={styles.viewerFullOverlay}>
            <View style={styles.viewerFullTop}>
              <Text style={styles.viewerFullTitle}>
                {fullScreenViewer === 'left' ? 'Left Viewer' : 'Right Viewer'}
              </Text>
              <View style={styles.viewerFullControls}>
                <Text style={styles.viewerFullZoomLabel}>Zoom {Math.round(fullZoom * 100)}%</Text>
                <View style={styles.viewerFullZoomButtons}>
                  <Pressable
                    onPress={() => setFullZoom((prev) => Math.max(1, Math.min(4, prev - 0.25)))}
                    style={styles.viewerFullZoomButton}
                  >
                    <Ionicons name="remove" size={14} color="#E2E8F0" />
                  </Pressable>
                  <Pressable
                    onPress={() => setFullZoom((prev) => Math.max(1, Math.min(4, prev + 0.25)))}
                    style={styles.viewerFullZoomButton}
                  >
                    <Ionicons name="add" size={14} color="#E2E8F0" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setFullZoom(1);
                      setFullPan({ x: 0, y: 0 });
                    }}
                    style={styles.viewerFullZoomButton}
                  >
                    <Ionicons name="contract" size={14} color="#E2E8F0" />
                  </Pressable>
                </View>
                <Pressable style={styles.viewerFullClose} onPress={exitFullScreen}>
                  <Ionicons name="close" size={16} color="#E2E8F0" />
                </Pressable>
              </View>
            </View>
            <View
              ref={fullViewerRef}
              style={styles.viewerFullBody}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setFullViewerSize({ width, height });
              }}
              {...fullViewerWebHandlers}
              onStartShouldSetResponder={() => true}
            >
              {fullScreenViewer === 'left' ? (
                currentUploadImageUri || dicomImageUri ? (
                  <View style={[styles.viewerImageWrap, { transform: [{ translateX: fullPan.x }, { translateY: fullPan.y }, { scale: fullZoom }] }]}>
                    <Image
                      source={{ uri: uploadKind === 'image' ? currentUploadImageUri ?? '' : dicomImageUri ?? '' }}
                      style={[styles.viewerFullImage, getFilterStyle('left')]}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <Text style={styles.viewerPlaceholder}>No scan selected</Text>
                )
              ) : secondaryImageUri ? (
                <View style={[styles.viewerImageWrap, { transform: [{ translateX: fullPan.x }, { translateY: fullPan.y }, { scale: fullZoom }] }]}>
                  <Image source={{ uri: secondaryImageUri }} style={[styles.viewerFullImage, getFilterStyle('right')]} resizeMode="contain" />
                </View>
              ) : (
                <Text style={styles.viewerPlaceholder}>No scan selected</Text>
              )}
              {Platform.OS === 'web' && (() => {
                const target = fullScreenViewer ?? 'left';
                const key = getCurrentScanKey(target);
                const pins = key ? pinsByScan[key] ?? [] : [];
                if (!pins.length) return null;
                const transform = getImageTransform('full');
                if (!transform) return null;
                const { scale, originX, originY, zoom: localZoom } = transform;
                return (
                  <View style={styles.viewerPins} pointerEvents="box-none">
                    {pins.map((pin) => (
                      <Pressable
                        key={pin.id}
                        onPress={() => removePin('full', pin.id)}
                        style={[
                          styles.viewerPin,
                          {
                            left: originX + pin.x * scale * localZoom - 6,
                            top: originY + pin.y * scale * localZoom - 6,
                          },
                        ]}
                      />
                    ))}
                  </View>
                );
              })()}
            </View>
          </View>
        ) : null}
        <View style={styles.viewerControls}>
          <Pressable
            style={[styles.viewerUploadButton, isCompleted && styles.viewerUploadDisabled]}
            onPress={handleUpload}
            disabled={isCompleted}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#1F2937" />
            <Text style={styles.viewerUploadText}>Upload Scan</Text>
          </Pressable>
          {uploadImages.length > 0 && dicomItems.length > 0 ? (
            <View style={styles.viewerTypeTabs}>
              <Pressable
                onPress={() => setUploadKind('image')}
                style={[styles.viewerTypeTab, uploadKind === 'image' && styles.viewerTypeTabActive]}
              >
                <View style={styles.viewerTypeTabInner}>
                  <Text style={[styles.viewerTypeTabText, uploadKind === 'image' && styles.viewerTypeTabTextActive]}>Images</Text>
                  <View style={[styles.viewerTypeBadge, uploadKind === 'image' && styles.viewerTypeBadgeActive]}>
                    <Text style={[styles.viewerTypeBadgeText, uploadKind === 'image' && styles.viewerTypeBadgeTextActive]}>
                      {uploadImages.length}
                    </Text>
                  </View>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setUploadKind('dicom')}
                style={[styles.viewerTypeTab, uploadKind === 'dicom' && styles.viewerTypeTabActive]}
              >
                <View style={styles.viewerTypeTabInner}>
                  <Text style={[styles.viewerTypeTabText, uploadKind === 'dicom' && styles.viewerTypeTabTextActive]}>DICOM</Text>
                  <View style={[styles.viewerTypeBadge, uploadKind === 'dicom' && styles.viewerTypeBadgeActive]}>
                    <Text style={[styles.viewerTypeBadgeText, uploadKind === 'dicom' && styles.viewerTypeBadgeTextActive]}>
                      {dicomItems.length}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          ) : null}
          {(uploadImages.length > 0 || dicomItems.length > 0) && (
            <View style={styles.viewerAssignRow}>
              <Text style={styles.viewerAssignLabel}>Assign to</Text>
              <Pressable
                onPress={() => setCompareTarget('left')}
                style={[styles.viewerAssignButton, compareTarget === 'left' && styles.viewerAssignButtonActive]}
              >
                <Text style={[styles.viewerAssignText, compareTarget === 'left' && styles.viewerAssignTextActive]}>Left</Text>
              </Pressable>
              <Pressable
                onPress={() => setCompareTarget('right')}
                style={[styles.viewerAssignButton, compareTarget === 'right' && styles.viewerAssignButtonActive]}
              >
                <Text style={[styles.viewerAssignText, compareTarget === 'right' && styles.viewerAssignTextActive]}>Right</Text>
              </Pressable>
            </View>
          )}
          {uploadLimitNote ? <Text style={styles.viewerLimitNote}>{uploadLimitNote}</Text> : null}
          {uploadKind === 'image' && uploadImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewerThumbStrip}>
              {uploadImages.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.viewerThumb,
                    uploadImageIndex === index && styles.viewerThumbActive,
                    rightImageIndex === index && styles.viewerThumbSecondaryActive,
                  ]}
                  onPress={() => {
                    if (compareTarget === 'left') {
                      setUploadImageIndex(index);
                    } else {
                      setRightImageIndex(index);
                    }
                  }}
                >
                  <Pressable
                    style={styles.viewerThumbRemove}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      removeImageAt(index);
                    }}
                  >
                    <Ionicons name="close" size={10} color="#FFFFFF" />
                  </Pressable>
                  <Image source={{ uri: item.uri }} style={styles.viewerThumbImage} resizeMode="cover" />
                  <View style={styles.viewerThumbLabelOverlay}>
                    <Text numberOfLines={1} style={styles.viewerThumbLabel}>
                      {item.scanId}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {uploadKind === 'dicom' && dicomItems.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewerThumbStrip}>
              {dicomItems.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.viewerThumb,
                    dicomIndex === index && styles.viewerThumbActive,
                    rightDicomIndex === index && styles.viewerThumbSecondaryActive,
                  ]}
                  onPress={() => {
                    if (compareTarget === 'left') {
                      setDicomIndex(index);
                      setDicomFrameIndex(0);
                      setDicomFrames(item.info.frames);
                      setDicomMeta(item.meta);
                      updateImageSize(item.meta.cols, item.meta.rows);
                      setWindowCenter(item.windowCenter);
                      setWindowWidth(item.windowWidth);
                      dicomPixelsRef.current = item.pixels;
                      dicomInfoRef.current = item.info;
                      setDicomImageUri(item.previewUri);
                    } else {
                      setRightDicomIndex(index);
                    }
                  }}
                >
                  <Pressable
                    style={styles.viewerThumbRemove}
                    onPress={(event) => {
                      event?.stopPropagation?.();
                      removeDicomAt(index);
                    }}
                  >
                    <Ionicons name="close" size={10} color="#FFFFFF" />
                  </Pressable>
                  {item.previewUri ? (
                    <Image source={{ uri: item.previewUri }} style={styles.viewerThumbImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.viewerThumbFallback}>
                      <Ionicons name="image-outline" size={16} color="#CBD5F5" />
                    </View>
                  )}
                  <View style={styles.viewerThumbLabelOverlay}>
                    <Text numberOfLines={1} style={styles.viewerThumbLabel}>
                      {item.scanId}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.viewerZoomRow}>
            <Text style={styles.viewerFooter}>
              Zoom {Math.round((activeViewer === 'left' ? zoom : rightZoom) * 100)}% ({activeViewer})
            </Text>
            <View style={styles.viewerZoomButtons}>
              <Pressable
                onPress={() => {
                  if (activeViewer === 'left') {
                    setZoom((prev) => Math.max(1, Math.min(4, prev - 0.25)));
                  } else {
                    setRightZoom((prev) => Math.max(1, Math.min(4, prev - 0.25)));
                  }
                }}
                style={styles.viewerZoomButton}
              >
                <Ionicons name="remove" size={14} color="#1F2937" />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (activeViewer === 'left') {
                    setZoom((prev) => Math.max(1, Math.min(4, prev + 0.25)));
                  } else {
                    setRightZoom((prev) => Math.max(1, Math.min(4, prev + 0.25)));
                  }
                }}
                style={styles.viewerZoomButton}
              >
                <Ionicons name="add" size={14} color="#1F2937" />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (activeViewer === 'left') {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  } else {
                    setRightZoom(1);
                    setRightPan({ x: 0, y: 0 });
                  }
                }}
                style={styles.viewerZoomButton}
              >
                <Ionicons name="contract" size={14} color="#1F2937" />
              </Pressable>
              <Pressable
                style={styles.viewerZoomButton}
                onPress={() => {
                  if (activeViewer === 'left') {
                    setBrightness(1);
                    setContrast(1);
                  } else {
                    setRightBrightness(1);
                    setRightContrast(1);
                  }
                }}
              >
                <Ionicons name="refresh" size={14} color="#1F2937" />
              </Pressable>
            </View>
          </View>
          <View style={styles.viewerActionRow}>
            <Pressable
              onPress={() => setPinMode((prev) => !prev)}
              style={[styles.viewerActionButton, pinMode && styles.viewerActionButtonActive]}
            >
              <Ionicons name="pin" size={13} color={pinMode ? '#047857' : '#1F2937'} />
              <Text style={[styles.viewerActionText, pinMode && styles.viewerActionTextActive]}>
                {pinMode ? 'Pin Mode On' : 'Pin Mode'}
              </Text>
            </Pressable>
            <Pressable onPress={handleSavePins} style={styles.viewerActionButton}>
              <Ionicons name="save" size={13} color="#1F2937" />
              <Text style={styles.viewerActionText}>Save Pins</Text>
            </Pressable>
            <Pressable onPress={handleResetPins} style={styles.viewerActionButton}>
              <Ionicons name="trash" size={13} color="#1F2937" />
              <Text style={styles.viewerActionText}>Reset Pins</Text>
            </Pressable>
            {(() => {
              const key = getCurrentScanKey(activeViewer);
              if (!key || !savedPinsByScan[key]) return null;
              return (
                <Text style={styles.viewerSavedText}>
                  Saved {savedPinsByScan[key].count}
                </Text>
              );
            })()}
          </View>
          <ViewerSlider
            label={`Brightness ${(activeViewer === 'left' ? brightness : rightBrightness).toFixed(2)}`}
            value={activeViewer === 'left' ? brightness : rightBrightness}
            min={0.6}
            max={1.6}
            onChange={(next) => (activeViewer === 'left' ? setBrightness(next) : setRightBrightness(next))}
          />
          <ViewerSlider
            label={`Contrast ${(activeViewer === 'left' ? contrast : rightContrast).toFixed(2)}`}
            value={activeViewer === 'left' ? contrast : rightContrast}
            min={0.6}
            max={1.8}
            onChange={(next) => (activeViewer === 'left' ? setContrast(next) : setRightContrast(next))}
          />
          {uploadKind === 'dicom' && dicomFrames > 1 ? (
            <ViewerSlider
              label={`Slice ${dicomFrameIndex + 1}/${dicomFrames}`}
              value={dicomFrameIndex}
              min={0}
              max={dicomFrames - 1}
              onChange={(next) => setDicomFrameIndex(Math.round(next))}
            />
          ) : null}
        </View>
        {uploadKind === 'dicom' && hoverInfo ? (
          <Text style={styles.viewerReadout}>
            X {hoverInfo.x}  Y {hoverInfo.y}  Value {hoverInfo.value}
          </Text>
        ) : null}
        <FileUpload label="Upload Report" hint="PDF" />
        <TextArea label="Notes" placeholder="Add notes" value={notes} onChangeText={setNotes} editable={!isCompleted} />
        <View style={styles.actions}>
          {reportSaved ? <Text style={styles.reportSavedText}>{reportSaved}</Text> : null}
          <PrimaryButton label={isCompleted ? 'Completed' : 'Submit'} onPress={handleSubmitReport} disabled={isCompleted} />
        </View>
        </FormCard>

        <View style={styles.rightColumn}>
          <FormCard style={styles.patientCard}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Patient Details</Text>
              {(severity === 'Severe' || severity === 'Critical') ? (
                <View style={styles.severityBadge}>
                  <Text style={styles.severityBadgeText}>{severity}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.infoGridTwoCol}>
              <View style={styles.infoBlockHalf}>
                <Text style={styles.infoLabel}>Order ID</Text>
                <Text style={styles.infoValue}>{orderId}</Text>
              </View>
              <View style={styles.infoBlockHalf}>
                <Text style={styles.infoLabel}>Patient</Text>
                <Text style={styles.infoValue}>{patientName}</Text>
              </View>
              <View style={styles.infoBlockHalf}>
                <Text style={styles.infoLabel}>Patient ID</Text>
                <Text style={styles.infoValue}>{patientId}</Text>
              </View>
              <View style={styles.infoBlockHalf}>
                <Text style={styles.infoLabel}>Age</Text>
                <Text style={styles.infoValue}>{patientAge}</Text>
              </View>
              <View style={styles.infoBlockHalf}>
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={styles.infoValue}>{patientGender}</Text>
              </View>
              <View style={styles.infoBlockHalf}>
                <Text style={styles.infoLabel}>Imaging Tests</Text>
                <Text style={styles.infoValue}>
                  {imagingTests.length > 0 ? imagingTests.map((t) => t.name).join(', ') : 'Not specified'}
                </Text>
              </View>
            </View>
          </FormCard>

          <FormCard style={styles.diagnosticCard}>
            <Text style={styles.sectionTitle}>Diagnostic Summary</Text>
            <View style={styles.infoGridTwoCol}>
              <View style={styles.infoBlockHalf}>
                <SelectField
                  label="Modality"
                  value={modality}
                  onPress={isCompleted ? undefined : () => openSelect('modality', 'Modality', modalityOptions)}
                />
              </View>
              <View style={styles.infoBlockHalf}>
                <SelectField
                  label="Body Part"
                  value={bodyPart}
                  onPress={isCompleted ? undefined : () => openSelect('bodyPart', 'Body Part', bodyPartOptions)}
                />
              </View>
              <View style={styles.infoBlockHalf}>
                <SelectField
                  label="Laterality"
                  value={laterality}
                  onPress={isCompleted ? undefined : () => openSelect('laterality', 'Laterality', lateralityOptions)}
                />
              </View>
              <View style={styles.infoBlockHalf}>
                <SelectField
                  label="Severity"
                  value={severity}
                  onPress={isCompleted ? undefined : () => openSelect('severity', 'Severity', severityOptions)}
                />
              </View>
              <View style={styles.infoBlockFull}>
                <SelectField
                  label="Follow-up"
                  value={followUp}
                  onPress={isCompleted ? undefined : () => openSelect('followUp', 'Follow-up', followUpOptions)}
                />
              </View>
              <View style={styles.infoBlockFull}>
                <TextArea label="Findings" placeholder="Describe findings..." value={findings} onChangeText={setFindings} editable={!isCompleted} />
              </View>
              <View style={styles.infoBlockFull}>
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>Consumption Summary</Text>
                  {shortages.length ? (
                    <View style={styles.shortageBox}>
                      <Text style={styles.shortageTitle}>Low stock warning</Text>
                      {shortages.map((row) => (
                        <Text key={`r-short-${row.itemName}`} style={styles.shortageText}>
                          {`${row.itemName}: required ${row.required}, available ${row.available}`}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.panelGrid}>
                    {consumptionRows.map((row, index) => (
                      <View key={`r-cons-${index}`} style={styles.consumptionRow}>
                        <View style={styles.consumptionField}>
                          <SelectField
                            label="Item"
                            value={row.itemName || 'Select item'}
                            onPress={
                              isCompleted
                                ? undefined
                                : () => {
                                    if (!stockItemNames.length) return;
                                    setActiveConsumptionRow(index);
                                    openSelect('consumptionItem', 'Select Inventory Item', stockItemNames);
                                  }
                            }
                          />
                        </View>
                        <View style={styles.qtyField}>
                          <TextInputField
                            label="Qty"
                            value={String(row.quantity)}
                            keyboardType="number-pad"
                            editable={!isCompleted}
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
                        {!isCompleted ? (
                          <Pressable
                            style={styles.inlineRemoveButton}
                            onPress={() => {
                              setHasManualConsumptionEdit(true);
                              setConsumptionRows((prev) => prev.filter((_, idx) => idx !== index));
                            }}
                          >
                            <Text style={styles.inlineRemoveText}>Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                    {!consumptionRows.length ? <Text style={styles.workflowHint}>No template set for these scans yet.</Text> : null}
                    {!isCompleted ? (
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
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={styles.infoBlockHalf}>
                <TextInputField
                  label="Radiologist/Tech Name"
                  value={techName}
                  editable={false}
                />
              </View>
              <View style={styles.infoBlockHalf}>
                <Text style={styles.infoLabel}>Date/Time</Text>
                <Text style={styles.infoValue}>{reportTimestamp}</Text>
              </View>
              <View style={styles.infoBlockFull}>
                <Text style={styles.infoLabel}>Uploaded Scan IDs</Text>
                <View style={styles.scanIdList}>
                  {(() => {
                    const imageIds = uploadImages.map((item) => item.scanId);
                    const dicomIds = dicomItems.map((item) => item.scanId);
                    const ids = Array.from(new Set([...imageIds, ...dicomIds]));
                    if (!ids.length) {
                      return <Text style={styles.scanIdEmpty}>No scans uploaded yet.</Text>;
                    }
                    return ids.map((id) => (
                      <View key={id} style={styles.scanIdChip}>
                        <Text style={styles.scanIdChipText}>{id}</Text>
                      </View>
                    ));
                  })()}
                </View>
              </View>
            </View>
          </FormCard>
        </View>
      </View>
      <Modal visible={!!selectModal.field} transparent animationType="fade" onRequestClose={closeSelect}>
        <Pressable style={styles.selectOverlay} onPress={closeSelect}>
          <View style={styles.selectSheet}>
            <Text style={styles.selectTitle}>{selectModal.label}</Text>
            {selectModal.options.map((option) => (
              <Pressable key={option} style={styles.selectOption} onPress={() => commitSelect(option)}>
                <Text style={styles.selectOptionText}>{option}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.selectCancel} onPress={closeSelect}>
              <Text style={styles.selectCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  pageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  viewerCard: {
    flex: 1,
  },
  rightColumn: {
    width: 360,
    gap: theme.spacing.md,
  },
  patientCard: {
    width: '100%',
  },
  diagnosticCard: {
    width: '100%',
  },
  actions: {
    marginTop: theme.spacing.md,
  },
  reportSavedText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#047857',
    marginBottom: theme.spacing.xs,
  },
  viewerFrameRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  viewerFrame: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radius.md,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  viewerFrameFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerFrameBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    zIndex: 2,
  },
  viewerFullButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    zIndex: 2,
  },
  viewerFrameBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.8)',
  },
  viewerFrameBadgeText: {
    fontFamily: theme.font.body,
    fontSize: 10,
    color: '#E2E8F0',
  },
  viewerFullOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    borderRadius: theme.radius.md,
    zIndex: 10,
    padding: theme.spacing.md,
  },
  viewerFullTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  viewerFullControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  viewerFullZoomLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#E2E8F0',
  },
  viewerFullZoomButtons: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  viewerFullZoomButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  viewerFullTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: '#E2E8F0',
  },
  viewerFullClose: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  viewerFullBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerFullImage: {
    width: '100%',
    height: '100%',
  },
  viewerImageWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerPlaceholder: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: '#E2E8F0',
  },
  viewerPins: {
    position: 'absolute',
    inset: 0,
  },
  viewerPin: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#F97316',
    borderWidth: 2,
    borderColor: '#FED7AA',
  },
  viewerControls: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  viewerAssignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  viewerLimitNote: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#DC2626',
  },
  viewerAssignLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  viewerAssignButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#FFFFFF',
  },
  viewerAssignButtonActive: {
    borderColor: '#34D399',
    backgroundColor: '#ECFDF3',
  },
  viewerAssignText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  viewerAssignTextActive: {
    color: '#047857',
  },
  viewerThumbStrip: {
    marginTop: theme.spacing.xs,
  },
  viewerTypeTabs: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  viewerTypeTab: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#FFFFFF',
  },
  viewerTypeTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewerTypeTabActive: {
    borderColor: '#34D399',
    backgroundColor: '#ECFDF3',
  },
  viewerTypeTabText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  viewerTypeTabTextActive: {
    color: '#047857',
  },
  viewerTypeBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerTypeBadgeActive: {
    backgroundColor: '#34D399',
  },
  viewerTypeBadgeText: {
    fontFamily: theme.font.body,
    fontSize: 10,
    color: '#0F172A',
  },
  viewerTypeBadgeTextActive: {
    color: '#064E3B',
  },
  viewerThumb: {
    width: 92,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 6,
    marginRight: theme.spacing.xs,
    position: 'relative',
  },
  viewerThumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  viewerThumbActive: {
    borderColor: '#34D399',
  },
  viewerThumbSecondaryActive: {
    borderColor: '#38BDF8',
  },
  viewerThumbImage: {
    width: '100%',
    height: 52,
    borderRadius: 8,
  },
  viewerThumbFallback: {
    width: '100%',
    height: 52,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerThumbLabel: {
    fontFamily: theme.font.body,
    fontSize: 9,
    color: '#E2E8F0',
    textAlign: 'center',
  },
  viewerThumbLabelOverlay: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 5,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  viewerUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  viewerUploadDisabled: {
    opacity: 0.5,
  },
  viewerUploadText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  viewerZoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  viewerZoomButtons: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  viewerActionRow: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    alignItems: 'center',
  },
  viewerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    backgroundColor: '#FFFFFF',
  },
  viewerActionButtonActive: {
    borderColor: '#34D399',
    backgroundColor: '#ECFDF3',
  },
  viewerActionText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  viewerActionTextActive: {
    color: '#047857',
  },
  viewerSavedText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  viewerZoomButton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  viewerControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  viewerSliderTrack: {
    width: 180,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
  },
  viewerSliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#34D399',
    left: '55%',
  },
  viewerFooter: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#94A3B8',
  },
  viewerReadout: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  severityBadgeText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#B91C1C',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  infoGridTwoCol: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  infoBlockHalf: {
    width: '47%',
    gap: 4,
  },
  infoBlock: {
    minWidth: 180,
    flex: 1,
    gap: 4,
  },
  selectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  selectSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  selectTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
    marginBottom: theme.spacing.xs,
  },
  selectOption: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  selectOptionText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  selectCancel: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectCancelText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  scanIdList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  scanIdChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    backgroundColor: '#F8FAFC',
  },
  scanIdChipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  scanIdEmpty: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  panelCard: {
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
  workflowHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
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
    marginTop: theme.spacing.xs,
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
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
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
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748B',
  },
  infoBlockFull: {
    width: '100%',
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
});
