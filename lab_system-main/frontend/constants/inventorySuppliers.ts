export type SupplierContact = {
  key: string;
  name: string;
  email: string;
  phone: string;
  aliases: string[];
};

const CUSTOM_SUPPLIERS_STORAGE_KEY = 'lab_inventory_suppliers_custom';

export const INVENTORY_SUPPLIERS: SupplierContact[] = [
  {
    key: 'biolab',
    name: 'BioLab Egypt',
    email: 'support@biolab.com',
    phone: '010xxxxxxx',
    aliases: ['biolab', 'biolab egypt'],
  },
  {
    key: 'medchem',
    name: 'MedChem Supplies',
    email: 'orders@medchem.com',
    phone: '011xxxxxxx',
    aliases: ['medchem', 'medchem supplies'],
  },
  {
    key: 'cleanmed',
    name: 'CleanMed',
    email: 'orders@cleanmed.com',
    phone: '012xxxxxxx',
    aliases: ['cleanmed'],
  },
];

export function findSupplierContact(supplierName: string) {
  const normalized = supplierName.trim().toLowerCase();
  if (!normalized) return null;

  const staticMatch =
    INVENTORY_SUPPLIERS.find(
      (supplier) =>
        supplier.name.trim().toLowerCase() === normalized ||
        supplier.aliases.some((alias) => alias === normalized)
    ) ?? null;
  if (staticMatch) return staticMatch;

  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(CUSTOM_SUPPLIERS_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Array<{
      name?: string;
      email?: string;
      phone?: string;
    }>;
    if (!Array.isArray(parsed)) return null;

    const custom = parsed.find(
      (supplier) => supplier.name?.trim().toLowerCase() === normalized
    );
    if (!custom) return null;

    return {
      key: `custom-${normalized}`,
      name: custom.name?.trim() || supplierName.trim(),
      email: custom.email?.trim() || '',
      phone: custom.phone?.trim() || '',
      aliases: [normalized],
    };
  } catch {
    return null;
  }
}
