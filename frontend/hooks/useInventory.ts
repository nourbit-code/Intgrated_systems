import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '@/utils/api';

type InventoryItem = {
  id: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  unit: string;
  minStock: number;
  expiryDate: string;
  supplier: string;
  isBlocked?: boolean;
  blockReason?: 'Expired';
};

type TransactionType = 'Added' | 'Used' | 'Expired' | 'Adjusted';

type StockTransaction = {
  id: string;
  itemId: string;
  itemName: string;
  type: TransactionType;
  quantity: number;
  date: string;
  performedBy: string;
};

type InventoryDropdownField = 'categories' | 'units' | 'suppliers';

type InventoryDropdownSettings = {
  categories: string[];
  units: string[];
  suppliers: string[];
};

type InventoryPreferences = {
  defaultCategory: string;
};

type ConsumptionTemplateRow = {
  itemName: string;
  quantity: number;
};

type ConsumptionTemplateMap = Record<string, ConsumptionTemplateRow[]>;

type InventoryState = {
  items: InventoryItem[];
  transactions: StockTransaction[];
  dropdownSettings: InventoryDropdownSettings;
  preferences: InventoryPreferences;
  consumptionTemplates: ConsumptionTemplateMap;
  addItem: (item: Omit<InventoryItem, 'id'>) => void;
  updateItem: (id: string, patch: Partial<InventoryItem>) => void;
  updateItemMinStock: (id: string, minStock: number) => void;
  markItemExpired: (id: string) => void;
  addStock: (id: string, quantity: number) => void;
  consumeItems: (entries: { id: string; quantity: number }[]) => void;
  addDropdownOption: (field: InventoryDropdownField, value: string) => void;
  removeDropdownOption: (field: InventoryDropdownField, value: string) => void;
  setDefaultCategory: (value: string) => void;
  setConsumptionTemplate: (testOrScanName: string, rows: ConsumptionTemplateRow[]) => void;
  removeConsumptionTemplate: (testOrScanName: string) => void;
};

type ApiInventoryItem = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  sku: string;
  unit: string;
  quantity: string;
  reorder_level: string;
  unit_cost: string;
  expiry_date: string | null;
  supplier: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  is_active: boolean;
};

type ApiInventoryTransaction = {
  id: number;
  item: number;
  delta: string;
  reason: string;
  created_by: number | null;
  created_at: string;
};

const InventoryContext = createContext<InventoryState | undefined>(undefined);

const SETTINGS_KEY = 'lab_inventory_dropdown_settings';
const PREF_KEY = 'lab_inventory_preferences';
const CONSUMPTION_TEMPLATES_KEY = 'lab_inventory_consumption_templates';

const defaultDropdownSettings: InventoryDropdownSettings = {
  categories: ['General'],
  units: ['pcs', 'kit', 'box', 'ml', 'bottle'],
  suppliers: ['Unknown'],
};

function normalizeOptions(options: string[]) {
  const unique = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));
  return unique.sort((a, b) => a.localeCompare(b));
}

function mapApiItem(item: ApiInventoryItem): InventoryItem {
  return {
    id: String(item.id),
    name: item.name,
    description: item.description ?? undefined,
    category: item.category ?? 'General',
    quantity: Number(item.quantity ?? 0),
    unit: item.unit,
    minStock: Number(item.reorder_level ?? 0),
    expiryDate: item.expiry_date ?? '2099-12-31',
    supplier: item.supplier ?? 'Unknown',
    isBlocked: item.is_blocked || !item.is_active,
    blockReason: item.block_reason === 'Expired' ? 'Expired' : undefined,
  };
}

function mapApiTransaction(tx: ApiInventoryTransaction, items: InventoryItem[]): StockTransaction {
  const foundItem = items.find((item) => item.id === String(tx.item));
  const delta = Number(tx.delta ?? 0);
  return {
    id: String(tx.id),
    itemId: String(tx.item),
    itemName: foundItem?.name ?? 'Item',
    type: delta >= 0 ? 'Added' : 'Used',
    quantity: delta,
    date: tx.created_at,
    performedBy: 'System',
  };
}

export function InventoryProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [dropdownSettings, setDropdownSettings] = useState<InventoryDropdownSettings>(
    defaultDropdownSettings
  );
  const [preferences, setPreferences] = useState<InventoryPreferences>({ defaultCategory: 'General' });
  const [consumptionTemplates, setConsumptionTemplates] = useState<ConsumptionTemplateMap>({});

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        const [apiItems, apiTransactions] = await Promise.all([
          apiRequest<ApiInventoryItem[]>('/api/v1/inventory-items/'),
          apiRequest<ApiInventoryTransaction[]>('/api/v1/inventory-transactions/'),
        ]);
        if (cancelled) return;

        const mappedItems = apiItems.map(mapApiItem);
        setItems(mappedItems);
        setTransactions(apiTransactions.map((tx) => mapApiTransaction(tx, mappedItems)));

        const itemDerivedSettings = {
          categories: normalizeOptions(mappedItems.map((item) => item.category)),
          units: normalizeOptions(mappedItems.map((item) => item.unit)),
          suppliers: normalizeOptions(mappedItems.map((item) => item.supplier)),
        };

        if (typeof window !== 'undefined') {
          const storedSettings = window.localStorage.getItem(SETTINGS_KEY);
          const storedPrefs = window.localStorage.getItem(PREF_KEY);
          const storedTemplates = window.localStorage.getItem(CONSUMPTION_TEMPLATES_KEY);

          if (storedSettings) {
            try {
              const parsed = JSON.parse(storedSettings) as Partial<InventoryDropdownSettings>;
              setDropdownSettings({
                categories: normalizeOptions([...(parsed.categories ?? []), ...itemDerivedSettings.categories]),
                units: normalizeOptions([...(parsed.units ?? []), ...itemDerivedSettings.units]),
                suppliers: normalizeOptions([...(parsed.suppliers ?? []), ...itemDerivedSettings.suppliers]),
              });
            } catch {
              setDropdownSettings(itemDerivedSettings);
            }
          } else {
            setDropdownSettings(itemDerivedSettings);
          }

          if (storedPrefs) {
            try {
              const parsed = JSON.parse(storedPrefs) as Partial<InventoryPreferences>;
              setPreferences({ defaultCategory: parsed.defaultCategory?.trim() || 'General' });
            } catch {
              setPreferences({ defaultCategory: 'General' });
            }
          }

          if (storedTemplates) {
            try {
              const parsed = JSON.parse(storedTemplates) as ConsumptionTemplateMap;
              setConsumptionTemplates(parsed && typeof parsed === 'object' ? parsed : {});
            } catch {
              setConsumptionTemplates({});
            }
          }
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setTransactions([]);
        }
      }
    };
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(dropdownSettings));
    window.localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
    window.localStorage.setItem(CONSUMPTION_TEMPLATES_KEY, JSON.stringify(consumptionTemplates));
  }, [dropdownSettings, preferences, consumptionTemplates]);

  const addItem: InventoryState['addItem'] = (item) => {
    const payload = {
      name: item.name.trim(),
      description: item.description?.trim() || null,
      category: item.category?.trim() || 'General',
      sku: `SKU-${Date.now()}`,
      unit: item.unit.trim() || 'pcs',
      quantity: Number(item.quantity || 0).toFixed(2),
      reorder_level: Number(item.minStock || 0).toFixed(2),
      unit_cost: '0.00',
      expiry_date: item.expiryDate || null,
      supplier: item.supplier?.trim() || 'Unknown',
      is_blocked: Boolean(item.isBlocked),
      block_reason: item.blockReason || null,
      is_active: !item.isBlocked,
    };

    void (async () => {
      try {
        const created = await apiRequest<ApiInventoryItem>('/api/v1/inventory-items/', {
          method: 'POST',
          body: payload,
        });
        setItems((prev) => [mapApiItem(created), ...prev]);
      } catch {
        // no-op
      }
    })();
  };

  const syncItemPatch = (id: string, patch: Partial<InventoryItem>) => {
    const current = items.find((entry) => entry.id === id);
    if (!current) return;

    const next = { ...current, ...patch };
    const payload = {
      name: next.name,
      description: next.description || null,
      category: next.category || 'General',
      sku: `SKU-${id}`,
      unit: next.unit,
      quantity: Number(next.quantity || 0).toFixed(2),
      reorder_level: Number(next.minStock || 0).toFixed(2),
      unit_cost: '0.00',
      expiry_date: next.expiryDate || null,
      supplier: next.supplier || 'Unknown',
      is_blocked: Boolean(next.isBlocked),
      block_reason: next.blockReason || null,
      is_active: !next.isBlocked,
    };

    void apiRequest(`/api/v1/inventory-items/${id}/`, {
      method: 'PATCH',
      body: payload,
    }).catch(() => {
      // optimistic update
    });
  };

  const updateItem: InventoryState['updateItem'] = (id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    syncItemPatch(id, patch);
  };

  const updateItemMinStock: InventoryState['updateItemMinStock'] = (id, minStock) => {
    if (!Number.isFinite(minStock) || minStock < 0) return;
    updateItem(id, { minStock });
  };

  const createTransaction = (id: string, delta: number, reason: string, type: TransactionType) => {
    const target = items.find((entry) => entry.id === id);
    if (!target) return;

    setTransactions((prev) => [
      {
        id: `tmp-${Date.now()}-${id}`,
        itemId: id,
        itemName: target.name,
        type,
        quantity: delta,
        date: new Date().toISOString(),
        performedBy: 'System',
      },
      ...prev,
    ]);

    void apiRequest('/api/v1/inventory-transactions/', {
      method: 'POST',
      body: {
        item: Number(id),
        delta: Number(delta).toFixed(2),
        reason,
      },
    }).catch(() => {
      // optimistic update
    });
  };

  const markItemExpired: InventoryState['markItemExpired'] = (id) => {
    const item = items.find((entry) => entry.id === id);
    if (!item || item.isBlocked) return;
    updateItem(id, { isBlocked: true, blockReason: 'Expired' });
    createTransaction(id, -Math.abs(item.quantity), 'Expired item blocked', 'Expired');
  };

  const addStock: InventoryState['addStock'] = (id, quantity) => {
    const target = items.find((entry) => entry.id === id);
    if (!target || target.isBlocked) return;
    updateItem(id, { quantity: target.quantity + quantity });
    createTransaction(id, Math.abs(quantity), 'Stock added', 'Added');
  };

  const consumeItems: InventoryState['consumeItems'] = (entries) => {
    entries.forEach((entry) => {
      const item = items.find((candidate) => candidate.id === entry.id);
      if (!item || item.isBlocked) return;
      const nextQty = Math.max(0, item.quantity - entry.quantity);
      updateItem(entry.id, { quantity: nextQty });
      createTransaction(entry.id, -Math.abs(entry.quantity), 'Inventory consumed', 'Used');
    });
  };

  const addDropdownOption: InventoryState['addDropdownOption'] = (field, value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setDropdownSettings((prev) => {
      const exists = prev[field].some((option) => option.toLowerCase() === trimmed.toLowerCase());
      if (exists) return prev;
      return { ...prev, [field]: normalizeOptions([...prev[field], trimmed]) };
    });
  };

  const removeDropdownOption: InventoryState['removeDropdownOption'] = (field, value) => {
    setDropdownSettings((prev) => ({
      ...prev,
      [field]: prev[field].filter((option) => option !== value),
    }));
  };

  const setDefaultCategory: InventoryState['setDefaultCategory'] = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPreferences({ defaultCategory: trimmed });
    setDropdownSettings((prev) => ({
      ...prev,
      categories: normalizeOptions([...prev.categories, trimmed]),
    }));
  };

  const setConsumptionTemplate: InventoryState['setConsumptionTemplate'] = (testOrScanName, rows) => {
    const key = testOrScanName.trim();
    if (!key) return;
    const normalizedRows = rows
      .map((row) => ({
        itemName: row.itemName.trim(),
        quantity: Number(row.quantity),
      }))
      .filter((row) => row.itemName && Number.isFinite(row.quantity) && row.quantity > 0);

    setConsumptionTemplates((prev) => ({
      ...prev,
      [key]: normalizedRows,
    }));
  };

  const removeConsumptionTemplate: InventoryState['removeConsumptionTemplate'] = (testOrScanName) => {
    const key = testOrScanName.trim();
    if (!key) return;
    setConsumptionTemplates((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const value = useMemo(
    () => ({
      items,
      transactions,
      dropdownSettings,
      preferences,
      consumptionTemplates,
      addItem,
      updateItem,
      updateItemMinStock,
      markItemExpired,
      addStock,
      consumeItems,
      addDropdownOption,
      removeDropdownOption,
      setDefaultCategory,
      setConsumptionTemplate,
      removeConsumptionTemplate,
    }),
    [items, transactions, dropdownSettings, preferences, consumptionTemplates]
  );

  return React.createElement(InventoryContext.Provider, { value }, children);
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}

export type {
  InventoryItem,
  StockTransaction,
  InventoryDropdownField,
  InventoryDropdownSettings,
  InventoryPreferences,
  ConsumptionTemplateMap,
  ConsumptionTemplateRow,
};
