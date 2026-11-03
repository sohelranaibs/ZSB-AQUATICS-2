import { PaymentRecord } from '../types/index.ts';
import { classifyPaymentCategory } from './calculations.ts';
import { isDateInRange } from './dateFilters.ts';

/**
 * Checks whether a payment record matches a multi-token search query
 * across supplier name (or shipping mark), reference ID (voucher invoiceNumber,
 * exportGoodsRef, or record ID), and payment remarks (remarks field or item descriptions).
 */
export function matchesPaymentSearch(
  payment: PaymentRecord,
  searchQuery: string
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;
  const target = searchQuery.trim().toLowerCase();

  const party = (payment.description || '').toLowerCase();
  const mark = (payment.shippingMark || '').toLowerCase();
  const inv = (payment.invoiceNumber || '').toLowerCase();
  const ref = (payment.exportGoodsRef || '').toLowerCase();
  const id = (payment.id || '').toLowerCase();
  const contact = (payment.contactNumber || '').toLowerCase();
  const remarks = (payment.remarks || '').toLowerCase();
  const itemTexts = Array.isArray(payment.items)
    ? payment.items
        .map(
          (i) =>
            `${i.description || ''} ${i.invoiceNumber || ''} ${i.shippingMark || ''}`
        )
        .join(' ')
        .toLowerCase()
    : '';

  const combined = `${party} ${mark} ${inv} ${ref} ${id} ${contact} ${remarks} ${itemTexts}`;
  const tokens = target.split(/\s+/).filter(Boolean);

  return tokens.every((tok) => combined.includes(tok));
}

export interface FilterPaymentRecordsOptions {
  searchQuery?: string;
  category?: 'all' | 'supplier' | 'exporter';
  startDate?: string;
  endDate?: string;
}

/**
 * Filters an array of PaymentRecord items in real-time by search query,
 * category, and optional date range.
 */
export function filterPaymentRecords(
  payments: PaymentRecord[],
  options: FilterPaymentRecordsOptions = {}
): PaymentRecord[] {
  const {
    searchQuery = '',
    category = 'all',
    startDate = '',
    endDate = '',
  } = options;

  return payments.filter((pm) => {
    if (category !== 'all') {
      const cat = classifyPaymentCategory(pm);
      if (cat !== category) return false;
    }

    if (startDate || endDate) {
      if (!isDateInRange(pm.date, startDate, endDate)) {
        return false;
      }
    }

    if (!matchesPaymentSearch(pm, searchQuery)) {
      return false;
    }

    return true;
  });
}
