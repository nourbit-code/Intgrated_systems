import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, View, StyleSheet, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Asset } from 'expo-asset';
import * as dicomParser from 'dicom-parser';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { FormCard } from '@/components/ui/FormCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { theme } from '@/constants/theme';
import { firstName, useAuth } from '@/hooks/useAuth';

type PriorityLevel = 'urgent' | 'normal';

const priorityMap: Record<PriorityLevel, { label: string; color: string; background: string }> = {
  urgent: { label: 'Urgent', color: '#B91C1C', background: '#FEE2E2' },
  normal: { label: 'Normal', color: '#0F766E', background: '#CCFBF1' },
};

function PriorityBadge({ level }: { level: PriorityLevel }) {
  const tone = priorityMap[level];
  return (
    <View style={[styles.priorityBadge, { backgroundColor: tone.background }]}>
      <Text style={[styles.priorityText, { color: tone.color }]}>{tone.label}</Text>
    </View>
  );
}

function TubeIcon() {
  return (
    <View style={styles.iconGroup}>
      <View style={styles.iconTube} />
      <View style={[styles.iconTube, styles.iconTubeTall]} />
      <View style={styles.iconTube} />
    </View>
  );
}

function ProgressIcon() {
  return <View style={styles.iconProgress} />;
}

function CheckIcon() {
  return (
    <View style={styles.iconDoc}>
      <View style={styles.iconCheck} />
    </View>
  );
}

function StackIcon() {
  return (
    <View style={styles.iconStack}>
      <View style={styles.iconStackRow} />
      <View style={[styles.iconStackRow, styles.iconStackRowMid]} />
      <View style={[styles.iconStackRow, styles.iconStackRowLight]} />
    </View>
  );
}

function StopwatchIcon() {
  return (
    <View style={styles.iconStopwatch}>
      <View style={styles.iconStopwatchHand} />
    </View>
  );
}

function AlertIcon() {
  return (
    <View style={styles.iconAlert}>
      <View style={styles.iconAlertDot} />
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  action,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  action?: ReactNode;
  tone?: 'light';
}) {
  const iconColor = tone === 'light' ? '#93C5FD' : theme.colors.accent;
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text style={[styles.sectionTitle, tone === 'light' && styles.sectionTitleLight]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
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

function MapSvg() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 900 520">
      <Defs>
        <LinearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#F6FAFF" />
          <Stop offset="100%" stopColor="#E8F0FA" />
        </LinearGradient>
      </Defs>
      <Rect width="900" height="520" fill="url(#mapBg)" />
      {[0, 60, 120, 180, 240, 300, 360, 420, 480].map((y) => (
        <Path key={`h-${y}`} d={`M0 ${y} H900`} stroke="#DDE6F1" strokeWidth="1" />
      ))}
      {[0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840].map((x) => (
        <Path key={`v-${x}`} d={`M${x} 0 V520`} stroke="#DDE6F1" strokeWidth="1" />
      ))}
      <Path d="M40 120 C200 40 420 220 620 120" stroke="#C7D2E5" strokeWidth="10" fill="none" />
      <Path d="M80 260 C260 240 520 140 780 200" stroke="#C7D2E5" strokeWidth="10" fill="none" />
      <Path d="M120 420 C260 320 500 520 820 420" stroke="#C7D2E5" strokeWidth="10" fill="none" />
      <Circle cx="240" cy="160" r="10" fill="#2E9E77" />
      <Circle cx="420" cy="240" r="10" fill="#3B82F6" />
      <Circle cx="640" cy="200" r="10" fill="#EF4444" />
      <Circle cx="320" cy="360" r="10" fill="#2E9E77" />
      <Rect x="110" y="60" width="220" height="44" rx="12" fill="#FFFFFF" stroke="#DCE5F0" />
      <SvgText x="128" y="86" fontSize="14" fill="#334155" fontFamily="System">
        Axilitme Station
      </SvgText>
      <SvgText x="128" y="102" fontSize="10" fill="#94A3B8" fontFamily="System">
        Live Lab Map
      </SvgText>
      <Rect x="710" y="470" width="160" height="28" rx="10" fill="#FFFFFF" opacity="0.9" />
      <SvgText x="726" y="488" fontSize="10" fill="#94A3B8" fontFamily="System">
        Axilitme Lab Campus
      </SvgText>
    </Svg>
  );
}

function TrendsChartSvg() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 640 240">
      <Defs>
        <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {[40, 90, 140, 190].map((y) => (
        <Path key={`g-${y}`} d={`M40 ${y} H600`} stroke="#E2E8F0" strokeWidth="1" />
      ))}
      <Path
        d="M40 180 C140 120 220 140 300 120 C380 100 460 140 600 80"
        stroke="#0F766E"
        strokeWidth="3"
        fill="none"
      />
      <Path
        d="M40 180 C140 120 220 140 300 120 C380 100 460 140 600 80 L600 220 L40 220 Z"
        fill="url(#trendFill)"
      />
      <Path d="M40 160 C120 140 220 80 300 100 C380 120 500 60 600 120" stroke="#2563EB" strokeWidth="3" fill="none" />
      <Path d="M40 200 C140 180 240 160 320 150 C420 140 520 160 600 140" stroke="#DC2626" strokeWidth="3" fill="none" />
      {[40, 200, 360, 520, 600].map((x) => (
        <Path key={`x-${x}`} d={`M${x} 210 V220`} stroke="#CBD5E1" strokeWidth="2" />
      ))}
      <Circle cx="520" cy="70" r="6" fill="#DC2626" />
    </Svg>
  );
}

function GaugeSvg() {
  return (
    <Svg width="100%" height="160" viewBox="0 0 260 160">
      <Path d="M30 130 A100 100 0 0 1 230 130" stroke="#E2E8F0" strokeWidth="18" fill="none" />
      <Path d="M30 130 A100 100 0 0 1 170 60" stroke="#22C55E" strokeWidth="18" fill="none" />
      <Path d="M170 60 L130 130" stroke="#0F172A" strokeWidth="4" />
      <Circle cx="130" cy="130" r="8" fill="#0F172A" />
    </Svg>
  );
}

const formatLabel = (value: string) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function LabTechDashboard() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const welcomeName = firstName(currentUser?.name) || 'Technician';
  const [viewerSource, setViewerSource] = useState<'t1' | 't2' | 'dicom' | 'upload'>('t1');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [windowCenter, setWindowCenter] = useState(40);
  const [windowWidth, setWindowWidth] = useState(120);
  const [dicomImageUri, setDicomImageUri] = useState<string | null>(null);
  const [dicomMeta, setDicomMeta] = useState<{ rows: number; cols: number } | null>(null);
  const [dicomFrames, setDicomFrames] = useState(1);
  const [dicomFrameIndex, setDicomFrameIndex] = useState(0);
  const [uploadImageUri, setUploadImageUri] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<'dicom' | 'image' | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; value: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [radiologistStatus, setRadiologistStatus] = useState<'idle' | 'sent'>('idle');
  const [reviewStatus, setReviewStatus] = useState<'idle' | 'flagged'>('idle');
  const [worklistSearch, setWorklistSearch] = useState('');
  const [sampleSearch, setSampleSearch] = useState('');
  const [scanSearch, setScanSearch] = useState('');
  const [worklistStatusFilter, setWorklistStatusFilter] = useState<'all' | 'in-progress' | 'samples-waiting' | 'completed'>('all');
  const [sampleStatusFilter, setSampleStatusFilter] = useState<'all' | 'in-progress' | 'samples-waiting' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'all'>('all');
  const [sampleSortMode, setSampleSortMode] = useState<'none' | 'status'>('none');
  const [recentScans, setRecentScans] = useState<
    Array<{
      id: string;
      code: string;
      viewedAt: number;
      source: typeof viewerSource;
      uploadKind: typeof uploadKind;
      uploadFileName?: string | null;
      uploadImageUri?: string | null;
      dicomImageUri?: string | null;
      dicomMeta?: { rows: number; cols: number } | null;
    }>
  >([]);
  const [pinsByScan, setPinsByScan] = useState<Record<string, Array<{ id: string; x: number; y: number }>>>({});
  const [savedPinsByScan, setSavedPinsByScan] = useState<Record<string, { savedAt: number; count: number }>>({});
  const viewerRef = useRef<View>(null);
  const didInitDicomWindow = useRef(false);
  const dicomPixelsRef = useRef<Uint16Array | Uint8Array | null>(null);
  const dicomInfoRef = useRef<{ rows: number; cols: number; slope: number; intercept: number; frames: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const dragDistanceRef = useRef(0);
  const skipNextClickRef = useRef(false);
  const lastRecentKeyRef = useRef<string | null>(null);
  const updateImageSize = (width: number, height: number) => {
    if (!width || !height) return;
    setImageSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };
  const worklist = [
    { order: '1042', patient: 'Ahmed', test: 'CBC', priority: 'urgent' as const, eta: '12 min', status: 'in-progress' as const },
    { order: '1043', patient: 'Sara', test: 'Glucose', priority: 'urgent' as const, eta: '24 min', status: 'samples-waiting' as const },
    { order: '1044', patient: 'Mona', test: 'Lipid Panel', priority: 'normal' as const, eta: '40 min', status: 'samples-waiting' as const },
    { order: '1045', patient: 'Omar', test: 'TSH', priority: 'normal' as const, eta: '52 min', status: 'samples-waiting' as const },
    { order: '1046', patient: 'Laila', test: 'HbA1c', priority: 'urgent' as const, eta: '18 min', status: 'in-progress' as const },
    { order: '1047', patient: 'Nadia', test: 'CRP', priority: 'urgent' as const, eta: '9 min', status: 'in-progress' as const },
    { order: '1048', patient: 'Hassan', test: 'BMP', priority: 'normal' as const, eta: '55 min', status: 'completed' as const },
  ];

  const specimenTracking = [
    { id: 'SP-3481', rack: 'Hematology A2', received: '09:12', stage: 'Centrifuge', status: 'in-progress' as const },
    { id: 'SP-3482', rack: 'Chemistry B1', received: '09:26', stage: 'Analyzer 02', status: 'in-progress' as const },
    { id: 'SP-3484', rack: 'Micro C3', received: '09:41', stage: 'Incubator', status: 'samples-waiting' as const },
    { id: 'SP-3487', rack: 'Hematology A4', received: '09:55', stage: 'Analyzer 01', status: 'in-progress' as const },
    { id: 'SP-3490', rack: 'Chemistry B2', received: '10:06', stage: 'Aliquot', status: 'samples-waiting' as const },
    { id: 'SP-3492', rack: 'Micro C1', received: '10:18', stage: 'Staining', status: 'in-progress' as const },
    { id: 'SP-3494', rack: 'Immuno D2', received: '10:22', stage: 'Analyzer 04', status: 'completed' as const },
  ];
  const criticalAlerts = [
    { patient: 'Ahmed', test: 'Potassium', value: '6.8 mmol/L', status: 'in-progress' as const },
  ];

  const viewerAssets = useMemo(() => ({
    t1: Asset.fromModule(require('@/assets/images/t1_sag_tse-REF-DR52.webp')),
    t2: Asset.fromModule(require('@/assets/images/t2_stir_sag_REF-DR52.webp')),
  }), []);
  const worklistCounts = useMemo(() => ({
    waiting: worklist.filter((row) => row.status === 'samples-waiting').length,
    inProgress: worklist.filter((row) => row.status === 'in-progress').length,
    completed: worklist.filter((row) => row.status === 'completed').length,
  }), [worklist]);
  const criticalAlertsCount = criticalAlerts.length;
  const activeImageUri = useMemo(() => {
    if (viewerSource === 't1') return viewerAssets.t1.uri;
    if (viewerSource === 't2') return viewerAssets.t2.uri;
    return null;
  }, [viewerAssets, viewerSource]);
  const linkedOrder = useMemo(() => worklist[0], [worklist]);
  const filteredWorklist = useMemo(() => {
    const query = worklistSearch.trim().toLowerCase();
    const base = query
      ? worklist.filter(
          (row) =>
            row.order.toLowerCase().includes(query) ||
            row.patient.toLowerCase().includes(query) ||
            row.test.toLowerCase().includes(query),
        )
      : worklist;
    const priorityFiltered = priorityFilter === 'all' ? base : base.filter((row) => row.priority === priorityFilter);
    if (worklistStatusFilter === 'all') return priorityFiltered;
    return priorityFiltered.filter((row) => row.status === worklistStatusFilter);
  }, [worklist, worklistSearch, priorityFilter, worklistStatusFilter]);
  const filteredSpecimenTracking = useMemo(() => {
    const query = sampleSearch.trim().toLowerCase();
    const base = query
      ? specimenTracking.filter(
          (row) =>
            row.id.toLowerCase().includes(query) ||
            row.rack.toLowerCase().includes(query) ||
            row.stage.toLowerCase().includes(query),
        )
      : specimenTracking;
    if (sampleStatusFilter === 'all') return base;
    return base.filter((row) => row.status === sampleStatusFilter);
  }, [specimenTracking, sampleSearch, sampleStatusFilter]);
  const prioritySortOrder: Record<PriorityLevel, number> = { urgent: 0, normal: 1 };
  const statusSortOrder: Record<'samples-waiting' | 'in-progress' | 'completed', number> = {
    'samples-waiting': 0,
    'in-progress': 1,
    completed: 2,
  };
  const sortedWorklist = useMemo(() => {
    return [...filteredWorklist].sort((a, b) => statusSortOrder[a.status] - statusSortOrder[b.status]);
  }, [filteredWorklist]);
  const sortedSpecimens = useMemo(() => {
    return [...filteredSpecimenTracking].sort((a, b) => statusSortOrder[a.status] - statusSortOrder[b.status]);
  }, [filteredSpecimenTracking]);
  const toggleWorklistStatusFilter = () => {
    setWorklistStatusFilter((prev) => {
      if (prev === 'all') return 'in-progress';
      if (prev === 'in-progress') return 'samples-waiting';
      if (prev === 'samples-waiting') return 'completed';
      return 'all';
    });
  };
  const toggleSampleStatusFilter = () => {
    setSampleStatusFilter((prev) => {
      if (prev === 'all') return 'in-progress';
      if (prev === 'in-progress') return 'samples-waiting';
      if (prev === 'samples-waiting') return 'completed';
      return 'all';
    });
  };
  const togglePriorityFilter = () => {
    setPriorityFilter((prev) => {
      if (prev === 'all') return 'urgent';
      if (prev === 'urgent') return 'normal';
      return 'all';
    });
  };
  const scanCode = useMemo(() => {
    const hashToCode = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
      }
      return `SC-${1000 + (hash % 9000)}`;
    };
    const computeCode = (source: typeof viewerSource, fileName?: string | null) => {
      if (source === 'upload') {
        if (fileName) return hashToCode(fileName);
        return 'SC-9000';
      }
      if (source === 't1') return 'SC-1042';
      if (source === 't2') return 'SC-1043';
      if (source === 'dicom') return 'SC-1044';
      return 'SC-1000';
    };
    return computeCode(viewerSource, uploadFileName);
  }, [viewerSource, uploadFileName]);
  const currentScanKey = useMemo(
    () => `${viewerSource}:${uploadKind ?? 'n/a'}:${uploadFileName ?? 'nofile'}:${dicomImageUri ? 'dicom' : 'none'}:${uploadImageUri ? 'img' : 'none'}`,
    [viewerSource, uploadKind, uploadFileName, dicomImageUri, uploadImageUri],
  );
  const getScanCodeForRecent = (source: typeof viewerSource, fileName?: string | null) => {
    if (source === 'upload') {
      if (fileName) {
        let hash = 0;
        for (let i = 0; i < fileName.length; i += 1) {
          hash = (hash * 31 + fileName.charCodeAt(i)) >>> 0;
        }
        return `SC-${1000 + (hash % 9000)}`;
      }
      return 'SC-9000';
    }
    if (source === 't1') return 'SC-1042';
    if (source === 't2') return 'SC-1043';
    if (source === 'dicom') return 'SC-1044';
    return 'SC-1000';
  };

  const webFilterStyle = useMemo(
    // Web-only CSS filter for brightness/contrast; native ignores this style.
    () => (Platform.OS === 'web' ? ({ filter: `brightness(${brightness}) contrast(${contrast})` } as any) : null),
    [brightness, contrast],
  );

  const viewerImageStyle = useMemo(
    () => [styles.viewerImage, webFilterStyle].filter(Boolean) as any,
    [webFilterStyle],
  );
  const viewerInteractionStyle = useMemo(
    () => (Platform.OS === 'web' ? ({ cursor: zoom > 1 ? 'grab' : 'default', userSelect: 'none' } as any) : null),
    [zoom],
  );

  const renderDicomFrame = (frameIndex: number) => {
    if (Platform.OS !== 'web') return;
    const info = dicomInfoRef.current;
    const pixels = dicomPixelsRef.current;
    if (!info || !pixels) return;

    const { rows, cols, slope, intercept } = info;
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.createImageData(cols, rows);

    const min = windowCenter - windowWidth / 2;
    const max = windowCenter + windowWidth / 2;
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
    setDicomImageUri(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    viewerAssets.t1.downloadAsync();
    viewerAssets.t2.downloadAsync();
  }, [viewerAssets]);

  useEffect(() => {
    if (viewerSource !== 'dicom') return;
    if (Platform.OS !== 'web') return;

    const loadDicom = async () => {
      try {
        const response = await fetch('/dicom/Altea_t2_stir_sag_DR_88115187.dcm');
        const buffer = await response.arrayBuffer();
        const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));
        const rows = dataSet.uint16('x00280010') ?? 0;
        const cols = dataSet.uint16('x00280011') ?? 0;
        setDicomMeta({ rows, cols });
        updateImageSize(cols, rows);

        const pixelElement = dataSet.elements.x7fe00010;
        if (!pixelElement) return;

        const bitsAllocated = dataSet.uint16('x00280100') ?? 16;
        const slope = parseFloat(dataSet.string('x00281053') ?? '1');
        const intercept = parseFloat(dataSet.string('x00281052') ?? '0');
        const tagFrames = parseInt(dataSet.string('x00280008') ?? '1', 10) || 1;
        setDicomFrameIndex(0);
        const wc = parseFloat(dataSet.string('x00281050') ?? `${windowCenter}`);
        const ww = parseFloat(dataSet.string('x00281051') ?? `${windowWidth}`);
        if (!didInitDicomWindow.current) {
          if (Number.isFinite(wc)) setWindowCenter(wc);
          if (Number.isFinite(ww)) setWindowWidth(ww);
          didInitDicomWindow.current = true;
        }

        const pixelBuffer = dataSet.byteArray.buffer.slice(
          pixelElement.dataOffset,
          pixelElement.dataOffset + pixelElement.length,
        );
        const pixels = bitsAllocated === 16 ? new Uint16Array(pixelBuffer) : new Uint8Array(pixelBuffer);
        const pixelCount = pixels.length;
        const framePixels = rows * cols || 1;
        const inferredFrames = Math.max(1, Math.floor(pixelCount / framePixels));
        const frames = tagFrames > 1 ? tagFrames : inferredFrames;
        setDicomFrames(frames);
        dicomPixelsRef.current = pixels;
        dicomInfoRef.current = { rows, cols, slope, intercept, frames };

        renderDicomFrame(0);
      } catch {
        setDicomImageUri(null);
      }
    };

    loadDicom();
  }, [viewerSource, windowCenter, windowWidth]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!(viewerSource === 'dicom' || (viewerSource === 'upload' && uploadKind === 'dicom'))) return;
    if (!dicomPixelsRef.current || !dicomInfoRef.current) return;
    renderDicomFrame(dicomFrameIndex);
  }, [dicomFrameIndex, viewerSource, uploadKind, windowCenter, windowWidth]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHoverInfo(null);
  }, [viewerSource, uploadImageUri, dicomImageUri]);
  const getImageTransform = () => {
    const info = dicomInfoRef.current;
    const cols = info?.cols ?? dicomMeta?.cols ?? imageSize.width;
    const rows = info?.rows ?? dicomMeta?.rows ?? imageSize.height;
    const imgW = imageSize.width || cols || 0;
    const imgH = imageSize.height || rows || 0;
    if (!imgW || !imgH || !viewerSize.width || !viewerSize.height) return null;
    const scale = Math.min(viewerSize.width / imgW, viewerSize.height / imgH);
    const offsetX = (viewerSize.width - imgW * scale) / 2 + pan.x;
    const offsetY = (viewerSize.height - imgH * scale) / 2 + pan.y;
    return { scale, offsetX, offsetY, imgW, imgH };
  };
  const getImageCoordsFromEvent = (event: any) => {
    const transform = getImageTransform();
    if (!transform) return null;
    const { scale, offsetX, offsetY, imgW, imgH } = transform;
    const displayW = imgW * scale * zoom;
    const displayH = imgH * scale * zoom;
    let localX = 0;
    let localY = 0;
    if (Platform.OS === 'web') {
      const rect = (viewerRef.current as any)?.getBoundingClientRect?.();
      const clientX = event?.clientX ?? event?.nativeEvent?.pageX ?? 0;
      const clientY = event?.clientY ?? event?.nativeEvent?.pageY ?? 0;
      if (rect) {
        localX = clientX - rect.left - offsetX;
        localY = clientY - rect.top - offsetY;
      } else {
        localX = (event.nativeEvent?.locationX ?? event.nativeEvent?.offsetX ?? 0) - offsetX;
        localY = (event.nativeEvent?.locationY ?? event.nativeEvent?.offsetY ?? 0) - offsetY;
      }
    } else {
      localX = (event.nativeEvent?.locationX ?? event.nativeEvent?.offsetX ?? 0) - offsetX;
      localY = (event.nativeEvent?.locationY ?? event.nativeEvent?.offsetY ?? 0) - offsetY;
    }
    if (localX < 0 || localY < 0 || localX > displayW || localY > displayH) return null;
    const x = Math.floor(localX / (scale * zoom));
    const y = Math.floor(localY / (scale * zoom));
    if (x < 0 || y < 0 || x >= imgW || y >= imgH) return null;
    return { x, y };
  };
  useEffect(() => {
    const label =
      viewerSource === 'upload'
        ? uploadKind === 'image'
          ? 'Uploaded Image'
          : 'Uploaded DICOM'
        : viewerSource === 'dicom'
          ? 'Sample DICOM'
          : viewerSource.toUpperCase();
    const key = `${viewerSource}:${uploadKind ?? 'n/a'}:${dicomImageUri ? 'dicom' : 'none'}:${uploadImageUri ? 'img' : 'none'}`;
    if (lastRecentKeyRef.current === key) return;
    lastRecentKeyRef.current = key;
    setRecentScans((prev) => {
      const normalizedPrev = prev.map((item) => ({
        ...item,
        code: item.code || getScanCodeForRecent(item.source, item.uploadFileName),
        viewedAt: Number.isFinite(item.viewedAt) ? item.viewedAt : Date.now(),
      }));
      const next = [
        {
          id: key,
          code: getScanCodeForRecent(viewerSource, uploadFileName),
          viewedAt: Date.now(),
          source: viewerSource,
          uploadKind,
          uploadFileName,
          uploadImageUri,
          dicomImageUri,
          dicomMeta,
        },
        ...normalizedPrev,
      ];
      const deduped = next.filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index);
      return deduped.slice(0, 4);
    });
  }, [viewerSource, uploadKind, dicomImageUri, uploadImageUri, dicomMeta, linkedOrder, scanCode]);

  const handleUpload = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dcm,.dicom,.png,.jpg,.jpeg,application/dicom,application/octet-stream,image/png,image/jpeg,*/*';
    input.setAttribute('accept', '.dcm,.dicom,.png,.jpg,.jpeg,application/dicom,application/octet-stream,image/png,image/jpeg,*/*');
    input.multiple = false;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const lowerName = file.name.toLowerCase();
      const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg)$/.test(lowerName);
      const isDicom = file.type === 'application/dicom' || /\.dcm$|\.dicom$/.test(lowerName);

      if (isImage && !isDicom) {
        const reader = new FileReader();
        reader.onload = () => {
          setUploadImageUri(reader.result as string);
          setUploadKind('image');
          setViewerSource('upload');
          setUploadFileName(file.name);
          setImageSize({ width: 0, height: 0 });
          setDicomFrames(1);
          setDicomFrameIndex(0);
          setDicomMeta(null);
        };
        reader.readAsDataURL(file);
        return;
      }

      didInitDicomWindow.current = false;
      dicomPixelsRef.current = null;
      dicomInfoRef.current = null;
      setUploadFileName(file.name);
      const buffer = await file.arrayBuffer();
      const dataSet = dicomParser.parseDicom(new Uint8Array(buffer));
      const rows = dataSet.uint16('x00280010') ?? 0;
      const cols = dataSet.uint16('x00280011') ?? 0;
      setDicomMeta({ rows, cols });
      updateImageSize(cols, rows);

      const pixelElement = dataSet.elements.x7fe00010;
      if (!pixelElement) return;
      const bitsAllocated = dataSet.uint16('x00280100') ?? 16;
      const slope = parseFloat(dataSet.string('x00281053') ?? '1');
      const intercept = parseFloat(dataSet.string('x00281052') ?? '0');
      const tagFrames = parseInt(dataSet.string('x00280008') ?? '1', 10) || 1;
      setDicomFrameIndex(0);

      const wc = parseFloat(dataSet.string('x00281050') ?? `${windowCenter}`);
      const ww = parseFloat(dataSet.string('x00281051') ?? `${windowWidth}`);
      if (Number.isFinite(wc)) setWindowCenter(wc);
      if (Number.isFinite(ww)) setWindowWidth(ww);

      const pixelBuffer = dataSet.byteArray.buffer.slice(
        pixelElement.dataOffset,
        pixelElement.dataOffset + pixelElement.length,
      );
      const pixels = bitsAllocated === 16 ? new Uint16Array(pixelBuffer) : new Uint8Array(pixelBuffer);
      const pixelCount = pixels.length;
      const framePixels = rows * cols || 1;
      const inferredFrames = Math.max(1, Math.floor(pixelCount / framePixels));
      const frames = tagFrames > 1 ? tagFrames : inferredFrames;
      setDicomFrames(frames);
      dicomPixelsRef.current = pixels;
      dicomInfoRef.current = { rows, cols, slope, intercept, frames };
      renderDicomFrame(0);
      setViewerSource('upload');
      setUploadKind('dicom');
    };
    input.click();
  };

  const handleFullscreen = () => {
    if (Platform.OS !== 'web') return;
    const node = viewerRef.current as any;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    node?.requestFullscreen?.();
  };

  const isDicomView = viewerSource === 'dicom' || (viewerSource === 'upload' && uploadKind === 'dicom');

  const handleWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    const delta = event?.deltaY ?? event?.nativeEvent?.deltaY ?? 0;
    if (!delta) return;
    event.preventDefault?.();
    const next = Math.max(1, Math.min(4, zoom - delta * 0.001));
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };
  const clampZoom = (value: number) => Math.max(1, Math.min(4, value));
  const handleZoomStep = (direction: 1 | -1) => {
    const next = clampZoom(zoom + direction * 0.25);
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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

    if (!isDicomView || !dicomInfoRef.current || !dicomPixelsRef.current) {
      setHoverInfo(null);
      return;
    }

    const coords = getImageCoordsFromEvent(event);
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

  const addPinFromEvent = (event?: any) => {
    if (!event) return;
    if (skipNextClickRef.current) {
      skipNextClickRef.current = false;
      return;
    }
    const coords = getImageCoordsFromEvent(event);
    if (!coords) return;
    const pin = { id: `${Date.now()}-${Math.random()}`, x: coords.x, y: coords.y };
    setPinsByScan((prev) => ({
      ...prev,
      [currentScanKey]: [...(prev[currentScanKey] ?? []), pin],
    }));
  };
  const removePin = (pinId: string) => {
    skipNextClickRef.current = true;
    setPinsByScan((prev) => ({
      ...prev,
      [currentScanKey]: (prev[currentScanKey] ?? []).filter((pin) => pin.id !== pinId),
    }));
  };
  const handleSavePins = () => {
    const count = (pinsByScan[currentScanKey] ?? []).length;
    setSavedPinsByScan((prev) => ({
      ...prev,
      [currentScanKey]: { savedAt: Date.now(), count },
    }));
  };
  const handleResetPins = () => {
    setPinsByScan((prev) => ({ ...prev, [currentScanKey]: [] }));
    setSavedPinsByScan((prev) => {
      const next = { ...prev };
      delete next[currentScanKey];
      return next;
    });
  };
  const handleMouseUp = (event?: any) => {
    const wasDragging = isDraggingRef.current;
    isDraggingRef.current = false;
    if (Platform.OS !== 'web') return;
    if (wasDragging && dragDistanceRef.current > 3) return;
    addPinFromEvent(event);
  };
  const handleClick = (event: any) => {
    if (Platform.OS !== 'web') return;
    if (dragDistanceRef.current > 3) return;
    addPinFromEvent(event);
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setHoverInfo(null);
  };
  const formatRecentAge = (timestamp: number) => {
    if (!Number.isFinite(timestamp)) return '';
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };
  const openRecentScan = (item: (typeof recentScans)[number]) => {
    if (item.source === 't1' || item.source === 't2' || item.source === 'dicom') {
      setViewerSource(item.source);
      return;
    }
    if (item.source === 'upload' && item.uploadKind === 'image' && item.uploadImageUri) {
      setUploadImageUri(item.uploadImageUri);
      setUploadKind('image');
      setUploadFileName(item.uploadFileName ?? null);
      setViewerSource('upload');
      return;
    }
    if (item.source === 'upload' && item.dicomImageUri) {
      setDicomImageUri(item.dicomImageUri);
      setDicomMeta(item.dicomMeta ?? null);
      setUploadKind('dicom');
      setUploadFileName(item.uploadFileName ?? null);
      setViewerSource('upload');
    }
  };
  const viewerWebEvents =
    Platform.OS === 'web'
      ? ({
          onWheel: handleWheel,
          onMouseDown: handleMouseDown,
          onMouseMove: handleMouseMove,
          onMouseUp: handleMouseUp,
          onMouseLeave: handleMouseLeave,
          onClick: handleClick,
        } as any)
      : {};

  return (
    <DashboardLayout
      title={`Welcome Technician, ${welcomeName}`}
    >
      <View style={styles.topRow}>
        <View style={styles.statsColumn}>
          <View style={styles.topLeftStack}>
            <View style={styles.stats}>
              <StatCard label="Samples Waiting" value={worklistCounts.waiting} icon={<TubeIcon />} />
              <StatCard label="In Progress" value={worklistCounts.inProgress} tone="accent" icon={<ProgressIcon />} />
              <StatCard label="Completed Today" value={worklistCounts.completed} icon={<CheckIcon />} />
              <StatCard
                label="Critical Alerts"
                value={criticalAlertsCount}
                icon={<AlertIcon />}
              />
            </View>
            <FormCard>
              <SectionHeader icon="list-circle-outline" title="Priority Worklist" />
              <View style={styles.tableSearchRow}>
                <View style={styles.tableSearchInputWrap}>
                  <SearchInput
                    placeholder="Search by ID or name"
                    value={worklistSearch}
                    onChangeText={setWorklistSearch}
                    enableVoice
                  />
                </View>
                <View style={styles.tableSortGroup}>
                  <Pressable
                    onPress={togglePriorityFilter}
                    style={[
                      styles.tableSortChip,
                      priorityFilter === 'all' ? styles.tableSortChipInactive : styles.tableSortChipPriorityActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tableSortText,
                        priorityFilter === 'all' ? styles.tableSortTextInactive : styles.tableSortTextPriority,
                      ]}
                    >
                      {priorityFilter === 'all'
                        ? 'All'
                        : priorityMap[priorityFilter].label}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={toggleWorklistStatusFilter}
                    style={[
                      styles.tableSortChip,
                      worklistStatusFilter === 'completed' ? styles.tableSortChipStatusCompleted : null,
                      worklistStatusFilter === 'in-progress' ? styles.tableSortChipStatusInProgress : null,
                      worklistStatusFilter === 'samples-waiting' ? styles.tableSortChipStatusWaiting : null,
                      worklistStatusFilter === 'all' ? styles.tableSortChipInactive : styles.tableSortChipStatusActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tableSortText,
                        worklistStatusFilter === 'completed' ? styles.tableSortTextCompleted : null,
                        worklistStatusFilter === 'in-progress' ? styles.tableSortTextInProgress : null,
                        worklistStatusFilter === 'samples-waiting' ? styles.tableSortTextWaiting : null,
                        worklistStatusFilter === 'all' ? styles.tableSortTextInactive : styles.tableSortTextStatus,
                      ]}
                    >
                      {worklistStatusFilter === 'all'
                        ? 'All'
                        : formatLabel(worklistStatusFilter)}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <DataTable
                columns={['Order', 'Patient', 'Test', 'Priority', 'ETA', 'Status']}
                columnWidths={[110, 140, 160, 120, 90, 150]}
                bodyMaxHeight={140}
                rowKeys={sortedWorklist.map((row) => row.order)}
                rowA11yLabels={sortedWorklist.map(
                  (row) =>
                    `Order ${row.order}. ${row.patient}. ${row.test}. Priority ${priorityMap[row.priority].label}. ETA ${row.eta}. Status ${formatLabel(
                      row.status,
                    )}.`,
                )}
                rows={sortedWorklist.map((row) => [
                  `#${row.order}`,
                  row.patient,
                  row.test,
                  <PriorityBadge key={`${row.order}-priority`} level={row.priority} />,
                  row.eta,
                  <StatusBadge key={`${row.order}-status`} status={row.status} />,
                ])}
              />
            </FormCard>
            <FormCard>
              <SectionHeader icon="flask-outline" title="Sample Tracking" />
              <View style={styles.tableSearchRow}>
                <View style={styles.tableSearchInputWrap}>
                  <SearchInput
                    placeholder="Search by ID or name"
                    value={sampleSearch}
                    onChangeText={setSampleSearch}
                    enableVoice
                  />
                </View>
                <View style={styles.tableSortGroup}>
                  <Pressable
                    onPress={toggleSampleStatusFilter}
                    style={[
                      styles.tableSortChip,
                      sampleStatusFilter === 'completed' ? styles.tableSortChipStatusCompleted : null,
                      sampleStatusFilter === 'in-progress' ? styles.tableSortChipStatusInProgress : null,
                      sampleStatusFilter === 'samples-waiting' ? styles.tableSortChipStatusWaiting : null,
                      sampleStatusFilter === 'all' ? styles.tableSortChipInactive : styles.tableSortChipStatusActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tableSortText,
                        sampleStatusFilter === 'completed' ? styles.tableSortTextCompleted : null,
                        sampleStatusFilter === 'in-progress' ? styles.tableSortTextInProgress : null,
                        sampleStatusFilter === 'samples-waiting' ? styles.tableSortTextWaiting : null,
                        sampleStatusFilter === 'all' ? styles.tableSortTextInactive : styles.tableSortTextStatus,
                      ]}
                    >
                      {sampleStatusFilter === 'all'
                        ? 'All'
                        : formatLabel(sampleStatusFilter)}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <DataTable
                columns={['Sample', 'Rack', 'Received', 'Stage', 'Status']}
                columnWidths={[120, 150, 100, 160, 150]}
                bodyMaxHeight={140}
                rowKeys={sortedSpecimens.map((row) => row.id)}
                rowA11yLabels={sortedSpecimens.map(
                  (row) =>
                    `Specimen ${row.id}. Rack ${row.rack}. Received ${row.received}. Stage ${row.stage}. Status ${formatLabel(row.status)}.`,
                )}
                rows={sortedSpecimens.map((row) => [
                  row.id,
                  row.rack,
                  row.received,
                  row.stage,
                  <StatusBadge key={`${row.id}-status`} status={row.status} />,
                ])}
              />
            </FormCard>
          </View>
        </View>
        <View style={styles.viewerColumn}>
          <FormCard style={isDarkMode ? styles.darkCard : styles.lightCard}>
            <SectionHeader
              icon="scan-outline"
              title="Scan Viewer"
              tone={isDarkMode ? 'light' : undefined}
              action={(
                <Pressable
                  onPress={handleFullscreen}
                  style={[styles.viewerIconButton, !isDarkMode && styles.viewerIconButtonLight]}
                >
                  <Ionicons name="expand-outline" size={16} color={isDarkMode ? '#E2E8F0' : '#1F2937'} />
                </Pressable>
              )}
            />
            <View style={styles.viewerToggle}>
              <Pressable
                onPress={() => setIsDarkMode((prev) => !prev)}
                style={[styles.viewerSwitch, !isDarkMode && styles.viewerSwitchLight]}
              >
                <View style={[styles.viewerSwitchThumb, !isDarkMode && styles.viewerSwitchThumbLight]} />
              </Pressable>
              <View style={styles.viewerSearchWrap}>
                <SearchInput
                  placeholder=""
                  value={scanSearch}
                  onChangeText={setScanSearch}
                  enableVoice
                />
              </View>
              <View style={styles.viewerStatusIcons}>
                {radiologistStatus === 'sent' ? (
                  <View style={[styles.viewerStatusIcon, styles.viewerStatusIconActive]}>
                    <Ionicons name="send" size={12} color="#E2E8F0" />
                  </View>
                ) : null}
                {reviewStatus === 'flagged' ? (
                  <View style={[styles.viewerStatusIcon, styles.viewerStatusIconWarn]}>
                    <Ionicons name="flag" size={12} color="#FDE68A" />
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.viewerTabs}>
              {[
                { id: 't1', label: 'T1' },
                { id: 't2', label: 'T2' },
                { id: 'dicom', label: 'DICOM' },
              ].map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => setViewerSource(tab.id as typeof viewerSource)}
                  style={[
                    styles.viewerTab,
                    !isDarkMode && styles.viewerTabLight,
                    viewerSource === tab.id && styles.viewerTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.viewerTabText,
                      !isDarkMode && styles.viewerTabTextLight,
                      viewerSource === tab.id && styles.viewerTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={handleUpload}
                style={[styles.viewerTabUpload, !isDarkMode && styles.viewerTabUploadLight]}
              >
                <Ionicons name="cloud-upload-outline" size={14} color={isDarkMode ? '#E2E8F0' : '#1F2937'} />
                <Text style={[styles.viewerTabUploadText, !isDarkMode && styles.viewerTabUploadTextLight]}>
                  Upload DICOM
                </Text>
              </Pressable>
            </View>
            <View
              ref={viewerRef}
              style={[styles.viewerFrame, !isDarkMode && styles.viewerFrameLight, viewerInteractionStyle]}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setViewerSize({ width, height });
              }}
              {...viewerWebEvents}
            >
              <View style={styles.viewerGlow} pointerEvents="none" />
              {viewerSource === 'dicom' || viewerSource === 'upload' ? (
                Platform.OS !== 'web' ? (
                  <Text style={styles.viewerPlaceholder}>DICOM preview available on web.</Text>
                ) : viewerSource === 'upload' && uploadKind === 'image' && uploadImageUri ? (
                  <View style={[styles.viewerImageWrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }] }]}>
                    <Image
                      source={{ uri: uploadImageUri }}
                      style={viewerImageStyle}
                      resizeMode="contain"
                      onLoad={(event) => {
                        const source = event.nativeEvent?.source;
                        if (source?.width && source?.height) {
                          updateImageSize(source.width, source.height);
                        }
                      }}
                    />
                  </View>
                ) : dicomImageUri ? (
                  <View style={[styles.viewerImageWrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }] }]}>
                    <Image
                      source={{ uri: dicomImageUri }}
                      style={viewerImageStyle}
                      resizeMode="contain"
                      onLoad={() => {
                        if (dicomMeta) updateImageSize(dicomMeta.cols, dicomMeta.rows);
                      }}
                    />
                  </View>
                ) : (
                  <Text style={styles.viewerPlaceholder}>DICOM preview loading...</Text>
                )
              ) : activeImageUri ? (
                <View style={[styles.viewerImageWrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }] }]}>
                  <Image
                    source={{ uri: activeImageUri }}
                    style={viewerImageStyle}
                    resizeMode="contain"
                    onLoad={(event) => {
                      const source = event.nativeEvent?.source;
                      if (source?.width && source?.height) {
                        updateImageSize(source.width, source.height);
                      }
                    }}
                  />
                </View>
              ) : (
                <Text style={styles.viewerPlaceholder}>Scan Preview</Text>
              )}
              {Platform.OS === 'web' && pinsByScan[currentScanKey]?.length ? (
                <View style={styles.viewerPins} pointerEvents="box-none">
                  {(() => {
                    const transform = getImageTransform();
                    if (!transform) return null;
                    const { scale, offsetX, offsetY } = transform;
                    return pinsByScan[currentScanKey].map((pin) => (
                      <Pressable
                        key={pin.id}
                        onPress={() => removePin(pin.id)}
                        style={[
                          styles.viewerPin,
                          {
                            left: offsetX + pin.x * scale * zoom - 6,
                            top: offsetY + pin.y * scale * zoom - 6,
                          },
                        ]}
                      />
                    ));
                  })()}
                </View>
              ) : null}
            </View>
            <View style={styles.viewerLinkRow}>
              <View>
                <Text style={[styles.viewerLinkLabel, !isDarkMode && styles.viewerFooterLight]}>
                  Linked Order
                </Text>
                <Text style={[styles.viewerLinkValue, !isDarkMode && styles.viewerFooterLight]}>
                  {linkedOrder.patient} · Order #{linkedOrder.order} · Scan {scanCode}
                </Text>
              </View>
            </View>
            <View style={styles.viewerControls}>
              <View style={styles.viewerActionRow}>
                <Pressable
                  onPress={() => setRadiologistStatus((prev) => (prev === 'sent' ? 'idle' : 'sent'))}
                  style={[styles.viewerActionButton, !isDarkMode && styles.viewerActionButtonLight]}
                >
                  <Ionicons name="send" size={13} color={isDarkMode ? '#E2E8F0' : '#1F2937'} />
                  <Text style={[styles.viewerActionText, !isDarkMode && styles.viewerActionTextLight]}>
                    Send
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setReviewStatus((prev) => (prev === 'flagged' ? 'idle' : 'flagged'))}
                  style={[styles.viewerActionButton, styles.viewerActionButtonWarn, !isDarkMode && styles.viewerActionButtonLight]}
                >
                  <Ionicons name="flag" size={13} color={isDarkMode ? '#FDE68A' : '#92400E'} />
                  <Text style={[styles.viewerActionText, styles.viewerActionTextWarn]}>
                    Flag
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSavePins}
                  style={[styles.viewerActionButton, !isDarkMode && styles.viewerActionButtonLight]}
                >
                  <Ionicons name="save" size={13} color={isDarkMode ? '#E2E8F0' : '#1F2937'} />
                  <Text style={[styles.viewerActionText, !isDarkMode && styles.viewerActionTextLight]}>
                    Save Pins
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleResetPins}
                  style={[styles.viewerActionButton, !isDarkMode && styles.viewerActionButtonLight]}
                >
                  <Ionicons name="trash" size={13} color={isDarkMode ? '#E2E8F0' : '#1F2937'} />
                  <Text style={[styles.viewerActionText, !isDarkMode && styles.viewerActionTextLight]}>
                    Reset Pins
                  </Text>
                </Pressable>
                {savedPinsByScan[currentScanKey] ? (
                  <Text style={[styles.viewerSavedText, !isDarkMode && styles.viewerFooterLight]}>
                    Saved {savedPinsByScan[currentScanKey].count}
                  </Text>
                ) : null}
              </View>
              <View style={styles.viewerZoomRow}>
                <Text style={[styles.viewerFooter, !isDarkMode && styles.viewerFooterLight]}>
                  Zoom {Math.round(zoom * 100)}%
                </Text>
                <View style={styles.viewerZoomButtons}>
                  <Pressable
                    onPress={() => handleZoomStep(-1)}
                    style={[styles.viewerZoomButton, !isDarkMode && styles.viewerZoomButtonLight]}
                  >
                    <Ionicons name="remove" size={14} color={isDarkMode ? '#E2E8F0' : '#1F2937'} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleZoomStep(1)}
                    style={[styles.viewerZoomButton, !isDarkMode && styles.viewerZoomButtonLight]}
                  >
                    <Ionicons name="add" size={14} color={isDarkMode ? '#E2E8F0' : '#1F2937'} />
                  </Pressable>
                  <Pressable
                    onPress={handleZoomReset}
                    style={[styles.viewerZoomButton, !isDarkMode && styles.viewerZoomButtonLight]}
                  >
                    <Ionicons name="contract" size={14} color={isDarkMode ? '#E2E8F0' : '#1F2937'} />
                  </Pressable>
                </View>
              </View>
              <ViewerSlider label={`Brightness ${brightness.toFixed(2)}`} value={brightness} min={0.6} max={1.6} onChange={setBrightness} />
              <ViewerSlider label={`Contrast ${contrast.toFixed(2)}`} value={contrast} min={0.6} max={1.8} onChange={setContrast} />
              <Pressable
                onPress={() => {
                  setBrightness(1);
                  setContrast(1);
                }}
                style={styles.viewerResetButton}
              >
                <Text style={styles.viewerResetText}>Reset</Text>
              </Pressable>
              {isDicomView && dicomFrames > 1 ? (
                <ViewerSlider
                  label={`Slice ${dicomFrameIndex + 1}/${dicomFrames}`}
                  value={dicomFrameIndex}
                  min={0}
                  max={dicomFrames - 1}
                  onChange={(next) => setDicomFrameIndex(Math.round(next))}
                />
              ) : null}
            </View>
            {isDicomView && hoverInfo ? (
              <Text style={[styles.viewerReadout, !isDarkMode && styles.viewerFooterLight]}>
                X {hoverInfo.x}  Y {hoverInfo.y}  Value {hoverInfo.value}
              </Text>
            ) : null}
            {recentScans.length ? (
              <View style={styles.viewerRecentWrap}>
                <Text style={[styles.viewerRecentTitle, !isDarkMode && styles.viewerFooterLight]}>
                  Recently Viewed
                </Text>
                {recentScans.map((item) => (
                  <Pressable key={item.id} style={styles.viewerRecentRow} onPress={() => openRecentScan(item)}>
                    <Text style={[styles.viewerRecentLabel, !isDarkMode && styles.viewerFooterLight]}>
                      {item.code}
                    </Text>
                    <Text style={[styles.viewerRecentMeta, !isDarkMode && styles.viewerFooterLight]}>
                      {formatRecentAge(item.viewedAt)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Text style={[styles.viewerFooter, !isDarkMode && styles.viewerFooterLight]}>
              {viewerSource === 'upload' && uploadKind === 'image'
                ? 'Image preview'
                : viewerSource === 'dicom' || viewerSource === 'upload'
                  ? `DICOM ${dicomMeta ? `${dicomMeta.cols}x${dicomMeta.rows}` : ''}`
                  : 'Brightness / Contrast'}
            </Text>
          </FormCard>
        </View>
      </View>

    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderColor: '#DCE5F0',
  },
  darkCard: {
    backgroundColor: '#0B1220',
    borderColor: '#111827',
  },
  lightCard: {
    backgroundColor: '#F8FAFF',
    borderColor: '#DCE5F0',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  topLeftStack: {
    gap: theme.spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
    alignItems: 'flex-start',
  },
  statsColumn: {
    flex: 2,
    minWidth: 320,
  },
  viewerColumn: {
    flex: 1,
    minWidth: 280,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  sectionTitleLight: {
    color: '#F8FAFC',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  mainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
    alignItems: 'flex-start',
  },
  mainColumn: {
    flex: 2,
    minWidth: 320,
    gap: theme.spacing.lg,
  },
  splitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  map: {
    marginTop: theme.spacing.md,
    backgroundColor: '#EAF1FA',
    borderRadius: theme.radius.md,
    height: 200,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    position: 'relative',
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  statusLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusValue: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#0F766E',
  },
  statusValueWarn: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.warning,
  },
  chart: {
    marginTop: theme.spacing.md,
    height: 220,
    borderRadius: theme.radius.md,
    backgroundColor: '#F6FAFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  chartBadge: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FAD4D4',
  },
  chartBadgeText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#B91C1C',
  },
  gaugeWrap: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  gaugeLegend: {
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  gaugeLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  gaugeLabelWarn: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.warning,
  },
  viewerToggle: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  viewerSearchWrap: {
    flex: 1,
  },
  tableSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  tableSearchInputWrap: {
    flex: 1,
  },
  tableSortGroup: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  tableSortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  tableSortChipInactive: {
    borderColor: '#D0D8E6',
    backgroundColor: '#FFFFFF',
  },
  tableSortChipPriorityActive: {
    borderColor: '#B45309',
    backgroundColor: '#FEF3C7',
  },
  tableSortChipStatusActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  tableSortChipStatusCompleted: {
    borderColor: '#059669',
    backgroundColor: '#D1FAE5',
  },
  tableSortChipStatusInProgress: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  tableSortChipStatusWaiting: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  tableSortText: {
    fontFamily: theme.font.body,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tableSortTextInactive: {
    color: theme.colors.slate,
  },
  tableSortTextPriority: {
    color: '#B45309',
  },
  tableSortTextStatus: {
    color: '#2563EB',
  },
  tableSortTextCompleted: {
    color: '#059669',
  },
  tableSortTextInProgress: {
    color: '#2563EB',
  },
  tableSortTextWaiting: {
    color: '#F59E0B',
  },
  viewerStatusIcons: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  viewerStatusIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1220',
  },
  viewerStatusIconActive: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  viewerStatusIconWarn: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  viewerTabs: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    alignItems: 'center',
  },
  viewerTab: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  viewerTabLight: {
    borderColor: '#D0D8E6',
    backgroundColor: '#F1F5F9',
  },
  viewerTabActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#2563EB',
  },
  viewerTabText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#CBD5F5',
  },
  viewerTabTextLight: {
    color: '#1F2937',
  },
  viewerTabTextActive: {
    color: '#F8FAFC',
  },
  viewerTabUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
  },
  viewerTabUploadLight: {
    borderColor: '#D0D8E6',
    backgroundColor: '#FFFFFF',
  },
  viewerTabUploadText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#E2E8F0',
  },
  viewerTabUploadTextLight: {
    color: '#1F2937',
  },
  viewerIconButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  viewerIconButtonLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D0D8E6',
  },
  viewerLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#C7D2FE',
  },
  viewerLabelLight: {
    color: theme.colors.slate,
  },
  viewerSwitch: {
    width: 46,
    height: 24,
    backgroundColor: '#0F172A',
    borderRadius: 999,
    padding: 3,
    justifyContent: 'center',
  },
  viewerSwitchLight: {
    backgroundColor: '#E2E8F0',
  },
  viewerSwitchThumb: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#34D399',
    alignSelf: 'flex-end',
  },
  viewerSwitchThumbLight: {
    backgroundColor: '#2563EB',
    alignSelf: 'flex-start',
  },
  viewerFrame: {
    marginTop: theme.spacing.md,
    height: 220,
    borderRadius: theme.radius.md,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  viewerFrameLight: {
    backgroundColor: '#EAF1FA',
  },
  viewerPins: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  viewerPin: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E11D48',
    borderWidth: 2,
    borderColor: '#FDE68A',
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
  viewerGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: '#1F2937',
    opacity: 0.7,
  },
  viewerPlaceholder: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: '#E2E8F0',
  },
  viewerControls: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  viewerActionRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    alignItems: 'center',
  },
  viewerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
  },
  viewerActionButtonLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D0D8E6',
  },
  viewerActionButtonWarn: {
    borderColor: '#92400E',
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  viewerActionText: {
    fontFamily: theme.font.body,
    fontSize: 9,
    color: '#E2E8F0',
  },
  viewerActionTextLight: {
    color: '#1F2937',
  },
  viewerActionTextWarn: {
    color: '#FDE68A',
  },
  viewerSavedText: {
    fontFamily: theme.font.body,
    fontSize: 10,
    color: '#94A3B8',
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
  viewerZoomButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  viewerZoomButtonLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D0D8E6',
  },
  viewerResetButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
  },
  viewerResetText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#E2E8F0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewerControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  viewerSlider: {
    marginTop: theme.spacing.md,
    height: 10,
    justifyContent: 'center',
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
  viewerLinkRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  viewerLinkLabel: {
    fontFamily: theme.font.body,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94A3B8',
  },
  viewerLinkValue: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#E2E8F0',
  },
  viewerRecentWrap: {
    marginTop: theme.spacing.sm,
    gap: 6,
  },
  viewerRecentTitle: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94A3B8',
  },
  viewerRecentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewerRecentLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#E2E8F0',
  },
  viewerRecentMeta: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: '#94A3B8',
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
    color: '#C7D2FE',
  },
  viewerFooterLight: {
    color: theme.colors.slate,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  priorityText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  iconGroup: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-end',
  },
  iconTube: {
    width: 8,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  iconTubeTall: {
    height: 24,
    backgroundColor: '#16A34A',
  },
  iconProgress: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#22C55E',
    borderTopColor: '#E2E8F0',
  },
  iconDoc: {
    width: 22,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCheck: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#2563EB',
    transform: [{ rotate: '-45deg' }],
  },
  iconStack: {
    gap: 4,
  },
  iconStackRow: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  iconStackRowMid: {
    width: 18,
    backgroundColor: '#FBBF24',
  },
  iconStackRowLight: {
    width: 12,
    backgroundColor: '#FCD34D',
  },
  iconStopwatch: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconStopwatchHand: {
    width: 10,
    height: 2,
    backgroundColor: '#0EA5E9',
    borderRadius: 999,
    transform: [{ rotate: '30deg' }],
  },
  iconAlert: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EF4444',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  iconAlertDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 6,
    borderRadius: 2,
    backgroundColor: '#FEE2E2',
  },
});
