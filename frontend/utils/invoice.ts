// Invoice PDF generation temporarily disabled to avoid build issues.

export type InvoiceTest = {
  name: string;
  price: number;
  sample?: string;
};

export type InvoicePayload = {
  invoiceId: string;
  orderId: string;
  date: string;
  patientName: string;
  tests: InvoiceTest[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  paymentMethod?: string;
  notes?: string;
  logoDataUrl?: string;
  barcodeDataUrl?: string;
  clinicName?: string;
};

export function downloadInvoicePdf(_payload: InvoicePayload) {
  // Intentionally no-op. This keeps the app stable while PDF is disabled.
  if (typeof console !== "undefined") {
    console.warn("Invoice PDF export is currently disabled.");
  }
}
