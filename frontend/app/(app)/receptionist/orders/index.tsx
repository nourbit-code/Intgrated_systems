import { useMemo, useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, Modal, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import bwipjs from 'bwip-js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DataTable } from '@/components/ui/DataTable';
import { FiltersBar } from '@/components/ui/FiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { TextInputField } from '@/components/ui/TextInputField';
import { FormCard } from '@/components/ui/FormCard';
import { Drawer } from '@/components/ui/Drawer';
import { InfoCard } from '@/components/ui/InfoCard';
import { theme } from '@/constants/theme';
import { useOrders, Order } from '@/hooks/useOrders';

const statusOptions = ['All', 'Samples Waiting', 'In Progress', 'Completed', 'Cancelled'] as const;
const priorityOptions = ['All', 'Routine', 'Urgent', 'STAT'] as const;
const sampleOptions = ['All', 'Blood', 'Urine', 'Stool', 'Swab', 'Tissue', 'Imaging'] as const;
const dateOptions = ['Today', 'This Week', 'Custom Range'] as const;

type StatusFilter = typeof statusOptions[number];
type PriorityFilter = typeof priorityOptions[number];
type SampleFilter = typeof sampleOptions[number];
type DateFilter = typeof dateOptions[number];

const sampleCodeMap: Record<string, string> = {
  Blood: 'BLO',
  Urine: 'URI',
  Stool: 'STO',
  Saliva: 'SAL',
  Swab: 'SWB',
  Tissue: 'TIS',
  Imaging: 'IMG',
};

type LineSeries = { values: number[]; color: string };

function LineChartSvg({
  width,
  height,
  labels,
  series,
}: {
  width: number;
  height: number;
  labels: string[];
  series: LineSeries[];
}) {
  const containerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (width <= 0 || height <= 0) return;

    const maxValue = Math.max(
      ...series.flatMap((s) => s.values),
      1,
    );
    const stepX = labels.length > 1 ? width / (labels.length - 1) : width;

    const paths = series.map((s) => {
      const points = s.values.map((value, index) => {
        const x = stepX * index;
        const y = height - (value / maxValue) * height;
        return { x, y };
      });
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const circles = points
        .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${s.color}" />`)
        .join('');
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" />${circles}`;
    });

    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        ${paths.join('')}
      </svg>
    `;

    containerRef.current.innerHTML = svg;
  }, [width, height, labels, series]);

  return <View ref={containerRef} style={{ width, height }} />;
}

function isImagingOrder(order: Order) {
  return order.tests.some((test) => test.sample === 'Imaging');
}

function normalizeStatus(order: Order) {
  if (isImagingOrder(order)) {
    return order.status;
  }
  if (order.status === 'Waiting for Sample') return 'Samples Waiting';
  return order.status;
}

function getSampleTypes(order: Order) {
  const samples = order.tests.map((test) => test.sample).filter(Boolean);
  return Array.from(new Set(samples));
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isWithinRange(date: Date, start?: Date | null, end?: Date | null) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}


function formatMonth(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' });
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

function printOrderBarcodes(order: Order) {
  const samples = getSampleTypes(order);
  if (samples.length === 0) return;

  const labels = samples.map((sample) => {
    const codePrefix = sampleCodeMap[sample] ?? sample.slice(0, 3).toUpperCase();
    const code = `${order.id}-${codePrefix}-01`;
    const barcode = generateBarcodeData(code);
    const tests = order.tests.filter((test) => test.sample === sample).map((test) => test.name).join(', ');
    return { sample, code, barcode, tests };
  });

  const html = `
    <html>
      <head>
        <title>Barcodes ${order.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0F172A; }
          .label { border: 1px solid #E2E8F0; padding: 12px; margin-bottom: 12px; width: 320px; }
          .title { font-weight: 700; font-size: 14px; }
          .meta { font-size: 12px; color: #64748B; margin-top: 4px; }
          img { width: 220px; margin-top: 8px; }
        </style>
      </head>
      <body>
        ${labels.map((label) => `
          <div class="label">
            <div class="title">Patient: ${order.patientName}</div>
            <div class="meta">Order: ${order.id}</div>
            <div class="meta">Sample: ${label.sample}</div>
            <div class="meta">Tests: ${label.tests}</div>
            ${label.barcode ? `<img src="${label.barcode}" />` : ''}
            <div class="meta">${label.code}</div>
          </div>
        `).join('')}
      </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export default function ReceptionistOrders() {
  const router = useRouter();
  const { orders, updateOrderStatus } = useOrders();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [sampleFilter, setSampleFilter] = useState<SampleFilter>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('Today');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeStartDate, setRangeStartDate] = useState<Date | null>(null);
  const [rangeEndDate, setRangeEndDate] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [sortKey, setSortKey] = useState<'id' | 'date' | 'patient' | 'priority'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  const resetFilters = () => {
    setStatusFilter('All');
    setPriorityFilter('All');
    setSampleFilter('All');
    setDateFilter('Today');
    setRangeStart('');
    setRangeEnd('');
    setRangeStartDate(null);
    setRangeEndDate(null);
  };

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const orderStats = useMemo(() => {
    const ordersToday = orders.filter((order) => order.date === todayIso);
    const counts = {
      samplesWaiting: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };
    ordersToday.forEach((order) => {
      const status = normalizeStatus(order);
      if (status === 'Samples Waiting') counts.samplesWaiting += 1;
      if (status === 'In Progress') counts.inProgress += 1;
      if (status === 'Completed') counts.completed += 1;
      if (status === 'Cancelled') counts.cancelled += 1;
    });
    return { ordersToday: ordersToday.length, ...counts };
  }, [orders, todayIso]);

  const timeSeries = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      return d;
    });
    const monthKeys = months.map((month) => ({
      key: `${month.getFullYear()}-${month.getMonth()}`,
      label: formatMonth(month),
    }));

    const series = {
      samplesWaiting: monthKeys.map((m) => ({ ...m, value: 0 })),
      inProgress: monthKeys.map((m) => ({ ...m, value: 0 })),
      completed: monthKeys.map((m) => ({ ...m, value: 0 })),
      cancelled: monthKeys.map((m) => ({ ...m, value: 0 })),
    };

    orders.forEach((order) => {
      const orderDate = parseDate(order.date);
      if (!orderDate) return;
      const key = `${orderDate.getFullYear()}-${orderDate.getMonth()}`;
      const status = normalizeStatus(order);
      const target = status === 'Samples Waiting'
        ? series.samplesWaiting
        : status === 'In Progress'
          ? series.inProgress
          : status === 'Completed'
            ? series.completed
            : status === 'Cancelled'
              ? series.cancelled
              : null;
      if (!target) return;
      const match = target.find((item) => item.key === key);
      if (match) match.value += 1;
    });

    return { monthLabels: monthKeys.map((m) => m.label), series };
  }, [orders, today]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rangeStartParsed = dateFilter === 'Custom Range' ? parseDate(rangeStart) : null;
    const rangeEndParsed = dateFilter === 'Custom Range' ? parseDate(rangeEnd) : null;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);

    return orders.filter((order) => {
      const displayStatus = normalizeStatus(order);
      if (statusFilter !== 'All' && displayStatus !== statusFilter) return false;
      const orderPriority = order.priority ?? 'Routine';
      if (priorityFilter !== 'All' && orderPriority !== priorityFilter) return false;

      const samples = getSampleTypes(order);
      if (sampleFilter !== 'All' && !samples.includes(sampleFilter)) return false;

      const orderDate = parseDate(order.date);
      if (orderDate) {
        if (dateFilter === 'Today' && !isSameDay(orderDate, today)) return false;
        if (dateFilter === 'This Week' && !isWithinRange(orderDate, weekStart, today)) return false;
        if (dateFilter === 'Custom Range' && !isWithinRange(orderDate, rangeStartParsed, rangeEndParsed)) return false;
      }

      if (query) {
        const sampleCodes = samples.map((sample) => {
          const code = sampleCodeMap[sample] ?? sample.slice(0, 3).toUpperCase();
          return `${order.id}-${code}-01`;
        });
        const haystack = [
          order.id,
          order.invoiceId,
          order.patientName,
          order.patientId,
          order.tests.map((t) => t.name).join(' '),
          samples.join(' '),
          sampleCodes.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [orders, statusFilter, priorityFilter, sampleFilter, dateFilter, rangeStart, rangeEnd, search, today]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'date') {
        return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) * dir;
      }
      if (sortKey === 'patient') {
        return a.patientName.localeCompare(b.patientName) * dir;
      }
      if (sortKey === 'priority') {
        const rank: Record<'Routine' | 'Urgent' | 'STAT', number> = {
          Routine: 1,
          Urgent: 2,
          STAT: 3,
        };
        const aPriority = a.priority ?? 'Routine';
        const bPriority = b.priority ?? 'Routine';
        return (rank[aPriority] - rank[bPriority]) * dir;
      }
      return a.id.localeCompare(b.id) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <DashboardLayout title="Lab Orders">
      <View style={styles.summaryGrid}>
        {[
          { label: 'Orders Today', value: orderStats.ordersToday, tone: styles.summaryTonePrimary },
          { label: 'Samples Waiting', value: orderStats.samplesWaiting, tone: styles.summaryToneWarn },
          { label: 'In Progress', value: orderStats.inProgress, tone: styles.summaryToneInfo },
          { label: 'Completed', value: orderStats.completed, tone: styles.summaryToneSuccess },
          { label: 'Cancelled', value: orderStats.cancelled, tone: styles.summaryToneDanger },
        ].map((item) => (
          <View key={item.label} style={[styles.summaryCard, item.tone]}>
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text style={styles.summaryValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <FormCard>
        <Text style={styles.sectionTitle}>Orders Over Time</Text>
        <Text style={styles.sectionSubtitle}>Last 6 months</Text>
        <View style={styles.chartWrap}>
          <View style={styles.metricColumn}>
            {[
              { key: 'samplesWaiting', label: 'Samples Waiting', color: '#F59E0B' },
              { key: 'inProgress', label: 'In Progress', color: '#2563EB' },
              { key: 'completed', label: 'Completed', color: '#059669' },
              { key: 'cancelled', label: 'Cancelled', color: '#DC2626' },
            ].map((item) => (
              <View key={item.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.metricLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.chartArea}>
            <View style={styles.chartYAxis}>
              {(() => {
                const allValues = [
                  ...timeSeries.series.samplesWaiting.map((p) => p.value),
                  ...timeSeries.series.inProgress.map((p) => p.value),
                  ...timeSeries.series.completed.map((p) => p.value),
                  ...timeSeries.series.cancelled.map((p) => p.value),
                ];
                const maxValue = Math.max(...allValues, 1);
                const step = Math.ceil(maxValue / 4);
                const ticks = [maxValue, maxValue - step, maxValue - step * 2, maxValue - step * 3, 0]
                  .map((v) => Math.max(0, v));
                return ticks.map((tick, index) => (
                  <Text key={`tick-${tick}-${index}`} style={styles.chartYAxisLabel}>{tick}</Text>
                ));
              })()}
            </View>
            <View
              style={styles.lineChart}
              onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
            >
              {Platform.OS === 'web' ? (
                <LineChartSvg
                  width={chartWidth}
                  height={120}
                  labels={timeSeries.monthLabels}
                  series={[
                    { values: timeSeries.series.samplesWaiting.map((p) => p.value), color: '#F59E0B' },
                    { values: timeSeries.series.inProgress.map((p) => p.value), color: '#2563EB' },
                    { values: timeSeries.series.completed.map((p) => p.value), color: '#059669' },
                    { values: timeSeries.series.cancelled.map((p) => p.value), color: '#DC2626' },
                  ]}
                />
              ) : null}
              <View style={styles.chartLabelsRow}>
                {timeSeries.monthLabels.map((label) => (
                  <Text key={label} style={styles.chartLabel}>{label}</Text>
                ))}
              </View>
            </View>
          </View>
        </View>
      </FormCard>

      <FormCard>
        <Text style={styles.sectionTitle}>Order Search</Text>
        <FiltersBar>
          <SearchInput placeholder="Search Orders: Ahmed / 3481 / 1021" value={search} onChangeText={setSearch} />
          <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Text style={styles.filterButtonText}>Filters</Text>
          </Pressable>
        </FiltersBar>
      </FormCard>

      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Recent Orders ({sorted.length})</Text>
        <View style={styles.sortRow}>
          {([
            { key: 'date', label: 'Date' },
            { key: 'patient', label: 'Patient' },
            { key: 'priority', label: 'Priority' },
            { key: 'id', label: 'Order ID' },
          ] as { key: 'id' | 'date' | 'patient' | 'priority'; label: string }[]).map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                if (sortKey === item.key) {
                  setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortKey(item.key);
                  setSortDir('asc');
                }
              }}
              style={[styles.sortChip, sortKey === item.key && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sortKey === item.key && styles.sortChipTextActive]}>
                {item.label} {sortKey === item.key ? (sortDir === 'asc' ? '^' : 'v') : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <DataTable
        columns={['Order ID', 'Patient Name', 'Patient ID', 'Tests', 'Sample Type', 'Priority', 'Status', 'Date', 'By', 'Tech', 'Actions']}
        columnWidths={[110, 150, 110, 240, 130, 100, 140, 110, 130, 130, 220]}
        rows={sorted.map((order) => {
          const samples = getSampleTypes(order).join(', ');
          const status = normalizeStatus(order);
          const isCancelled = status === 'Cancelled';
          return [
            `#${order.id}`,
            order.patientName,
            order.patientId,
            order.tests.map((t) => t.name).join(', '),
            samples || 'N/A',
            order.priority ?? 'Routine',
            status,
            order.date,
            order.bookedByName || 'Reception',
            status === 'Completed' ? (order.completedByTechName || 'Lab Technician') : '-',
            (
              <View style={styles.actionRow}>
                <Pressable style={[styles.actionButton, styles.actionView]} onPress={() => setSelected(order)}>
                  <Text style={styles.actionTextLight}>View</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.actionPrint]} onPress={() => printOrderBarcodes(order)}>
                  <Text style={styles.actionTextLight}>Print Barcode</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.actionButton,
                    styles.actionCancel,
                    isCancelled && styles.actionButtonDisabled,
                  ]}
                  onPress={() => updateOrderStatus(order.id, 'Cancelled')}
                  disabled={isCancelled}
                >
                  <Text style={[styles.actionTextLight, isCancelled && styles.actionTextDisabled]}>Cancel</Text>
                </Pressable>
              </View>
            ),
          ];
        })}
        rowKeys={sorted.map((order) => order.id)}
        onRowPress={(index) => setSelected(sorted[index])}
      />

      <Drawer visible={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <ScrollView contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.drawerTitle}>Order #{selected.id}</Text>
            <InfoCard title="Patient" value={selected.patientName} />
            <InfoCard title="Patient ID" value={selected.patientId} />
            <InfoCard title="Status" value={normalizeStatus(selected)} />
            <InfoCard title="Date" value={selected.date} />
            <InfoCard title="By" value={selected.bookedByName || 'Reception'} />
            <InfoCard title="Tech" value={normalizeStatus(selected) === 'Completed' ? (selected.completedByTechName || 'Lab Technician') : '-'} />
            <InfoCard title="Tests" value={selected.tests.map((t) => t.name).join(', ')} />
            <InfoCard title="Sample Types" value={getSampleTypes(selected).join(', ') || 'N/A'} />
            <View style={styles.drawerActions}>
              <PrimaryButton label="Print Barcode" onPress={() => printOrderBarcodes(selected)} />
              <PrimaryButton label="Cancel Order" onPress={() => updateOrderStatus(selected.id, 'Cancelled')} />
              <PrimaryButton label="Close" onPress={() => setSelected(null)} />
            </View>
          </ScrollView>
        ) : null}
      </Drawer>

      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilters(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Filters</Text>

            <Text style={styles.sectionLabel}>Status</Text>
            <View style={styles.chipRow}>
              {statusOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setStatusFilter(option)}
                  style={[styles.filterChip, statusFilter === option && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, statusFilter === option && styles.filterTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Sample Type</Text>
            <View style={styles.chipRow}>
              {sampleOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setSampleFilter(option)}
                  style={[styles.filterChip, sampleFilter === option && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, sampleFilter === option && styles.filterTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {priorityOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setPriorityFilter(option)}
                  style={[styles.filterChip, priorityFilter === option && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, priorityFilter === option && styles.filterTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Date</Text>
            <View style={styles.chipRow}>
              {dateOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setDateFilter(option)}
                  style={[styles.filterChip, dateFilter === option && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, dateFilter === option && styles.filterTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>

            {dateFilter === 'Custom Range' ? (
              <View style={styles.dateRow}>
                {Platform.OS === 'web' ? (
                  <View style={styles.datePickerField}>
                    <Text style={styles.dateLabel}>Start (YYYY-MM-DD)</Text>
                    <DatePicker
                      selected={rangeStartDate}
                      onChange={(date: Date | null) => {
                        setRangeStartDate(date ?? null);
                        setRangeStart(date ? date.toISOString().slice(0, 10) : '');
                      }}
                      placeholderText="2026-03-10"
                      dateFormat="yyyy-MM-dd"
                      className="clinic-date-input"
                    />
                  </View>
                ) : (
                  <TextInputField label="Start (YYYY-MM-DD)" placeholder="2026-03-10" value={rangeStart} onChangeText={setRangeStart} />
                )}
                {Platform.OS === 'web' ? (
                  <View style={styles.datePickerField}>
                    <Text style={styles.dateLabel}>End (YYYY-MM-DD)</Text>
                    <DatePicker
                      selected={rangeEndDate}
                      onChange={(date: Date | null) => {
                        setRangeEndDate(date ?? null);
                        setRangeEnd(date ? date.toISOString().slice(0, 10) : '');
                      }}
                      placeholderText="2026-03-16"
                      dateFormat="yyyy-MM-dd"
                      className="clinic-date-input"
                    />
                  </View>
                ) : (
                  <TextInputField label="End (YYYY-MM-DD)" placeholder="2026-03-16" value={rangeEnd} onChangeText={setRangeEnd} />
                )}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.clearButton} onPress={resetFilters}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
              <PrimaryButton label="Apply" onPress={() => setShowFilters(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  summaryCard: {
    flex: 1,
    minWidth: 180,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  summaryLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryValue: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.heading,
    fontSize: 22,
    color: theme.colors.ink,
  },
  summaryTonePrimary: {
    backgroundColor: '#F8FAFC',
  },
  summaryToneWarn: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  summaryToneInfo: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  summaryToneSuccess: {
    backgroundColor: '#ECFDF3',
    borderColor: '#86EFAC',
  },
  summaryToneDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  chartWrap: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  chartYAxis: {
    width: 24,
    height: 120,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 6,
  },
  chartYAxisLabel: {
    fontFamily: theme.font.body,
    fontSize: 10,
    color: theme.colors.slate,
  },
  metricColumn: {
    width: 140,
    gap: 6,
    marginRight: theme.spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  metricLabel: {
    fontFamily: theme.font.body,
    fontSize: 10,
    color: theme.colors.slate,
  },
  lineChart: {
    flex: 1,
    overflow: 'hidden',
  },
  chartLabelsRow: {
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  chartLabel: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.slate,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  sectionSubtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.ink,
  },
  recentHeader: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  sortChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  sortChipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  sortChipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  sortChipTextActive: {
    color: theme.colors.ink,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  filterChipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  filterText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  filterTextActive: {
    color: theme.colors.ink,
  },
  dateRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  datePickerField: {
    flex: 1,
    minWidth: 220,
    gap: theme.spacing.xs,
  },
  dateLabel: {
    fontFamily: theme.font.body,
    color: theme.colors.slate,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  actionButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionView: {
    backgroundColor: theme.colors.accent,
  },
  actionPrint: {
    backgroundColor: theme.colors.accent,
  },
  actionCancel: {
    backgroundColor: '#EF4444',
  },
  actionButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  actionTextLight: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#F8FAFC',
  },
  actionTextDisabled: {
    color: '#94A3B8',
  },
  drawerContent: {
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  drawerTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  drawerActions: {
    gap: theme.spacing.sm,
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
    maxWidth: 920,
    maxHeight: '88%',
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  sectionLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  clearButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clearText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
});
