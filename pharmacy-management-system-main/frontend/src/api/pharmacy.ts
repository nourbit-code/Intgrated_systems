import { apiRequest } from './client';

export type Prescription = Record<string, unknown>;
export type PharmacyOrder = Record<string, unknown>;
export type InventoryItem = Record<string, unknown>;
export type Invoice = Record<string, unknown>;
export type ClinicSupplyRequest = Record<string, unknown>;
export type Patient = Record<string, unknown>;
export type AlertItem = Record<string, unknown>;
export type PrescriptionPreparation = Record<string, unknown>;
const DEFAULT_INVENTORY_LIMIT = 500;

export function getPrescriptions(): Promise<Prescription[]> {
  return apiRequest<Prescription[]>('/prescriptions/');
}

export function createPrescription(payload: Prescription): Promise<Prescription> {
  return apiRequest<Prescription>('/prescriptions/', {
    method: 'POST',
    body: payload,
  });
}

export function updatePrescription(id: string, payload: Prescription): Promise<Prescription> {
  return apiRequest<Prescription>(`/prescriptions/${id}/`, {
    method: 'PATCH',
    body: payload,
  });
}

export function prepareInvoiceForPrescription(id: string): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(`/prescriptions/${id}/prepare-invoice/`, {
    method: 'POST',
  });
}

export function getPrescriptionPreparation(id: string): Promise<PrescriptionPreparation> {
  return apiRequest<PrescriptionPreparation>(`/prescriptions/${id}/preparation/`);
}

export function finalizePrescriptionPreparation(
  id: string,
  payload: PrescriptionPreparation
): Promise<PrescriptionPreparation> {
  return apiRequest<PrescriptionPreparation>(`/prescriptions/${id}/prepare-order/`, {
    method: 'POST',
    body: payload,
  });
}

export function getPharmacyOrders(): Promise<PharmacyOrder[]> {
  return apiRequest<PharmacyOrder[]>('/pharmacy-orders/');
}

export function updatePharmacyOrder(id: string, payload: PharmacyOrder): Promise<PharmacyOrder> {
  return apiRequest<PharmacyOrder>(`/pharmacy-orders/${id}/`, {
    method: 'PATCH',
    body: payload,
  });
}

export function getInventory(): Promise<InventoryItem[]> {
  return apiRequest<InventoryItem[]>(`/inventory/?limit=${DEFAULT_INVENTORY_LIMIT}`);
}

export function deleteInventory(id: string): Promise<void> {
  return apiRequest<void>(`/inventory/${id}/`, {
    method: 'DELETE',
  });
}

export function getLowStock(): Promise<InventoryItem[]> {
  return apiRequest<InventoryItem[]>('/inventory/low-stock/');
}

export function updateInventory(payload: InventoryItem): Promise<InventoryItem> {
  return apiRequest<InventoryItem>('/inventory/', {
    method: 'POST',
    body: payload,
  });
}

export function getInvoices(): Promise<Invoice[]> {
  return apiRequest<Invoice[]>('/invoices/');
}

export function getPatients(): Promise<Patient[]> {
  return apiRequest<Patient[]>('/patients/');
}

export function createPatient(payload: Patient): Promise<Patient> {
  return apiRequest<Patient>('/patients/', {
    method: 'POST',
    body: payload,
  });
}

export function deletePatient(id: string): Promise<void> {
  return apiRequest<void>(`/patients/${id}/`, {
    method: 'DELETE',
  });
}

export function createInvoice(payload: Invoice): Promise<Invoice> {
  return apiRequest<Invoice>('/invoices/', {
    method: 'POST',
    body: payload,
  });
}

export function updateInvoice(id: string, payload: Invoice): Promise<Invoice> {
  return apiRequest<Invoice>(`/invoices/${id}/`, {
    method: 'PATCH',
    body: payload,
  });
}

export function getClinicRequests(): Promise<ClinicSupplyRequest[]> {
  return apiRequest<ClinicSupplyRequest[]>('/clinic-requests/');
}

export function createClinicRequest(payload: ClinicSupplyRequest): Promise<ClinicSupplyRequest> {
  return apiRequest<ClinicSupplyRequest>('/clinic-requests/', {
    method: 'POST',
    body: payload,
  });
}

export function updateClinicRequest(id: string, payload: ClinicSupplyRequest): Promise<ClinicSupplyRequest> {
  return apiRequest<ClinicSupplyRequest>(`/clinic-requests/${id}/`, {
    method: 'PATCH',
    body: payload,
  });
}

export function getAlerts(): Promise<AlertItem[]> {
  return apiRequest<AlertItem[]>('/alerts/');
}
