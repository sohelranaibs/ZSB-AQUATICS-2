import {
  MortalityRecord,
  OtherCostRecord,
  PackingRecord,
  PaymentRecord,
  PurchaseRecord,
} from '../types/index.ts';
import { calculatePackingTotalAmountBDT, classifyPaymentCategory } from './calculations.ts';
import { normalizeExpenseDateString } from './dailyExpense.ts';
import { UpcomingRecurringPaymentItem } from './recurringPayments.ts';

export interface CalendarGridCell {
  dateIso: string; // YYYY-MM-DD
  dayNumber: number;
  inCurrentMonth: boolean;
}

export type CalendarActivityKind =
  | 'purchase'
  | 'packing'
  | 'payment'
  | 'expense'
  | 'mortality'
  | 'upcoming_due';

export interface CalendarDayActivityItem {
  id: string;
  kind: CalendarActivityKind;
  title: string;
  subtitle: string;
  amount: number;
  amountLabel?: string;
}

export interface CalendarDayAggregate {
  dateIso: string;
  purchasesCount: number;
  purchasesTotal: number;
  packingsCount: number;
  packingsTotalBDT: number;
  paymentsCount: number;
  paymentsTotal: number;
  expensesCount: number;
  expensesTotal: number;
  mortalitiesCount: number;
  mortalitiesKg: number;
  upcomingDueCount: number;
  upcomingDueTotal: number;
  totalActivityCount: number;
  items: CalendarDayActivityItem[];
}

export interface CalendarMonthTotals {
  activeDays: number;
  purchasesTotal: number;
  packingsTotalBDT: number;
  paymentsTotal: number;
  expensesTotal: number;
  totalEvents: number;
}

const MONTH_FULL_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatCalendarMonthHeading(monthYm: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec((monthYm || '').trim());
  if (!match) return monthYm;
  const idx = Number(match[2]) - 1;
  return MONTH_FULL_NAMES[idx] ? `${MONTH_FULL_NAMES[idx]} ${match[1]}` : monthYm;
}

export function formatCalendarSelectedDateHeading(dateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateIso || '').trim());
  if (!match) return dateIso;
  const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    dt.getDay()
  ];
  const monthName = MONTH_FULL_NAMES[Number(match[2]) - 1] || match[2];
  return `${weekday}, ${Number(match[3])} ${monthName} ${match[1]}`;
}

export function shiftCalendarMonth(monthYm: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec((monthYm || '').trim());
  if (!match) return monthYm;
  const baseYear = Number(match[1]);
  const baseMonthIndex = Number(match[2]) - 1;
  const shifted = new Date(baseYear, baseMonthIndex + deltaMonths, 1);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toIsoYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildMonthCalendarCells(monthYm: string): CalendarGridCell[] {
  const match = /^(\d{4})-(\d{2})$/.exec((monthYm || '').trim());
  if (!match) return [];

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const firstOfMonth = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankDays = firstOfMonth.getDay(); // 0 = Sunday

  const totalCells = leadingBlankDays + daysInMonth > 35 ? 42 : 35;
  const cells: CalendarGridCell[] = [];

  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(year, monthIndex, 1 - leadingBlankDays + i);
    const dateIso = toIsoYmd(cellDate);
    cells.push({
      dateIso,
      dayNumber: cellDate.getDate(),
      inCurrentMonth: cellDate.getFullYear() === year && cellDate.getMonth() === monthIndex,
    });
  }

  return cells;
}

export function createEmptyDayAggregate(dateIso: string): CalendarDayAggregate {
  return {
    dateIso,
    purchasesCount: 0,
    purchasesTotal: 0,
    packingsCount: 0,
    packingsTotalBDT: 0,
    paymentsCount: 0,
    paymentsTotal: 0,
    expensesCount: 0,
    expensesTotal: 0,
    mortalitiesCount: 0,
    mortalitiesKg: 0,
    upcomingDueCount: 0,
    upcomingDueTotal: 0,
    totalActivityCount: 0,
    items: [],
  };
}

export function buildCalendarActivityMap(params: {
  purchases: readonly PurchaseRecord[];
  packings: readonly PackingRecord[];
  payments: readonly PaymentRecord[];
  otherCosts: readonly OtherCostRecord[];
  mortalities: readonly MortalityRecord[];
  upcomingRecurringPayments?: readonly UpcomingRecurringPaymentItem[];
}): Map<string, CalendarDayAggregate> {
  const map = new Map<string, CalendarDayAggregate>();

  const getOrCreate = (rawDate: string | undefined | null): CalendarDayAggregate | null => {
    const iso = normalizeExpenseDateString(rawDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    let entry = map.get(iso);
    if (!entry) {
      entry = createEmptyDayAggregate(iso);
      map.set(iso, entry);
    }
    return entry;
  };

  for (const p of params.purchases || []) {
    const bucket = getOrCreate(p.date);
    if (!bucket) continue;
    const amt = Number(p.totalAmount) || 0;
    bucket.purchasesCount += 1;
    bucket.purchasesTotal += amt;
    bucket.totalActivityCount += 1;
    bucket.items.push({
      id: `pur-${p.id}`,
      kind: 'purchase',
      title: `Purchase · ${p.description || 'Supplier Challan'}`,
      subtitle: `${p.invoiceNumber || 'Challan'} · ${(Number(p.totalQty) || 0).toLocaleString()} KG`,
      amount: amt,
    });
  }

  for (const pk of params.packings || []) {
    const bucket = getOrCreate(pk.packingDate);
    if (!bucket) continue;
    const amtBdt = calculatePackingTotalAmountBDT(pk.totalAmount, pk.rmbRate);
    bucket.packingsCount += 1;
    bucket.packingsTotalBDT += amtBdt;
    bucket.totalActivityCount += 1;
    bucket.items.push({
      id: `pkg-${pk.id}`,
      kind: 'packing',
      title: `Export Packing · ${pk.shippingMark || 'Manifest'}`,
      subtitle: `${pk.invoiceNumber || 'PKL'} · ${pk.totalBox} Box (${pk.totalWeight} KG)`,
      amount: amtBdt,
    });
  }

  for (const pm of params.payments || []) {
    const bucket = getOrCreate(pm.date);
    if (!bucket) continue;
    const amt = Number(pm.paidAmount) || 0;
    const isExporter = classifyPaymentCategory(pm) === 'exporter';
    bucket.paymentsCount += 1;
    bucket.paymentsTotal += amt;
    bucket.totalActivityCount += 1;
    bucket.items.push({
      id: `pay-${pm.id}`,
      kind: 'payment',
      title: `${isExporter ? 'Exporter' : 'Supplier'} Payment · ${pm.description || 'Voucher'}`,
      subtitle: `${pm.invoiceNumber || 'PAY'}`,
      amount: amt,
    });
  }

  for (const oc of params.otherCosts || []) {
    const bucket = getOrCreate(oc.date);
    if (!bucket) continue;
    const amt = Number(oc.amount) || 0;
    bucket.expensesCount += 1;
    bucket.expensesTotal += amt;
    bucket.totalActivityCount += 1;
    bucket.items.push({
      id: `exp-${oc.id}`,
      kind: 'expense',
      title: `Daily Expense · ${oc.category || 'Expense'}`,
      subtitle: oc.description || oc.paymentMethod || 'Operating expense',
      amount: amt,
    });
  }

  for (const mort of params.mortalities || []) {
    const bucket = getOrCreate(mort.date);
    if (!bucket) continue;
    const kg = Number(mort.quantityKg) || 0;
    bucket.mortalitiesCount += 1;
    bucket.mortalitiesKg += kg;
    bucket.totalActivityCount += 1;
    bucket.items.push({
      id: `mort-${mort.id}`,
      kind: 'mortality',
      title: `Mortality Loss · ${mort.species || 'Stock'}`,
      subtitle: mort.cause || 'Inventory adjustment',
      amount: 0,
      amountLabel: `-${kg} KG`,
    });
  }

  for (const rec of params.upcomingRecurringPayments || []) {
    const bucket = getOrCreate(rec.dueDate);
    if (!bucket) continue;
    const amt = Number(rec.amountDue) || 0;
    bucket.upcomingDueCount += 1;
    bucket.upcomingDueTotal += amt;
    bucket.totalActivityCount += 1;
    bucket.items.push({
      id: `due-${rec.id}`,
      kind: 'upcoming_due',
      title: `Recurring Due · ${rec.supplierName}`,
      subtitle: `${rec.invoiceNumber} · ${rec.recurrenceFrequency}`,
      amount: amt,
    });
  }

  return map;
}

export function calculateCalendarMonthTotals(
  activityMap: ReadonlyMap<string, CalendarDayAggregate>,
  monthYm: string
): CalendarMonthTotals {
  let activeDays = 0;
  let purchasesTotal = 0;
  let packingsTotalBDT = 0;
  let paymentsTotal = 0;
  let expensesTotal = 0;
  let totalEvents = 0;

  for (const [dateIso, day] of activityMap.entries()) {
    if (!dateIso.startsWith(monthYm)) continue;
    if (day.totalActivityCount > 0) activeDays += 1;
    purchasesTotal += day.purchasesTotal;
    packingsTotalBDT += day.packingsTotalBDT;
    paymentsTotal += day.paymentsTotal;
    expensesTotal += day.expensesTotal;
    totalEvents += day.totalActivityCount;
  }

  return {
    activeDays,
    purchasesTotal: Number(purchasesTotal.toFixed(2)),
    packingsTotalBDT: Number(packingsTotalBDT.toFixed(2)),
    paymentsTotal: Number(paymentsTotal.toFixed(2)),
    expensesTotal: Number(expensesTotal.toFixed(2)),
    totalEvents,
  };
}
