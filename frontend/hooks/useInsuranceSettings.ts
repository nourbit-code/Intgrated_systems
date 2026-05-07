import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '@/utils/api';

type InsuranceSettings = {
  providers: string[];
  discounts: Record<string, number>;
};

type InsuranceSettingsState = InsuranceSettings & {
  addProvider: (provider: string) => void;
  setDiscount: (provider: string, percent: number) => void;
  getDiscountForProvider: (provider?: string) => number;
  aliases: Record<string, string>;
  setAlias: (from: string, to: string) => void;
  removeAlias: (from: string) => void;
};

type ApiInsuranceProvider = {
  id: number;
  name: string;
  discount_percent: string;
  is_active: boolean;
};

const InsuranceSettingsContext = createContext<InsuranceSettingsState | undefined>(undefined);
const ALIASES_STORAGE_KEY = 'insurance_provider_aliases';

function sanitizeProvider(input: string) {
  return input.trim();
}

function normalizeProviderKey(input?: string) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const defaultProviderAliases: Record<string, string> = {
  'axa egypt': 'axa',
  'axa insurance': 'axa',
  'metlife aeg': 'metlife',
  'allianz egypt': 'allianz',
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function parseDiscount(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function InsuranceSettingsProvider({ children }: PropsWithChildren) {
  const [providerRows, setProviderRows] = useState<ApiInsuranceProvider[]>([]);
  const [aliases, setAliases] = useState<Record<string, string>>(defaultProviderAliases);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(ALIASES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === 'object') {
        setAliases({ ...defaultProviderAliases, ...parsed });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ALIASES_STORAGE_KEY, JSON.stringify(aliases));
    } catch {
      // ignore
    }
  }, [aliases]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await apiRequest<ApiInsuranceProvider[]>('/api/v1/insurance-providers/');
        if (!cancelled) {
          setProviderRows(rows.filter((row) => row.is_active !== false));
        }
      } catch {
        if (!cancelled) {
          setProviderRows([]);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const providers = useMemo(
    () => providerRows.map((row) => row.name).sort((a, b) => a.localeCompare(b)),
    [providerRows]
  );

  const discounts = useMemo(() => {
    const next: Record<string, number> = {};
    providerRows.forEach((row) => {
      next[row.name] = parseDiscount(row.discount_percent);
    });
    return next;
  }, [providerRows]);

  const addProvider = (provider: string) => {
    const cleaned = sanitizeProvider(provider);
    if (!cleaned) return;
    const exists = providerRows.some((row) => row.name.toLowerCase() === cleaned.toLowerCase());
    if (exists) return;

    const tempId = -(Date.now());
    setProviderRows((prev) => [
      ...prev,
      { id: tempId, name: cleaned, discount_percent: '0.00', is_active: true },
    ]);

    void (async () => {
      try {
        const created = await apiRequest<ApiInsuranceProvider>('/api/v1/insurance-providers/', {
          method: 'POST',
          body: {
            name: cleaned,
            discount_percent: '0.00',
            is_active: true,
          },
        });
        setProviderRows((prev) => prev.map((row) => (row.id === tempId ? created : row)));
      } catch {
        setProviderRows((prev) => prev.filter((row) => row.id !== tempId));
      }
    })();
  };

  const setDiscount = (provider: string, percent: number) => {
    const cleaned = sanitizeProvider(provider);
    if (!cleaned) return;
    const clamped = clampPercent(percent);
    const matched = providerRows.find((row) => row.name.toLowerCase() === cleaned.toLowerCase());
    if (!matched) return;

    setProviderRows((prev) =>
      prev.map((row) =>
        row.id === matched.id ? { ...row, discount_percent: clamped.toFixed(2) } : row
      )
    );

    void apiRequest(`/api/v1/insurance-providers/${matched.id}/`, {
      method: 'PATCH',
      body: {
        discount_percent: clamped.toFixed(2),
      },
    }).catch(() => {
      // optimistic update retained
    });
  };

  const getDiscountForProvider = (provider?: string) => {
    if (!provider) return 0;
    const normalized = normalizeProviderKey(provider);
    const aliasResolved = aliases[normalized] ?? normalized;
    const match = providerRows.find((row) => {
      const rowKey = normalizeProviderKey(row.name);
      return rowKey === aliasResolved || rowKey === normalized;
    });
    if (!match) return 0;
    return parseDiscount(match.discount_percent);
  };

  const setAlias = (from: string, to: string) => {
    const fromKey = normalizeProviderKey(from);
    const toKey = normalizeProviderKey(to);
    if (!fromKey || !toKey) return;
    setAliases((prev) => ({ ...prev, [fromKey]: toKey }));
  };

  const removeAlias = (from: string) => {
    const fromKey = normalizeProviderKey(from);
    if (!fromKey) return;
    setAliases((prev) => {
      const next = { ...prev };
      delete next[fromKey];
      return next;
    });
  };

  const value = useMemo(
    () => ({ providers, discounts, addProvider, setDiscount, getDiscountForProvider, aliases, setAlias, removeAlias }),
    [providers, discounts, providerRows, aliases]
  );

  return React.createElement(InsuranceSettingsContext.Provider, { value }, children);
}

export function useInsuranceSettings() {
  const ctx = useContext(InsuranceSettingsContext);
  if (!ctx) {
    throw new Error('useInsuranceSettings must be used within InsuranceSettingsProvider');
  }
  return ctx;
}
