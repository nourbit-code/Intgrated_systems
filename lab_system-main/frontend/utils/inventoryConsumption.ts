import type { InventoryItem } from '@/hooks/useInventory';
import type { OrderTest } from '@/hooks/useOrders';

export type ConsumptionTemplateRow = {
  itemName: string;
  quantity: number;
};

export type ConsumptionTemplateMap = Record<string, ConsumptionTemplateRow[]>;

export type ConsumptionShortage = {
  itemName: string;
  required: number;
  available: number;
  missing: number;
};

export type ConsumptionAllocation = {
  entries: { id: string; quantity: number }[];
  shortages: ConsumptionShortage[];
};

export const CONSUMPTION_DRAFT_KEY = 'lab_order_consumption_draft';
export const CONSUMPTION_APPLIED_KEY = 'lab_order_consumption_applied';

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isUsableItem(item: InventoryItem) {
  if (item.isBlocked) return false;
  return new Date(item.expiryDate) >= new Date();
}

function pickTemplateRows(test: OrderTest, templates: ConsumptionTemplateMap) {
  const byName = templates[test.name];
  if (Array.isArray(byName) && byName.length) return byName;
  const byId = templates[test.id];
  if (Array.isArray(byId) && byId.length) return byId;

  const targetName = normalize(test.name);
  const targetId = normalize(test.id);
  const matchedKey = Object.keys(templates).find((key) => {
    const normalized = normalize(key);
    return normalized === targetName || normalized === targetId;
  });
  if (!matchedKey) return [];
  return templates[matchedKey] ?? [];
}

export function buildConsumptionRowsFromTests(
  tests: OrderTest[],
  templates: ConsumptionTemplateMap
) {
  const rows = new Map<string, ConsumptionTemplateRow>();

  tests.forEach((test) => {
    const templateRows = pickTemplateRows(test, templates);
    templateRows.forEach((row) => {
      const name = row.itemName.trim();
      const quantity = Number(row.quantity);
      if (!name || !Number.isFinite(quantity) || quantity <= 0) return;
      const key = normalize(name);
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, { itemName: name, quantity });
        return;
      }
      rows.set(key, { itemName: existing.itemName, quantity: existing.quantity + quantity });
    });
  });

  return Array.from(rows.values());
}

export function getAvailableQuantity(itemName: string, items: InventoryItem[]) {
  const key = normalize(itemName);
  return items.reduce((sum, item) => {
    if (normalize(item.name) !== key) return sum;
    if (!isUsableItem(item)) return sum;
    return sum + item.quantity;
  }, 0);
}

export function allocateConsumption(
  rows: ConsumptionTemplateRow[],
  items: InventoryItem[]
): ConsumptionAllocation {
  const entries: { id: string; quantity: number }[] = [];
  const shortages: ConsumptionShortage[] = [];

  rows.forEach((row) => {
    const itemName = row.itemName.trim();
    const required = Number(row.quantity);
    if (!itemName || !Number.isFinite(required) || required <= 0) return;

    const matchKey = normalize(itemName);
    const candidates = items
      .filter((item) => normalize(item.name) === matchKey && isUsableItem(item))
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    let remaining = required;
    let available = 0;

    candidates.forEach((item) => {
      available += item.quantity;
      if (remaining <= 0) return;
      const take = Math.min(item.quantity, remaining);
      if (take <= 0) return;
      entries.push({ id: item.id, quantity: take });
      remaining -= take;
    });

    if (remaining > 0) {
      shortages.push({
        itemName,
        required,
        available,
        missing: remaining,
      });
    }
  });

  return { entries, shortages };
}

export function readOrderConsumptionDraft(orderId: string) {
  if (typeof window === 'undefined' || !orderId) return [] as ConsumptionTemplateRow[];
  try {
    const raw = window.localStorage.getItem(CONSUMPTION_DRAFT_KEY);
    if (!raw) return [] as ConsumptionTemplateRow[];
    const parsed = JSON.parse(raw) as Record<string, ConsumptionTemplateRow[]>;
    return parsed[orderId] ?? [];
  } catch {
    return [] as ConsumptionTemplateRow[];
  }
}

export function writeOrderConsumptionDraft(orderId: string, rows: ConsumptionTemplateRow[]) {
  if (typeof window === 'undefined' || !orderId) return;
  try {
    const raw = window.localStorage.getItem(CONSUMPTION_DRAFT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ConsumptionTemplateRow[]>) : {};
    parsed[orderId] = rows;
    window.localStorage.setItem(CONSUMPTION_DRAFT_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function wasOrderConsumptionApplied(orderId: string) {
  if (typeof window === 'undefined' || !orderId) return false;
  try {
    const raw = window.localStorage.getItem(CONSUMPTION_APPLIED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return Boolean(parsed[orderId]);
  } catch {
    return false;
  }
}

export function markOrderConsumptionApplied(orderId: string) {
  if (typeof window === 'undefined' || !orderId) return;
  try {
    const raw = window.localStorage.getItem(CONSUMPTION_APPLIED_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[orderId] = true;
    window.localStorage.setItem(CONSUMPTION_APPLIED_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}
