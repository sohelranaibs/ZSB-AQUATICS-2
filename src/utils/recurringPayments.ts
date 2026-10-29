/**
 * Utilities for scanning, classifying, and advancing upcoming recurring supplier payments
 */

import { PaymentRecord, RecurrenceFrequency } from '../types/index.ts';
import { classifyPaymentCategory } from './calculations.ts';
import { toISODateString } from './dateFilters.ts';

export type PaymentUrgencyLevel = 'due_today' | 'urgent' | 'upcoming' | 'scheduled';

export interface UpcomingRecurringPaymentItem {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  contactNumber: string;
  voucherDate: string;
  dueDate: string;
  daysUntilDue: number;
  urgency: PaymentUrgencyLevel;
  urgencyLabel: string;
  amountDue: number;
  recurrenceFrequency: RecurrenceFrequency;
  frequencyLabel: string;
  nextProjectedDate: string;
  remarks: string;
  rawRecord: PaymentRecord;
}

export interface UpcomingRecurringSummary {
  totalScheduledCount: number;
  totalUpcomingAmount: number;
  dueWithin7DaysCount: number;
  dueWithin7DaysAmount: number;
  urgentCount: number;
  uniqueSuppliersCount: number;
}

/**
 * Formats a RecurrenceFrequency key into a human-readable badge label.
 */
export function formatRecurrenceFrequency(freq?: RecurrenceFrequency): string {
  switch (freq) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Bi-Weekly (14d)';
    case 'quarterly':
      return 'Quarterly';
    case 'monthly':
    default:
      return 'Monthly';
  }
}

/**
 * Infers recurrence frequency from record fields or remarks if not explicitly provided.
 */
export function inferRecurrenceFrequency(record: PaymentRecord): RecurrenceFrequency {
  if (record.recurrenceFrequency) {
    return record.recurrenceFrequency;
  }
  const text = `${record.remarks || ''} ${(record.items || []).map((i) => i.description).join(' ')}`.toLowerCase();
  if (text.includes('bi-weekly') || text.includes('biweekly') || text.includes('14 day') || text.includes('fortnight')) {
    return 'biweekly';
  }
  if (text.includes('week')) {
    return 'weekly';
  }
  if (text.includes('quarter')) {
    return 'quarterly';
  }
  return 'monthly';
}

/**
 * Computes the next cycle due date (YYYY-MM-DD) from a given YYYY-MM-DD date string and frequency.
 */
export function computeNextRecurrenceDate(
  dueDateStr: string,
  frequency: RecurrenceFrequency = 'monthly'
): string {
  const clean = (dueDateStr || '').slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return clean;
  }

  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);

  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      return toISODateString(d);

    case 'biweekly':
      d.setDate(d.getDate() + 14);
      return toISODateString(d);

    case 'quarterly': {
      const targetMonth = month - 1 + 3;
      const maxDayInTarget = new Date(year, targetMonth + 1, 0).getDate();
      const clampedDay = Math.min(day, maxDayInTarget);
      return toISODateString(new Date(year, targetMonth, clampedDay));
    }

    case 'monthly':
    default: {
      const targetMonth = month; // month is 1-indexed, so month is next month index
      const maxDayInTarget = new Date(year, targetMonth + 1, 0).getDate();
      const clampedDay = Math.min(day, maxDayInTarget);
      return toISODateString(new Date(year, targetMonth, clampedDay));
    }
  }
}

/**
 * Calculates calendar day difference from referenceDateStr (YYYY-MM-DD) to targetDateStr (YYYY-MM-DD).
 */
export function calculateDaysUntilDue(targetDateStr: string, referenceDateStr: string): number {
  const [tY, tM, tD] = targetDateStr.slice(0, 10).split('-').map(Number);
  const [rY, rM, rD] = referenceDateStr.slice(0, 10).split('-').map(Number);
  const targetUTC = Date.UTC(tY, tM - 1, tD);
  const refUTC = Date.UTC(rY, rM - 1, rD);
  return Math.round((targetUTC - refUTC) / (1000 * 60 * 60 * 24));
}

/**
 * Classifies urgency level and badge label from daysUntilDue.
 */
export function classifyPaymentUrgency(daysUntilDue: number): {
  urgency: PaymentUrgencyLevel;
  urgencyLabel: string;
} {
  if (daysUntilDue <= 0) {
    return {
      urgency: 'due_today',
      urgencyLabel: 'Due Today',
    };
  }
  if (daysUntilDue === 1) {
    return {
      urgency: 'urgent',
      urgencyLabel: 'Due Tomorrow',
    };
  }
  if (daysUntilDue <= 3) {
    return {
      urgency: 'urgent',
      urgencyLabel: `Due in ${daysUntilDue} Days`,
    };
  }
  if (daysUntilDue <= 7) {
    return {
      urgency: 'upcoming',
      urgencyLabel: `Due in ${daysUntilDue} Days`,
    };
  }
  return {
    urgency: 'scheduled',
    urgencyLabel: `In ${daysUntilDue} Days`,
  };
}

/**
 * Scans all payment records for upcoming recurring supplier payments with future (or today) due dates.
 */
export function scanUpcomingRecurringSupplierPayments(
  payments: PaymentRecord[],
  referenceDate: Date = new Date()
): UpcomingRecurringPaymentItem[] {
  const todayStr = toISODateString(referenceDate);

  const results: UpcomingRecurringPaymentItem[] = [];

  for (const pm of payments) {
    // Only scan supplier payments
    if (classifyPaymentCategory(pm) !== 'supplier') {
      continue;
    }

    const effectiveDueDate = (pm.dueDate || pm.date || '').slice(0, 10);
    if (!effectiveDueDate) continue;

    // Must have a future (or today) due date:
    // Either dueDate >= todayStr (when dueDate is explicitly set or recurring is enabled),
    // or voucher date itself is in the future (pm.date > todayStr).
    const hasExplicitFutureDue = Boolean(pm.dueDate && pm.dueDate.slice(0, 10) >= todayStr);
    const hasPostDatedVoucher = pm.date.slice(0, 10) > todayStr;
    const isMarkedRecurringWithFutureDate =
      Boolean(pm.isRecurring || pm.recurrenceFrequency) && effectiveDueDate >= todayStr;

    if (!hasExplicitFutureDue && !hasPostDatedVoucher && !isMarkedRecurringWithFutureDate) {
      continue;
    }

    const daysUntilDue = calculateDaysUntilDue(effectiveDueDate, todayStr);
    if (daysUntilDue < 0) {
      continue;
    }

    const { urgency, urgencyLabel } = classifyPaymentUrgency(daysUntilDue);
    const frequency = inferRecurrenceFrequency(pm);
    const frequencyLabel = formatRecurrenceFrequency(frequency);
    const nextProjectedDate = computeNextRecurrenceDate(effectiveDueDate, frequency);

    // Determine installment / scheduled amount due
    const amountDue =
      Number(pm.balance) > 0
        ? Number(pm.balance)
        : Number(pm.paidAmount) > 0
        ? Number(pm.paidAmount)
        : Number(pm.totalAmount) || 0;

    results.push({
      id: pm.id,
      invoiceNumber: pm.invoiceNumber,
      supplierName: pm.description || 'Unknown Supplier',
      contactNumber: pm.contactNumber || '',
      voucherDate: pm.date,
      dueDate: effectiveDueDate,
      daysUntilDue,
      urgency,
      urgencyLabel,
      amountDue,
      recurrenceFrequency: frequency,
      frequencyLabel,
      nextProjectedDate,
      remarks: pm.remarks || 'Scheduled recurring supplier settlement',
      rawRecord: pm,
    });
  }

  // Sort by soonest due date first, then highest amount due
  results.sort((a, b) => {
    if (a.daysUntilDue !== b.daysUntilDue) {
      return a.daysUntilDue - b.daysUntilDue;
    }
    return b.amountDue - a.amountDue;
  });

  return results;
}

/**
 * Computes aggregate metrics for upcoming recurring supplier payments.
 */
export function calculateUpcomingRecurringSummary(
  items: UpcomingRecurringPaymentItem[]
): UpcomingRecurringSummary {
  let totalUpcomingAmount = 0;
  let dueWithin7DaysCount = 0;
  let dueWithin7DaysAmount = 0;
  let urgentCount = 0;
  const suppliers = new Set<string>();

  for (const item of items) {
    totalUpcomingAmount += item.amountDue;
    suppliers.add(item.supplierName);

    if (item.daysUntilDue <= 7) {
      dueWithin7DaysCount += 1;
      dueWithin7DaysAmount += item.amountDue;
    }
    if (item.daysUntilDue <= 3) {
      urgentCount += 1;
    }
  }

  return {
    totalScheduledCount: items.length,
    totalUpcomingAmount,
    dueWithin7DaysCount,
    dueWithin7DaysAmount,
    urgentCount,
    uniqueSuppliersCount: suppliers.size,
  };
}

/**
 * Produces a record update patch that settles the current due cycle and advances dueDate to the next recurrence cycle.
 */
export function buildNextCyclePaymentPatch(
  item: UpcomingRecurringPaymentItem
): Partial<PaymentRecord> {
  return {
    date: item.dueDate,
    dueDate: item.nextProjectedDate,
    isRecurring: true,
    recurrenceFrequency: item.recurrenceFrequency,
    status: 'PAID',
  };
}
