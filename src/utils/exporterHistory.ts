/**
 * Exporter Database Record History Builder & Calculations
 * Supports Automatic Exporter Database Lookup (Select Shipping Mark & Packing Date)
 * with full Debit, Credit, Balance, and Status (REPORT, NO REPORT, PAID) history.
 */
import {
  PackingRecord,
  PaymentRecord,
  PaymentItemRow,
  ExporterStatus,
} from '../types/index.ts';
import {
  calculatePaymentRow,
  calculatePackingTotals,
  calculateExporterSlipRowAmount,
  classifyPaymentCategory,
  ExporterSlipFilterOptions,
} from './calculations.ts';

export const EXPORTER_STATUS_OPTIONS: readonly ExporterStatus[] = [
  'REPORT',
  'NO REPORT',
  'PAID',
] as const;

export interface ExporterRecordHistoryRow extends PaymentItemRow {
  id: string;
  packingId?: string;
  paymentId?: string;
  invoiceNumber: string;
  date: string;
  shippingMark: string;
  flight: string;
  destination: string;
  box: number;
  weightKg: number;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  status: ExporterStatus;
  isCustom?: boolean;
}

export interface ExporterHistoryTotals {
  recordCount: number;
  totalBox: number;
  totalWeightKg: number;
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
  paidCount: number;
  reportCount: number;
  noReportCount: number;
}

/**
 * Normalizes any status string into one of 'REPORT' | 'NO REPORT' | 'PAID' (or preserves uppercase custom status)
 */
export function normalizeExporterStatus(status?: string): ExporterStatus {
  const raw = (status || '').trim().toUpperCase();
  if (raw === 'PAID') return 'PAID';
  if (raw === 'NO REPORT' || raw === 'NOREPORT') return 'NO REPORT';
  if (raw === 'REPORT') return 'REPORT';
  return raw || 'REPORT';
}

/**
 * Builds the complete Exporter Record History (Debit, Credit, Balance, and Status: Report, No Report, Paid)
 * from Packing List records and Exporter Payment records, filtered by Shipping Mark, Packing Date, Flight, or Status.
 */
export function buildExporterRecordHistory(
  packings: PackingRecord[],
  payments: PaymentRecord[] = [],
  filters: ExporterSlipFilterOptions = {}
): ExporterRecordHistoryRow[] {
  const {
    shippingMark = 'ALL',
    packingDate = 'ALL',
    flight = 'ALL',
    status = 'ALL',
    rmbExchangeRate = 16.5,
  } = filters;

  const rate = Number(rmbExchangeRate) > 0 ? Number(rmbExchangeRate) : 16.5;
  const markTarget = (shippingMark || 'ALL').trim().toLowerCase();
  const dateTarget = (packingDate || 'ALL').trim();
  const flightTarget = (flight || 'ALL').trim().toLowerCase();
  const statusTarget = (status || 'ALL').trim().toLowerCase();

  const safePackings = Array.isArray(packings) ? packings : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const exporterPayments = safePayments.filter(
    (pm) => classifyPaymentCategory(pm) === 'exporter'
  );

  const matchedPackingInvoices = new Set<string>();

  const packingHistoryRows: ExporterRecordHistoryRow[] = safePackings.map((pkg) => {
    if (pkg.invoiceNumber) {
      matchedPackingInvoices.add(pkg.invoiceNumber.trim().toLowerCase());
    }

    const linkedPayment = exporterPayments.find(
      (pm) =>
        (pm.exportGoodsRef &&
          pm.exportGoodsRef.trim().toLowerCase() ===
            (pkg.invoiceNumber || '').trim().toLowerCase()) ||
        (pm.shippingMark &&
          pm.shippingMark.trim().toLowerCase() ===
            (pkg.shippingMark || '').trim().toLowerCase() &&
          pm.date === pkg.packingDate)
    );

    const itemTotals =
      Array.isArray(pkg.items) && pkg.items.length > 0
        ? calculatePackingTotals(pkg.items)
        : { totalBox: 0, totalWeight: 0, totalAmount: 0 };

    const box = Number(pkg.totalBox) || itemTotals.totalBox || 0;
    const rawWeight = Number(pkg.totalWeight) || itemTotals.totalWeight || 0;
    const weightKg = Math.round(rawWeight * 100) / 100;
    const rawTotalAmount = Number(pkg.totalAmount) || itemTotals.totalAmount || 0;

    const resolvedStatus = normalizeExporterStatus(
      pkg.exporterStatus || pkg.paymentStatus || linkedPayment?.status || 'REPORT'
    );

    // Derive Debit Amount (Export RMB value)
    let debitAmount = 0;
    if (pkg.debitAmount !== undefined && !Number.isNaN(Number(pkg.debitAmount))) {
      debitAmount = Math.round(Number(pkg.debitAmount) * 100) / 100;
    } else if (pkg.settledAmount !== undefined && Number(pkg.settledAmount) > 0) {
      debitAmount = Math.round(Number(pkg.settledAmount) * 100) / 100;
    } else if (rawTotalAmount > 0) {
      debitAmount = Math.round(rawTotalAmount * 100) / 100;
    } else if (pkg.rmbAmount !== undefined && Number(pkg.rmbAmount) > 0 && weightKg > 0) {
      debitAmount = calculateExporterSlipRowAmount(weightKg, Number(pkg.rmbAmount));
    } else if (linkedPayment && Number(linkedPayment.totalAmount) > 0) {
      debitAmount = Math.round((Number(linkedPayment.totalAmount) / rate) * 100) / 100;
    }

    // Derive Credit Amount (Paid / Settled / Claimed RMB value)
    let creditAmount = 0;
    if (pkg.creditAmount !== undefined && !Number.isNaN(Number(pkg.creditAmount))) {
      creditAmount = Math.round(Number(pkg.creditAmount) * 100) / 100;
    } else if (linkedPayment) {
      const voucherCreditSum = Array.isArray(linkedPayment.items)
        ? linkedPayment.items.reduce((acc, it) => acc + (Number(it.creditAmount) || 0), 0)
        : 0;
      if (voucherCreditSum > 0) {
        creditAmount = Math.round(voucherCreditSum * 100) / 100;
      } else if (Number(linkedPayment.returnRMB) > 0) {
        creditAmount = Math.round(Number(linkedPayment.returnRMB) * 100) / 100;
      } else if (Number(linkedPayment.paidAmount) > 0) {
        creditAmount = Math.round(Number(linkedPayment.paidAmount) * 100) / 100;
      } else if (resolvedStatus === 'PAID') {
        creditAmount = debitAmount;
      }
    } else if (resolvedStatus === 'PAID') {
      creditAmount = debitAmount;
    } else {
      creditAmount = 0;
    }

    const balance = calculatePaymentRow(debitAmount, creditAmount);

    const markLabel = (pkg.shippingMark || 'GENERAL').trim();
    const flightLabel = (pkg.flight || '').trim();
    const destLabel = (pkg.destination || '').trim();
    const description = `${markLabel} — ${pkg.invoiceNumber}${
      flightLabel ? ` · Flight ${flightLabel}` : ''
    } (${box} Box, ${weightKg} KG${destLabel ? ` to ${destLabel}` : ''})`;

    return {
      id: `hist-pkg-${pkg.id}`,
      packingId: pkg.id,
      paymentId: linkedPayment?.id,
      invoiceNumber: pkg.invoiceNumber || 'PKG',
      date: pkg.packingDate || '',
      shippingMark: markLabel,
      flight: flightLabel,
      destination: destLabel,
      box,
      weightKg,
      description,
      debitAmount,
      creditAmount,
      balance,
      status: resolvedStatus,
    };
  });

  // Also include standalone Exporter Payment Vouchers that aren't already linked to a PackingRecord
  const standaloneVoucherRows: ExporterRecordHistoryRow[] = [];
  for (const pm of exporterPayments) {
    const refInv = (pm.exportGoodsRef || '').trim().toLowerCase();
    if (refInv && matchedPackingInvoices.has(refInv)) {
      continue;
    }

    const resolvedStatus = normalizeExporterStatus(pm.status || 'REPORT');
    const markLabel = (pm.shippingMark || pm.description || 'EXPORTER').trim();
    const itemDebitSum = Array.isArray(pm.items)
      ? pm.items.reduce((acc, it) => acc + (Number(it.debitAmount) || 0), 0)
      : 0;
    const itemCreditSum = Array.isArray(pm.items)
      ? pm.items.reduce((acc, it) => acc + (Number(it.creditAmount) || 0), 0)
      : 0;

    const debitAmount =
      Math.round(
        (itemDebitSum > 0
          ? itemDebitSum
          : Number(pm.totalAmount) || Number(pm.returnRMB) || 0) * 100
      ) / 100;
    const creditAmount =
      Math.round(
        (itemCreditSum > 0
          ? itemCreditSum
          : Number(pm.paidAmount) || (resolvedStatus === 'PAID' ? debitAmount : 0)) * 100
      ) / 100;
    const balance = calculatePaymentRow(debitAmount, creditAmount);

    const firstItemDesc =
      Array.isArray(pm.items) && pm.items[0]?.description
        ? pm.items[0].description
        : `${markLabel} — Voucher ${pm.invoiceNumber}`;

    standaloneVoucherRows.push({
      id: `hist-pay-${pm.id}`,
      paymentId: pm.id,
      invoiceNumber: pm.invoiceNumber,
      date: pm.date || '',
      shippingMark: markLabel,
      flight: '',
      destination: '',
      box: 0,
      weightKg: 0,
      description: firstItemDesc,
      debitAmount,
      creditAmount,
      balance,
      status: resolvedStatus,
    });
  }

  const allRows = [...packingHistoryRows, ...standaloneVoucherRows];

  // Apply Automatic Exporter Database Lookup filters (Shipping Mark, Packing Date, Flight, Status)
  return allRows.filter((row) => {
    if (
      markTarget !== 'all' &&
      markTarget !== '' &&
      row.shippingMark.trim().toLowerCase() !== markTarget &&
      !row.description.toLowerCase().includes(markTarget)
    ) {
      return false;
    }
    if (
      dateTarget !== 'ALL' &&
      dateTarget !== 'all' &&
      dateTarget !== '' &&
      row.date !== dateTarget
    ) {
      return false;
    }
    if (
      flightTarget !== 'all' &&
      flightTarget !== '' &&
      row.flight.trim().toLowerCase() !== flightTarget
    ) {
      return false;
    }
    if (
      statusTarget !== 'all' &&
      statusTarget !== '' &&
      row.status.trim().toLowerCase() !== statusTarget
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Calculates aggregate Debit, Credit, Balance, and Status counts across Exporter Record History rows
 */
export function calculateExporterHistoryTotals(
  rows: Array<{
    box?: number;
    weightKg?: number;
    debitAmount?: number;
    creditAmount?: number;
    balance?: number;
    status?: string;
  }>
): ExporterHistoryTotals {
  const safeRows = Array.isArray(rows) ? rows : [];
  let totalBox = 0;
  let totalWeightKg = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let paidCount = 0;
  let reportCount = 0;
  let noReportCount = 0;

  for (const r of safeRows) {
    totalBox += Number(r.box) || 0;
    totalWeightKg += Number(r.weightKg) || 0;
    totalDebit += Number(r.debitAmount) || 0;
    totalCredit += Number(r.creditAmount) || 0;

    const st = normalizeExporterStatus(r.status);
    if (st === 'PAID') paidCount += 1;
    else if (st === 'NO REPORT') noReportCount += 1;
    else reportCount += 1;
  }

  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;
  const totalBalance = calculatePaymentRow(roundedDebit, roundedCredit);

  return {
    recordCount: safeRows.length,
    totalBox,
    totalWeightKg: Math.round(totalWeightKg * 100) / 100,
    totalDebit: roundedDebit,
    totalCredit: roundedCredit,
    totalBalance,
    paidCount,
    reportCount,
    noReportCount,
  };
}
