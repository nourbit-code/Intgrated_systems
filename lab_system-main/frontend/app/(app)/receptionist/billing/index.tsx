import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Modal, Platform, ScrollView } from 'react-native';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import bwipjs from 'bwip-js';
import { Asset } from 'expo-asset';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { TextInputField } from '@/components/ui/TextInputField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DataTable } from '@/components/ui/DataTable';
import { FiltersBar } from '@/components/ui/FiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Drawer } from '@/components/ui/Drawer';
import { InfoCard } from '@/components/ui/InfoCard';
import { theme } from '@/constants/theme';
import { useOrders, Order } from '@/hooks/useOrders';
import { useInsuranceSettings } from '@/hooks/useInsuranceSettings';

const appLogo = require('@/assets/images/icon.png');

const methodOptions = ['All', 'Cash', 'Visa'] as const;
const dateOptions = ['All', 'Today', 'This Week', 'Custom Range'] as const;

type MethodFilter = typeof methodOptions[number];
type DateFilter = typeof dateOptions[number];
type InsuranceFilter = string;

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

export default function Billing() {
  const params = useLocalSearchParams<{ invoiceId?: string }>();
  const router = useRouter();
  const { orders, updateOrderPaymentStatus, updateOrderFinancials } = useOrders();
  const { getDiscountForProvider } = useInsuranceSettings();
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All');
  const [insuranceFilter, setInsuranceFilter] = useState<InsuranceFilter>('All');
  const [insuranceQuery, setInsuranceQuery] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeStartDate, setRangeStartDate] = useState<Date | null>(null);
  const [rangeEndDate, setRangeEndDate] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<'date' | 'patient' | 'invoice' | 'total'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);

  const resetFilters = () => {
    setMethodFilter('All');
    setDateFilter('All');
    setInsuranceFilter('All');
    setRangeStart('');
    setRangeEnd('');
    setRangeStartDate(null);
    setRangeEndDate(null);
  };

  const today = useMemo(() => new Date(), []);
  const insuranceOptions = useMemo(() => {
    const names = new Set<string>();
    orders.forEach((order) => {
      if (order.insurance) names.add(order.insurance);
    });
    return ['All', ...Array.from(names)];
  }, [orders]);

  const filteredInsuranceOptions = useMemo(() => {
    const query = insuranceQuery.trim().toLowerCase();
    if (!query) return insuranceOptions;
    return insuranceOptions.filter((option) => option.toLowerCase().includes(query));
  }, [insuranceOptions, insuranceQuery]);

  const invoicesToday = useMemo(
    () => orders.filter((order) => {
      const orderDate = parseDate(order.date);
      return orderDate ? isSameDay(orderDate, today) : false;
    }).length,
    [orders, today],
  );

  const totalIncomeThisWeek = useMemo(() => {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    return orders.reduce((sum, order) => {
      const orderDate = parseDate(order.date);
      if (!orderDate) return sum;
      if (!isWithinRange(orderDate, weekStart, today)) return sum;
      return sum + (order.amountPaid ?? 0);
    }, 0);
  }, [orders, today]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rangeStartParsed = dateFilter === 'Custom Range' ? parseDate(rangeStart) : null;
    const rangeEndParsed = dateFilter === 'Custom Range' ? parseDate(rangeEnd) : null;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);

    return orders.filter((order) => {
      if (methodFilter !== 'All' && order.paymentMethod !== methodFilter) return false;
      if (insuranceFilter !== 'All' && order.insurance !== insuranceFilter) return false;

      const orderDate = parseDate(order.date);
      if (orderDate) {
        if (dateFilter === 'Today' && !isSameDay(orderDate, today)) return false;
        if (dateFilter === 'This Week' && !isWithinRange(orderDate, weekStart, today)) return false;
        if (dateFilter === 'Custom Range' && !isWithinRange(orderDate, rangeStartParsed, rangeEndParsed)) return false;
      }

      const haystack = [
        order.invoiceId,
        order.id,
        order.patientName,
        order.patientId,
        order.paymentStatus,
        order.paymentMethod,
        order.insurance ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (query && !haystack.includes(query)) return false;
      return true;
    });
  }, [orders, search, methodFilter, insuranceFilter, dateFilter, rangeStart, rangeEnd, today]);

  const recent = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'patient') {
        return a.patientName.localeCompare(b.patientName) * dir;
      }
      if (sortKey === 'invoice') {
        return a.invoiceId.localeCompare(b.invoiceId) * dir;
      }
      if (sortKey === 'total') {
        return (a.total - b.total) * dir;
      }
      return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) * dir;
    }).slice(0, 10);
  }, [filtered, sortKey, sortDir]);

  useEffect(() => {
    if (!params.invoiceId) return;
    const match = orders.find((order) => order.invoiceId === params.invoiceId);
    if (match) {
      setSelected(match);
    }
  }, [orders, params.invoiceId]);

  const handlePrintInvoice = async (order: Order) => {
    const paymentMethod = order.paymentMethod;
    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice ${order.invoiceId}</title>
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
          <h1>Invoice ${order.invoiceId}</h1>
          <div class="muted">Order #${order.id}</div>
          <div class="muted">Date: ${order.date}</div>
          <div class="muted">Patient: ${order.patientName}</div>

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
                ${order.tests.map((test) => `
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
            <div class="summary-row"><span>Subtotal</span><span>${order.subtotal} EGP</span></div>
            <div class="summary-row"><span>Discount (${order.discountPercent ?? 0}%)</span><span>${order.discount} EGP</span></div>
            <div class="summary-row total"><span>Total</span><span>${order.total} EGP</span></div>
            <div class="summary-row"><span>Payment Method</span><span>${paymentMethod}</span></div>
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
    <DashboardLayout title="Payments">
      <View style={styles.summaryGrid}>
        {[
          { label: 'Invoices Today', value: invoicesToday.toString(), tone: styles.summaryTonePrimary },
          { label: 'Total Income This Week', value: `${totalIncomeThisWeek} EGP`, tone: styles.summaryToneSuccess },
        ].map((item) => (
          <View key={item.label} style={[styles.summaryCard, item.tone]}>
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text style={styles.summaryValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <FormCard>
        <Text style={styles.sectionTitle}>Invoice Search</Text>
        <FiltersBar>
          <SearchInput
            placeholder="Search invoices: INV-3481 / Amina / 2844"
            value={search}
            onChangeText={setSearch}
          />
          <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Text style={styles.filterButtonText}>Filters</Text>
          </Pressable>
        </FiltersBar>
      </FormCard>

      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Recent Invoices ({recent.length})</Text>
        <Pressable
          style={styles.bulkRecalcBtn}
          onPress={() => {
            orders.forEach((order) => {
              if (!order.insurance) return;
              const percent = getDiscountForProvider(order.insurance);
              if (percent <= 0) return;
              const discount = Number(((order.subtotal * percent) / 100).toFixed(2));
              const total = Math.max(Number((order.subtotal - discount).toFixed(2)), 0);
              updateOrderFinancials(order.id, {
                insurance: order.insurance,
                discountPercent: percent,
                discount,
                total,
              });
            });
          }}
        >
          <Text style={styles.bulkRecalcBtnText}>Apply Insurance To All</Text>
        </Pressable>
        <View style={styles.sortRow}>
          {([
            { key: 'date', label: 'Date' },
            { key: 'patient', label: 'Patient' },
            { key: 'invoice', label: 'Invoice' },
            { key: 'total', label: 'Total' },
          ] as { key: 'date' | 'patient' | 'invoice' | 'total'; label: string }[]).map((item) => (
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
        columns={['Invoice', 'Patient', 'Patient ID', 'Total', 'Method', 'Date', 'Insurance', 'Actions']}
        columnWidths={[120, 160, 120, 100, 120, 120, 140, 160]}
        rows={recent.map((order) => ([
          order.invoiceId,
          order.patientName,
          order.patientId,
          `${order.total} EGP`,
          order.paymentMethod,
          order.date,
          order.insurance ?? 'N/A',
          (
            <View style={styles.actionRow}>
              <Pressable style={[styles.actionButton, styles.actionView]} onPress={() => setSelected(order)}>
                <Text style={styles.actionTextLight}>Invoice Details</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.actionPrint]} onPress={() => handlePrintInvoice(order)}>
                <Text style={styles.actionTextLight}>Print Invoice</Text>
              </Pressable>
            </View>
          ),
        ]))}
        rowKeys={recent.map((order) => order.invoiceId)}
        onRowPress={(index) => setSelected(recent[index])}
      />

      <Drawer visible={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <ScrollView contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.drawerTitle}>Invoice {selected.invoiceId}</Text>
            <View style={styles.drawerGrid}>
              <View style={styles.drawerCell}><InfoCard title="Patient" value={selected.patientName} /></View>
              <View style={styles.drawerCell}><InfoCard title="Patient ID" value={selected.patientId} /></View>
              <View style={styles.drawerCell}><InfoCard title="Order ID" value={selected.id} /></View>
              <View style={styles.drawerCell}><InfoCard title="Date" value={selected.date} /></View>
              <View style={styles.drawerCell}><InfoCard title="Method" value={selected.paymentMethod} /></View>
              <View style={styles.drawerCell}><InfoCard title="Insurance" value={selected.insurance ?? 'N/A'} /></View>
              <View style={styles.drawerCell}><InfoCard title="Subtotal" value={`${selected.subtotal} EGP`} /></View>
              <View style={styles.drawerCell}><InfoCard title="Discount" value={`${selected.discount} EGP`} /></View>
              <View style={styles.drawerCell}><InfoCard title="Total" value={`${selected.total} EGP`} /></View>
            </View>
            <View style={styles.paymentToggleWrap}>
              <Pressable
                style={styles.recalcBtn}
                onPress={() => {
                  const provider = selected.insurance;
                  const percent = getDiscountForProvider(provider);
                  const discount = Number(((selected.subtotal * percent) / 100).toFixed(2));
                  const total = Math.max(Number((selected.subtotal - discount).toFixed(2)), 0);
                  updateOrderFinancials(selected.id, {
                    insurance: provider,
                    discountPercent: percent,
                    discount,
                    total,
                  });
                  setSelected({
                    ...selected,
                    discountPercent: percent,
                    discount,
                    total,
                    amountPaid: selected.paymentStatus === 'Paid' ? total : selected.amountPaid,
                  });
                }}
              >
                <Text style={styles.recalcBtnText}>Apply Current Insurance Discount</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.paymentToggleBtn,
                  selected.paymentStatus === 'Paid' ? styles.paymentTogglePaid : styles.paymentToggleUnpaid,
                ]}
                onPress={() => {
                  const shouldBePaid = selected.paymentStatus !== 'Paid';
                  updateOrderPaymentStatus(selected.id, shouldBePaid);
                  setSelected({
                    ...selected,
                    paymentStatus: shouldBePaid ? 'Paid' : 'Unpaid',
                    amountPaid: shouldBePaid ? selected.total : 0,
                  });
                }}
              >
                <Text style={styles.paymentToggleText}>
                  {selected.paymentStatus === 'Paid' ? 'Mark As Not Paid' : 'Mark As Paid'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.drawerActions}>
              <PrimaryButton
                label="Close"
                onPress={() => {
                  setSelected(null);
                  if (params.invoiceId) {
                    router.back();
                  }
                }}
              />
            </View>
          </ScrollView>
        ) : null}
      </Drawer>

      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilters(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <Pressable style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Payment Method</Text>
            <View style={styles.chipRow}>
              {methodOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setMethodFilter(option)}
                  style={[styles.filterChip, methodFilter === option && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, methodFilter === option && styles.filterTextActive]}>{option}</Text>
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

            <Text style={styles.sectionLabel}>Insurance</Text>
            <TextInputField
              label="Search insurance"
              placeholder="Type company name..."
              value={insuranceQuery}
              onChangeText={setInsuranceQuery}
            />
            <View style={styles.insuranceList}>
              {filteredInsuranceOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setInsuranceFilter(option)}
                  style={[styles.insuranceItem, insuranceFilter === option && styles.insuranceItemActive]}
                >
                  <Text style={[styles.insuranceText, insuranceFilter === option && styles.insuranceTextActive]}>
                    {option}
                  </Text>
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
  summaryToneSuccess: {
    backgroundColor: '#ECFDF3',
    borderColor: '#86EFAC',
  },
  summaryToneDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
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
  bulkRecalcBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#60A5FA',
    backgroundColor: '#EFF6FF',
  },
  bulkRecalcBtnText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#1D4ED8',
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  resetButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  resetButtonText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  insuranceList: {
    maxHeight: 180,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  insuranceItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  insuranceItemActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  insuranceText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
  insuranceTextActive: {
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
  actionTextLight: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#F8FAFC',
  },
  drawerContent: {
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  drawerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  drawerCell: {
    width: '33.3333%',
    paddingHorizontal: 6,
    paddingBottom: 10,
    minWidth: 220,
  },
  drawerTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  paymentToggleWrap: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  recalcBtn: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#60A5FA',
    backgroundColor: '#EFF6FF',
  },
  recalcBtnText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#1D4ED8',
  },
  paymentToggleBtn: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  paymentTogglePaid: {
    backgroundColor: '#ECFDF3',
    borderColor: '#86EFAC',
  },
  paymentToggleUnpaid: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  paymentToggleText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: theme.colors.ink,
  },
  drawerActions: {
    marginTop: theme.spacing.sm,
  },
});
