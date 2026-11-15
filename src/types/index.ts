export interface CompanyProfile {
  companyName: string;
  address: string;
  mobiles: string[];
  email?: string;
  website?: string;
  managingPartner: string;
  partner: string;
  partners?: string[];
  partnerEmails?: Record<string, string>;
  partnerAlertsEnabled?: boolean;
  currency: string;
  rmbExchangeRate: number;
  logoUrl?: string;
  minInventoryThresholdKg?: number;
  approachingThresholdPercent?: number;
  minTotalBalanceThreshold?: number;
  documentAlertWindowDays?: number;
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
  status?: ExporterStatus;
  remarks?: string;
  calculationPending?: boolean;
  pendingFields?: string[];
  rawValues?: Record<string, string>;
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
  awbRmbPerBox?: number;
  awbRate?: number;
  rmbAmount?: number;
  settledAmount?: number;
  debitAmount?: number;
  reportAmount?: number;
  creditAmount?: number;
  balanceAmount?: number;
  exporterStatus?: ExporterStatus;
  paymentStatus?: ExporterStatus;
  paymentDate?: string;
  billSite?: string;
  remarks?: string;
  calculationPending?: boolean;
  pendingFields?: string[];
  rawValues?: Record<string, string>;
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
  paymentId?: string;
  invoiceNumber?: string;
  date: string;
  flight: string;
  mark: string;
  box: number;
  weightKg: number;
  rmb: number;
  amount: number;
  debitAmount?: number;
  reportAmount?: number;
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
  reportAmount?: number;
  creditAmount: number;
  balance: number; // reportAmount - creditAmount (or debit - credit for supplier)
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
  reportAmount?: number;
  returnRMB: number;
  returnRMBInBDT?: number;
  exportGoodsRef?: string;
  paymentCategory?: 'supplier' | 'exporter';
  shippingMark?: string;
  remarks?: string;
  calculationPending?: boolean;
  pendingFields?: string[];
  rawValues?: Record<string, string>;
  createdAt: string;
}

export interface OtherCostRecord {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  refInvoice?: string;
  recurringExpenseId?: string;
  recurringYearMonth?: string;
  calculationPending?: boolean;
  pendingFields?: string[];
  rawValues?: Record<string, string>;
  createdAt: string;
}

export interface RecurringExpenseRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  billingDay: number; // 1 - 31
  startYearMonth: string; // YYYY-MM
  lastProcessedYearMonth?: string; // YYYY-MM
  autoDeduct: boolean;
  notes?: string;
  createdAt: string;
}

export type ExternalDebtFrequency = 'monthly' | 'biweekly' | 'weekly' | 'one_time';

export interface ExternalDebtRepayment {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  paymentMethod?: string;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}

export interface ExternalDebtRecord {
  id: string;
  title: string;
  lenderName: string;
  category: string;
  originationDate: string; // YYYY-MM-DD
  principalAmount: number;
  interestAmount: number;
  frequency: ExternalDebtFrequency;
  installmentCount: number;
  firstDueDate: string; // YYYY-MM-DD
  referenceNo?: string;
  notes?: string;
  repayments: ExternalDebtRepayment[];
  createdAt: string;
}

export interface PrivateImportDraft {
  id: string;
  ownerUsername: string;
  dataset: 'purchase' | 'packing' | 'payment' | 'other_cost' | 'all';
  importMode: 'append' | 'replace';
  sourceLabel: string;
  savedAt: string;
  populatedRows: number;
  pendingCount: number;
  records: {
    purchases: Omit<PurchaseRecord, 'id' | 'createdAt'>[];
    packings: Omit<PackingRecord, 'id' | 'createdAt'>[];
    payments: Omit<PaymentRecord, 'id' | 'createdAt'>[];
    otherCosts: Omit<OtherCostRecord, 'id' | 'createdAt'>[];
  };
  errors: string[];
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

export type BusinessDocumentCategory =
  | 'Export License'
  | 'Trade License'
  | 'Quarantine / Health Certificate'
  | 'Airline / Cargo Permit'
  | 'Customs Bond / Insurance'
  | 'Other Compliance Document';

export interface BusinessDocumentRecord {
  id: string;
  title: string;
  category: BusinessDocumentCategory | string;
  referenceNumber?: string;
  issueDate?: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

export interface PartnerDepositRecord {
  id: string;
  date: string;
  partnerName: string;
  amount: number;
  paymentMethod?: string;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}

export interface PartnerWithdrawalRecord {
  id: string;
  date: string;
  partnerName: string;
  amount: number;
  paymentMethod?: string;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}

export interface BalanceIncomeRecord {
  id: string;
  date: string;
  source: string;
  amount: number;
  description: string;
  refInvoice?: string;
  createdAt: string;
}

export interface ProfitDistributionPayoutLine {
  partnerName: string;
  equityPercent: number;
  payoutAmount: number;
}

export interface ProfitDistributionRecord {
  id: string;
  targetYearMonth: string; // YYYY-MM
  payoutDate: string; // YYYY-MM-DD
  calculatedNetProfit: number;
  distributedAmount: number;
  retainedAmount: number;
  paymentMethod?: string;
  referenceNo?: string;
  notes?: string;
  allocations: ProfitDistributionPayoutLine[];
  createdAt: string;
}

export type PartnerAlertEventType = 'partner_withdrawal' | 'profit_distribution';

export interface PartnerNotificationLogRecord {
  id: string;
  eventType: PartnerAlertEventType;
  eventId: string;
  triggeredAt: string;
  subject: string;
  recipients: Array<{ partnerName: string; email: string }>;
  status: 'sending' | 'sent_resend' | 'local_dispatch' | 'failed';
  mode: 'resend_email' | 'local_dispatch' | 'resend_error_fallback' | 'client_error';
  messageId?: string;
  errorDetail?: string;
  amount: number;
  currency: string;
  summaryLine: string;
  previewHtml: string;
  previewText: string;
}

export type AuditLogAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CLEAR'
  | 'IMPORT'
  | 'EXPORT'
  | 'AUTH';

export type AuditLogModule =
  | 'Purchase'
  | 'Packing'
  | 'Payment'
  | 'OtherCost'
  | 'RecurringExpense'
  | 'ExternalDebt'
  | 'PartnerDeposit'
  | 'PartnerWithdrawal'
  | 'ProfitDistribution'
  | 'PartnerNotification'
  | 'BalanceIncome'
  | 'TotalBalance'
  | 'SupplierCredit'
  | 'Mortality'
  | 'BusinessDocument'
  | 'Settings'
  | 'Database'
  | 'Authentication'
  | 'Logistics'
  | 'Administration';

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
  | 'air_way_bill'
  | 'payment_form'
  | 'exporter_payment_form'
  | 'exporter_payment_slip'
  | 'profit_loss'
  | 'total_balance'
  | 'purchase_db'
  | 'packing_db'
  | 'payment_db'
  | 'search_reports'
  | 'audit_logs'
  | 'settings'
  | 'administration'
  | 'forget_password';
