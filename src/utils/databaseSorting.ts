import { PurchaseRecord, PackingRecord, PaymentRecord } from '../types/index.ts';
import { calculatePackingTotalAmountBDT } from './calculations.ts';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  column: string | null;
  direction: SortDirection;
}

/**
 * Toggles sort state for a given column:
 * - If target column is already active, toggles between 'asc' and 'desc'.
 * - If target column is newly selected, defaults to 'asc' (or 'desc' for dates/amounts if preferred, but standard is 'asc').
 */
export function toggleSort(current: SortConfig, targetColumn: string): SortConfig {
  if (current.column === targetColumn) {
    return {
      column: targetColumn,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    };
  }
  return {
    column: targetColumn,
    direction: 'asc',
  };
}

/**
 * Robust comparison supporting numbers, date strings, and natural alphanumeric strings.
 */
export function compareValues(valA: unknown, valB: unknown, direction: SortDirection): number {
  // Handle nulls / undefined - always sort to bottom
  const aEmpty = valA === undefined || valA === null || valA === '';
  const bEmpty = valB === undefined || valB === null || valB === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let comparison = 0;

  // Numeric comparison
  if (typeof valA === 'number' && typeof valB === 'number') {
    comparison = valA - valB;
  } else {
    // Check if both are numeric strings
    const numA = Number(valA);
    const numB = Number(valB);
    const isNumA = !isNaN(numA) && typeof valA === 'string' && valA.trim() !== '';
    const isNumB = !isNaN(numB) && typeof valB === 'string' && valB.trim() !== '';

    if (isNumA && isNumB) {
      comparison = numA - numB;
    } else {
      // String comparison with natural numeric sorting (e.g., INV-002 before INV-010)
      const strA = String(valA).trim();
      const strB = String(valB).trim();
      comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
    }
  }

  return direction === 'asc' ? comparison : -comparison;
}

/**
 * Pure function to sort Purchase Records
 */
export function sortPurchaseRecords(
  records: PurchaseRecord[],
  sort: SortConfig,
  reconciliations?: Record<string, { status: string; label: string }>
): PurchaseRecord[] {
  if (!sort.column) return records;

  return [...records].sort((a, b) => {
    let valA: unknown;
    let valB: unknown;

    switch (sort.column) {
      case 'invoiceNumber':
        valA = a.invoiceNumber;
        valB = b.invoiceNumber;
        break;
      case 'date':
        valA = a.date;
        valB = b.date;
        break;
      case 'description':
        valA = a.description;
        valB = b.description;
        break;
      case 'contactNumber':
      case 'contact':
        valA = a.contactNumber;
        valB = b.contactNumber;
        break;
      case 'items':
      case 'itemsCount':
        valA = a.items?.length || 0;
        valB = b.items?.length || 0;
        break;
      case 'totalQty':
        valA = a.totalQty !== undefined ? a.totalQty : a.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || 0;
        valB = b.totalQty !== undefined ? b.totalQty : b.items?.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || 0;
        break;
      case 'totalAmount':
        valA = a.totalAmount;
        valB = b.totalAmount;
        break;
      case 'paidAmount':
        valA = a.paidAmount;
        valB = b.paidAmount;
        break;
      case 'balance':
        valA = a.balance;
        valB = b.balance;
        break;
      case 'reconciliation':
      case 'reconciliationStatus':
        valA = reconciliations?.[a.id]?.label || '';
        valB = reconciliations?.[b.id]?.label || '';
        break;
      default:
        valA = (a as unknown as Record<string, unknown>)[sort.column!];
        valB = (b as unknown as Record<string, unknown>)[sort.column!];
    }

    return compareValues(valA, valB, sort.direction);
  });
}

/**
 * Pure function to sort Packing List Records
 */
export function sortPackingRecords(
  records: PackingRecord[],
  sort: SortConfig,
  defaultRmbRate: number = 16.5
): PackingRecord[] {
  if (!sort.column) return records;

  return [...records].sort((a, b) => {
    let valA: unknown;
    let valB: unknown;

    switch (sort.column) {
      case 'invoiceNumber':
        valA = a.invoiceNumber;
        valB = b.invoiceNumber;
        break;
      case 'date':
      case 'packingDate':
        valA = a.packingDate || a.fromDate || a.toDate || '';
        valB = b.packingDate || b.fromDate || b.toDate || '';
        break;
      case 'shippingMark':
        valA = a.shippingMark;
        valB = b.shippingMark;
        break;
      case 'flight':
        valA = a.flight;
        valB = b.flight;
        break;
      case 'destination':
        valA = a.destination;
        valB = b.destination;
        break;
      case 'shipper':
        valA = a.shipper;
        valB = b.shipper;
        break;
      case 'items':
      case 'itemsCount':
        valA = a.items?.length || 0;
        valB = b.items?.length || 0;
        break;
      case 'totalBox':
        valA = a.totalBox;
        valB = b.totalBox;
        break;
      case 'totalWeight':
        valA = a.totalWeight;
        valB = b.totalWeight;
        break;
      case 'totalAmount':
      case 'totalValue':
        valA = a.totalAmount;
        valB = b.totalAmount;
        break;
      case 'rmbRate':
        valA = a.rmbRate || defaultRmbRate;
        valB = b.rmbRate || defaultRmbRate;
        break;
      case 'amountBDT':
      case 'totalAmountBDT':
        valA = calculatePackingTotalAmountBDT(a.totalAmount, a.rmbRate || defaultRmbRate);
        valB = calculatePackingTotalAmountBDT(b.totalAmount, b.rmbRate || defaultRmbRate);
        break;
      default:
        valA = (a as unknown as Record<string, unknown>)[sort.column!];
        valB = (b as unknown as Record<string, unknown>)[sort.column!];
    }

    return compareValues(valA, valB, sort.direction);
  });
}

/**
 * Pure function to sort Payment Records
 */
export function sortPaymentRecords(
  records: PaymentRecord[],
  sort: SortConfig,
  reconciliations?: Record<string, { status: string; label: string }>
): PaymentRecord[] {
  if (!sort.column) return records;

  return [...records].sort((a, b) => {
    let valA: unknown;
    let valB: unknown;

    switch (sort.column) {
      case 'invoiceNumber':
        valA = a.invoiceNumber;
        valB = b.invoiceNumber;
        break;
      case 'type':
      case 'category':
        valA = a.paymentCategory || (a.shippingMark || a.exportGoodsRef ? 'exporter' : 'supplier');
        valB = b.paymentCategory || (b.shippingMark || b.exportGoodsRef ? 'exporter' : 'supplier');
        break;
      case 'date':
        valA = a.date;
        valB = b.date;
        break;
      case 'description':
      case 'party':
        valA = a.description;
        valB = b.description;
        break;
      case 'status':
        valA = a.status;
        valB = b.status;
        break;
      case 'paidAmount':
        valA = a.paidAmount;
        valB = b.paidAmount;
        break;
      case 'balance':
        valA = a.balance;
        valB = b.balance;
        break;
      case 'exportRef':
        valA = a.exportGoodsRef || a.shippingMark || '';
        valB = b.exportGoodsRef || b.shippingMark || '';
        break;
      case 'reconciliation':
      case 'reconciliationStatus':
        valA = reconciliations?.[a.id]?.label || '';
        valB = reconciliations?.[b.id]?.label || '';
        break;
      default:
        valA = (a as unknown as Record<string, unknown>)[sort.column!];
        valB = (b as unknown as Record<string, unknown>)[sort.column!];
    }

    return compareValues(valA, valB, sort.direction);
  });
}

/**
 * Returns human-readable label for column sort display
 */
export function getColumnHeaderTitle(column: string): string {
  const titles: Record<string, string> = {
    invoiceNumber: 'Invoice / Doc No',
    date: 'Date',
    description: 'Supplier / Description',
    contactNumber: 'Contact',
    contact: 'Contact',
    items: 'Items Count',
    itemsCount: 'Items Count',
    totalQty: 'Total Quantity (KG)',
    totalAmount: 'Total Amount',
    paidAmount: 'Paid Amount',
    balance: 'Balance',
    reconciliation: 'Reconciliation Status',
    shippingMark: 'Shipping Mark',
    flight: 'Flight No',
    destination: 'Destination',
    shipper: 'Shipper',
    totalBox: 'Total Box',
    totalWeight: 'Total Weight (KG)',
    rmbRate: 'RMB Rate',
    amountBDT: 'Total Amount (BDT)',
    type: 'Voucher Type',
    status: 'Payment Status',
    exportRef: 'Export Goods Ref',
  };
  return titles[column] || column;
}
