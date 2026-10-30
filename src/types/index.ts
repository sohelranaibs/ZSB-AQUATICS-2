export interface CompanyProfile {
  companyName: string;
  address: string;
  mobiles: string[];
  email?: string;
  managingPartner: string;
  partner: string;
  currency: string;
  rmbExchangeRate: number;
  logoUrl?: string;
  minInventoryThresholdKg?: number;
  approachingThresholdPercent?: number;
}

export interface DropdownOptions {
  purchaseItems: string[];
  suppliers: string[];
  shippingMarks: string[];
  flights: string[];
  destinations: string[];
  shippers: string[];
  exportItems: string[];
  boxes: string[];
  weights: string[];
  units: string[];
  paymentDescriptions: string[];
  paymentStatuses: string[];
  costingCategories: string[];
}

export interface PurchaseItemRow {
  id: string;
  item: string;
  quantity: number;
  rate: number;
  totalAmount: number;
  previousAmount: number;
  paidAmount: number;
  balance: number;
}

export interface PurchaseRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  description: string; // Supplier name
  contactNumber: string;
  items: PurchaseItemRow[];
  totalQty: number;
  totalAmount: number;
  previousAmount: number;
  paidAmount: number;
  balance: number;
  remarks?: string;
  createdAt: string;
}

export interface PackingItemRow {
  id: string;
  item: string;
  box: number;
  weight: number;
  totalWeight: number; // box * weight
  unit: string;
  rate: number;
  amount: number; // totalWeight * rate
}

export interface PackingRecord {
  id: string;
  invoiceNumber: string;
  shippingMark: string;
  flight: string;
  destination: string;
  shipper: string;
  packingDate: string;
  fromDate: string;
  toDate: string;
  items: PackingItemRow[];
  totalBox: number;
  totalWeight: number;
  totalAmount: number;
  rmbRate?: number;
  totalAmountBDT?: number;
  rmbAmount?: number;
  settledAmount?: number;
  debitAmount?: number;
  creditAmount?: number;
  balanceAmount?: number;
  exporterStatus?: ExporterStatus;
  paymentStatus?: ExporterStatus;
  paymentDate?: string;
  billSite?: string;
  remarks?: string;
  createdAt: string;
}

export interface PackingFormDraft {
  invoiceNumber: string;
  packingDate: string;
  shippingMark: string;
  flight: string;
  destination: string;
  shipper: string;
  paymentStatus: ExporterStatus;
  customRmbAmount: string;
  remarks: string;
  rows: PackingItemRow[];
}

export interface ExporterPaymentSlipRow {
  id: string;
  packingId?: string;
  invoiceNumber?: string;
  date: string;
  flight: string;
  mark: string;
  box: number;
  weightKg: number;
  rmb: number;
  amount: number;
  debitAmount?: number;
  creditAmount?: number;
  balance?: number;
  status: ExporterStatus;
  destination?: string;
  shipper?: string;
  isDraft?: boolean;
  isCustom?: boolean;
}

export interface PaymentItemRow {
  id: string;
  packingId?: string;
  paymentId?: string;
  invoiceNumber?: string;
  date?: string;
  shippingMark?: string;
  flight?: string;
  box?: number;
  weightKg?: number;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number; // debit - credit
  status?: ExporterStatus;
}

export type ExporterStatus = 'PAID' | 'UNPAID' | 'NO REPORT' | 'REPORT' | string;

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export interface PaymentRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  description: string;
  contactNumber: string;
  items: PaymentItemRow[];
  totalAmount: number;
  previousAmount: number;
  paidAmount: number;
  balance: number;
  status: ExporterStatus;
  returnRMB: number;
  returnRMBInBDT?: number;
  exportGoodsRef?: string;
  paymentCategory?: 'supplier' | 'exporter';
  shippingMark?: string;
  remarks?: string;
  createdAt: string;
}

export interface OtherCostRecord {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  refInvoice?: string;
  createdAt: string;
}

export type SupplierCreditReason =
  | 'Weight Shortage / Shrinkage'
  | 'Mortality / DOA Claim'
  | 'Grade / Quality Discount'
  | 'Overcharge Adjustment'
  | 'Volume Rebate / Loyalty Credit'
  | 'Returned Consignment'
  | 'Other Credit Note'
  | string;

export type SupplierCreditStatus = 'AVAILABLE' | 'PARTIAL' | 'APPLIED';

export interface SupplierCreditApplication {
  id: string;
  date: string;
  amount: number;
  targetPaymentInvoice?: string;
  targetPurchaseInvoice?: string;
  notes?: string;
}

export interface SupplierCreditRecord {
  id: string;
  creditNoteNumber: string;
  date: string;
  supplierName: string;
  refPurchaseInvoice?: string;
  reason: SupplierCreditReason;
  amount: number;
  appliedAmount: number;
  remainingAmount: number;
  status: SupplierCreditStatus;
  applications: SupplierCreditApplication[];
  remarks?: string;
  createdAt: string;
}

export interface MortalityRecord {
  id: string;
  species: string; // Species or grade code (e.g. F1, FF1, KS/3, Eel Fish)
  quantityKg: number;
  date: string; // YYYY-MM-DD
  cause?: string; // e.g. 'Transit Stress', 'Tank Acclimation', 'DOA Claim', 'Water Quality'
  notes?: string;
  createdAt: string;
}

export type AuditLogAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CLEAR'
  | 'IMPORT'
  | 'AUTH';

export type AuditLogModule =
  | 'Purchase'
  | 'Packing'
  | 'Payment'
  | 'OtherCost'
  | 'SupplierCredit'
  | 'Mortality'
  | 'Settings'
  | 'Database'
  | 'Authentication';

export interface AuditLogRecord {
  id: string;
  timestamp: string; // ISO 8601 timestamp
  action: AuditLogAction;
  module: AuditLogModule;
  entityId?: string; // e.g., INV-2026-0001, PKG-2026-0001
  summary: string;
  details?: string;
  actor: string;
}

export interface AuthUser {
  username: string;
  displayName: string;
  role: string;
  email: string;
  loginAt: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'purchase_form'
  | 'packing_form'
  | 'payment_form'
  | 'exporter_payment_form'
  | 'exporter_payment_slip'
  | 'profit_loss'
  | 'purchase_db'
  | 'packing_db'
  | 'payment_db'
  | 'search_reports'
  | 'audit_logs'
  | 'settings';
