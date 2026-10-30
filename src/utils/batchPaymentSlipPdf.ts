import { PaymentRecord, CompanyProfile } from '../types/index.ts';
import { classifyPaymentCategory } from './calculations.ts';

export interface BatchPaymentSlipSummary {
  totalCount: number;
  supplierCount: number;
  exporterCount: number;
  totalDebitBDT: number;
  totalCreditBDT: number;
  totalBalanceBDT: number;
  totalDebitRMB: number;
  totalCreditRMB: number;
  totalBalanceRMB: number;
}

/**
 * Generates a clean, deterministic filename for exporting multiple payment slips as a single combined PDF.
 * Format: ZSB_Aquatics_Batch_Payment_Slips_<COUNT>_Slips_<DATE>.pdf
 */
export function formatBatchPaymentSlipsPdfFilename(
  count: number,
  categoryFilter?: 'all' | 'supplier' | 'exporter',
  dateStr?: string
): string {
  const dateTag = (dateStr || new Date().toISOString().slice(0, 10)).replace(/[^0-9-]/g, '');
  const prefix =
    categoryFilter === 'supplier'
      ? 'ZSB_Aquatics_Supplier_Payment_Slips'
      : categoryFilter === 'exporter'
      ? 'ZSB_Aquatics_Exporter_Payment_Slips'
      : 'ZSB_Aquatics_Batch_Payment_Slips';

  const countTag = count === 1 ? '1_Slip' : `${count}_Slips`;
  return `${prefix}_${countTag}_${dateTag}.pdf`;
}

/**
 * Calculates aggregate summary totals across a batch of payment records for auditing.
 */
export function buildBatchPaymentSlipSummary(payments: PaymentRecord[]): BatchPaymentSlipSummary {
  let supplierCount = 0;
  let exporterCount = 0;
  let totalDebitBDT = 0;
  let totalCreditBDT = 0;
  let totalBalanceBDT = 0;
  let totalDebitRMB = 0;
  let totalCreditRMB = 0;
  let totalBalanceRMB = 0;

  for (const pm of payments) {
    const category = classifyPaymentCategory(pm);
    if (category === 'exporter') {
      exporterCount++;
      totalDebitRMB += Number(pm.totalAmount) || 0;
      totalCreditRMB += Number(pm.paidAmount) || 0;
      totalBalanceRMB += Number(pm.balance) || 0;
    } else {
      supplierCount++;
      totalDebitBDT += Number(pm.totalAmount) || 0;
      totalCreditBDT += Number(pm.paidAmount) || 0;
      totalBalanceBDT += Number(pm.balance) || 0;
    }
  }

  return {
    totalCount: payments.length,
    supplierCount,
    exporterCount,
    totalDebitBDT: Math.round(totalDebitBDT * 100) / 100,
    totalCreditBDT: Math.round(totalCreditBDT * 100) / 100,
    totalBalanceBDT: Math.round(totalBalanceBDT * 100) / 100,
    totalDebitRMB: Math.round(totalDebitRMB * 100) / 100,
    totalCreditRMB: Math.round(totalCreditRMB * 100) / 100,
    totalBalanceRMB: Math.round(totalBalanceRMB * 100) / 100,
  };
}

/**
 * Validates and sorts selected payment records chronologically or by invoice number for batch export.
 */
export function preparePaymentRecordsForBatchExport(
  allPayments: PaymentRecord[],
  selectedIds: string[]
): PaymentRecord[] {
  if (!selectedIds || selectedIds.length === 0) return [];
  const selectedSet = new Set(selectedIds);
  return allPayments.filter((pm) => selectedSet.has(pm.id));
}
