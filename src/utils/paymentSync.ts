/**
 * Automated Synchronization Trigger for Supplier & Exporter Payment Sheets
 * Dispatches real-time synchronization events whenever a payment, purchase,
 * packing, or credit note entry is confirmed, updated, or deleted so that
 * the 'All Supplier Record History' and 'All Exporter Record History' tables
 * and their summary footer running balances stay continuously up to date.
 */

export const ZSB_PAYMENT_ENTRY_CONFIRMED_EVENT = 'zsb:payment-entry-confirmed';

export interface PaymentSyncEventDetail {
  syncId: string;
  timestamp: string;
  category: 'supplier' | 'exporter';
  action: 'confirm' | 'update' | 'delete';
  invoiceNumber?: string;
  partyName?: string;
  debitAmount?: number;
  creditAmount?: number;
  runningBalance?: number;
}

export function emitPaymentSyncTrigger(
  detail: Omit<PaymentSyncEventDetail, 'syncId' | 'timestamp'>
): PaymentSyncEventDetail {
  const fullDetail: PaymentSyncEventDetail = {
    ...detail,
    syncId: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent<PaymentSyncEventDetail>(ZSB_PAYMENT_ENTRY_CONFIRMED_EVENT, {
        detail: fullDetail,
      })
    );
  }

  return fullDetail;
}
