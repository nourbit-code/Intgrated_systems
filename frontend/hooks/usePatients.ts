import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest, toIsoDateOnly } from '@/utils/api';

type MedicalSummary = {
  allergies: string;
  chronicConditions: string;
  currentMedications: string;
  previousSurgeries: string;
};

type Patient = {
  id: string;
  externalId?: string;
  globalPatientId?: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  email?: string;
  address?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceMemberId?: string;
  insuranceExpiry?: string;
  status: 'Active' | 'Pending' | 'Inactive';
  lastVisit: string;
  lastVisitDate: string;
  lastTest: string;
  medicalHistory?: MedicalSummary;
};

type PatientsState = {
  patients: Patient[];
  addPatient: (patient: Omit<Patient, 'id' | 'lastVisit' | 'lastVisitDate' | 'status' | 'lastTest'> & Partial<Pick<Patient, 'status' | 'lastTest'>>) => void;
  updatePatient: (id: string, updates: Partial<Pick<Patient, 'phone' | 'email' | 'address'>>) => void;
};

type ApiPatient = {
  id: number;
  full_name: string;
  dob: string;
  gender: 'male' | 'female' | 'other';
  phone: string;
  email: string | null;
  address: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_member_id: string | null;
  insurance_expiry: string | null;
  is_active: boolean;
  external_id: string | null;
  global_patient_id?: string | null;
  clinical_profile_snapshot?: {
    allergies?: unknown;
    medical_history?: unknown;
    surgeries?: unknown;
    notes?: unknown;
  } | null;
  created_at: string;
};

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

const PatientsContext = createContext<PatientsState | undefined>(undefined);

function calculateAgeFromDob(dob: string) {
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return Math.max(age, 0);
}

function formatDisplayVisitDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(
    new Date(year, month - 1, day),
  );
}

function mapApiPatient(input: ApiPatient): Patient {
  const createdDate = (input.created_at ?? '').slice(0, 10) || toIsoDateOnly(new Date());
  const gender =
    input.gender === 'male' ? 'Male' : input.gender === 'female' ? 'Female' : 'Other';
  const snapshot = input.clinical_profile_snapshot ?? {};
  const allergies = normalizeSnapshotList(snapshot.allergies);
  const chronicConditions = normalizeSnapshotList(snapshot.medical_history);
  const surgeries = normalizeSnapshotList(snapshot.surgeries);
  return {
    id: String(input.id),
    name: input.full_name,
    externalId: input.external_id ?? undefined,
    globalPatientId: input.global_patient_id ?? undefined,
    age: calculateAgeFromDob(input.dob),
    gender,
    phone: input.phone,
    email: input.email ?? undefined,
    address: input.address ?? undefined,
    insuranceProvider: input.insurance_provider ?? undefined,
    insurancePolicyNumber: input.insurance_policy_number ?? undefined,
    insuranceMemberId: input.insurance_member_id ?? undefined,
    insuranceExpiry: input.insurance_expiry ?? undefined,
    status: input.is_active ? 'Active' : 'Inactive',
    lastVisit: formatDisplayVisitDate(createdDate),
    lastVisitDate: createdDate,
    lastTest: 'N/A',
    medicalHistory: {
      allergies: toSummaryText(allergies),
      chronicConditions: toSummaryText(chronicConditions),
      currentMedications: 'None reported',
      previousSurgeries: toSummaryText(surgeries),
    },
  };
}

function dobFromAge(age: number) {
  const now = new Date();
  const year = now.getFullYear() - Math.max(0, Math.floor(age));
  return `${year}-01-01`;
}

export function PatientsProvider({ children }: PropsWithChildren) {
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadPatients = async () => {
      try {
        const apiPatients = await apiRequest<ApiPatient[]>('/api/v1/patients/');
        if (!cancelled) {
          setPatients(apiPatients.map(mapApiPatient));
        }
      } catch {
        if (!cancelled) {
          setPatients([]);
        }
      }
    };
    loadPatients();
    return () => {
      cancelled = true;
    };
  }, []);

  const addPatient: PatientsState['addPatient'] = (patient) => {
    const payload = {
      full_name: patient.name.trim(),
      dob: dobFromAge(patient.age),
      gender: patient.gender.toLowerCase(),
      phone: patient.phone.trim(),
      email: patient.email?.trim() || null,
      address: patient.address?.trim() || null,
      insurance_provider: patient.insuranceProvider?.trim() || null,
      insurance_policy_number: patient.insurancePolicyNumber?.trim() || null,
      insurance_member_id: patient.insuranceMemberId?.trim() || null,
      insurance_expiry: patient.insuranceExpiry?.trim() || null,
      consent_signed: false,
      is_active: (patient.status ?? 'Pending') !== 'Inactive',
    };

    void (async () => {
      try {
        const created = await apiRequest<ApiPatient>('/api/v1/patients/', {
          method: 'POST',
          body: payload,
        });
        setPatients((prev) => [mapApiPatient(created), ...prev]);
      } catch {
        // keep UI stable; backend error can be surfaced later in form UX improvements
      }
    })();
  };

  const updatePatient: PatientsState['updatePatient'] = (id, updates) => {
    const payload = {
      phone: updates.phone?.trim(),
      email: updates.email?.trim() || null,
      address: updates.address?.trim() || null,
    };

    setPatients((prev) =>
      prev.map((patient) => (patient.id === id ? { ...patient, ...updates } : patient)),
    );

    void apiRequest(`/api/v1/patients/${id}/`, {
      method: 'PATCH',
      body: payload,
    }).catch(() => {
      // optimistic update fallback
    });
  };

  const value = useMemo(() => ({ patients, addPatient, updatePatient }), [patients]);

  return React.createElement(PatientsContext.Provider, { value }, children);
}

export function usePatients() {
  const ctx = useContext(PatientsContext);
  if (!ctx) {
    throw new Error('usePatients must be used within PatientsProvider');
  }
  return ctx;
}

export type { Patient, MedicalSummary };
