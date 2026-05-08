import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { InputField } from '../../components/InputField';
import { SecondaryButton } from '../../components/Buttons';
import { Section } from '../../components/Section';
import { SegmentedControl } from '../../components/SegmentedControl';
import { StatCard } from '../../components/StatCard';
import { StatusPill } from '../../components/StatusPill';
import { theme } from '../../theme';

type BillingWorkspaceProps = {
  addToCart: (row: any) => void;
  cart: any[];
  cashierName: string;
  coverage: any;
  discountValue: number;
  filteredInvoices: any[];
  handleCheckout: () => void;
  handleInvoiceExportCsv: () => void;
  handleInvoiceMarkPaid: (invoice: any) => void;
  handleInvoicePrint: (invoice: any) => void;
  handleInvoiceRefund: (invoice: any) => void;
  handleInvoiceSave: (invoice: any) => void;
  handleInvoiceSendReminders: () => void;
  handleInvoiceView: (invoice: any) => void;
  handlePrintReceipt: () => void;
  handleRefreshInvoices: () => void;
  handleScanAdd: () => void;
  handleStartNewInvoice: () => void;
  invoiceSearch: string;
  invoiceSummary: any[];
  isTableCardCollapsed: (key: string) => boolean;
  onCashierNameChange: (value: string) => void;
  onInvoiceSearchChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onPosPatientChange: (value: string) => void;
  onPosPatientIdChange: (value: string) => void;
  onPosPatientPhoneChange: (value: string) => void;
  onPosSearchChange: (value: string) => void;
  onReceiptNoChange: (value: string) => void;
  onScanBarcodeChange: (value: string) => void;
  onShiftIdChange: (value: string) => void;
  onVerifyCoverage: () => void;
  paymentMethod: string;
  posInventory: any[];
  posPatient: string;
  posPatientId: string;
  posPatientPhone: string;
  posSearch: string;
  receiptNo: string;
  removeFromCart: (id: string) => void;
  scanBarcode: string;
  selectedInvoice: any;
  shiftId: string;
  styles: any;
  subtotal: number;
  toggleTableCard: (key: string) => void;
  total: number;
  updateCartQty: (id: string, delta: number) => void;
  vat: number;
};

export function BillingWorkspace({
  addToCart,
  cart,
  cashierName,
  coverage,
  discountValue,
  filteredInvoices,
  handleCheckout,
  handleInvoiceExportCsv,
  handleInvoiceMarkPaid,
  handleInvoicePrint,
  handleInvoiceRefund,
  handleInvoiceSave,
  handleInvoiceSendReminders,
  handleInvoiceView,
  handlePrintReceipt,
  handleRefreshInvoices,
  handleScanAdd,
  handleStartNewInvoice,
  invoiceSearch,
  invoiceSummary,
  isTableCardCollapsed,
  onCashierNameChange,
  onInvoiceSearchChange,
  onPaymentMethodChange,
  onPosPatientChange,
  onPosPatientIdChange,
  onPosPatientPhoneChange,
  onPosSearchChange,
  onReceiptNoChange,
  onScanBarcodeChange,
  onShiftIdChange,
  onVerifyCoverage,
  paymentMethod,
  posInventory,
  posPatient,
  posPatientId,
  posPatientPhone,
  posSearch,
  receiptNo,
  removeFromCart,
  scanBarcode,
  selectedInvoice,
  shiftId,
  styles,
  subtotal,
  toggleTableCard,
  total,
  updateCartQty,
  vat,
}: BillingWorkspaceProps) {
  const [mode, setMode] = useState<'Direct Sale' | 'Clinic Prescriptions'>('Direct Sale');

  const directInvoices = useMemo(
    () => filteredInvoices.filter((item: any) => String(item.invoiceType || '').toLowerCase() === 'direct sale'),
    [filteredInvoices]
  );
  const prescriptionInvoices = useMemo(
    () => filteredInvoices.filter((item: any) => String(item.invoiceType || '').toLowerCase() === 'prescription'),
    [filteredInvoices]
  );
  const activeInvoices = mode === 'Direct Sale' ? directInvoices : prescriptionInvoices;
  const cartUnits = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const activeSelectedInvoice =
    selectedInvoice && String(selectedInvoice.invoiceType || '') === mode ? selectedInvoice : selectedInvoice;

  return (
    <>
      <Section title="Invoices" action={<SecondaryButton label="Refresh" onPress={handleRefreshInvoices} />}>
        <View style={styles.row}>
          {invoiceSummary.map((item: any) => (
            <StatCard key={item.label} {...item} variant="white" />
          ))}
        </View>

        <Card variant="soft" style={styles.sectionCard} title="Billing Modes">
          <SegmentedControl options={['Direct Sale', 'Clinic Prescriptions']} value={mode} onChange={(value) => setMode(value as any)} />
          <Text style={localStyles.modeHelp}>
            {mode === 'Direct Sale'
              ? 'Use this mode when the pharmacy sells medicines directly and creates a new invoice on the spot.'
              : 'Use this mode to review invoices generated from clinic prescriptions after the prescription has been prepared.'}
          </Text>
        </Card>

        {mode === 'Direct Sale' ? (
          <>
            <Card variant="soft" style={styles.posHeader} title="Direct Sale Invoice Builder">
              <View style={styles.posHeaderRow}>
                <View style={styles.posHeaderText}>
                  <Text style={styles.posTitle}>Direct Pharmacy Sale</Text>
                  <Text style={localStyles.helperText}>
                    Scan or search medicines, confirm patient details, then generate a direct sale invoice.
                  </Text>
                </View>
                <View style={styles.posHeaderMeta}>
                  <Text style={styles.posMetaLabel}>Receipt</Text>
                  <Text style={styles.posMetaValue}>{receiptNo}</Text>
                  <Text style={styles.posMetaLabel}>Cashier</Text>
                  <Text style={styles.posMetaValue}>{cashierName}</Text>
                </View>
              </View>
            </Card>

            <View style={styles.posGrid}>
              <View style={styles.posColumnPrimary}>
                <Card variant="white" title="Product Search">
                  <InputField label="Barcode" placeholder="Scan barcode" value={scanBarcode} onChangeText={onScanBarcodeChange} />
                  <View style={styles.buttonRow}>
                    <SecondaryButton label="Add Item" onPress={handleScanAdd} />
                  </View>
                  <InputField label="Search Drug" placeholder="Search drug" value={posSearch} onChangeText={onPosSearchChange} />
                </Card>

                <Card
                  variant="white"
                  style={styles.sectionCard}
                  title="Available Medicines"
                  collapsible
                  isCollapsed={isTableCardCollapsed('medicine-list')}
                  onToggleCollapse={() => toggleTableCard('medicine-list')}
                >
                  <DataTable
                    columns={[
                      { key: 'id', label: 'SKU' },
                      { key: 'name', label: 'Drug', wide: true },
                      { key: 'stock', label: 'Stock' },
                      { key: 'price', label: 'Price' },
                      {
                        key: 'action',
                        label: 'Action',
                        render: (row: any) => <SecondaryButton label="Add" onPress={() => addToCart(row)} />,
                      },
                    ]}
                    rows={posInventory}
                  />
                </Card>

                <Card variant="white" style={styles.sectionCard} title="Sale Cart">
                  <DataTable
                    columns={[
                      { key: 'name', label: 'Item', wide: true },
                      { key: 'qty', label: 'Qty' },
                      { key: 'price', label: 'Unit Price' },
                      {
                        key: 'action',
                        label: 'Action',
                        render: (row: any) => (
                          <View style={styles.inlineActions}>
                            <SecondaryButton label="+" onPress={() => updateCartQty(row.id, 1)} />
                            <SecondaryButton label="-" onPress={() => updateCartQty(row.id, -1)} />
                            <SecondaryButton label="Remove" onPress={() => removeFromCart(row.id)} />
                          </View>
                        ),
                      },
                    ]}
                    rows={cart}
                  />
                </Card>
              </View>

              <View style={styles.posColumnSecondary}>
                <Card variant="white" style={styles.sectionCard} title="Invoice Details">
                  <InputField label="Receipt No" placeholder="RCPT-0000" value={receiptNo} onChangeText={onReceiptNoChange} />
                  <InputField label="Cashier" placeholder="Cashier name" value={cashierName} onChangeText={onCashierNameChange} />
                  <InputField label="Shift ID" placeholder="SHIFT-01" value={shiftId} onChangeText={onShiftIdChange} />
                  <InputField label="Patient Name" placeholder="Patient name" value={posPatient} onChangeText={onPosPatientChange} />
                  <InputField label="Patient ID" placeholder="PT-001" value={posPatientId} onChangeText={onPosPatientIdChange} />
                  <InputField label="Phone" placeholder="+20 1X XXX XXXX" value={posPatientPhone} onChangeText={onPosPatientPhoneChange} />
                </Card>

                <Card variant="white" style={styles.sectionCard} title="Coverage and Totals">
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Coverage</Text>
                    <Text style={styles.summaryValue}>{coverage.status}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Provider</Text>
                    <Text style={styles.summaryValue}>{coverage.provider}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Cart Lines</Text>
                    <Text style={styles.summaryValue}>{cart.length}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Units</Text>
                    <Text style={styles.summaryValue}>{cartUnits}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>EGP {subtotal.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>VAT</Text>
                    <Text style={styles.summaryValue}>EGP {vat.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Discount</Text>
                    <Text style={styles.summaryValue}>EGP {discountValue.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total</Text>
                    <Text style={styles.summaryValue}>EGP {total.toFixed(2)}</Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Payment</Text>
                    <SecondaryButton label={paymentMethod} onPress={() => onPaymentMethodChange(paymentMethod === 'Cash' ? 'Card' : 'Cash')} />
                  </View>
                  <View style={styles.buttonRow}>
                    <SecondaryButton label="Verify Coverage" onPress={onVerifyCoverage} />
                    <SecondaryButton label="Generate Invoice" onPress={handleCheckout} />
                    <SecondaryButton label="Print Receipt" onPress={handlePrintReceipt} />
                    <SecondaryButton label="New Sale" onPress={handleStartNewInvoice} />
                  </View>
                </Card>
              </View>
            </View>
          </>
        ) : (
          <Card variant="soft" style={styles.sectionCard} title="Clinic Prescription Billing">
            <Text style={localStyles.helperText}>
              Prescription invoices are created from pharmacy-prepared clinic prescriptions. Review them here, mark them paid when collected, and refund them if needed.
            </Text>
          </Card>
        )}

        <View style={localStyles.registerGrid}>
          <View style={localStyles.registerMain}>
            <Card variant="soft" style={styles.sectionCard} title={`${mode} Register`}>
              <InputField
                label="Search Invoices"
                placeholder={mode === 'Direct Sale' ? 'Search by invoice, patient, or receipt' : 'Search by invoice, patient, or prescription'}
                value={invoiceSearch}
                onChangeText={onInvoiceSearchChange}
              />
              <View style={styles.buttonRow}>
                <SecondaryButton label="Export CSV" onPress={handleInvoiceExportCsv} />
                <SecondaryButton label="Send Reminders" onPress={handleInvoiceSendReminders} />
              </View>
            </Card>

            <Card
              variant="white"
              style={styles.sectionCard}
              title={mode === 'Direct Sale' ? 'Direct Sale Invoices' : 'Prescription Invoices'}
              collapsible
              isCollapsed={isTableCardCollapsed('invoice-table')}
              onToggleCollapse={() => toggleTableCard('invoice-table')}
            >
              <DataTable
                columns={[
                  { key: 'reference', label: 'Invoice' },
                  { key: 'patient', label: 'Patient', wide: true },
                  {
                    key: 'sourceReference',
                    label: mode === 'Direct Sale' ? 'Receipt' : 'Prescription',
                  },
                  { key: 'amount', label: 'Total' },
                  { key: 'date', label: 'Date' },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row: any) => <StatusPill value={row.status} />,
                  },
                  {
                    key: 'action',
                    label: 'Action',
                    render: (row: any) => (
                      <View style={styles.inlineActions}>
                        <SecondaryButton label="View" onPress={() => handleInvoiceView(row)} />
                        {row.status !== 'Paid' && row.status !== 'Refunded' ? (
                          <SecondaryButton label="Mark Paid" onPress={() => handleInvoiceMarkPaid(row)} />
                        ) : null}
                        {row.status === 'Paid' ? (
                          <SecondaryButton label="Refund" onPress={() => handleInvoiceRefund(row)} />
                        ) : null}
                      </View>
                    ),
                  },
                ]}
                rows={activeInvoices}
              />
            </Card>
          </View>

          <View style={localStyles.registerSidebar}>
            <Card variant="white" style={styles.sectionCard} title="Mode Summary">
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Invoices</Text>
                <Text style={styles.summaryValue}>{activeInvoices.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pending</Text>
                <Text style={styles.summaryValue}>
                  {activeInvoices.filter((item: any) => String(item.status || '').toLowerCase() === 'pending').length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Paid</Text>
                <Text style={styles.summaryValue}>
                  {activeInvoices.filter((item: any) => String(item.status || '').toLowerCase() === 'paid').length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Refunded</Text>
                <Text style={styles.summaryValue}>
                  {activeInvoices.filter((item: any) => String(item.status || '').toLowerCase() === 'refunded').length}
                </Text>
              </View>
            </Card>

            {activeSelectedInvoice ? (
              <Card variant="white" style={styles.sectionCard} title="Selected Invoice">
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Invoice</Text>
                  <Text style={styles.summaryValue}>{activeSelectedInvoice.reference}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Type</Text>
                  <Text style={styles.summaryValue}>{activeSelectedInvoice.invoiceType}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Patient</Text>
                  <Text style={styles.summaryValue}>{activeSelectedInvoice.patient}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Source</Text>
                  <Text style={styles.summaryValue}>{activeSelectedInvoice.sourceReference || 'N/A'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>EGP {Number(activeSelectedInvoice.subtotal || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax</Text>
                  <Text style={styles.summaryValue}>EGP {Number(activeSelectedInvoice.taxAmount || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={styles.summaryValue}>EGP {Number(activeSelectedInvoice.discountAmount || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.summaryValue}>EGP {Number(activeSelectedInvoice.amount || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Status</Text>
                  <Text style={styles.summaryValue}>{activeSelectedInvoice.status}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Payment</Text>
                  <Text style={styles.summaryValue}>{activeSelectedInvoice.paymentMethod || 'N/A'}</Text>
                </View>
                <Text style={localStyles.linesTitle}>Line Items</Text>
                {activeSelectedInvoice.lines?.length ? (
                  activeSelectedInvoice.lines.map((line: any) => (
                    <View key={line.id} style={localStyles.lineRow}>
                      <View style={localStyles.lineText}>
                        <Text style={localStyles.lineName}>{line.description}</Text>
                        <Text style={localStyles.lineMeta}>
                          {line.sku || 'N/A'} | {line.quantity} x EGP {Number(line.unitPrice || 0).toFixed(2)}
                        </Text>
                      </View>
                      <Text style={localStyles.lineTotal}>EGP {Number(line.lineTotal || 0).toFixed(2)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noteMeta}>No line items available.</Text>
                )}
                <View style={styles.buttonRow}>
                  <SecondaryButton label="Print" onPress={() => handleInvoicePrint(activeSelectedInvoice)} />
                  <SecondaryButton label="Save" onPress={() => handleInvoiceSave(activeSelectedInvoice)} />
                  {activeSelectedInvoice.status !== 'Paid' && activeSelectedInvoice.status !== 'Refunded' ? (
                    <SecondaryButton label="Mark Paid" onPress={() => handleInvoiceMarkPaid(activeSelectedInvoice)} />
                  ) : null}
                  {activeSelectedInvoice.status === 'Paid' ? (
                    <SecondaryButton label="Refund" onPress={() => handleInvoiceRefund(activeSelectedInvoice)} />
                  ) : null}
                </View>
              </Card>
            ) : (
              <Card variant="white" style={styles.sectionCard} title="Selected Invoice">
                <Text style={styles.noteMeta}>Select an invoice from the register to review its line items and actions.</Text>
              </Card>
            )}
          </View>
        </View>
      </Section>
    </>
  );
}

const localStyles = StyleSheet.create({
  helperText: {
    marginTop: 6,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  modeHelp: {
    marginTop: 10,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  registerGrid: {
    gap: 16,
  },
  registerMain: {
    gap: 16,
  },
  registerSidebar: {
    gap: 16,
  },
  linesTitle: {
    marginTop: 10,
    marginBottom: 8,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
    fontSize: 13,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lineText: {
    flex: 1,
  },
  lineName: {
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  lineMeta: {
    marginTop: 3,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  lineTotal: {
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
    fontSize: 12,
  },
});
