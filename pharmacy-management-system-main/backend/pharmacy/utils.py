import re
from decimal import Decimal

from pharmacy.models import DrugInventory


MEDICATION_SPLIT_RE = re.compile(r'(?:[\r\n,;]+|\s+[+/&|]\s+|\s+/\s+)')
LEADING_INDEX_RE = re.compile(r'^\s*\d+[\).\-\s]+')
NORMALIZE_RE = re.compile(r'[^a-z0-9]+')


def normalize_medicine_key(value):
    return NORMALIZE_RE.sub(' ', str(value or '').casefold()).strip()


def parse_prescription_medications(prescription):
    raw_value = str(getattr(prescription, 'medication', '') or '')
    chunks = [chunk.strip() for chunk in MEDICATION_SPLIT_RE.split(raw_value) if chunk.strip()]
    if not chunks and raw_value.strip():
        chunks = [raw_value.strip()]

    items = []
    for index, chunk in enumerate(chunks):
        medicine_name = LEADING_INDEX_RE.sub('', chunk).strip(' -')
        if not medicine_name:
            continue
        items.append(
            {
                'source_name': medicine_name,
                'medicine_name': medicine_name,
                'dosage': str(getattr(prescription, 'dosage', '') or ''),
                'quantity': 1,
                'notes': str(getattr(prescription, 'instructions', '') or ''),
                'sort_order': index,
            }
        )
    return items


def find_inventory_match(medicine_name, inventory_sku=None):
    if inventory_sku:
        inventory = DrugInventory.objects.filter(sku__iexact=str(inventory_sku).strip()).first()
        if inventory:
            return inventory

    cleaned_name = str(medicine_name or '').strip()
    if not cleaned_name:
        return None

    direct_match = DrugInventory.objects.filter(name__iexact=cleaned_name).order_by('-quantity', '-updated_at').first()
    if direct_match:
        return direct_match

    key = normalize_medicine_key(cleaned_name)
    if not key:
        return None

    inventories = DrugInventory.objects.all().order_by('-quantity', '-updated_at')
    exact_normalized = None
    partial_match = None
    for inventory in inventories:
        inventory_key = normalize_medicine_key(inventory.name)
        if inventory_key == key:
            exact_normalized = inventory
            break
        if key in inventory_key or inventory_key in key:
            partial_match = partial_match or inventory

    return exact_normalized or partial_match


def build_prepared_line(item_data):
    inventory = find_inventory_match(item_data.get('medicine_name'), item_data.get('inventory_sku'))
    quantity = max(1, int(item_data.get('quantity') or 1))
    available_quantity = int(getattr(inventory, 'quantity', 0) or 0)
    in_stock = inventory is not None and available_quantity >= quantity
    unit_price = item_data.get('unit_price')
    if unit_price in [None, ''] and inventory is not None:
        unit_price = inventory.price
    unit_price = Decimal(str(unit_price or 0))
    line_total = unit_price * quantity if in_stock else Decimal('0')
    return {
        'inventory': inventory,
        'inventory_sku': getattr(inventory, 'sku', ''),
        'source_name': str(item_data.get('source_name') or item_data.get('medicine_name') or '').strip(),
        'medicine_name': str(item_data.get('medicine_name') or '').strip(),
        'dosage': str(item_data.get('dosage') or '').strip(),
        'quantity': quantity,
        'available_quantity': available_quantity,
        'unit_price': unit_price,
        'line_total': line_total,
        'in_stock': in_stock,
        'notes': str(item_data.get('notes') or '').strip(),
        'sort_order': int(item_data.get('sort_order') or 0),
    }
