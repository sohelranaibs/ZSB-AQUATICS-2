import { PackingItemRow, PaymentItemRow, PurchaseItemRow } from '../types/index.ts';
import {
  calculatePackingRow,
  calculatePaymentRow,
  calculatePurchaseRowTotal,
} from './calculations.ts';

export const FORM_DRAFT_STORAGE_KEYS = {
  PURCHASE_FORM: 'zsb_purchase_form_draft_v1',
  PACKING_FORM: 'zsb_packing_form_draft_v1',
  PAYMENT_FORM: 'zsb_payment_form_draft_v1',
  EXPORTER_PAYMENT_FORM: 'zsb_exporter_payment_form_draft_v1',
  PROFIT_LOSS_FORM: 'zsb_profit_loss_form_draft_v1',
  TOTAL_BALANCE_FORM: 'zsb_total_balance_form_draft_v1',
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function saveFormDraftJson(
  key: string,
  serializedJson: string,
  storage?: StorageLike
): boolean {
  const target = getDefaultStorage(storage);
  if (!target) return false;
  try {
    target.setItem(key, serializedJson);
    return true;
  } catch {
    return false;
  }
}

export function saveFormDraft<T>(
  key: string,
  payload: T,
  storage?: StorageLike
): boolean {
  try {
    return saveFormDraftJson(key, JSON.stringify(payload), storage);
  } catch {
    return false;
  }
}

export function loadFormDraft<T>(
  key: string,
  sanitize: (raw: unknown) => T | null,
  storage?: StorageLike
): T | null {
  const target = getDefaultStorage(storage);
  if (!target) return null;
  try {
    const rawText = target.getItem(key);
    if (!rawText) return null;
    const parsed: unknown = JSON.parse(rawText);
    return sanitize(parsed);
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string, storage?: StorageLike): void {
  const target = getDefaultStorage(storage);
  if (!target) return;
  try {
    target.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

export function clearAllFormDrafts(storage?: StorageLike): void {
  Object.values(FORM_DRAFT_STORAGE_KEYS).forEach((key) => {
    clearFormDraft(key, storage);
  });
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function toSafeString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function toSafeNumber(val: unknown, fallback = 0): number {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export interface PurchaseFormDraftData {
  invoiceNumber: string;
  date: string;
  description: string;
  contactNumber: string;
  remarks: string;
  overallPreviousAmount: number;
  overallPaidAmount: number;
  rows: PurchaseItemRow[];
}

export function sanitizePurchaseFormDraft(
  raw: unknown
): PurchaseFormDraftData | null {
  if (!isRecord(raw)) return null;

  const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  const rows: PurchaseItemRow[] = rawRows
    .filter(isRecord)
    .map((r, idx) => {
      const quantity = toSafeNumber(r.quantity, 0);
      const rate = toSafeNumber(r.rate, 0);
      return {
        id: toSafeString(r.id, String(idx + 1)),
        item: toSafeString(r.item, ''),
        quantity,
        rate,
        totalAmount: calculatePurchaseRowTotal(quantity, rate),
        previousAmount: toSafeNumber(r.previousAmount, 0),
        paidAmount: toSafeNumber(r.paidAmount, 0),
        balance: toSafeNumber(r.balance, 0),
      };
    });

  return {
    invoiceNumber: toSafeString(raw.invoiceNumber, ''),
    date: toSafeString(raw.date, ''),
    description: toSafeString(raw.description, ''),
    contactNumber: toSafeString(raw.contactNumber, ''),
    remarks: toSafeString(raw.remarks, ''),
    overallPreviousAmount: toSafeNumber(raw.overallPreviousAmount, 0),
    overallPaidAmount: toSafeNumber(raw.overallPaidAmount, 0),
    rows,
  };
}

export function hasMeaningfulPurchaseDraft(
  draft: PurchaseFormDraftData | null | undefined
): boolean {
  if (!draft) return false;
  if (
    draft.description.trim() !== '' ||
    draft.contactNumber.trim() !== '' ||
    draft.remarks.trim() !== '' ||
    draft.overallPreviousAmount !== 0 ||
    draft.overallPaidAmount !== 0
  ) {
    return true;
  }
  return draft.rows.some(
    (r) => r.item.trim() !== '' || r.quantity !== 0 || r.rate !== 0
  );
}

export interface PackingFormDraftData {
  invoiceNumber: string;
  packingDate: string;
  shippingMark: string;
  flight: string;
  destination: string;
  shipper: string;
  paymentStatus: 'PAID' | 'UNPAID';
  remarks: string;
  customRmbAmount: string;
  rows: PackingItemRow[];
}

export function sanitizePackingFormDraft(
  raw: unknown
): PackingFormDraftData | null {
  if (!isRecord(raw)) return null;

  const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  const rows: PackingItemRow[] = rawRows
    .filter(isRecord)
    .map((r, idx) => {
      const box = toSafeNumber(r.box, 0);
      const weight = toSafeNumber(r.weight, 0);
      const rate = toSafeNumber(r.rate, 0);
      const reportWeight = toSafeNumber(r.reportWeight, 0);
      const calcs = calculatePackingRow(box, weight, rate, reportWeight);
      return {
        id: toSafeString(r.id, String(idx + 1)),
        item: toSafeString(r.item, ''),
        box,
        weight,
        reportWeight,
        totalWeight: calcs.totalWeight,
        unit: toSafeString(r.unit, 'KG'),
        rate,
        amount: calcs.amount,
      };
    });

  const paymentStatus = raw.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID';

  return {
    invoiceNumber: toSafeString(raw.invoiceNumber, ''),
    packingDate: toSafeString(raw.packingDate, ''),
    shippingMark: toSafeString(raw.shippingMark, ''),
    flight: toSafeString(raw.flight, ''),
    destination: toSafeString(raw.destination, ''),
    shipper: toSafeString(raw.shipper, ''),
    paymentStatus,
    remarks: toSafeString(raw.remarks, ''),
    customRmbAmount: toSafeString(raw.customRmbAmount, ''),
    rows,
  };
}

export function hasMeaningfulPackingDraft(
  draft: PackingFormDraftData | null | undefined
): boolean {
  if (!draft) return false;
  if (
    draft.shippingMark.trim() !== '' ||
    draft.flight.trim() !== '' ||
    draft.destination.trim() !== '' ||
    draft.shipper.trim() !== '' ||
    draft.remarks.trim() !== '' ||
    draft.customRmbAmount.trim() !== '' ||
    draft.paymentStatus === 'PAID'
  ) {
    return true;
  }
  return draft.rows.some(
    (r) =>
      r.item.trim() !== '' ||
      r.box !== 0 ||
      r.weight !== 0 ||
      (Number(r.reportWeight) || 0) !== 0 ||
      r.rate !== 0
  );
}

export interface PaymentFormDraftData {
  invoiceNumber: string;
  date: string;
  supplierName: string;
  creditAmount: string;
  paymentMode: string;
  refPurchaseInvoice: string;
  remarks: string;
  voucherStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  contactNumber: string;
}

export function sanitizePaymentFormDraft(
  raw: unknown
): PaymentFormDraftData | null {
  if (!isRecord(raw)) return null;
  const rawStatus = toSafeString(raw.voucherStatus, 'PAID');
  const voucherStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
    rawStatus === 'PARTIAL' || rawStatus === 'UNPAID' ? rawStatus : 'PAID';

  return {
    invoiceNumber: toSafeString(raw.invoiceNumber, ''),
    date: toSafeString(raw.date, ''),
    supplierName: toSafeString(raw.supplierName, ''),
    creditAmount: toSafeString(raw.creditAmount, ''),
    paymentMode: toSafeString(raw.paymentMode, 'Cash'),
    refPurchaseInvoice: toSafeString(raw.refPurchaseInvoice, ''),
    remarks: toSafeString(raw.remarks, ''),
    voucherStatus,
    contactNumber: toSafeString(raw.contactNumber, ''),
  };
}

export function hasMeaningfulPaymentDraft(
  draft: PaymentFormDraftData | null | undefined
): boolean {
  if (!draft) return false;
  return (
    draft.supplierName.trim() !== '' ||
    draft.creditAmount.trim() !== '' ||
    draft.refPurchaseInvoice.trim() !== '' ||
    draft.remarks.trim() !== '' ||
    draft.contactNumber.trim() !== ''
  );
}

export interface ExporterPaymentFormDraftData {
  invoiceNumber: string;
  date: string;
  shippingMark: string;
  selectedPackingDate: string;
  fromDate: string;
  toDate: string;
  selectedStatusFilter: string;
  contactNumber: string;
  exporterStatus: string;
  returnRMB: number;
  exportGoodsRef: string;
  remarks: string;
  overallPreviousAmount: number;
  overallReportAmount: number;
  overallPaidAmount: number;
  customRows: PaymentItemRow[];
  rowDescriptionOverrides: Record<string, string>;
}

export function sanitizeExporterPaymentFormDraft(
  raw: unknown
): ExporterPaymentFormDraftData | null {
  if (!isRecord(raw)) return null;

  const rawCustomRows = Array.isArray(raw.customRows) ? raw.customRows : [];
  const customRows: PaymentItemRow[] = rawCustomRows
    .filter(isRecord)
    .map((r, idx) => {
      const debitAmount = toSafeNumber(r.debitAmount, 0);
      const reportAmount = toSafeNumber(r.reportAmount, 0);
      const creditAmount = toSafeNumber(r.creditAmount, 0);
      return {
        id: toSafeString(r.id, `exp-draft-${idx + 1}`),
        date: toSafeString(r.date, ''),
        shippingMark: toSafeString(r.shippingMark, ''),
        description: toSafeString(r.description, ''),
        debitAmount,
        reportAmount,
        creditAmount,
        balance: calculatePaymentRow(reportAmount, creditAmount),
        status: toSafeString(r.status, 'UNPAID'),
      };
    });

  const rawOverrides = isRecord(raw.rowDescriptionOverrides)
    ? raw.rowDescriptionOverrides
    : {};
  const rowDescriptionOverrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawOverrides)) {
    if (typeof v === 'string') {
      rowDescriptionOverrides[k] = v;
    }
  }

  return {
    invoiceNumber: toSafeString(raw.invoiceNumber, ''),
    date: toSafeString(raw.date, ''),
    shippingMark: toSafeString(raw.shippingMark, 'ALL'),
    selectedPackingDate: toSafeString(raw.selectedPackingDate, 'ALL'),
    fromDate: toSafeString(raw.fromDate, ''),
    toDate: toSafeString(raw.toDate, ''),
    selectedStatusFilter: toSafeString(raw.selectedStatusFilter, 'ALL'),
    contactNumber: toSafeString(raw.contactNumber, ''),
    exporterStatus: toSafeString(raw.exporterStatus, 'UNPAID'),
    returnRMB: toSafeNumber(raw.returnRMB, 0),
    exportGoodsRef: toSafeString(raw.exportGoodsRef, ''),
    remarks: toSafeString(raw.remarks, ''),
    overallPreviousAmount: toSafeNumber(raw.overallPreviousAmount, 0),
    overallReportAmount: toSafeNumber(raw.overallReportAmount, 0),
    overallPaidAmount: toSafeNumber(raw.overallPaidAmount, 0),
    customRows,
    rowDescriptionOverrides,
  };
}

export interface ProfitLossFormDraftData {
  newCategory: string;
  newCostDate: string;
  newAmount: string;
  newDesc: string;
  newRef: string;
  creditSupplier: string;
  creditAmount: string;
  creditReason: string;
  creditRefInvoice: string;
  creditDate: string;
  creditRemarks: string;
}

export function sanitizeProfitLossFormDraft(
  raw: unknown
): ProfitLossFormDraftData | null {
  if (!isRecord(raw)) return null;
  return {
    newCategory: toSafeString(raw.newCategory, ''),
    newCostDate: toSafeString(raw.newCostDate, ''),
    newAmount: toSafeString(raw.newAmount, ''),
    newDesc: toSafeString(raw.newDesc, ''),
    newRef: toSafeString(raw.newRef, ''),
    creditSupplier: toSafeString(raw.creditSupplier, ''),
    creditAmount: toSafeString(raw.creditAmount, ''),
    creditReason: toSafeString(raw.creditReason, ''),
    creditRefInvoice: toSafeString(raw.creditRefInvoice, ''),
    creditDate: toSafeString(raw.creditDate, ''),
    creditRemarks: toSafeString(raw.creditRemarks, ''),
  };
}

export interface TotalBalanceFormDraftData {
  depositDate: string;
  partnerName: string;
  depositAmount: string;
  paymentMethod: string;
  depositRef: string;
  depositNotes: string;
  withdrawalDate: string;
  withdrawalPartnerName: string;
  withdrawalAmount: string;
  withdrawalMethod: string;
  withdrawalRef: string;
  withdrawalNotes: string;
  entryMode: 'cost' | 'income';
  entryDate: string;
  costCategory: string;
  incomeSource: string;
  entryAmount: string;
  entryRef: string;
  entryDescription: string;
}

export function sanitizeTotalBalanceFormDraft(
  raw: unknown
): TotalBalanceFormDraftData | null {
  if (!isRecord(raw)) return null;
  return {
    depositDate: toSafeString(raw.depositDate, ''),
    partnerName: toSafeString(raw.partnerName, ''),
    depositAmount: toSafeString(raw.depositAmount, ''),
    paymentMethod: toSafeString(raw.paymentMethod, ''),
    depositRef: toSafeString(raw.depositRef, ''),
    depositNotes: toSafeString(raw.depositNotes, ''),
    withdrawalDate: toSafeString(raw.withdrawalDate, ''),
    withdrawalPartnerName: toSafeString(raw.withdrawalPartnerName, ''),
    withdrawalAmount: toSafeString(raw.withdrawalAmount, ''),
    withdrawalMethod: toSafeString(raw.withdrawalMethod, ''),
    withdrawalRef: toSafeString(raw.withdrawalRef, ''),
    withdrawalNotes: toSafeString(raw.withdrawalNotes, ''),
    entryMode: raw.entryMode === 'income' ? 'income' : 'cost',
    entryDate: toSafeString(raw.entryDate, ''),
    costCategory: toSafeString(raw.costCategory, ''),
    incomeSource: toSafeString(raw.incomeSource, ''),
    entryAmount: toSafeString(raw.entryAmount, ''),
    entryRef: toSafeString(raw.entryRef, ''),
    entryDescription: toSafeString(raw.entryDescription, ''),
  };
}
