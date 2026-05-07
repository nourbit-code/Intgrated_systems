import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '@/utils/api';

type PaymentStatus = 'Pending' | 'Paid';

type InventoryPurchaseOrder = {
  id: string;
  requestRef: string;
  requestedAt: string;
  itemId: string;
  itemName: string;
  category: string;
  supplier: string;
  supplierEmail: string;
  qtyToOrder: number;
  qtyType: string;
  status: 'Requested' | 'Received';
  receivedAt?: string;
  receivedQty?: number;
  unitCost?: number;
  totalCost?: number;
  paymentMethod?: string;
  paymentStatus: PaymentStatus;
};

type AddPurchaseOrderInput = {
  requestRef: string;
  requestedAt: string;
  itemId: string;
  itemName: string;
  category: string;
  supplier: string;
  supplierEmail: string;
  qtyToOrder: number;
  qtyType: string;
};

type ReceivePurchaseOrderInput = {
  receivedQty: number;
  unitCost: number;
  paymentMethod: string;
};

type InventoryPurchaseOrdersState = {
  purchaseOrders: InventoryPurchaseOrder[];
  addPurchaseOrder: (input: AddPurchaseOrderInput) => string;
  receivePurchaseOrder: (id: string, input: ReceivePurchaseOrderInput) => void;
};

type ApiPurchaseOrder = {
  id: number;
  request_ref: string;
  requested_at: string;
  item: number | null;
  item_name: string;
  category: string | null;
  supplier: string;
  supplier_email: string | null;
  qty_to_order: string;
  qty_type: string;
  status: 'requested' | 'received';
  received_at: string | null;
  received_qty: string | null;
  unit_cost: string | null;
  total_cost: string | null;
  payment_method: string | null;
  payment_status: 'pending' | 'paid';
};

const InventoryPurchaseOrdersContext = createContext<InventoryPurchaseOrdersState | undefined>(undefined);

function mapApiOrder(order: ApiPurchaseOrder): InventoryPurchaseOrder {
  return {
    id: String(order.id),
    requestRef: order.request_ref,
    requestedAt: order.requested_at,
    itemId: order.item ? String(order.item) : '',
    itemName: order.item_name,
    category: order.category ?? '',
    supplier: order.supplier,
    supplierEmail: order.supplier_email ?? '',
    qtyToOrder: Number(order.qty_to_order ?? 0),
    qtyType: order.qty_type,
    status: order.status === 'received' ? 'Received' : 'Requested',
    receivedAt: order.received_at ?? undefined,
    receivedQty: order.received_qty ? Number(order.received_qty) : undefined,
    unitCost: order.unit_cost ? Number(order.unit_cost) : undefined,
    totalCost: order.total_cost ? Number(order.total_cost) : undefined,
    paymentMethod: order.payment_method ?? undefined,
    paymentStatus: order.payment_status === 'paid' ? 'Paid' : 'Pending',
  };
}

export function InventoryPurchaseOrdersProvider({ children }: PropsWithChildren) {
  const [purchaseOrders, setPurchaseOrders] = useState<InventoryPurchaseOrder[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await apiRequest<ApiPurchaseOrder[]>('/api/v1/inventory-purchase-orders/');
        if (!cancelled) {
          setPurchaseOrders(rows.map(mapApiOrder));
        }
      } catch {
        if (!cancelled) {
          setPurchaseOrders([]);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const addPurchaseOrder: InventoryPurchaseOrdersState['addPurchaseOrder'] = (input) => {
    const tempId = `temp-${Date.now()}`;
    setPurchaseOrders((prev) => [
      {
        id: tempId,
        requestRef: input.requestRef,
        requestedAt: input.requestedAt,
        itemId: input.itemId,
        itemName: input.itemName,
        category: input.category,
        supplier: input.supplier,
        supplierEmail: input.supplierEmail,
        qtyToOrder: input.qtyToOrder,
        qtyType: input.qtyType,
        status: 'Requested',
        paymentStatus: 'Pending',
      },
      ...prev,
    ]);

    void (async () => {
      try {
        const created = await apiRequest<ApiPurchaseOrder>('/api/v1/inventory-purchase-orders/', {
          method: 'POST',
          body: {
            request_ref: input.requestRef,
            requested_at: input.requestedAt.includes('T')
              ? input.requestedAt
              : `${input.requestedAt}T00:00:00Z`,
            item: input.itemId ? Number(input.itemId) : null,
            item_name: input.itemName,
            category: input.category || null,
            supplier: input.supplier,
            supplier_email: input.supplierEmail || null,
            qty_to_order: Number(input.qtyToOrder).toFixed(2),
            qty_type: input.qtyType,
            status: 'requested',
            payment_status: 'pending',
          },
        });
        setPurchaseOrders((prev) =>
          prev.map((order) => (order.id === tempId ? mapApiOrder(created) : order))
        );
      } catch {
        setPurchaseOrders((prev) => prev.filter((order) => order.id !== tempId));
      }
    })();

    return tempId;
  };

  const receivePurchaseOrder: InventoryPurchaseOrdersState['receivePurchaseOrder'] = (id, input) => {
    const totalCost = Number((input.receivedQty * input.unitCost).toFixed(2));
    setPurchaseOrders((prev) =>
      prev.map((order) =>
        order.id === id
          ? {
              ...order,
              status: 'Received',
              receivedAt: new Date().toISOString(),
              receivedQty: input.receivedQty,
              unitCost: input.unitCost,
              totalCost,
              paymentMethod: input.paymentMethod,
              paymentStatus: 'Paid',
            }
          : order
      )
    );

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;
    void apiRequest(`/api/v1/inventory-purchase-orders/${numericId}/`, {
      method: 'PATCH',
      body: {
        status: 'received',
        received_at: new Date().toISOString(),
        received_qty: Number(input.receivedQty).toFixed(2),
        unit_cost: Number(input.unitCost).toFixed(2),
        total_cost: totalCost.toFixed(2),
        payment_method: input.paymentMethod,
        payment_status: 'paid',
      },
    }).catch(() => {
      // optimistic update
    });
  };

  const value = useMemo(
    () => ({
      purchaseOrders,
      addPurchaseOrder,
      receivePurchaseOrder,
    }),
    [purchaseOrders]
  );

  return React.createElement(InventoryPurchaseOrdersContext.Provider, { value }, children);
}

export function useInventoryPurchaseOrders() {
  const context = useContext(InventoryPurchaseOrdersContext);
  if (!context) {
    throw new Error('useInventoryPurchaseOrders must be used within InventoryPurchaseOrdersProvider');
  }
  return context;
}

export type { InventoryPurchaseOrder, AddPurchaseOrderInput, ReceivePurchaseOrderInput, PaymentStatus };
