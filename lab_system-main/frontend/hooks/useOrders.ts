import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest, toIsoDateOnly } from '@/utils/api';
import type { Role } from './useAuth';
import type { MedicalSummary } from './usePatients';

type OrderTest = {
  id: string;
  code?: string;
  name: string;
  price: number;
  sample: string;
  result?: string;
  unit?: string;
  reference?: string;
  min?: number;
  max?: number;
};

type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid';

type Order = {
  id: string;
  invoiceId: string;
  patientId: string;
  patientName: string;
  date: string;
  completedAt?: string;
  status: 'Waiting for Sample' | 'In Progress' | 'Completed' | 'Cancelled';
  priority?: 'Routine' | 'Urgent' | 'STAT';
  tests: OrderTest[];
  subtotal: number;
  discount: number;
  discountPercent?: number;
  total: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  insurance?: string;
  notes?: string;
  bookedByName?: string;
  bookedByRole?: Role;
  bookedByUserId?: string;
  bookedBySignature?: string;
  completedByTechName?: string;
  completedByTechUserId?: string;
  medicalHistorySnapshot?: MedicalSummary;
};

type OrdersState = {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderPaymentStatus: (id: string, paid: boolean) => void;
  updateOrderFinancials: (id: string, updates: Partial<Pick<Order, 'discount' | 'discountPercent' | 'total' | 'insurance'>>) => void;
  updateOrderStatus: (
    id: string,
    status: Order['status'],
    meta?: { completedByTechName?: string; completedByTechUserId?: string }
  ) => void;
};

type ApiClinicalSnapshot = {
  allergies?: unknown;
  medical_history?: unknown;
  surgeries?: unknown;
};
type ApiPatient = {
  id: number;
  full_name: string;
  insurance_provider?: string | null;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  external_id?: string | null;
  clinical_profile_snapshot?: ApiClinicalSnapshot | null;
};
type ApiAppointment = {
  id: number;
  patient: number;
  scheduled_at: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  type: 'LAB_TEST' | 'SCAN';
};
type ApiLabType = {
  id: number;
  name: string;
  code?: string | null;
  default_price: string;
  result_unit?: string | null;
  reference_min?: string | null;
  reference_max?: string | null;
  reference_text?: string | null;
};
type ApiScanType = { id: number; name: string; default_price: string };
type ApiLabOrder = { id: number; appointment: number; test_type: number; status: string; price: string };
type ApiScanOrder = { id: number; appointment: number; scan_type: number; status: string; price: string };
type ApiInvoice = { id: number; patient: number; appointment: number | null; total: string; paid: boolean; status: string; created_at: string };
type ApiPayment = { id: number; invoice: number; amount: string; method: string; paid_at: string };
type MatchedLabTest = { sourceTest: OrderTest; matchedType: ApiLabType };
type MatchedScanTest = { sourceTest: OrderTest; matchedType: ApiScanType };

const OrdersContext = createContext<OrdersState | undefined>(undefined);

function statusLabel(
  appointmentStatus: ApiAppointment['status'],
  appointmentType: ApiAppointment['type']
): Order['status'] {
  if (appointmentStatus === 'cancelled') return 'Cancelled';
  if (appointmentStatus === 'completed') return 'Completed';
  return appointmentType === 'SCAN' ? 'In Progress' : 'Waiting for Sample';
}

function paymentStatusLabel(invoiceStatus: string): PaymentStatus {
  if (invoiceStatus === 'paid') return 'Paid';
  if (invoiceStatus === 'partial') return 'Partial';
  return 'Unpaid';
}

function methodLabel(method: string) {
  if (method === 'card') return 'Visa';
  return method ? method.charAt(0).toUpperCase() + method.slice(1) : 'Cash';
}

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInvoiceNumericId(invoiceId?: string) {
  const match = /^INV-(\d+)$/i.exec(String(invoiceId ?? '').trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchLabTypeForTest(test: { id?: string; name?: string }, labTypes: ApiLabType[]) {
  const idToken = normalizeToken(test.id);
  const nameToken = normalizeToken(test.name);
  const direct = labTypes.find((type) => {
    const typeName = normalizeToken(type.name);
    const typeCode = normalizeToken(type.code ?? '');
    return (
      (idToken && (idToken === typeName || idToken === typeCode)) ||
      (nameToken && (nameToken === typeName || nameToken === typeCode))
    );
  });
  if (direct) return direct;

  const partial = labTypes.find((type) => {
    const typeName = normalizeToken(type.name);
    const typeCode = normalizeToken(type.code ?? '');
    return (
      (idToken && (typeName.includes(idToken) || idToken.includes(typeName) || typeCode.includes(idToken))) ||
      (nameToken && (typeName.includes(nameToken) || nameToken.includes(typeName) || typeCode.includes(nameToken)))
    );
  });
  return partial ?? null;
}

function matchScanTypeForTest(test: { id?: string; name?: string }, scanTypes: ApiScanType[]) {
  const idToken = normalizeToken(test.id);
  const nameToken = normalizeToken(test.name);
  const direct = scanTypes.find((type) => {
    const typeName = normalizeToken(type.name);
    return (
      (idToken && idToken === typeName) ||
      (nameToken && nameToken === typeName)
    );
  });
  if (direct) return direct;

  const partial = scanTypes.find((type) => {
    const typeName = normalizeToken(type.name);
    return (
      (idToken && (typeName.includes(idToken) || idToken.includes(typeName))) ||
      (nameToken && (typeName.includes(nameToken) || nameToken.includes(typeName)))
    );
  });
  return partial ?? null;
}

function normalizeSnapshotList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function toSummaryText(values: string[]) {
  return values.length ? values.join(', ') : 'None reported';
}

function mapBackendToOrders(
  patients: ApiPatient[],
  appointments: ApiAppointment[],
  labTypes: ApiLabType[],
  scanTypes: ApiScanType[],
  labOrders: ApiLabOrder[],
  scanOrders: ApiScanOrder[],
  invoices: ApiInvoice[],
  payments: ApiPayment[]
): Order[] {
  const patientById = new Map(patients.map((item) => [item.id, item]));
  const labTypeById = new Map(labTypes.map((item) => [item.id, item]));
  const scanTypeById = new Map(scanTypes.map((item) => [item.id, item]));
  const paymentsByInvoice = new Map<number, ApiPayment[]>();
  payments.forEach((payment) => {
    const current = paymentsByInvoice.get(payment.invoice) ?? [];
    current.push(payment);
    paymentsByInvoice.set(payment.invoice, current);
  });

  return appointments
    .map((appointment) => {
      const patient = patientById.get(appointment.patient);
      if (!patient) return null;
      const snapshot = patient.clinical_profile_snapshot ?? {};
      const allergies = normalizeSnapshotList(snapshot.allergies);
      const chronicConditions = normalizeSnapshotList(snapshot.medical_history);
      const surgeries = normalizeSnapshotList(snapshot.surgeries);

      const relatedInvoice = invoices.find((invoice) => invoice.appointment === appointment.id) ?? null;
      const relatedPayments = relatedInvoice ? paymentsByInvoice.get(relatedInvoice.id) ?? [] : [];
      const relatedLabOrders = labOrders.filter((order) => order.appointment === appointment.id);
      const relatedScanOrders = scanOrders.filter((order) => order.appointment === appointment.id);

      const tests: OrderTest[] = [
        ...relatedLabOrders.map((order) => {
          const testType = labTypeById.get(order.test_type);
          const min = testType?.reference_min != null ? toNumber(testType.reference_min) : undefined;
          const max = testType?.reference_max != null ? toNumber(testType.reference_max) : undefined;
          return {
            id: `lab-${order.id}`,
            code: testType?.code ?? undefined,
            name: testType?.name ?? 'Lab Test',
            price: toNumber(order.price) || toNumber(testType?.default_price),
            sample: 'Blood',
            unit: testType?.result_unit ?? undefined,
            reference: testType?.reference_text ?? undefined,
            min: Number.isFinite(min as number) ? min : undefined,
            max: Number.isFinite(max as number) ? max : undefined,
          };
        }),
        ...relatedScanOrders.map((order) => {
          const scanType = scanTypeById.get(order.scan_type);
          return {
            id: `scan-${order.id}`,
            code: scanType?.name ?? undefined,
            name: scanType?.name ?? 'Scan',
            price: toNumber(order.price) || toNumber(scanType?.default_price),
            sample: 'Imaging',
          };
        }),
      ];

      const subtotal = tests.reduce((sum, test) => sum + test.price, 0);
      const total = relatedInvoice ? toNumber(relatedInvoice.total) : subtotal;
      const amountPaid = relatedPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
      const firstPayment = relatedPayments[0];

      return {
        id: String(appointment.id),
        invoiceId: relatedInvoice ? `INV-${relatedInvoice.id}` : `INV-${appointment.id}`,
        patientId: String(patient.id),
        patientName: patient.full_name,
        date: appointment.scheduled_at.slice(0, 10),
        status: statusLabel(appointment.status, appointment.type),
        tests,
        subtotal,
        discount: Math.max(0, subtotal - total),
        total,
        amountPaid,
        paymentStatus: relatedInvoice ? paymentStatusLabel(relatedInvoice.status) : 'Unpaid',
        paymentMethod: firstPayment ? methodLabel(firstPayment.method) : 'Cash',
        insurance: patient.insurance_provider ?? undefined,
        medicalHistorySnapshot: {
          allergies: toSummaryText(allergies),
          chronicConditions: toSummaryText(chronicConditions),
          currentMedications: 'None reported',
          previousSurgeries: toSummaryText(surgeries),
        },
      };
    })
    .filter(Boolean) as Order[];
}

export function OrdersProvider({ children }: PropsWithChildren) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [
          patients,
          appointments,
          labTypes,
          scanTypes,
          labOrders,
          scanOrders,
          invoices,
          payments,
        ] = await Promise.all([
          apiRequest<ApiPatient[]>('/api/v1/patients/'),
          apiRequest<ApiAppointment[]>('/api/v1/appointments/'),
          apiRequest<ApiLabType[]>('/api/v1/lab-test-types/'),
          apiRequest<ApiScanType[]>('/api/v1/scan-types/'),
          apiRequest<ApiLabOrder[]>('/api/v1/lab-test-orders/'),
          apiRequest<ApiScanOrder[]>('/api/v1/scan-orders/'),
          apiRequest<ApiInvoice[]>('/api/v1/invoices/'),
          apiRequest<ApiPayment[]>('/api/v1/payments/'),
        ]);

        if (!cancelled) {
          setOrders(
            mapBackendToOrders(
              patients,
              appointments,
              labTypes,
              scanTypes,
              labOrders,
              scanOrders,
              invoices,
              payments
            )
          );
        }
      } catch {
        if (!cancelled) {
          setOrders([]);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const addOrder = (order: Order) => {
    setOrders((prev) => [order, ...prev]);

    void (async () => {
      try {
        const patientId = Number(order.patientId);
        if (!Number.isFinite(patientId)) return;

        const hasImaging = order.tests.some((test) => test.sample === 'Imaging');
        const hasLabTests = order.tests.some((test) => test.sample !== 'Imaging');
        if (hasImaging && hasLabTests) {
          throw new Error('Mixed lab and imaging tests in one order are not supported.');
        }

        let matchedLabTests: MatchedLabTest[] = [];
        let matchedScanTests: MatchedScanTest[] = [];

        if (hasImaging) {
          const scanTypes = await apiRequest<ApiScanType[]>('/api/v1/scan-types/');
          const scanTests = order.tests.filter((test) => test.sample === 'Imaging');
          const unmatchedTests: string[] = [];
          matchedScanTests = scanTests
            .map((test) => {
              const matchedType = matchScanTypeForTest(test, scanTypes);
              if (!matchedType) {
                unmatchedTests.push(test.name || test.id || 'Unknown scan');
                return null;
              }
              return { sourceTest: test, matchedType };
            })
            .filter(Boolean) as MatchedScanTest[];
          if (unmatchedTests.length > 0) {
            throw new Error(`Missing scan type mapping for: ${unmatchedTests.join(', ')}`);
          }
        } else {
          const labTypes = await apiRequest<ApiLabType[]>('/api/v1/lab-test-types/');
          const unmatchedTests: string[] = [];
          matchedLabTests = order.tests
            .map((test) => {
              const matchedType = matchLabTypeForTest(test, labTypes);
              if (!matchedType) {
                unmatchedTests.push(test.name || test.id || 'Unknown test');
                return null;
              }
              return { sourceTest: test, matchedType };
            })
            .filter(Boolean) as MatchedLabTest[];
          if (unmatchedTests.length > 0) {
            throw new Error(`Missing lab test type mapping for: ${unmatchedTests.join(', ')}`);
          }
        }

        const appointment = await apiRequest<ApiAppointment>('/api/v1/appointments/', {
          method: 'POST',
          body: {
            patient: patientId,
            scheduled_at: new Date().toISOString(),
            status: 'confirmed',
            type: hasImaging ? 'SCAN' : 'LAB_TEST',
            notes: order.notes ?? null,
          },
        });

        let syncedTests: OrderTest[] = [];
        if (hasImaging) {
          const createdScanOrders: Array<{ sourceTest: OrderTest; matchedType: ApiScanType; createdOrder: ApiScanOrder }> = [];
          for (const mapped of matchedScanTests) {
            const created = await apiRequest<ApiScanOrder>('/api/v1/scan-orders/', {
              method: 'POST',
              body: {
                appointment: appointment.id,
                scan_type: mapped.matchedType.id,
                status: 'in_progress',
                price: Number(mapped.sourceTest.price || mapped.matchedType.default_price).toFixed(2),
              },
            });
            createdScanOrders.push({ ...mapped, createdOrder: created });
          }
          syncedTests = createdScanOrders.map(({ sourceTest, matchedType, createdOrder }) => ({
            ...sourceTest,
            id: `scan-${createdOrder.id}`,
            code: matchedType.name,
            name: matchedType.name,
            price: toNumber(createdOrder.price) || toNumber(matchedType.default_price) || sourceTest.price,
          }));
        } else {
          const createdLabOrders: Array<{ sourceTest: OrderTest; matchedType: ApiLabType; createdOrder: ApiLabOrder }> = [];
          for (const mapped of matchedLabTests) {
            const created = await apiRequest<ApiLabOrder>('/api/v1/lab-test-orders/', {
              method: 'POST',
              body: {
                appointment: appointment.id,
                test_type: mapped.matchedType.id,
                status: 'waiting_for_sample',
                price: Number(mapped.sourceTest.price || mapped.matchedType.default_price).toFixed(2),
              },
            });
            createdLabOrders.push({ ...mapped, createdOrder: created });
          }
          syncedTests = createdLabOrders.map(({ sourceTest, matchedType, createdOrder }) => {
            const min = matchedType.reference_min != null ? toNumber(matchedType.reference_min) : undefined;
            const max = matchedType.reference_max != null ? toNumber(matchedType.reference_max) : undefined;
            return {
              ...sourceTest,
              id: `lab-${createdOrder.id}`,
              code: matchedType.code ?? undefined,
              name: matchedType.name,
              unit: matchedType.result_unit ?? undefined,
              reference: matchedType.reference_text ?? undefined,
              min: Number.isFinite(min as number) ? min : undefined,
              max: Number.isFinite(max as number) ? max : undefined,
              price: toNumber(createdOrder.price) || toNumber(matchedType.default_price) || sourceTest.price,
            };
          });
        }

        const invoice = await apiRequest<ApiInvoice>('/api/v1/invoices/', {
          method: 'POST',
          body: {
            patient: patientId,
            appointment: appointment.id,
            total: Number(order.total || 0).toFixed(2),
            paid: order.amountPaid >= order.total && order.total > 0,
            status:
              order.amountPaid >= order.total && order.total > 0
                ? 'paid'
                : order.amountPaid > 0
                ? 'partial'
                : 'unpaid',
          },
        });

        if (order.amountPaid > 0) {
          await apiRequest('/api/v1/payments/', {
            method: 'POST',
            body: {
              invoice: invoice.id,
              amount: Number(order.amountPaid).toFixed(2),
              method: order.paymentMethod?.toLowerCase() === 'visa' ? 'card' : 'cash',
              paid_at: new Date().toISOString(),
            },
          });
        }

        setOrders((prev) =>
          prev.map((entry) =>
            entry.id === order.id
              ? {
                  ...entry,
                  id: String(appointment.id),
                  invoiceId: `INV-${invoice.id}`,
                  date: toIsoDateOnly(new Date(appointment.scheduled_at)),
                  tests: syncedTests.length > 0 ? syncedTests : entry.tests,
                }
              : entry
          )
        );
      } catch {
        setOrders((prev) => prev.filter((entry) => entry.id !== order.id));
      }
    })();
  };

  const updateOrderStatus: OrdersState['updateOrderStatus'] = (id, status, meta) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        if (status === 'Completed') {
          return {
            ...o,
            status,
            completedAt: o.completedAt ?? toIsoDateOnly(new Date()),
            completedByTechName: meta?.completedByTechName?.trim() || o.completedByTechName || 'Lab Technician',
            completedByTechUserId: meta?.completedByTechUserId?.trim() || o.completedByTechUserId,
          };
        }
        return { ...o, status, completedAt: undefined, completedByTechName: undefined, completedByTechUserId: undefined };
      }),
    );

    const statusMap: Record<Order['status'], ApiAppointment['status']> = {
      'Waiting for Sample': 'confirmed',
      'In Progress': 'confirmed',
      Completed: 'completed',
      Cancelled: 'cancelled',
    };

    void apiRequest(`/api/v1/appointments/${id}/`, {
      method: 'PATCH',
      body: {
        status: statusMap[status],
      },
    }).catch(() => {
      // optimistic update
    });
  };

  const updateOrderPaymentStatus: OrdersState['updateOrderPaymentStatus'] = (id, paid) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        return {
          ...o,
          amountPaid: paid ? o.total : 0,
          paymentStatus: paid ? 'Paid' : 'Unpaid',
        };
      })
    );

    const targetOrder = orders.find((o) => o.id === id);
    if (!targetOrder) return;
    const invoiceNumericId = parseInvoiceNumericId(targetOrder.invoiceId);
    if (!invoiceNumericId) return;

    void (async () => {
      try {
        await apiRequest(`/api/v1/invoices/${invoiceNumericId}/`, {
          method: 'PATCH',
          body: {
            paid,
            status: paid ? 'paid' : 'unpaid',
            total: Number(targetOrder.total || 0).toFixed(2),
          },
        });

        if (paid && (targetOrder.amountPaid ?? 0) <= 0) {
          await apiRequest('/api/v1/payments/', {
            method: 'POST',
            body: {
              invoice: invoiceNumericId,
              amount: Number(targetOrder.total || 0).toFixed(2),
              method: targetOrder.paymentMethod?.toLowerCase() === 'visa' ? 'card' : 'cash',
              paid_at: new Date().toISOString(),
            },
          });
        }
      } catch {
        // keep optimistic UX
      }
    })();
  };

  const updateOrderFinancials: OrdersState['updateOrderFinancials'] = (id, updates) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const next = { ...o, ...updates };
        if (next.paymentStatus === 'Paid') {
          next.amountPaid = next.total;
        }
        return next;
      })
    );

    const targetOrder = orders.find((o) => o.id === id);
    if (!targetOrder) return;
    const invoiceNumericId = parseInvoiceNumericId(targetOrder.invoiceId);
    if (!invoiceNumericId) return;
    const nextTotal = updates.total ?? targetOrder.total;
    const paid = (targetOrder.paymentStatus === 'Paid');

    void apiRequest(`/api/v1/invoices/${invoiceNumericId}/`, {
      method: 'PATCH',
      body: {
        total: Number(nextTotal || 0).toFixed(2),
        paid,
        status: paid ? 'paid' : 'unpaid',
      },
    }).catch(() => {
      // optimistic update retained
    });
  };

  const value = useMemo(
    () => ({ orders, addOrder, updateOrderStatus, updateOrderPaymentStatus, updateOrderFinancials }),
    [orders]
  );

  return React.createElement(OrdersContext.Provider, { value }, children);
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) {
    throw new Error('useOrders must be used within OrdersProvider');
  }
  return ctx;
}

export type { Order, OrderTest, PaymentStatus };
