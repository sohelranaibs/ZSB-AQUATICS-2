export interface CompanyProfile {
  companyName: string;
  address: string;
  mobiles: string[];
  managingPartner: string;
  partner: string;
  currency: string;
  rmbExchangeRate: number;
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
  status: ExporterStatus;
  destination?: string;
  shipper?: string;
  isDraft?: boolean;
  isCustom?: boolean;
}

export interface PaymentItemRow {
  id: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number; // debit - credit
}

export type ExporterStatus = 'NO REPORT' | 'REPORT' | 'PAID' | string;

export interface PaymentRecord {
  id: string;
  invoiceNumber: string;
  date: string;
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
  | 'settings';
